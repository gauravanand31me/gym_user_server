const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BookingDetailedRating = sequelize.define('BookingDetailedRating', {
  ratingId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Bookings', // Should match your table name
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
    allowNull: true
  },
  ratedOn: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'BookingDetailedRatings',
  timestamps: true
});

// Associations
BookingDetailedRating.associate = (models) => {
  BookingDetailedRating.belongsTo(models.Booking, { foreignKey: 'bookingId' });
  BookingDetailedRating.belongsTo(models.Gym, { foreignKey: 'gymId' });
  BookingDetailedRating.belongsTo(models.User, { foreignKey: 'userId' });
};

module.exports = BookingDetailedRating;
