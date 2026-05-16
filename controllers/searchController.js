const sequelize = require('../config/db');

exports.globalSearch = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
    }

    const term = `%${q.trim()}%`;

    const [users, posts, hashtagRows, gyms] = await Promise.all([

      // Users: match username or full_name
      sequelize.query(
        `SELECT id,
                username,
                full_name       AS name,
                profile_pic     AS image,
                is_verified     AS "isVerified"
         FROM   "Users"
         WHERE  username  ILIKE :term
            OR  full_name ILIKE :term
         LIMIT  5`,
        { replacements: { term }, type: sequelize.QueryTypes.SELECT }
      ),

      // Posts (Feeds): match description or any hashtag
      sequelize.query(
        `SELECT f.id,
                f.description                                  AS caption,
                COALESCE(f."imageUrl", f.images[1])            AS "imageUrl",
                f."userId",
                u.username,
                f."createdAt"
         FROM   "Feeds" f
         LEFT JOIN "Users" u ON u.id = f."userId"
         WHERE  f."postType" = 'public'
           AND (
                 f.description ILIKE :term
                 OR EXISTS (
                   SELECT 1
                   FROM   unnest(COALESCE(f.hashtags, '{}')) h
                   WHERE  h ILIKE :term
                 )
               )
         ORDER BY f."createdAt" DESC
         LIMIT  5`,
        { replacements: { term }, type: sequelize.QueryTypes.SELECT }
      ),

      // Hashtags: distinct values matching the query
      sequelize.query(
        `SELECT DISTINCT h AS hashtag
         FROM   "Feeds"
         CROSS JOIN LATERAL unnest(COALESCE(hashtags, '{}')) h
         WHERE  h ILIKE :term
         LIMIT  8`,
        { replacements: { term }, type: sequelize.QueryTypes.SELECT }
      ),

      // Gyms: match name or addressLine1, pull first image from GymImages
      sequelize.query(
        `SELECT g.id,
                g.name,
                g."addressLine1"                              AS address,
                (SELECT gi."imageUrl"
                 FROM   "GymImages" gi
                 WHERE  gi."gymId" = g.id
                 LIMIT  1)                                    AS "imageUrl"
         FROM   "Gyms" g
         WHERE  g.name         ILIKE :term
            OR  g."addressLine1" ILIKE :term
         LIMIT  5`,
        { replacements: { term }, type: sequelize.QueryTypes.SELECT }
      ),
    ]);

    return res.status(200).json({
      success: true,
      results: {
        users: users.map(u => ({ ...u, id: String(u.id) })),
        posts: posts.map(p => ({
          ...p,
          id:     String(p.id),
          userId: p.userId ? String(p.userId) : null,
        })),
        hashtags: hashtagRows.map(r => r.hashtag),
        gyms: gyms.map(g => ({ ...g, id: String(g.id) })),
      },
    });
  } catch (err) {
    console.error('globalSearch error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
