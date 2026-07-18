require('dotenv').config();

const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/db');

const User          = require('../models/User');
const Page          = require('../models/Page');
const PagePost      = require('../models/PagePost');
const PageFollower  = require('../models/PageFollower');
const Feed          = require('../models/Feed');
const Follow        = require('../models/Follow');
const FriendRequest = require('../models/FriendRequest');
const Reel          = require('../models/Reel');
const Category      = require('../models/Category');
const PostReaction  = require('../models/PostReaction');
const PostComment   = require('../models/PostComment');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const daysAgo  = (n) => new Date(Date.now() - n * 86_400_000);
const hoursAgo = (n) => new Date(Date.now() - n * 3_600_000);
const rand     = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick     = (arr) => arr[Math.floor(Math.random() * arr.length)];
const toSlug   = (s) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');

// ─── USERS (20) ───────────────────────────────────────────────────────────────

const USERS = [
  // ── Fitness Influencers ──
  {
    full_name: 'Karan Oberoi',       username: 'karan_shredded',   mobile_number: '9819023451',
    email: 'karan.oberoi@yupluck.dev',
    bio: 'Natural bodybuilder 💪 | 8 years of lifting | Mumbai | 100k journey',
    gender: 'Male', height: '180', weight: '85', is_trainer: 'false',
    profile_pic: 'https://i.pravatar.cc/300?img=11',
    cover_pic: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=900&h=300&fit=crop',
    total_work_out_time: 2400, followers_count: 1840, following_count: 312, register_date: daysAgo(280),
  },
  {
    full_name: 'Ritika Kapoor',      username: 'ritika_yoga_life', mobile_number: '8956234701',
    email: 'ritika.kapoor@yupluck.dev',
    bio: '🧘 Yoga & mindfulness | RYT-500 | Delhi | Living in flow',
    gender: 'Female', height: '163', weight: '57', is_trainer: 'true', spec: 'Hatha, Vinyasa',
    profile_pic: 'https://i.pravatar.cc/300?img=5',
    cover_pic: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900&h=300&fit=crop',
    total_work_out_time: 3100, followers_count: 2240, following_count: 198, register_date: daysAgo(310),
  },
  {
    full_name: 'Dev Malhotra',       username: 'dev_lifts_heavy',  mobile_number: '7823456190',
    email: 'dev.malhotra@yupluck.dev',
    bio: 'Powerlifter | 200kg squat | Bangalore | Strength > aesthetics',
    gender: 'Male', height: '177', weight: '96', is_trainer: 'false',
    profile_pic: 'https://i.pravatar.cc/300?img=15',
    cover_pic: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=900&h=300&fit=crop',
    total_work_out_time: 3800, followers_count: 1650, following_count: 274, register_date: daysAgo(350),
  },
  {
    full_name: 'Pooja Menon',        username: 'pooja_eats_clean',  mobile_number: '9087654321',
    email: 'pooja.menon@yupluck.dev',
    bio: 'Macro coach 🥗 | Lost 22kg in 14 months | Hyderabad | Helping you do the same',
    gender: 'Female', height: '161', weight: '59', is_trainer: 'true', spec: 'Fat Loss, Macros',
    profile_pic: 'https://i.pravatar.cc/300?img=9',
    cover_pic: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900&h=300&fit=crop',
    total_work_out_time: 2900, followers_count: 1980, following_count: 441, register_date: daysAgo(290),
  },
  {
    full_name: 'Zaid Ansari',        username: 'zaid_athlete',      mobile_number: '9123456789',
    email: 'zaid.ansari@yupluck.dev',
    bio: 'Track & field | 100m in 10.8s | Chennai | Train like an athlete, look like one',
    gender: 'Male', height: '183', weight: '78', is_trainer: 'true', spec: 'Athletic Performance, Speed',
    profile_pic: 'https://i.pravatar.cc/300?img=13',
    cover_pic: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=900&h=300&fit=crop',
    total_work_out_time: 4200, followers_count: 2100, following_count: 389, register_date: daysAgo(400),
  },
  // ── Page Owners ──
  {
    full_name: 'Rahul Sharma',       username: 'rahul_lifts',       mobile_number: '8712345690',
    email: 'rahul.sharma@yupluck.dev',
    bio: 'Gym owner | IronHouse Fitness | Mumbai | Building a community ❤️',
    gender: 'Male', height: '178', weight: '82', is_trainer: 'false',
    profile_pic: 'https://i.pravatar.cc/300?img=33',
    total_work_out_time: 1800, followers_count: 620, following_count: 285, register_date: daysAgo(220),
  },
  {
    full_name: 'Priya Nair',         username: 'priya_trains',      mobile_number: '9934561230',
    email: 'priya.nair@yupluck.dev',
    bio: 'Certified Personal Trainer 💪 | Nutrition Coach | Delhi',
    gender: 'Female', height: '162', weight: '58', is_trainer: 'true', spec: 'Weight Loss, Strength',
    profile_pic: 'https://i.pravatar.cc/300?img=47',
    total_work_out_time: 2100, followers_count: 880, following_count: 310, register_date: daysAgo(200),
  },
  {
    full_name: 'Amit Gupta',         username: 'amitgupta_fit',     mobile_number: '8023456712',
    email: 'amit.gupta@yupluck.dev',
    bio: 'Sports Nutritionist 🥗 | 8+ years | Bangalore',
    gender: 'Male', height: '175', weight: '74', is_trainer: 'false',
    profile_pic: 'https://i.pravatar.cc/300?img=52',
    total_work_out_time: 1500, followers_count: 540, following_count: 221, register_date: daysAgo(250),
  },
  {
    full_name: 'Anjali Menon',       username: 'anjali_yoga',       mobile_number: '9765432108',
    email: 'anjali.menon@yupluck.dev',
    bio: 'Yoga Instructor 🧘 | 200hr RYT | Pune | Mind & body wellness',
    gender: 'Female', height: '158', weight: '52', is_trainer: 'true', spec: 'Hatha Yoga, Meditation',
    profile_pic: 'https://i.pravatar.cc/300?img=44',
    total_work_out_time: 1900, followers_count: 710, following_count: 198, register_date: daysAgo(180),
  },
  {
    full_name: 'Vikram Singh',       username: 'vikram_warrior',    mobile_number: '9654321078',
    email: 'vikram.singh@yupluck.dev',
    bio: 'Ex-Army | Athlete | Football & Conditioning Coach | Chennai',
    gender: 'Male', height: '183', weight: '89', is_trainer: 'true', spec: 'Athletic Conditioning',
    profile_pic: 'https://i.pravatar.cc/300?img=60',
    total_work_out_time: 3200, followers_count: 930, following_count: 167, register_date: daysAgo(260),
  },
  // ── Regular Users ──
  {
    full_name: 'Sneha Reddy',        username: 'sneha_active',      mobile_number: '8901234567',
    email: 'sneha.reddy@yupluck.dev',
    bio: 'CrossFit ❤️ | Hyderabad | Chasing PRs',
    gender: 'Female', height: '165', weight: '60',
    profile_pic: 'https://i.pravatar.cc/300?img=25',
    total_work_out_time: 980, followers_count: 120, following_count: 88, register_date: daysAgo(95),
  },
  {
    full_name: 'Arjun Mehta',        username: 'arjun_gains',       mobile_number: '7712345609',
    email: 'arjun.mehta@yupluck.dev',
    bio: 'Bulking season 365 days 💪 | Ahmedabad',
    gender: 'Male', height: '180', weight: '91',
    profile_pic: 'https://i.pravatar.cc/300?img=29',
    total_work_out_time: 740, followers_count: 88, following_count: 145, register_date: daysAgo(80),
  },
  {
    full_name: 'Kavitha Iyer',       username: 'kavitha_wellness',  mobile_number: '9812345601',
    email: 'kavitha.iyer@yupluck.dev',
    bio: 'Yoga & meditation | Coimbatore | Slow living',
    gender: 'Female', height: '160', weight: '55',
    profile_pic: 'https://i.pravatar.cc/300?img=39',
    total_work_out_time: 610, followers_count: 72, following_count: 94, register_date: daysAgo(130),
  },
  {
    full_name: 'Rohan Desai',        username: 'rohan_runner',      mobile_number: '9712345602',
    email: 'rohan.desai@yupluck.dev',
    bio: 'Marathon runner 🏅 | 3x finisher | Pune',
    gender: 'Male', height: '174', weight: '68',
    profile_pic: 'https://i.pravatar.cc/300?img=53',
    total_work_out_time: 1200, followers_count: 195, following_count: 112, register_date: daysAgo(110),
  },
  {
    full_name: 'Divya Pillai',       username: 'divya_flex',        mobile_number: '9612345603',
    email: 'divya.pillai@yupluck.dev',
    bio: 'Flexibility & dance fitness | Kochi',
    gender: 'Female', height: '163', weight: '57',
    profile_pic: 'https://i.pravatar.cc/300?img=41',
    total_work_out_time: 540, followers_count: 66, following_count: 130, register_date: daysAgo(65),
  },
  {
    full_name: 'Suresh Babu',        username: 'suresh_iron',       mobile_number: '9512345604',
    email: 'suresh.babu@yupluck.dev',
    bio: 'Gym rat since 2015 🏋️ | Powerlifting | Chennai',
    gender: 'Male', height: '170', weight: '86',
    profile_pic: 'https://i.pravatar.cc/300?img=57',
    total_work_out_time: 1650, followers_count: 210, following_count: 179, register_date: daysAgo(155),
  },
  {
    full_name: 'Neha Joshi',         username: 'neha_fitlife',      mobile_number: '9412345605',
    email: 'neha.joshi@yupluck.dev',
    bio: 'Weight loss journey 🌟 | -18kg in 6 months | Jaipur',
    gender: 'Female', height: '161', weight: '64',
    profile_pic: 'https://i.pravatar.cc/300?img=23',
    total_work_out_time: 420, followers_count: 58, following_count: 201, register_date: daysAgo(55),
  },
  {
    full_name: 'Manish Tiwari',      username: 'manish_cut',        mobile_number: '9312345606',
    email: 'manish.tiwari@yupluck.dev',
    bio: 'Cutting to 8% bf | Lucknow | No shortcuts',
    gender: 'Male', height: '173', weight: '79',
    profile_pic: 'https://i.pravatar.cc/300?img=64',
    total_work_out_time: 890, followers_count: 103, following_count: 156, register_date: daysAgo(72),
  },
  {
    full_name: 'Ananya Bhatt',       username: 'ananya_sweat',      mobile_number: '9212345607',
    email: 'ananya.bhatt@yupluck.dev',
    bio: 'HIIT | Zumba | Ahmedabad | Sweat is my morning dew ✨',
    gender: 'Female', height: '164', weight: '62',
    profile_pic: 'https://i.pravatar.cc/300?img=36',
    total_work_out_time: 680, followers_count: 91, following_count: 118, register_date: daysAgo(88),
  },
  {
    full_name: 'Prashant Kulkarni',  username: 'prashant_strong',   mobile_number: '9112345608',
    email: 'prashant.kulkarni@yupluck.dev',
    bio: 'Strongman competitor 🏆 | Pune | 140kg farmer carry PR',
    gender: 'Male', height: '185', weight: '105',
    profile_pic: 'https://i.pravatar.cc/300?img=68',
    total_work_out_time: 2100, followers_count: 318, following_count: 88, register_date: daysAgo(142),
  },
];

