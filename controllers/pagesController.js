const { Op } = require('sequelize');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../s3Client');
const axios = require('axios');

const Page         = require('../models/Page');
const PageFollower = require('../models/PageFollower');
const PagePost     = require('../models/PagePost');
const User         = require('../models/User');
const Feed         = require('../models/Feed');
const PushNotification = require('../models/PushNotification');

const CLOUDFRONT = process.env.CLOUDFRONT_URL;

// ── Slug helpers ──────────────────────────────────────────────────────────────

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function uniqueSlug(name, excludeId = null) {
  const base = toSlug(name);
  let slug = base;
  let counter = 2;
  while (true) {
    const where = { slug };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    const exists = await Page.findOne({ where });
    if (!exists) return slug;
    slug = `${base}-${counter++}`;
  }
}

// ── S3 upload helper ──────────────────────────────────────────────────────────

async function uploadToS3(buffer, key, mimetype) {
  await s3Client.send(new PutObjectCommand({
    Bucket:      process.env.AWS_S3_BUCKET_NAME,
    Key:         key,
    Body:        buffer,
    ContentType: mimetype || 'image/jpeg',
  }));
  return `https://${CLOUDFRONT}/${key}`;
}

// ── Page response shape ───────────────────────────────────────────────────────

async function formatPage(page, userId) {
  const owner = await User.findByPk(page.owner_id, {
    attributes: ['id', 'full_name', 'profile_pic'],
  });

  let isJoined = false;
  if (userId) {
    const follow = await PageFollower.findOne({
      where: { page_id: page.id, user_id: userId },
    });
    isJoined = !!follow;
  }

  return {
    id:           page.id,
    name:         page.name,
    slug:         page.slug,
    category:     page.category,
    description:  page.description,
    website:      page.website,
    profileImage: page.profile_image,
    coverImage:   page.cover_image,
    followerCount: page.follower_count,
    postCount:    page.post_count,
    isJoined,
    isOwner:      userId ? page.owner_id === userId : false,
    owner: owner ? {
      id:         owner.id,
      name:       owner.full_name,
      profilePic: owner.profile_pic,
    } : null,
    createdAt: page.created_at,
  };
}

// ── Batch push notification ───────────────────────────────────────────────────

async function notifyFollowers(page, post) {
  const followers = await PageFollower.findAll({ where: { page_id: page.id } });
  if (!followers.length) return;

  const userIds = followers.map(f => f.user_id);
  const tokens  = await PushNotification.findAll({
    where: { userId: { [Op.in]: userIds } },
    attributes: ['expoPushToken'],
  });

  const validTokens = tokens
    .map(t => t.expoPushToken)
    .filter(t => t && t.startsWith('ExponentPushToken'));

  if (!validTokens.length) return;

  const body = post.content
    ? post.content.substring(0, 80)
    : 'New post with photo';

  // Expo allows up to 100 messages per batch request
  const BATCH = 100;
  for (let i = 0; i < validTokens.length; i += BATCH) {
    const batch = validTokens.slice(i, i + BATCH).map(token => ({
      to:    token,
      sound: 'default',
      title: page.name,
      body,
      data:  { type: 'PAGE_POST', pageId: page.id, postId: post.id },
    }));

    axios.post('https://exp.host/--/api/v2/push/send', batch, {
      headers: { 'Content-Type': 'application/json' },
    }).catch(err => console.error('Push batch error:', err.message));
  }
}

// ── GET /pages ────────────────────────────────────────────────────────────────

