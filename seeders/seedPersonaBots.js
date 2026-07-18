require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const sequelize = require('../config/db');
const User = require('../models/User');

// Two Indian fitness persona bots — identified by @yupluck.bot email domain
const PERSONAS = [
  {
    email:          'arjun.mehta@yupluck.bot',
    username:       'arjun_mehta_fit',
    full_name:      'Arjun Mehta',
    mobile_number:  '9000000101',
    password:       'Yupluck@2024',
    otp:            123456,
    bio:            'Mumbai ka fitness freak 💪 Gymrat since 2019 | Roz subah 5 baje uthta hoon 🔥 | Open to collabs',
    profile_pic:    'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&h=400&fit=crop&crop=face',
    cover_pic:      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&h=400&fit=crop',
    gender:         'male',
    height:         '178',
    weight:         '76',
    is_verified:    true,
    register_date:  new Date(Date.now() - 120 * 86_400_000), // joined 4 months ago
  },
  {
    email:          'kavya.reddy@yupluck.bot',
    username:       'kavya_reddy_wellness',
    full_name:      'Kavya Reddy',
    mobile_number:  '9000000102',
    password:       'Yupluck@2024',
    otp:            123456,
    bio:            'Hyderabad ki wellness queen 🧘 | Yoga + HIIT = life ✨ | Healthy khao, healthy raho 🥗 | Aspiring nutritionist',
    profile_pic:    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=400&fit=crop&crop=face',
    cover_pic:      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=400&fit=crop',
    gender:         'female',
    height:         '163',
    weight:         '57',
    is_verified:    true,
    register_date:  new Date(Date.now() - 90 * 86_400_000), // joined 3 months ago
  },
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('\n🇮🇳 Seeding Indian Persona Bots');
    console.log('═'.repeat(40));

    for (const p of PERSONAS) {
      const [user, created] = await User.findOrCreate({
        where: { email: p.email },
        defaults: p,
      });

      if (created) {
        console.log(`✅ Created : @${user.username} (${p.full_name})`);
      } else {
        // Update profile pic / bio in case it changed
        await user.update({
          profile_pic:   p.profile_pic,
          cover_pic:     p.cover_pic,
          bio:           p.bio,
        });
        console.log(`⚠️  Updated : @${user.username} (already existed)`);
      }
    }

    console.log('\n✅ Done — run `npm run bot:persona` to activate them.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
}

seed();