// ─── GYMS (8 cities) ──────────────────────────────────────────────────────────

const GYMS = [
  {
    id: uuidv4(), name: 'IronHouse Fitness', city: 'Mumbai', state: 'Maharashtra',
    addressLine1: 'Shop 12, Andheri West',  addressLine2: 'Near Lokhandwala Market',
    pinCode: '400053', latitude: 19.1136,   longitude: 72.8697,
    description: 'Premium fitness facility with 12,000 sq ft of equipment, Olympic lifting platform, and a passionate coaching team. Open 5 AM–11 PM daily.',
    rating: 4.6, total_rating: 280,
    images: [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1581009137042-c552e485697a?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=500&fit=crop',
    ],
    equipment: ['Dumbbells', 'Barbell', 'Squat Rack', 'Cable Machine', 'Bench Press', 'Leg Press', 'Treadmill', 'Rowing Machine', 'Kettlebells', 'Pull-up Bar'],
    slots: [{ start: '05:30', period: 6 }, { start: '16:00', period: 5 }, { start: '06:00', period: 5 }],
    daily: 350, monthly: 2200, quarterly: 5800, halfyearly: 10500, yearly: 18000,
  },
  {
    id: uuidv4(), name: 'FitZone Platinum', city: 'New Delhi', state: 'Delhi',
    addressLine1: 'B-14, Saket District Centre', addressLine2: 'Opposite PVR',
    pinCode: '110017', latitude: 28.5270, longitude: 77.2143,
    description: 'Delhi\'s most equipped strength facility. Five squat racks, powerlifting suits on rent, and nutrition bar. Trusted by 1,200+ active members.',
    rating: 4.4, total_rating: 190,
    images: [
      'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=500&fit=crop',
    ],
    equipment: ['Dumbbells', 'Barbell', 'Smith Machine', 'Cable Machine', 'Hack Squat', 'Leg Curl', 'Chest Fly', 'Treadmill', 'Elliptical', 'Battle Ropes', 'TRX'],
    slots: [{ start: '05:00', period: 7 }, { start: '15:30', period: 6 }],
    daily: 400, monthly: 2800, quarterly: 7200, halfyearly: 13000, yearly: 22000,
  },
  {
    id: uuidv4(), name: 'PowerMax Gym', city: 'Bangalore', state: 'Karnataka',
    addressLine1: '47, Koramangala 5th Block', addressLine2: 'Above Cafe Coffee Day',
    pinCode: '560095', latitude: 12.9341, longitude: 77.6155,
    description: 'Bangalore\'s go-to for serious lifters. No cardio bunnies, no Instagram posing — just heavy iron and real gains. 24/7 access for premium members.',
    rating: 4.7, total_rating: 340,
    images: [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?w=800&h=500&fit=crop',
    ],
    equipment: ['Dumbbells', 'Barbell', 'Squat Rack', 'Deadlift Platform', 'Cable Machine', 'Lat Pulldown', 'Preacher Curl', 'Leg Press', 'Hack Squat', 'Pull-up Bar', 'Dip Station', 'Ab Roller'],
    slots: [{ start: '05:00', period: 8 }, { start: '16:00', period: 6 }, { start: '06:00', period: 6 }],
    daily: 300, monthly: 1800, quarterly: 4800, halfyearly: 8500, yearly: 14500,
  },
  {
    id: uuidv4(), name: 'GymNation Hyderabad', city: 'Hyderabad', state: 'Telangana',
    addressLine1: '22-A, Banjara Hills Road No 12', addressLine2: 'Next to GVK One Mall',
    pinCode: '500034', latitude: 17.4122, longitude: 78.4488,
    description: 'Modern fitness hub with group class studio, spinning room, and functional training zone. Something for everyone — beginner to advanced.',
    rating: 4.3, total_rating: 156,
    images: [
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop',
    ],
    equipment: ['Dumbbells', 'Barbell', 'Treadmill', 'Bicycle', 'Elliptical', 'Cable Machine', 'Kettlebells', 'Foam Roller', 'Battle Ropes', 'Spin Bikes'],
    slots: [{ start: '06:00', period: 5 }, { start: '17:00', period: 5 }],
    daily: 280, monthly: 1700, quarterly: 4400, halfyearly: 8000, yearly: 13500,
  },
  {
    id: uuidv4(), name: 'Peak Performance Club', city: 'Chennai', state: 'Tamil Nadu',
    addressLine1: '15, TTK Road, Alwarpet', addressLine2: 'Near Music Academy',
    pinCode: '600018', latitude: 13.0340, longitude: 80.2548,
    description: 'Sports-science driven training facility with Velocity-Based Training technology, nutrition counselling, and monthly performance testing.',
    rating: 4.8, total_rating: 412,
    images: [
      'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=500&fit=crop',
    ],
    equipment: ['Dumbbells', 'Barbell', 'Squat Rack', 'Cable Machine', 'Rowing Machine', 'Assault Bike', 'Sled', 'Battle Ropes', 'Pull-up Bar', 'GHD Machine', 'Plyo Boxes'],
    slots: [{ start: '05:30', period: 7 }, { start: '15:30', period: 6 }],
    daily: 450, monthly: 3000, quarterly: 8000, halfyearly: 14000, yearly: 24000,
  },
  {
    id: uuidv4(), name: 'ProFit Studio', city: 'Pune', state: 'Maharashtra',
    addressLine1: 'Survey No 8, Kothrud', addressLine2: 'Opposite Venu Madhav Theatre',
    pinCode: '411038', latitude: 18.5047, longitude: 73.8243,
    description: 'Boutique strength and conditioning studio. Small batches (max 20 per session), personalised coaching, and a no-judgment community.',
    rating: 4.5, total_rating: 98,
    images: [
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=500&fit=crop',
    ],
    equipment: ['Dumbbells', 'Barbell', 'Kettlebells', 'Pull-up Bar', 'Resistance Bands', 'TRX', 'Ab Roller', 'Foam Roller', 'Medicine Ball'],
    slots: [{ start: '06:00', period: 4 }, { start: '17:30', period: 4 }],
    daily: 250, monthly: 1500, quarterly: 3900, halfyearly: 7000, yearly: 12000,
  },
  {
    id: uuidv4(), name: 'Elevate Fitness Centre', city: 'Ahmedabad', state: 'Gujarat',
    addressLine1: 'SF-11, Navrangpura Commercial Complex', addressLine2: 'Near Navrangpura Bus Stand',
    pinCode: '380009', latitude: 23.0395, longitude: 72.5638,
    description: 'Ahmedabad\'s fastest growing gym with 3 floors of equipment, dedicated ladies section, and Zumba and CrossFit classes daily.',
    rating: 4.2, total_rating: 124,
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1581009137042-c552e485697a?w=800&h=500&fit=crop',
    ],
    equipment: ['Dumbbells', 'Barbell', 'Cable Machine', 'Treadmill', 'Elliptical', 'Bicycle', 'Leg Press', 'Chest Press', 'Lat Pulldown', 'Pull-up Bar'],
    slots: [{ start: '05:30', period: 6 }, { start: '16:00', period: 5 }],
    daily: 220, monthly: 1400, quarterly: 3600, halfyearly: 6500, yearly: 11000,
  },
  {
    id: uuidv4(), name: 'StrengthBox Kolkata', city: 'Kolkata', state: 'West Bengal',
    addressLine1: 'CD-98, Salt Lake Sector 1', addressLine2: 'Near Bidhan Nagar Metro',
    pinCode: '700064', latitude: 22.5806, longitude: 88.4196,
    description: 'East India\'s premier strength-focused gym. Home to competitive powerlifters, Olympic weightlifters, and weekend warriors alike.',
    rating: 4.6, total_rating: 203,
    images: [
      'https://images.unsplash.com/photo-1603287681836-b174ce5074c2?w=800&h=500&fit=crop',
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=500&fit=crop',
    ],
    equipment: ['Dumbbells', 'Barbell', 'Squat Rack', 'Deadlift Platform', 'Cable Machine', 'Pull-up Bar', 'Dip Station', 'GHD Machine', 'Leg Press', 'Rowing Machine'],
    slots: [{ start: '05:00', period: 7 }, { start: '16:30', period: 5 }, { start: '06:00', period: 5 }],
    daily: 320, monthly: 2000, quarterly: 5200, halfyearly: 9500, yearly: 16000,
  },
];

