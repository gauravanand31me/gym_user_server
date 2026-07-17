require('dotenv').config();

const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/db');

const User         = require('../models/User');
const Page         = require('../models/Page');
const PagePost     = require('../models/PagePost');
const PageFollower = require('../models/PageFollower');
const Feed         = require('../models/Feed');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const daysAgo  = (n) => new Date(Date.now() - n * 86_400_000);
const hoursAgo = (n) => new Date(Date.now() - n * 3_600_000);

function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

// ─── Seed users ───────────────────────────────────────────────────────────────

const USERS = [
  {
    full_name: 'Rahul Sharma',
    username:  'rahul_lifts',
    email:     'rahul.sharma@yupluck.dev',
    mobile_number: '9819023451',
    bio:       'Powerlifter 🏋️ | Mumbai | 5 years of iron',
    gender:    'Male',
    height:    '178',
    weight:    '82',
    profile_pic: 'https://i.pravatar.cc/300?img=11',
    cover_pic:   'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&h=300&fit=crop',
    is_trainer:  'false',
    register_date: daysAgo(180),
  },
  {
    full_name: 'Priya Nair',
    username:  'priya_trains',
    email:     'priya.nair@yupluck.dev',
    mobile_number: '8956234701',
    bio:       'Certified Personal Trainer 💪 | Nutrition Coach | Delhi',
    gender:    'Female',
    height:    '162',
    weight:    '58',
    profile_pic: 'https://i.pravatar.cc/300?img=5',
    cover_pic:   'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=900&h=300&fit=crop',
    is_trainer:  'true',
    spec:        'Weight Loss, Strength Training',
    register_date: daysAgo(165),
  },
  {
    full_name: 'Amit Gupta',
    username:  'amitgupta_fit',
    email:     'amit.gupta@yupluck.dev',
    mobile_number: '7823456190',
    bio:       'Sports Nutritionist 🥗 | 8+ years | Bangalore',
    gender:    'Male',
    height:    '175',
    weight:    '74',
    profile_pic: 'https://i.pravatar.cc/300?img=15',
    cover_pic:   'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900&h=300&fit=crop',
    is_trainer:  'false',
    register_date: daysAgo(210),
  },
  {
    full_name: 'Anjali Menon',
    username:  'anjali_yoga',
    email:     'anjali.menon@yupluck.dev',
    mobile_number: '9087654321',
    bio:       'Yoga Instructor 🧘 | 200hr RYT | Pune | Mind & body wellness',
    gender:    'Female',
    height:    '158',
    weight:    '52',
    profile_pic: 'https://i.pravatar.cc/300?img=9',
    cover_pic:   'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900&h=300&fit=crop',
    is_trainer:  'true',
    spec:        'Hatha Yoga, Pranayama, Meditation',
    register_date: daysAgo(195),
  },
  {
    full_name: 'Vikram Singh',
    username:  'vikram_warrior',
    email:     'vikram.singh@yupluck.dev',
    mobile_number: '9123456789',
    bio:       'Ex-Army | Athlete | Football & Conditioning Coach | Chennai',
    gender:    'Male',
    height:    '183',
    weight:    '89',
    profile_pic: 'https://i.pravatar.cc/300?img=13',
    cover_pic:   'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=900&h=300&fit=crop',
    is_trainer:  'true',
    spec:        'Athletic Conditioning, Football',
    register_date: daysAgo(220),
  },
  {
    full_name: 'Sneha Reddy',
    username:  'sneha_active',
    email:     'sneha.reddy@yupluck.dev',
    mobile_number: '8712345690',
    bio:       'Fitness enthusiast 🏃‍♀️ | CrossFit | Hyderabad',
    gender:    'Female',
    height:    '165',
    weight:    '60',
    profile_pic: 'https://i.pravatar.cc/300?img=25',
    register_date: daysAgo(90),
  },
  {
    full_name: 'Arjun Mehta',
    username:  'arjun_gains',
    email:     'arjun.mehta@yupluck.dev',
    mobile_number: '9934561230',
    bio:       'Bodybuilding | Bulking season forever 💪 | Ahmedabad',
    gender:    'Male',
    height:    '180',
    weight:    '91',
    profile_pic: 'https://i.pravatar.cc/300?img=33',
    register_date: daysAgo(75),
  },
  {
    full_name: 'Kavitha Iyer',
    username:  'kavitha_wellness',
    email:     'kavitha.iyer@yupluck.dev',
    mobile_number: '8023456712',
    bio:       'Holistic health | Yoga & meditation | Coimbatore',
    gender:    'Female',
    height:    '160',
    weight:    '55',
    profile_pic: 'https://i.pravatar.cc/300?img=47',
    register_date: daysAgo(120),
  },
  {
    full_name: 'Rohan Desai',
    username:  'rohan_runner',
    email:     'rohan.desai@yupluck.dev',
    mobile_number: '9765432108',
    bio:       'Marathon runner 🏅 | 3x finisher | Pune',
    gender:    'Male',
    height:    '174',
    weight:    '68',
    profile_pic: 'https://i.pravatar.cc/300?img=52',
    register_date: daysAgo(100),
  },
  {
    full_name: 'Divya Pillai',
    username:  'divya_flex',
    email:     'divya.pillai@yupluck.dev',
    mobile_number: '9654321078',
    bio:       'Flexibility & mobility coach | Dance fitness | Kochi',
    gender:    'Female',
    height:    '163',
    weight:    '57',
    profile_pic: 'https://i.pravatar.cc/300?img=44',
    register_date: daysAgo(60),
  },
  {
    full_name: 'Suresh Babu',
    username:  'suresh_iron',
    email:     'suresh.babu@yupluck.dev',
    mobile_number: '8901234567',
    bio:       'Gym rat since 2015 🏋️ | Powerlifting | Chennai',
    gender:    'Male',
    height:    '170',
    weight:    '86',
    profile_pic: 'https://i.pravatar.cc/300?img=60',
    register_date: daysAgo(145),
  },
  {
    full_name: 'Neha Joshi',
    username:  'neha_fitlife',
    email:     'neha.joshi@yupluck.dev',
    mobile_number: '7712345609',
    bio:       'Weight loss journey 🌟 | -18kg in 6 months | Jaipur',
    gender:    'Female',
    height:    '161',
    weight:    '64',
    profile_pic: 'https://i.pravatar.cc/300?img=29',
    register_date: daysAgo(55),
  },
];

