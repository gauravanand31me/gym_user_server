'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create the table
    await queryInterface.createTable('Categories', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false,
      }
    });

    // 2. Insert all categories
    const allCategories = [
      // 💪 Upper Body Muscles
      "Chest", "Upper Chest", "Lower Chest", "Back", "Upper Back", "Lower Back",
      "Lats (Latissimus Dorsi)", "Traps (Trapezius)", "Shoulders (Deltoids)",
      "Front Delts", "Side Delts", "Rear Delts", "Biceps", "Triceps", "Forearms",
      "Wrists", "Hands", "Fingers", "Neck",

      // 💪 Core Muscles
      "Abdominals (Abs)", "Upper Abs", "Lower Abs", "Obliques", "Transverse Abdominis",
      "Pelvic Floor", "Diaphragm",

      // 💪 Lower Body Muscles
      "Glutes", "Quadriceps (Quads)", "Hamstrings", "Adductors (Inner Thighs)",
      "Abductors (Outer Thighs)", "Hip Flexors", "Hip Joints", "Calves",
      "Tibialis Anterior", "Ankles", "Feet", "Toes", "Legs", "Cardio",

      // 💪 Spine & Mobility
      "Spine (Cervical, Thoracic, Lumbar)", "Sacrum", "Shoulder Girdle", "Hip Girdle",
      "Iliopsoas",

      // 💪 Foundational Compound Lifts
      "Barbell Squat", "Front Squat", "Overhead Squat", "Deadlift", "Sumo Deadlift",
      "Romanian Deadlift", "Bench Press", "Incline Bench Press", "Decline Bench Press",
      "Overhead Press (OHP)", "Push Press", "Military Press", "Clean and Jerk",
      "Snatch", "Power Clean", "Power Snatch", "Split Jerk",

      // 💪 Gym Training Styles
      "Strength Training", "Hypertrophy Training", "Endurance Training", "Powerlifting",
      "Olympic Weightlifting", "Bodybuilding", "Functional Training", "Mobility Training",
      "CrossFit", "Core Stability", "Plyometric Training", "Resistance Band Training",
      "Kettlebell Workouts", "TRX Suspension Training", "Calisthenics (Bodyweight Training)",
      "Isolation Exercises", "Compound Exercises", "Superset Training", "Circuit Training",
      "Drop Set Training", "Negative Reps", "Isometric Training",

      // 💪 Cardio & Conditioning
      "Jogging", "Running", "Sprint Training", "Walking", "Treadmill Workout",
      "Elliptical Trainer", "Stair Climber", "Jump Rope", "Cycling (Outdoor/Stationary)",
      "Rowing Machine", "HIIT", "LISS", "Tabata", "Shadow Boxing",

      // 💪 Yoga Practices
      "Surya Namaskar", "Chandra Namaskar", "Kapalbhati", "Anulom Vilom", "Bhastrika",
      "Bhramari", "Sheetali", "Ujjayi", "Nadi Shodhana", "Trataka", "Yoga Nidra",
      "Mantra Chanting",

      // 💪 Yoga Asanas
      "Tadasana", "Vrikshasana", "Adho Mukha Svanasana", "Bhujangasana", "Trikonasana",
      "Setu Bandhasana", "Balasana", "Paschimottanasana", "Shavasana", "Utkatasana",
      "Padmasana", "Dhanurasana", "Vajrasana", "Marjariasana", "Halasana", "Sarvangasana",
      "Matsyasana",

      // 💪 Mind-Body & Breath
      "Mindfulness", "Breath Control", "Nervous System", "Energy Centers",

      // 💪 Physical Sports
      "Football", "Cricket", "Basketball", "Volleyball", "Tennis", "Badminton",
      "Swimming", "Boxing", "Kickboxing", "Martial Arts", "Wrestling", "Skating",
      "Cycling", "Hiking", "Climbing", "Table Tennis", "Squash", "Dance Fitness", "Zoomba"
    ];

    const categoryObjects = allCategories.map(name => ({ name }));
    await queryInterface.bulkInsert('Categories', categoryObjects);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Categories');
  }
};