// ─── PAGES (5) ────────────────────────────────────────────────────────────────

const PAGES_DATA = [
  {
    name: 'Iron Paradise Fitness', category: 'Gym', owner_index: 5,
    description: 'Premium gym in Andheri, Mumbai. 10,000 sq ft, certified trainers, and a community that pushes you harder every day.',
    website: 'https://ironparadisefitness.in',
    profile_image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop',
    cover_image: 'https://images.unsplash.com/photo-1581009137042-c552e485697a?w=1200&h=400&fit=crop',
    posts: [
      { content: 'Just installed brand new cable machines! 🏋️ First month membership at ₹999 only. Tag a friend who needs to join. #ironparadise #gymlife #mumbai', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop', daysAgo: 72 },
      { content: 'Morning warrior sessions now open from 5:30 AM 🌅 Beat the crowd and start your day stronger. Limited to 20 slots per batch — book through the Yupluck app.', image: null, daysAgo: 51 },
      { content: 'Member transformation of the month 🔥 3 months, zero shortcuts. This could be you. Walk in, show up, we take care of the rest.', image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=600&fit=crop', daysAgo: 28 },
      { content: 'Personal training packages starting at ₹2,500/month. Personalised program that fits your life. DM us or walk in between 6–9 AM.', image: null, daysAgo: 8 },
    ],
  },
  {
    name: 'Coach Priya — Personal Training', category: 'Trainer', owner_index: 6,
    description: 'ISSA certified personal trainer and nutrition coach. Specialising in body recomposition and fat loss. 200+ clients transformed.',
    website: 'https://coachpriya.in',
    profile_image: 'https://i.pravatar.cc/300?img=5',
    cover_image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&h=400&fit=crop',
    posts: [
      { content: 'Started with two new clients this week — 8-week transformation begins now. That decision to start is everything. 🧠 #personaltrainer #transformation', image: null, daysAgo: 60 },
      { content: 'Meal prep Sunday 🥗 Grilled chicken, rajma, brown rice, massive greens bowl. Hitting 140g protein daily. What does your prep look like? Drop it below 👇', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop', daysAgo: 41 },
      { content: 'Form over ego. Every. Single. Time. 🎯 Slow down, load less, feel the muscle. The weight will come when the pattern is solid.', image: null, daysAgo: 19 },
      { content: 'Online coaching open for August batch 🚀 Personalised plan + nutrition + weekly check-ins + 24/7 support. ₹4,500/month. Only 5 spots.', image: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&h=600&fit=crop', daysAgo: 5 },
    ],
  },
  {
    name: 'NutriBalance India', category: 'Nutrition', owner_index: 7,
    description: 'Evidence-based nutrition coaching. Cutting through the noise so you can eat smarter and perform better.',
    website: 'https://nutribalance.in',
    profile_image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop',
    cover_image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&h=400&fit=crop',
    posts: [
      { content: 'Protein myth BUSTED 🔬 You do NOT need 200g+ per day. For most active adults, 1.6–2.2g per kg bodyweight is enough. More is literally expensive urine. #nutritionscience', image: null, daysAgo: 85 },
      { content: 'Pre-workout nutrition > pre-workout supplement. Meal 2–3 hrs before: complex carbs + protein. Skip training fasted if you want to build muscle. 🍚', image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=600&fit=crop', daysAgo: 55 },
      { content: 'Beginner supplement stack 💊\n1. Creatine 3–5g daily\n2. Whey if not hitting protein targets\n3. Vitamin D3\n\nThat\'s it. Save your money on everything else.', image: null, daysAgo: 32 },
      { content: 'Hydration morning hack 💧 500ml water FIRST thing before coffee or chai. Body has been fasting 8 hours. Rehydrate first. Better digestion, better focus.', image: null, daysAgo: 11 },
    ],
  },
  {
    name: 'ZenFlow Yoga Studio', category: 'Health', owner_index: 8,
    description: 'Hatha, Vinyasa, and Yin yoga in Koregaon Park, Pune. New batches every month. Beginners always welcome.',
    website: 'https://zenflowstudio.in',
    profile_image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=400&fit=crop',
    cover_image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&h=400&fit=crop',
    posts: [
      { content: 'Sunday morning flow with 34 students 🙏 The energy today was something else. Grateful for everyone who rolled out their mat. See you Tuesday. #zenflow #yoga #pune', image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=600&fit=crop', daysAgo: 78 },
      { content: 'Yoga is not about touching your toes — it\'s about what you learn on the way down 🌿 New beginner batch starting Monday. Book your spot on Yupluck.', image: null, daysAgo: 47 },
      { content: 'Breathwork & Pranayama Workshop 🌬️\nSaturday 8–10:30 AM | ZenFlow Studio\nNadi Shodhana, Kapalabhati, Bhramari for stress & better sleep. 16 spots only.', image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=600&fit=crop', daysAgo: 12 },
    ],
  },
  {
    name: 'Warriors Athletic Club', category: 'Sports', owner_index: 9,
    description: 'Developing well-rounded athletes in Chennai since 2018. Football, basketball, and sport-specific conditioning.',
    website: 'https://warriorsac.in',
    profile_image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=400&fit=crop',
    cover_image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1200&h=400&fit=crop',
    posts: [
      { content: 'Football trials — Open call 🏆\nSaturday 6 AM | DY Patil Stadium\nAll levels, U17 to open age. Bring your cleats and hunger. We scout potential, not just polish.', image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&h=600&fit=crop', daysAgo: 68 },
      { content: 'DISTRICT CHAMPIONS 🥇 Our U-19 team won Tamil Nadu District Football Championship! 3 years of relentless training. Proud beyond words. 🔴⚫', image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&h=600&fit=crop', daysAgo: 45 },
      { content: 'Athlete S&C Program 💥 8 weeks: speed, agility, power, conditioning. Not generic — designed for competing athletes. Aug 4 | 20 athletes max | ₹6,000', image: null, daysAgo: 22 },
      { content: 'Recovery is training too 🧊 Ice baths, foam rolling, sleep. Your body grows when you rest. Don\'t skip recovery days. #athlete #recovery', image: null, daysAgo: 7 },
    ],
  },
];

// ─── VIDEO REELS ──────────────────────────────────────────────────────────────
// videoUrl is resolved at runtime from existing production reels on CloudFront.
// thumbnailUrl is a Unsplash static image (always available).

const REELS_DATA = [
  {
    user_index: 0,
    thumbnail:  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=800&fit=crop',
    title:      '5 AM Club — This is what discipline looks like',
    description: 'Nobody sees the 5 AM sessions. Nobody sees the missed social events. But they see the results. 6 months in 60 seconds. 🔥 #discipline #gains #gymlife',
    hashtags:   ['discipline', 'gymlife', 'gains', 'transformation'],
    daysAgo: 64, views: 12400, likes: 890,
  },
  {
    user_index: 1,
    thumbnail:  'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=800&fit=crop',
    title:      'Morning yoga flow — 10 min energiser',
    description: 'This 10-minute morning flow will wake up your spine, open your hips, and set the tone for the day. No equipment needed. 🧘 #yoga #morningroutine #wellness',
    hashtags:   ['yoga', 'morningroutine', 'wellness', 'flexibility'],
    daysAgo: 50, views: 8900, likes: 640,
  },
  {
    user_index: 2,
    thumbnail:  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&h=800&fit=crop',
    title:      'My 220kg deadlift — Raw, no belt',
    description: 'Year 8. Finally hit this. No belt, no suit, raw. Still shaking. For everyone who said I\'d plateau — watch this. 💪 #powerlifting #deadlift #strengthsports',
    hashtags:   ['powerlifting', 'deadlift', 'strengthsports', 'pr'],
    daysAgo: 38, views: 22100, likes: 1740,
  },
  {
    user_index: 3,
    thumbnail:  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=800&fit=crop',
    title:      'What I eat in a day — 1800 calories, 140g protein',
    description: 'Full day of eating while cutting. Every meal, every macro, every snack — explained. Indian food, high protein, totally sustainable. 🥗 #nutrition #whatieataday #macros',
    hashtags:   ['nutrition', 'whatieataday', 'macros', 'indianfood'],
    daysAgo: 29, views: 15600, likes: 1120,
  },
  {
    user_index: 4,
    thumbnail:  'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&h=800&fit=crop',
    title:      'Speed drills that actually work — Track session',
    description: 'A session breakdown of the exact speed drills I use for my 100m training. Acceleration phase, max velocity, speed endurance. 🏃 #athletics #speedtraining #trackandfield',
    hashtags:   ['athletics', 'speedtraining', 'trackandfield', 'sprinting'],
    daysAgo: 18, views: 9300, likes: 710,
  },
  {
    user_index: 0,
    thumbnail:  'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=600&h=800&fit=crop',
    title:      'How I went from skinny to jacked — 3 year transformation',
    description: '54kg to 85kg. 3 years of consistency. No steroids, no shortcuts, no excuses. This reel has everything: training, diet, mindset. Save it. 🔑 #transformation #natty #fitnessjourney',
    hashtags:   ['transformation', 'natty', 'fitnessjourney', 'gymlife'],
    daysAgo: 8, views: 31000, likes: 2480,
  },
];

// ─── REGULAR FEED POSTS ───────────────────────────────────────────────────────

const FEED_POSTS = [
  // general
  { user_index: 0, type: 'general', daysAgo: 55, postType: 'public',
    title: 'Back day was different today 🔥',
    answer: 'Hit a new volume PR on weighted pull-ups today. 5 sets of 12 with 20kg. 8 months ago I couldn\'t do 1 bodyweight rep. Proof that consistency beats everything. #backday #pullups #progressnotperfection',
    images: ['https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&h=600&fit=crop'],
    likes: 234, comments: 18 },

  { user_index: 1, type: 'general', daysAgo: 48, postType: 'public',
    title: 'Rest day thoughts 🧘',
    answer: 'Rest days are not lazy days. They\'re the days your body actually grows, repairs, and gets stronger. Honour your rest as much as your training. Today: light stretch, long walk, good food. 🌿 #restday #recovery #yogalife',
    images: ['https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=600&fit=crop'],
    likes: 188, comments: 22 },

  { user_index: 4, type: 'general', daysAgo: 40, postType: 'public',
    title: 'Track session complete ⚡',
    answer: '8 × 100m at 85% intensity. Rest 3 min between reps. Felt fast. Legs are cooked. But this is what off-season is for — building the base so that race season is smooth. #athletics #sprinting #tracklife',
    images: ['https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&h=600&fit=crop'],
    likes: 312, comments: 28 },

  { user_index: 2, type: 'general', daysAgo: 33, postType: 'public',
    title: 'Leg day was brutal today 🦵',
    answer: 'Squats: 5×5 at 160kg. Leg press: 4×15 at 300kg. Romanian deadlift: 4×10 at 120kg. Walked out like a newborn deer. This is the sport. 😂 #legday #squats #powerlifting #bangalore',
    images: ['https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop'],
    likes: 445, comments: 41 },

  { user_index: 3, type: 'general', daysAgo: 26, postType: 'public',
    title: 'Grocery haul for the week 🥦',
    answer: 'Weekly grocery haul: chicken breast, eggs, paneer, Greek yogurt, oats, sweet potato, broccoli, spinach, almonds. Total: ₹1,400. Eating clean doesn\'t have to be expensive. Here\'s how I meal plan for 7 days on this. 🧵 #nutrition #mealprep #indianfood',
    images: ['https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop'],
    likes: 267, comments: 35 },

  // then_now (transformation)
  { user_index: 10, type: 'then_now', daysAgo: 44, postType: 'public',
    title: 'My 6-month transformation 💪',
    answer: 'Jan 2026 → July 2026. 68kg → 79kg. 24% → 14% body fat. What changed: hired a trainer, started tracking macros, stopped skipping meals, sleep 8 hours. No magic. Just consistency. 🙏 #transformation #beforeandafter #fitness',
    images: [
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&h=800&fit=crop',
    ], likes: 892, comments: 67 },

  { user_index: 16, type: 'then_now', daysAgo: 30, postType: 'public',
    title: 'She said she wasn\'t the gym type 😅',
    answer: 'October to April. -14kg. People keep asking what diet I was on. I just ate real food and stopped ordering biryani at 11 PM. And I walked 8k steps daily. That\'s the whole secret. 👋 #weightloss #womenwholift #transformation #jaipur',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=800&fit=crop',
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=800&fit=crop',
    ], likes: 1240, comments: 94 },

  // meal posts
  { user_index: 3, type: 'meal', daysAgo: 38, postType: 'public',
    title: 'Post-workout meal 🍗',
    answer: 'Post-workout: 200g grilled chicken, 150g brown rice, 100g broccoli, tbsp olive oil. Macros: 520 kcal | 52g protein | 48g carbs | 12g fat. Kept it simple today. Meal prep takes 20 min on Sundays — this is the ROI. #mealprep #postworkout #highprotein',
    images: ['https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=600&fit=crop'],
    likes: 198, comments: 16 },

  { user_index: 6, type: 'meal', daysAgo: 20, postType: 'public',
    title: 'High protein Indian breakfast 🍳',
    answer: 'Besan cheela (3) + 2 boiled eggs + 1 cup low-fat curd + 1 fruit. Total: 42g protein, 380 kcal. This is my go-to on training days. Quick to make, hits macros, and doesn\'t feel like diet food. Drop your high-protein Indian breakfast below 👇 #indianfitness #highprotein #breakfast',
    images: ['https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop'],
    likes: 334, comments: 29 },

  // challenge posts
  { user_index: 11, type: 'challenge', daysAgo: 35, postType: 'public',
    title: '30-Day Push-Up Challenge',
    answer: 'Day 1 of 30 — done ✅ 50 push-ups completed. It\'s never comfortable on day 1 but it\'ll be worth it on day 30. Anyone else doing this? Drop a 🔥 if you\'re in. #30daychallenge #pushupchallenge #fitness',
    images: ['https://images.unsplash.com/photo-1598971639058-fab3c3109a78?w=800&h=600&fit=crop'],
    likes: 156, comments: 44, challengeId: null },

  { user_index: 12, type: 'challenge', daysAgo: 22, postType: 'public',
    title: '10k Steps Daily Challenge',
    answer: 'Week 3 of the 10k daily steps challenge and I genuinely feel different. Sleep is better. Appetite is better. Mood is better. Walking is underrated medicine. 🚶‍♀️ #10ksteps #walkingchallenge #wellness',
    images: ['https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=800&h=600&fit=crop'],
    likes: 203, comments: 31, challengeId: null },

  { user_index: 13, type: 'challenge', daysAgo: 14, postType: 'public',
    title: '21-Day Plank Challenge — Day 7',
    answer: 'Day 7 done! Holding 3 min plank now. Core is screaming but in the best way. Started at 30 sec on day 1. Progress is real. 💪 #plankchallenge #corestrength #21days',
    images: ['https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=600&fit=crop'],
    likes: 134, comments: 22, challengeId: null },

  { user_index: 18, type: 'challenge', daysAgo: 7, postType: 'public',
    title: 'No Sugar 30 Days — Week 1 done!',
    answer: 'One week without sugar complete 🎉 The cravings on day 2-3 were brutal. Day 7 feels different — clearer head, better energy. Sticking with it. Who else is on a no-sugar challenge? 🙋 #nosugarchallenge #cleaneating #wellness',
    images: ['https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&h=600&fit=crop'],
    likes: 178, comments: 38, challengeId: null },

  // checkin posts
  { user_index: 5, type: 'checkin', gym_index: 0, daysAgo: 60, hours: 2,
    title: 'Morning session at IronHouse 💪',
    answer: 'Chest + triceps today. Incline bench felt amazing this morning. 2 hours of focused work. If you\'re in Andheri and haven\'t checked out IronHouse yet — you\'re missing out. 🔥 #checkin #gymlife #mumbai',
    images: ['https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop'],
    likes: 122, comments: 9 },

  { user_index: 9, type: 'checkin', gym_index: 4, daysAgo: 25, hours: 3,
    title: 'Peak Performance Club — where gains are born',
    answer: 'Velocity-based training session today with the team. If you\'re in Chennai and haven\'t experienced science-backed training — Peak Performance is where it\'s at. Shoutout to the coaches. 🙌 #peakperformance #athletics #chennai',
    images: null, likes: 88, comments: 7 },

  // milestone posts
  { user_index: 0, type: 'milestone', daysAgo: 42, postType: 'public',
    title: 'Hit 100kg bench press! 🏋️',
    answer: '3 years ago I benched 40kg with terrible form and massive ego. Today I hit 100kg for a clean triple. This journey has taught me that ego is the enemy and patience is the real performance-enhancing drug. Thank you to everyone who trained with me. 💪 #milestone #benchpress #powerlifting',
    images: ['https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&h=600&fit=crop'],
    awards: '100kg Bench Press', likes: 678, comments: 52 },

  { user_index: 13, type: 'milestone', daysAgo: 15, postType: 'public',
    title: 'First 21km half-marathon ✅',
    answer: 'Did it. 21.1km in 2:04:38. Cried at km 19. Smiled at the finish line. 8 months of training, 6 months of early mornings, one day that made all of it worth it. If you\'re thinking about running — start today. 🏅 #halfmarathon #running #milestone #pune',
    images: ['https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&h=600&fit=crop'],
    awards: 'Half Marathon Finisher', likes: 934, comments: 78 },
];

// ─── CHALLENGES (categories) ──────────────────────────────────────────────────

const CHALLENGE_NAMES = [
  '30-Day Push-Up Challenge', '10k Steps Daily', 'No Sugar for 30 Days',
  'Morning 5 AM Workout', '21-Day Plank Challenge', '100 Burpees Daily',
  'Dry January Fitness', '6-Week Bulk Challenge', '30-Day Squat Challenge',
  'Marathon Training — 16 Weeks',
];

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected\n');

    // ── 0. Harvest existing CloudFront video URLs from production reels ─────────
    // This runs BEFORE cleanup so we can recycle real video URLs that actually
    // exist on S3/CloudFront. Seed reels will use these so playback works.
    console.log('🎬 Fetching existing video URLs from production reels...');
    const productionReels = await Reel.findAll({
      where: {
        videoUrl: { [Op.not]: null },
        processing: { [Op.or]: [false, null] },
      },
      attributes: ['videoUrl', 'thumbnailUrl'],
      order: [['timestamp', 'DESC']],
      limit: 20,
    });

    const liveVideoUrls = productionReels
      .filter(r => r.videoUrl && r.videoUrl.includes('cloudfront'))
      .map(r => r.videoUrl);

    if (liveVideoUrls.length > 0) {
      console.log(`   ✔ Found ${liveVideoUrls.length} live CloudFront video(s) — will reuse for seed reels\n`);
    } else {
      console.log('   ⚠ No existing CloudFront videos found — seed reels will show thumbnails only\n');
    }

    // ── 1. Cleanup ──────────────────────────────────────────────────────────────
    console.log('🧹 Cleaning previous seed data...');

    const emails    = USERS.map(u => u.email);
    const mobiles   = USERS.map(u => u.mobile_number);
    const usernames = USERS.map(u => u.username);

    const existing = await User.findAll({
      where: { [Op.or]: [{ email: { [Op.in]: emails } }, { mobile_number: { [Op.in]: mobiles } }, { username: { [Op.in]: usernames } }] },
      attributes: ['id'],
    });
    const existingIds = existing.map(u => u.id);

    if (existingIds.length) {
      await PostComment.destroy({ where: { userId: { [Op.in]: existingIds } } }).catch(() => {});
      await PostReaction.destroy({ where: { userId: { [Op.in]: existingIds } } }).catch(() => {});
      await Feed.destroy({ where: { userId: { [Op.in]: existingIds } } });
      await Reel.destroy({ where: { userId: { [Op.in]: existingIds } } });
      await Follow.destroy({ where: { [Op.or]: [{ followerId: { [Op.in]: existingIds } }, { followingId: { [Op.in]: existingIds } }] } });
      await FriendRequest.destroy({ where: { [Op.or]: [{ fromUserId: { [Op.in]: existingIds } }, { toUserId: { [Op.in]: existingIds } }] } });
    }

    const pageSlugs = PAGES_DATA.map(p => toSlug(p.name));
    const existingPages = await Page.findAll({ where: { slug: { [Op.in]: pageSlugs } }, attributes: ['id'] });
    const existingPageIds = existingPages.map(p => p.id);
    if (existingPageIds.length) {
      await PagePost.destroy({ where: { page_id: { [Op.in]: existingPageIds } } });
      await PageFollower.destroy({ where: { page_id: { [Op.in]: existingPageIds } } });
      await Page.destroy({ where: { id: { [Op.in]: existingPageIds } } });
    }

    if (existingIds.length) await User.destroy({ where: { id: { [Op.in]: existingIds } } });

    const gymNames = GYMS.map(g => g.name);
    await sequelize.query(`DELETE FROM "GymImages" WHERE "gymId" IN (SELECT id FROM "Gyms" WHERE name = ANY(:names))`, { replacements: { names: gymNames } }).catch(() => {});
    await sequelize.query(`DELETE FROM "Equipment"  WHERE "gymId" IN (SELECT id FROM "Gyms" WHERE name = ANY(:names))`, { replacements: { names: gymNames } }).catch(() => {});
    await sequelize.query(`DELETE FROM "Slots"       WHERE "gymId" IN (SELECT id FROM "Gyms" WHERE name = ANY(:names))`, { replacements: { names: gymNames } }).catch(() => {});
    await sequelize.query(`DELETE FROM "Subscriptions" WHERE "gymId" IN (SELECT id FROM "Gyms" WHERE name = ANY(:names))`, { replacements: { names: gymNames } }).catch(() => {});
    await sequelize.query(`DELETE FROM "Gyms" WHERE name = ANY(:names)`, { replacements: { names: gymNames } }).catch(() => {});

    console.log('✅ Cleanup done\n');

    // ── 2. Users ────────────────────────────────────────────────────────────────
    console.log('👥 Creating users...');
    const createdUsers = [];
    for (const u of USERS) {
      const user = await User.create({
        username: u.username, email: u.email, mobile_number: u.mobile_number,
        password: 'Yupluck@2024', full_name: u.full_name, bio: u.bio || null,
        gender: u.gender || null, height: u.height || null, weight: u.weight || null,
        profile_pic: u.profile_pic || null, cover_pic: u.cover_pic || null,
        is_trainer: u.is_trainer || 'false', spec: u.spec || null,
        is_verified: true, otp: 123456, status: 0, country: 'IN',
        total_work_out_time: u.total_work_out_time || 0,
        followers_count: u.followers_count || 0,
        following_count: u.following_count || 0,
        register_date: u.register_date || daysAgo(rand(60, 200)),
        last_active: daysAgo(rand(0, 3)),
      });
      createdUsers.push(user);
      console.log(`   ✔ ${user.full_name} (@${user.username})`);
    }
    console.log();

    // ── 3. Follows & Friend Requests ────────────────────────────────────────────
    console.log('🤝 Creating follows & friendships...');

    // Regular users (10-19) follow all influencers (0-4)
    for (let followerIdx = 10; followerIdx < createdUsers.length; followerIdx++) {
      for (let influencerIdx = 0; influencerIdx < 5; influencerIdx++) {
        await Follow.create({
          followerId:  createdUsers[followerIdx].id,
          followingId: createdUsers[influencerIdx].id,
          followedOn:  daysAgo(rand(10, 60)),
        }).catch(() => {});
      }
    }
    // Influencers follow each other
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        if (i !== j) {
          await Follow.create({
            followerId:  createdUsers[i].id,
            followingId: createdUsers[j].id,
            followedOn:  daysAgo(rand(30, 120)),
          }).catch(() => {});
        }
      }
    }
    // Page owners follow influencers
    for (let ownerIdx = 5; ownerIdx < 10; ownerIdx++) {
      for (let infIdx = 0; infIdx < 5; infIdx++) {
        await Follow.create({
          followerId:  createdUsers[ownerIdx].id,
          followingId: createdUsers[infIdx].id,
          followedOn:  daysAgo(rand(20, 80)),
        }).catch(() => {});
      }
    }

    // Friend requests (accepted) between influencers and page owners
    const friendPairs = [[0,5],[1,6],[2,7],[3,8],[4,9],[0,1],[2,3],[10,11],[12,13]];
    for (const [a, b] of friendPairs) {
      await FriendRequest.create({
        fromUserId: createdUsers[a].id, toUserId: createdUsers[b].id,
        status: 'accepted', sentOn: daysAgo(rand(30, 100)), acceptedOn: daysAgo(rand(5, 29)),
      }).catch(() => {});
    }
    console.log('   ✔ Follows and friend requests created\n');

    // ── 4. Gyms ─────────────────────────────────────────────────────────────────
    console.log('🏋️  Creating gyms...');
    const createdGymIds = [];

    for (const gym of GYMS) {
      try {
        await sequelize.query(`
          INSERT INTO "Gyms" (id, name, description, latitude, longitude, "addressLine1", "addressLine2", city, "pinCode", state, rating, total_rating, verified)
          VALUES (:id, :name, :desc, :lat, :long, :addr1, :addr2, :city, :pin, :state, :rating, :totalRating, true)
          ON CONFLICT DO NOTHING
        `, { replacements: { id: gym.id, name: gym.name, desc: gym.description, lat: gym.latitude, long: gym.longitude, addr1: gym.addressLine1, addr2: gym.addressLine2, city: gym.city, pin: gym.pinCode, state: gym.state, rating: gym.rating, totalRating: gym.total_rating } });

        // GymImages
        for (const imageUrl of gym.images) {
          await sequelize.query(`
            INSERT INTO "GymImages" (id, "gymId", "imageUrl") VALUES (:id, :gymId, :url) ON CONFLICT DO NOTHING
          `, { replacements: { id: uuidv4(), gymId: gym.id, url: imageUrl } }).catch(() => {});
        }

        // Equipment
        for (const name of gym.equipment) {
          await sequelize.query(`
            INSERT INTO "Equipment" (id, "gymId", name) VALUES (:id, :gymId, :name) ON CONFLICT DO NOTHING
          `, { replacements: { id: uuidv4(), gymId: gym.id, name } }).catch(() => {});
        }

        // Slots
        for (const slot of gym.slots) {
          await sequelize.query(`
            INSERT INTO "Slots" (id, "gymId", "startTime", "timePeriod") VALUES (:id, :gymId, :start, :period) ON CONFLICT DO NOTHING
          `, { replacements: { id: uuidv4(), gymId: gym.id, start: slot.start, period: slot.period } }).catch(() => {});
        }

        // Subscription
        await sequelize.query(`
          INSERT INTO "Subscriptions" (id, "gymId", daily, monthly, quarterly, halfyearly, yearly)
          VALUES (:id, :gymId, :daily, :monthly, :quarterly, :half, :yearly) ON CONFLICT DO NOTHING
        `, { replacements: { id: uuidv4(), gymId: gym.id, daily: gym.daily, monthly: gym.monthly, quarterly: gym.quarterly, half: gym.halfyearly, yearly: gym.yearly } }).catch(() => {
          // If column names differ, try with just daily
          sequelize.query(`INSERT INTO "Subscriptions" (id, "gymId", daily) VALUES (:id, :gymId, :daily) ON CONFLICT DO NOTHING`,
            { replacements: { id: uuidv4(), gymId: gym.id, daily: gym.daily } }).catch(() => {});
        });

        createdGymIds.push(gym.id);
        console.log(`   ✔ ${gym.name} — ${gym.city}`);
      } catch (err) {
        console.log(`   ⚠ ${gym.name} skipped: ${err.message.split('\n')[0]}`);
      }
    }
    console.log();

    // ── 5. EquipmentList ─────────────────────────────────────────────────────────
    const allEquipment = [...new Set(GYMS.flatMap(g => g.equipment))];
    for (const name of allEquipment) {
      await sequelize.query(`
        INSERT INTO "EquipmentList" (equipment_name) VALUES (:name) ON CONFLICT DO NOTHING
      `, { replacements: { name } }).catch(() => {});
    }

    // ── 6. Challenges (Categories) ───────────────────────────────────────────────
    console.log('🏆 Creating challenge categories...');
    for (const name of CHALLENGE_NAMES) {
      await Category.findOrCreate({ where: { name }, defaults: { name, isChallenge: true, numberOfPosts: rand(8, 180) } });
    }
    // General fitness categories
    for (const name of ['Weight Loss', 'Muscle Building', 'Yoga', 'Running', 'Nutrition', 'Calisthenics']) {
      await Category.findOrCreate({ where: { name }, defaults: { name, isChallenge: false, numberOfPosts: rand(20, 300) } });
    }
    console.log('   ✔ Categories created\n');

    // ── 7. Video Reels ──────────────────────────────────────────────────────────
    console.log('🎬 Creating video reels...');
    const createdReelIds = [];
    for (let i = 0; i < REELS_DATA.length; i++) {
      const r = REELS_DATA[i];
      const reelId = uuidv4();
      const ts = daysAgo(r.daysAgo);
      const user = createdUsers[r.user_index];

      // Rotate through real CloudFront video URLs harvested from production.
      // If production has no videos yet, videoUrl will be null — the reel is
      // still created so the feed card appears; the user can upload videos later.
      const videoUrl = liveVideoUrls.length > 0
        ? liveVideoUrls[i % liveVideoUrls.length]
        : null;

      await Reel.create({
        id: reelId, userId: user.id,
        videoUrl, thumbnailUrl: r.thumbnail,
        title: r.title, description: r.description,
        hashtags: r.hashtags, postType: 'public', isPublic: true,
        like_count: r.likes, view_count: r.views,
        processing: false, timestamp: ts,
      });

      await Feed.create({
        id: reelId, userId: user.id,
        activityType: 'aiPromo',
        title: r.title, description: r.description,
        imageUrl: r.thumbnail, images: [r.thumbnail],
        hashtags: r.hashtags,
        like_count: r.likes, comment_count: rand(10, 80),
        postType: 'public', timestamp: ts,
      });

      createdReelIds.push(reelId);
      console.log(`   ✔ [${user.username}] "${r.title.substring(0, 50)}"`);
    }
    console.log();

    // ── 8. Regular Feed Posts ───────────────────────────────────────────────────
    console.log('📝 Creating feed posts...');
    for (const p of FEED_POSTS) {
      const user = createdUsers[p.user_index];
      const ts   = daysAgo(p.daysAgo);
      const gymId = (p.type === 'checkin' && createdGymIds[p.gym_index]) ? createdGymIds[p.gym_index] : null;

      await Feed.create({
        userId:       user.id,
        activityType: p.type,
        title:        p.title    || '',
        description:  p.answer   || null,
        imageUrl:     p.images?.[0] || null,
        images:       p.images   || [],
        gymId:        gymId,
        hours:        p.hours    || null,
        awards:       p.awards   || null,
        challengeId:  p.challengeId || null,
        like_count:   p.likes    || 0,
        comment_count: p.comments || 0,
        postType:     p.postType || 'public',
        hashtags:     [],
        timestamp:    ts,
      });
      console.log(`   ✔ [${p.type}] ${user.username}: "${(p.title || '').substring(0, 45)}"`);
    }
    console.log();

    // ── 9. Pages + Posts ────────────────────────────────────────────────────────
    console.log('📄 Creating pages...');
    const createdPages = [];
    for (const pd of PAGES_DATA) {
      const owner = createdUsers[pd.owner_index];
      const page  = await Page.create({
        name: pd.name, slug: toSlug(pd.name), category: pd.category,
        description: pd.description, website: pd.website,
        profile_image: pd.profile_image, cover_image: pd.cover_image,
        owner_id: owner.id, follower_count: 0, post_count: 0,
      });
      createdPages.push(page);

      for (const postData of pd.posts) {
        const ts     = daysAgo(postData.daysAgo);
        const images = postData.image ? [postData.image] : [];
        const post   = await PagePost.create({
          page_id: page.id, author_id: owner.id,
          content: postData.content, image_url: images[0] || null,
          images, hashtags: [], mentions: [], created_at: ts,
        });
        await Feed.create({
          id: uuidv4(), userId: owner.id, activityType: 'page_post',
          title: page.name, description: post.content,
          imageUrl: images[0] || null, images,
          pageId: page.id, postType: 'public', timestamp: ts,
        });
      }
      await page.update({ post_count: pd.posts.length });
      console.log(`   ✔ ${page.name} (${pd.posts.length} posts)`);
    }
    console.log();

    // ── 10. Page Follows ────────────────────────────────────────────────────────
    console.log('➕ Page follows...');
    const pageFollowMap = [
      [10, [0, 2, 4]], [11, [0, 1, 3]], [12, [1, 3, 4]], [13, [2, 4]],
      [14, [0, 1, 2]], [15, [0, 3, 4]], [16, [1, 2, 3]], [17, [0, 2]],
      [0,  [1, 3]],    [1,  [0, 2]],    [2,  [3, 4]],   [4,  [0, 1]],
    ];
    const pfCountMap = {};
    for (const [uIdx, pageIdxs] of pageFollowMap) {
      if (!createdUsers[uIdx]) continue;
      for (const pIdx of pageIdxs) {
        if (!createdPages[pIdx]) continue;
        await PageFollower.findOrCreate({
          where: { page_id: createdPages[pIdx].id, user_id: createdUsers[uIdx].id },
          defaults: { joined_at: daysAgo(rand(5, 50)) },
        });
        pfCountMap[pIdx] = (pfCountMap[pIdx] || 0) + 1;
      }
    }
    for (const [pIdx, count] of Object.entries(pfCountMap)) {
      await createdPages[pIdx]?.update({ follower_count: count });
    }

    // ── 11. Post Reactions ──────────────────────────────────────────────────────
    console.log('\n❤️  Adding reactions...');
    const allFeeds = await Feed.findAll({
      where: { userId: { [Op.in]: createdUsers.slice(0, 5).map(u => u.id) } },
      attributes: ['id'], limit: 20,
    });
    let reactionCount = 0;
    for (const feedItem of allFeeds) {
      const reactors = createdUsers.slice(10).sort(() => 0.5 - Math.random()).slice(0, rand(3, 8));
      for (const reactor of reactors) {
        await PostReaction.findOrCreate({
          where: { postId: feedItem.id, userId: reactor.id },
          defaults: { reactionType: 'like' },
        }).catch(() => {});
        reactionCount++;
      }
    }
    console.log(`   ✔ ${reactionCount} reactions added`);

    // ── Summary ─────────────────────────────────────────────────────────────────
    const totalPosts = PAGES_DATA.reduce((s, p) => s + p.posts.length, 0);
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅  FULL APP SEED COMPLETE');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Users        : ${createdUsers.length}`);
    console.log(`   Gyms         : ${createdGymIds.length}`);
    console.log(`   Pages        : ${createdPages.length}`);
    console.log(`   Page Posts   : ${totalPosts}`);
    console.log(`   Video Reels  : ${REELS_DATA.length}`);
    console.log(`   Feed Posts   : ${FEED_POSTS.length}`);
    console.log(`   Challenges   : ${CHALLENGE_NAMES.length}`);
    console.log(`   Reactions    : ${reactionCount}`);
    console.log('───────────────────────────────────────────────────────');
    console.log('   Password for all seed users : Yupluck@2024');
    console.log('   OTP for all seed users      : 123456');
    console.log('───────────────────────────────────────────────────────');
    console.log('   📱 Influencer accounts (high follower counts):');
    createdUsers.slice(0, 5).forEach(u => {
      console.log(`      ${u.mobile_number.padEnd(15)} @${u.username.padEnd(20)} ${u.full_name}`);
    });
    console.log('═══════════════════════════════════════════════════════');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    if (err.errors) err.errors.forEach(e => console.error('   -', e.message));
    console.error(err.stack);
    process.exit(1);
  }
};

seed();
