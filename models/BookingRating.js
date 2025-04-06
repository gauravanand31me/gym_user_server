const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BookingRating = sequelize.define('BookingRating', {
  ratingId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Booking',
      key: 'bookingId'
    }
  },
  gymId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Gyms',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  rating: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true // ✅ Newly added
  },
  ratedOn: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'BookingRatings',
  timestamps: true
});

BookingRating.associate = (models) => {
  BookingRating.belongsTo(models.Booking, { foreignKey: 'bookingId' });
  BookingRating.belongsTo(models.Gym, { foreignKey: 'gymId' });
  BookingRating.belongsTo(models.User, { foreignKey: 'userId' });
};

module.exports = BookingRating;