// ─── Pages ────────────────────────────────────────────────────────────────────

const PAGES_DATA = [
  {
    name:          'Iron Paradise Fitness',
    category:      'Gym',
    description:   'Premium gym in the heart of Andheri, Mumbai. 10,000 sq ft of state-of-the-art equipment, certified trainers, and a community that pushes you to be better every single day.',
    website:       'https://ironparadisefitness.in',
    profile_image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop',
    cover_image:   'https://images.unsplash.com/photo-1581009137042-c552e485697a?w=1200&h=400&fit=crop',
    owner_index:   0, // Rahul Sharma
    posts: [
      {
        content: 'Just installed brand new cable machines and a complete free weights section upgrade! 🏋️ Come check it out this weekend. First month membership at ₹999 only. Tag a friend who needs to join! #ironparadise #gymlife #mumbai #fitness',
        image:   'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop',
        hashtags: ['ironparadise', 'gymlife', 'mumbai', 'fitness'],
        daysAgo: 72,
      },
      {
        content: 'Morning warrior sessions now open from 5:30 AM 🌅 Beat the crowd and start your day stronger than yesterday. Our coaches will be there with you from day one. Book your spot through the Yupluck app — limited to 20 slots per batch.',
        image:   null,
        hashtags: ['earlymorning', 'gymlife', 'fitness', 'mumbai'],
        daysAgo: 51,
      },
      {
        content: "Member transformation of the month 🔥 3 months of consistent training, zero shortcuts, and this is what dedication looks like. This could be you. Walk in, show up, and we'll take care of the rest. DM us to get started today.",
        image:   'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=600&fit=crop',
        hashtags: ['transformation', 'fitness', 'motivation', 'gymlife'],
        daysAgo: 33,
      },
      {
        content: 'Our certified trainers are here to design a personalised program that actually fits your life. No cookie-cutter plans. Personal training packages starting at ₹2,500/month. Limited spots available. DM us or walk in between 6–9 AM.',
        image:   null,
        hashtags: ['personaltraining', 'fitnessmumbai', 'gym'],
        daysAgo: 8,
      },
    ],
  },
  {
    name:          'Coach Priya — Personal Training',
    category:      'Trainer',
    description:   'ISSA certified personal trainer and nutrition coach. Specialising in body recomposition, fat loss, and strength for women. 200+ clients transformed. Based in Delhi, online coaching available nationwide.',
    website:       'https://coachpriya.in',
    profile_image: 'https://i.pravatar.cc/300?img=5',
    cover_image:   'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&h=400&fit=crop',
    owner_index:   1, // Priya Nair
    posts: [
      {
        content: 'Reminder: your body achieves what your mind believes 🧠 Started working with two new clients this week — 8-week transformation begins now. Both have completely different goals, but the same thing in common — they finally decided to start. That decision is everything.',
        image:   null,
        hashtags: ['personaltrainer', 'fitness', 'mindset', 'transformation'],
        daysAgo: 60,
      },
      {
        content: 'Meal prep Sunday 🥗 High protein, moderate carb prep for the week. Grilled chicken, boiled eggs, rajma, brown rice, and a massive greens bowl. Hitting 140g protein daily. What does your meal prep look like? Drop it in the comments 👇',
        image:   'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop',
        hashtags: ['mealprep', 'nutrition', 'highprotein', 'fitfood'],
        daysAgo: 41,
      },
      {
        content: 'Form over ego. Every. Single. Time. 🎯 Saw way too many rounded-back deadlifts at the gym today. One bad rep can set you back 6 weeks. Slow down, load less, feel the muscle. The weight will come when the pattern is solid. Train smart, not just hard.',
        image:   null,
        hashtags: ['training', 'formcheck', 'strengthtraining', 'fitnesstrip'],
        daysAgo: 19,
      },
      {
        content: 'Online coaching now open for July batch 🚀 Personalised training program + nutrition plan + weekly check-ins + 24/7 support. ₹4,500/month. Only 5 spots left. Message me directly or book through the app link.',
        image:   'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&h=600&fit=crop',
        hashtags: ['onlinecoaching', 'personaltrainer', 'fitlife', 'delhi'],
        daysAgo: 5,
      },
    ],
  },
  {
    name:          'NutriBalance India',
    category:      'Nutrition',
    description:   'Evidence-based nutrition coaching by certified sports dieticians. Cutting through the noise so you can eat smarter, perform better, and feel incredible. No fads, just science.',
    website:       'https://nutribalance.in',
    profile_image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop',
    cover_image:   'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&h=400&fit=crop',
    owner_index:   2, // Amit Gupta
    posts: [
      {
        content: 'Protein myth BUSTED 🔬 You do NOT need 200–250g of protein per day unless you\'re a professional bodybuilder in prep. For most active adults, 1.6–2.2g per kg of bodyweight is the evidence-backed sweet spot. More than that is literally just expensive urine. #nutritionscience',
        image:   null,
        hashtags: ['nutrition', 'protein', 'fitnessmyth', 'science'],
        daysAgo: 85,
      },
      {
        content: 'Pre-workout nutrition matters more than your pre-workout supplement 🍚 Have a balanced meal 2–3 hours before training: complex carbs + protein + minimal fat. Skip the completely fasted training if building muscle is your goal — your performance and recovery will thank you.',
        image:   'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=600&fit=crop',
        hashtags: ['preworkout', 'nutrition', 'mealprep', 'fitness'],
        daysAgo: 62,
      },
      {
        content: 'Beginner supplement stack (that actually works) 💊\n\n1. Creatine monohydrate — 3–5g daily\n2. Whey protein — if you\'re not hitting protein targets from food\n3. Vitamin D3 — most Indians are deficient\n\nThat\'s it. Save your money on everything else. The rest is marketing.',
        image:   null,
        hashtags: ['supplements', 'creatine', 'nutrition', 'fitness'],
        daysAgo: 44,
      },
      {
        content: 'Hydration morning hack 💧 Drink 500–750ml of water first thing in the morning before coffee, chai, or anything else. Your body has been fasting for 7–8 hours. Rehydrate first. Better digestion, better focus, and you\'ll naturally eat less at breakfast.',
        image:   null,
        hashtags: ['hydration', 'morningroutine', 'healthtips', 'wellness'],
        daysAgo: 21,
      },
      {
        content: 'Indian diet for fat loss doesn\'t have to be boring 🌾 Dal, sabzi, roti, curd — a traditional Indian plate is already high fibre, moderate protein, and fills you up. The problem isn\'t the food. It\'s the portion, the frequency, and the liquid calories (juice, chai with sugar). Simple fixes go a long way.',
        image:   'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop',
        hashtags: ['indiandiet', 'fatloss', 'nutrition', 'eatwell'],
        daysAgo: 7,
      },
    ],
  },
  {
    name:          'ZenFlow Yoga Studio',
    category:      'Health',
    description:   'A calm space to move, breathe, and reconnect. Hatha, Vinyasa, and Yin yoga classes in Koregaon Park, Pune. New batches every month. Beginners always welcome.',
    website:       'https://zenflowstudio.in',
    profile_image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=400&fit=crop',
    cover_image:   'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&h=400&fit=crop',
    owner_index:   3, // Anjali Menon
    posts: [
      {
        content: 'Sunday morning flow with 34 students today — the energy in the room was something else 🙏 Grateful for every single person who rolled out their mat and showed up. The practice doesn\'t get easier, you get better. See you all again Tuesday. #zenflow #yoga #pune',
        image:   'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=600&fit=crop',
        hashtags: ['yoga', 'zenflow', 'pune', 'community'],
        daysAgo: 78,
      },
      {
        content: 'Yoga is not about touching your toes — it\'s about what you learn on the way down 🌿 New beginner batch starting Monday, July 21. All levels, all body types, all welcome. Flexible payment options available. Book your spot through the Yupluck app.',
        image:   null,
        hashtags: ['yoga', 'beginners', 'wellness', 'pune'],
        daysAgo: 47,
      },
      {
        content: 'Breathwork & Pranayama Workshop 🌬️\nDate: Saturday, July 26\nTime: 8 AM – 10:30 AM\nVenue: ZenFlow Studio, Koregaon Park\n\nLearn: Nadi Shodhana, Kapalabhati, Bhramari for stress relief, anxiety management, and deep sleep. Only 16 spots. Book now. 🔗 Link in bio.',
        image:   'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=600&fit=crop',
        hashtags: ['pranayama', 'breathwork', 'yoga', 'workshop'],
        daysAgo: 12,
      },
    ],
  },
  {
    name:          'Warriors Athletic Club',
    category:      'Sports',
    description:   'Developing well-rounded athletes in Chennai since 2018. Football, basketball, and sport-specific strength & conditioning. Our alumni play at state and national level.',
    website:       'https://warriorsac.in',
    profile_image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=400&fit=crop',
    cover_image:   'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1200&h=400&fit=crop',
    owner_index:   4, // Vikram Singh
    posts: [
      {
        content: 'Football trials — Open call 🏆\nDate: Saturday, July 19\nTime: 6:00 AM sharp\nVenue: DY Patil Stadium, Chennai\n\nAll skill levels welcome. U-17, U-19, and open age categories. Bring your cleats, your hunger, and your passport-size photo. We scout for potential, not only polish.',
        image:   'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&h=600&fit=crop',
        hashtags: ['football', 'trials', 'sports', 'chennai'],
        daysAgo: 68,
      },
      {
        content: 'DISTRICT CHAMPIONS 🏆🥇 Congratulations to our Under-19 team for winning the Tamil Nadu District Football Championship! 3 years of relentless training, dozens of early mornings, and zero shortcuts. Every single player on that squad deserves this. Proud beyond words. 🔴⚫',
        image:   'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&h=600&fit=crop',
        hashtags: ['champions', 'football', 'winners', 'warriors'],
        daysAgo: 45,
      },
      {
        content: 'Athlete Strength & Conditioning Program 💥\n8-week intensive: speed, agility, power, and sport-specific conditioning. Not a generic gym program — designed for athletes who compete.\n\n📍 Warriors Ground, Chennai\n📅 Starting August 4\n👥 Max 20 athletes\n💰 ₹6,000 for the full program\n\nRegister via the Yupluck app. Last batch filled in 3 days.',
        image:   null,
        hashtags: ['strengthandconditioning', 'athlete', 'sports', 'training'],
        daysAgo: 28,
      },
      {
        content: 'Recovery is training 🧊 Ice baths, foam rolling, stretching, nutrition, and — most importantly — sleep. Your body doesn\'t grow during the workout. It grows when you rest and recover properly. Skipping recovery is like taking two steps forward and one step back. Don\'t do it. #athletelife',
        image:   null,
        hashtags: ['recovery', 'athlete', 'sportscience', 'training'],
        daysAgo: 10,
      },
    ],
  },
];

