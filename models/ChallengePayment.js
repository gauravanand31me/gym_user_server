const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ChallengePayment = sequelize.define('ChallengePayment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  challengeId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'success', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
  },
}, {
  tableName: 'ChallengePayments',
  timestamps: true,
});

// Associations
ChallengePayment.associate = (models) => {
  ChallengePayment.belongsTo(models.User, { foreignKey: 'userId' });
  ChallengePayment.belongsTo(models.Challenge, { foreignKey: 'challengeId' });
};

module.exports = ChallengePayment;
