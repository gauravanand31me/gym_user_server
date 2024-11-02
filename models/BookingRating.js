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
      model: 'Booking', // The name of the Booking table
      key: 'bookingId'
    }
  },
  gymId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Gyms', // The name of the Gyms table
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users', // The name of the Users table
      key: 'id'
    }
  },
  rating: {
    type: DataTypes.FLOAT, // Adjust based on how you want to represent ratings
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  ratedOn: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW // Sets the current date as default
  }
}, {
  tableName: 'BookingRatings', // Define the table name in the database
  timestamps: true // Adds createdAt and updatedAt fields
});

// Associations
BookingRating.associate = (models) => {
  BookingRating.belongsTo(models.Booking, { foreignKey: 'bookingId' });
  BookingRating.belongsTo(models.Gym, { foreignKey: 'gymId' });
  BookingRating.belongsTo(models.User, { foreignKey: 'userId' });
};

module.exports = BookingRating;