// ─── Follow map: which user indices follow which page indices ─────────────────
// (page owners automatically follow their own page implicitly — we skip that)

const FOLLOWS = [
  { user: 5,  pages: [0, 2, 4] },
  { user: 6,  pages: [0, 1, 3] },
  { user: 7,  pages: [1, 3, 4] },
  { user: 8,  pages: [2, 4]    },
  { user: 9,  pages: [0, 1, 2] },
  { user: 10, pages: [0, 3, 4] },
  { user: 11, pages: [1, 2, 3] },
  // owners also follow each other's pages
  { user: 0,  pages: [1, 3]    },
  { user: 1,  pages: [0, 2]    },
  { user: 2,  pages: [3, 4]    },
  { user: 3,  pages: [0, 2]    },
  { user: 4,  pages: [0, 1]    },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected\n');

    // ── 1. Clean up existing seed records ──────────────────────────────────────
    console.log('🧹 Cleaning previous seed data...');
    const emails    = USERS.map(u => u.email);
    const mobiles   = USERS.map(u => u.mobile_number);
    const usernames = USERS.map(u => u.username);

    const existingUsers = await User.findAll({
      where: { [Op.or]: [{ email: { [Op.in]: emails } }, { mobile_number: { [Op.in]: mobiles } }, { username: { [Op.in]: usernames } }] },
      attributes: ['id'],
    });
    const existingIds = existingUsers.map(u => u.id);

    if (existingIds.length) {
      await Feed.destroy({ where: { userId: { [Op.in]: existingIds } } });
    }

    const pageSlugs = PAGES_DATA.map(p => toSlug(p.name));
    const existingPages = await Page.findAll({ where: { slug: { [Op.in]: pageSlugs } }, attributes: ['id'] });
    const existingPageIds = existingPages.map(p => p.id);

    if (existingPageIds.length) {
      await PagePost.destroy({ where: { page_id: { [Op.in]: existingPageIds } } });
      await PageFollower.destroy({ where: { page_id: { [Op.in]: existingPageIds } } });
      await Page.destroy({ where: { id: { [Op.in]: existingPageIds } } });
    }

    if (existingIds.length) {
      await User.destroy({ where: { id: { [Op.in]: existingIds } } });
    }

    console.log('✅ Clean done\n');

    // ── 2. Create users ────────────────────────────────────────────────────────
    console.log('👥 Creating users...');
    const createdUsers = [];
    for (const u of USERS) {
      const user = await User.create({
        username:      u.username,
        email:         u.email,
        mobile_number: u.mobile_number,
        password:      'Yupluck@2024',
        full_name:     u.full_name,
        bio:           u.bio       || null,
        gender:        u.gender    || null,
        height:        u.height    || null,
        weight:        u.weight    || null,
        profile_pic:   u.profile_pic || null,
        cover_pic:     u.cover_pic   || null,
        is_trainer:    u.is_trainer  || 'false',
        spec:          u.spec        || null,
        is_verified:   true,
        otp:           123456,
        status:        0,
        country:       'IN',
        register_date: u.register_date,
        last_active:   daysAgo(Math.floor(Math.random() * 3)),
      });
      createdUsers.push(user);
      console.log(`   ✔ ${user.full_name} (${user.username})`);
    }
    console.log();

    // ── 3. Create pages ────────────────────────────────────────────────────────
    console.log('📄 Creating pages...');
    const createdPages = [];
    for (const pd of PAGES_DATA) {
      const owner = createdUsers[pd.owner_index];
      const page  = await Page.create({
        name:          pd.name,
        slug:          toSlug(pd.name),
        category:      pd.category,
        description:   pd.description,
        website:       pd.website,
        profile_image: pd.profile_image,
        cover_image:   pd.cover_image,
        owner_id:      owner.id,
        follower_count: 0,
        post_count:     0,
      });
      createdPages.push(page);
      console.log(`   ✔ ${page.name} (${page.category}) — owned by ${owner.full_name}`);
    }
    console.log();

    // ── 4. Create posts + Feed entries ────────────────────────────────────────
    console.log('📝 Creating posts...');
    for (let pi = 0; pi < PAGES_DATA.length; pi++) {
      const pd    = PAGES_DATA[pi];
      const page  = createdPages[pi];
      const owner = createdUsers[pd.owner_index];

      for (const postData of pd.posts) {
        const ts       = daysAgo(postData.daysAgo);
        const images   = postData.image ? [postData.image] : [];

        const post = await PagePost.create({
          page_id:   page.id,
          author_id: owner.id,
          content:   postData.content,
          image_url: images[0] || null,
          images,
          hashtags:  postData.hashtags || [],
          mentions:  [],
          created_at: ts,
        });

        await Feed.create({
          id:           uuidv4(),
          userId:       owner.id,
          activityType: 'page_post',
          title:        page.name,
          description:  post.content,
          imageUrl:     images[0] || null,
          images,
          pageId:       page.id,
          postType:     'public',
          hashtags:     postData.hashtags || [],
          timestamp:    ts,
        });

        console.log(`   ✔ [${page.name}] "${postData.content.substring(0, 55)}..."`);
      }

      await page.update({ post_count: pd.posts.length });
    }
    console.log();

    // ── 5. Create follows ──────────────────────────────────────────────────────
    console.log('➕ Creating follows...');
    const followerCountMap = {};

    for (const follow of FOLLOWS) {
      const user = createdUsers[follow.user];
      for (const pageIdx of follow.pages) {
        const page = createdPages[pageIdx];
        await PageFollower.findOrCreate({
          where:    { page_id: page.id, user_id: user.id },
          defaults: { joined_at: daysAgo(Math.floor(Math.random() * 60) + 5) },
        });
        followerCountMap[page.id] = (followerCountMap[page.id] || 0) + 1;
        console.log(`   ✔ ${user.full_name} → ${page.name}`);
      }
    }

    for (const [pageId, count] of Object.entries(followerCountMap)) {
      await Page.update({ follower_count: count }, { where: { id: pageId } });
    }
    console.log();

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ SEED COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   Users   : ${createdUsers.length}`);
    console.log(`   Pages   : ${createdPages.length}`);
    const totalPosts = PAGES_DATA.reduce((s, p) => s + p.posts.length, 0);
    console.log(`   Posts   : ${totalPosts}`);
    console.log(`   Follows : ${FOLLOWS.reduce((s, f) => s + f.pages.length, 0)}`);
    console.log('───────────────────────────────────────────────────');
    console.log('   Password for all seed users: Yupluck@2024');
    console.log('   OTP for all seed users     : 123456');
    console.log('───────────────────────────────────────────────────');
    createdUsers.forEach(u => {
      console.log(`   📱 ${u.mobile_number.padEnd(15)} ${u.full_name}`);
    });
    console.log('═══════════════════════════════════════════════════');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    if (err.errors) err.errors.forEach(e => console.error('   -', e.message));
    console.error(err);
    process.exit(1);
  }
};

seed();