exports.listPages = async (req, res) => {
  try {
    const userId   = req.user.id;
    const limit    = Math.min(parseInt(req.query.limit)  || 20, 50);
    const offset   = parseInt(req.query.offset) || 0;
    const search   = req.query.search?.trim()   || '';
    const category = req.query.category?.trim() || '';

    const where = {};
    if (category) where.category = category;
    if (search)   where.name = { [Op.iLike]: `%${search}%` };

    const rows = await Page.findAll({ where, limit, offset, order: [['follower_count', 'DESC']] });
    const pages = await Promise.all(rows.map(p => formatPage(p, userId)));

    return res.json({ pages });
  } catch (err) {
    console.error('listPages error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ── GET /pages/my ─────────────────────────────────────────────────────────────

exports.myPages = async (req, res) => {
  try {
    const userId = req.user.id;

    const followed = await PageFollower.findAll({
      where: { user_id: userId },
      attributes: ['page_id'],
    });
    const followedIds = followed.map(f => f.page_id);

    const rows = await Page.findAll({
      where: {
        [Op.or]: [
          { owner_id: userId },
          ...(followedIds.length ? [{ id: { [Op.in]: followedIds } }] : []),
        ],
      },
      order: [['created_at', 'DESC']],
    });

    const pages = await Promise.all(rows.map(p => formatPage(p, userId)));
    return res.json({ pages });
  } catch (err) {
    console.error('myPages error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ── GET /pages/:id ────────────────────────────────────────────────────────────

exports.getPage = async (req, res) => {
  try {
    const userId = req.user.id;
    const page   = await Page.findByPk(req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found' });

    return res.json({ page: await formatPage(page, userId) });
  } catch (err) {
    console.error('getPage error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ── POST /pages ───────────────────────────────────────────────────────────────

exports.createPage = async (req, res) => {
  try {
    const userId      = req.user.id;
    const { name, category, description, website } = req.body;

    if (!name || !category) {
      return res.status(400).json({ message: 'name and category are required' });
    }

    const VALID_CATEGORIES = ['Gym', 'Trainer', 'Blog', 'Nutrition', 'Community', 'Fitness Brand', 'Sports', 'Health'];
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const slug = await uniqueSlug(name);
    const ts   = Date.now();

    // Create page first to get id
    const page = await Page.create({
      name, slug, category,
      description: description || null,
      website:     website     || null,
      owner_id:    userId,
    });

    // Upload images if provided
    let profileImage = null;
    let coverImage   = null;

    if (req.files?.profileImage?.[0]) {
      const f = req.files.profileImage[0];
      profileImage = await uploadToS3(f.buffer, `pages/${page.id}/avatar_${ts}.jpg`, f.mimetype);
    }
    if (req.files?.coverImage?.[0]) {
      const f = req.files.coverImage[0];
      coverImage = await uploadToS3(f.buffer, `pages/${page.id}/cover_${ts}.jpg`, f.mimetype);
    }

    if (profileImage || coverImage) {
      await page.update({ profile_image: profileImage, cover_image: coverImage });
    }

    return res.status(201).json({ page: await formatPage(page, userId) });
  } catch (err) {
    console.error('createPage error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ── PUT /pages/:id ────────────────────────────────────────────────────────────

exports.updatePage = async (req, res) => {
  try {
    const userId = req.user.id;
    const page   = await Page.findByPk(req.params.id);
    if (!page)                    return res.status(404).json({ message: 'Page not found' });
    if (page.owner_id !== userId) return res.status(403).json({ message: 'Not authorised' });

    const { name, category, description, website } = req.body;
    const updates = {};

    if (name && name !== page.name) {
      updates.name = name;
      updates.slug = await uniqueSlug(name, page.id);
    }
    if (category)    updates.category    = category;
    if (description !== undefined) updates.description = description;
    if (website     !== undefined) updates.website     = website;

    const ts = Date.now();
    if (req.files?.profileImage?.[0]) {
      const f = req.files.profileImage[0];
      updates.profile_image = await uploadToS3(f.buffer, `pages/${page.id}/avatar_${ts}.jpg`, f.mimetype);
    }
    if (req.files?.coverImage?.[0]) {
      const f = req.files.coverImage[0];
      updates.cover_image = await uploadToS3(f.buffer, `pages/${page.id}/cover_${ts}.jpg`, f.mimetype);
    }

    await page.update(updates);
    return res.json({ page: await formatPage(page, userId) });
  } catch (err) {
    console.error('updatePage error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ── DELETE /pages/:id ─────────────────────────────────────────────────────────

exports.deletePage = async (req, res) => {
  try {
    const userId = req.user.id;
    const page   = await Page.findByPk(req.params.id);
    if (!page)                    return res.status(404).json({ message: 'Page not found' });
    if (page.owner_id !== userId) return res.status(403).json({ message: 'Not authorised' });

    await page.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error('deletePage error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ── POST /pages/:id/join ──────────────────────────────────────────────────────

exports.joinPage = async (req, res) => {
  try {
    const userId = req.user.id;
    const page   = await Page.findByPk(req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found' });

    const [, created] = await PageFollower.findOrCreate({
      where: { page_id: page.id, user_id: userId },
    });

    if (created) {
      await page.increment('follower_count');
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('joinPage error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ── DELETE /pages/:id/leave ───────────────────────────────────────────────────

exports.leavePage = async (req, res) => {
  try {
    const userId = req.user.id;
    const page   = await Page.findByPk(req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found' });

    const deleted = await PageFollower.destroy({
      where: { page_id: page.id, user_id: userId },
    });

    if (deleted) {
      await page.decrement('follower_count');
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('leavePage error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ── GET /pages/:id/posts ──────────────────────────────────────────────────────

exports.listPosts = async (req, res) => {
  try {
    const page = await Page.findByPk(req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found' });

    const limit  = Math.min(parseInt(req.query.limit)  || 20, 50);
    const offset = parseInt(req.query.offset) || 0;

    const rows = await PagePost.findAll({
      where:  { page_id: page.id },
      order:  [['created_at', 'DESC']],
      limit,
      offset,
    });

    const requestUserId = req.user.id;
    const isAdmin = requestUserId === process.env.ADMIN_UUID;

    const posts = await Promise.all(rows.map(async post => {
      const author = await User.findByPk(post.author_id, {
        attributes: ['id', 'full_name', 'profile_pic'],
      });
      return {
        id:           post.id,
        content:      post.content,
        images:       post.images || (post.image_url ? [post.image_url] : []),
        link:         post.link   || null,
        hashtags:     post.hashtags || [],
        mentions:     post.mentions || [],
        likeCount:    post.like_count,
        commentCount: post.comment_count,
        createdAt:    post.created_at,
        canDelete:    post.author_id === requestUserId || page.owner_id === requestUserId || isAdmin,
        author: author ? {
          id:         author.id,
          name:       author.full_name,
          profilePic: author.profile_pic,
        } : null,
      };
    }));

    return res.json({ posts });
  } catch (err) {
    console.error('listPosts error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ── POST /pages/:id/posts ─────────────────────────────────────────────────────

exports.createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = userId === process.env.ADMIN_UUID;
    const page   = await Page.findByPk(req.params.id);
    if (!page) return res.status(404).json({ message: 'Page not found' });
    if (page.owner_id !== userId && !isAdmin) return res.status(403).json({ message: 'Only the page owner can post' });

    const { content, link } = req.body;
    const files = req.files || [];

    if (!content && files.length === 0) {
      return res.status(400).json({ message: 'Post must have content or at least one image' });
    }

    // Parse hashtags: "gym,fitness" → ["gym", "fitness"]
    let hashtags = [];
    if (req.body.hashtags) {
      hashtags = req.body.hashtags.split(',').map(t => t.trim()).filter(Boolean);
    }

    // Parse mentions: JSON string → array
    let mentions = [];
    if (req.body.mentions) {
      try { mentions = JSON.parse(req.body.mentions); } catch (_) {}
    }

    const post = await PagePost.create({
      page_id:   page.id,
      author_id: userId,
      content:   content || null,
      link:      link    || null,
      hashtags,
      mentions,
    });

    // Upload up to 10 images in parallel
    let images = [];
    if (files.length > 0) {
      const ts = Date.now();
      images = await Promise.all(
        files.slice(0, 10).map((f, i) =>
          uploadToS3(f.buffer, `pages/${page.id}/posts/${post.id}_${ts}_${i}.jpg`, f.mimetype)
        )
      );
      await post.update({ images, image_url: images[0] });
    }

    await page.increment('post_count');

    await Feed.create({
      userId:       userId,
      activityType: 'page_post',
      title:        page.name,
      description:  post.content  || null,
      imageUrl:     images[0]     || null,
      images:       images,
      pageId:       page.id,
      postType:     'public',
      timestamp:    new Date(),
    });

    notifyFollowers(page, post).catch(err => console.error('notifyFollowers error:', err));

    const author = await User.findByPk(userId, { attributes: ['id', 'full_name', 'profile_pic'] });

    return res.status(201).json({
      success: true,
      post: {
        id:           post.id,
        content:      post.content,
        images:       post.images || [],
        link:         post.link,
        hashtags:     post.hashtags || [],
        mentions:     post.mentions || [],
        likeCount:    post.like_count,
        commentCount: post.comment_count,
        createdAt:    post.created_at,
        canDelete:    true,
        author: {
          id:         author.id,
          name:       author.full_name,
          profilePic: author.profile_pic,
        },
      },
    });
  } catch (err) {
    console.error('createPost error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ── DELETE /pages/:pageId/posts/:postId ───────────────────────────────────────

exports.deletePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = userId === process.env.ADMIN_UUID;
    const page = await Page.findByPk(req.params.id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });

    const post = await PagePost.findOne({
      where: { id: req.params.postId, page_id: page.id },
    });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });

    const canDelete = post.author_id === userId || page.owner_id === userId || isAdmin;
    if (!canDelete) return res.status(403).json({ success: false, message: 'Not authorised' });

    await post.destroy();
    await page.decrement('post_count');

    return res.json({ success: true });
  } catch (err) {
    console.error('deletePost error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
