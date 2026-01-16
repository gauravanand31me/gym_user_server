const express = require('express');
const router = express.Router();
const UserAddress = require('../models/UserAddress');
const { v4: uuidv4 } = require('uuid'); // For generating UUIDs
const User = require('../models/User');
const sequelize = require('../config/db');


// Middleware to get logged-in user's ID (assuming you have this set up)
const getUserId = (req) => {
    // Replace this with actual logic to get user ID from request
    return req.user.id;
};

// Register a new user
exports.addAddress = async (req, res) => {
    try {
        const userId = getUserId(req);

        const addressData = {
            lat: req.body.lat,
            long: req.body.long,
            address_line_1: req.body.address_line_1,
            address_line_2: req.body.address_line_2,
            city: req.body.city,
            state: req.body.state,
            pincode: req.body.pincode,
        };

        const existingAddress = await UserAddress.findOne({
            where: { user_id: userId }
        });

        let result;

        if (existingAddress) {
            // Update
            result = await existingAddress.update(addressData);
        } else {
            // Insert
            result = await UserAddress.create({
                user_id: userId,
                ...addressData
            });
        }

        return res.status(201).json(result);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Failed to add/update address" });
    }
};





// Register a new user


exports.getAddress = async (req, res) => {
    try {
        const userLat = parseFloat(req.query.lat);
        const userLong = parseFloat(req.query.long);
        const radius = parseFloat(req.query.radius || 5); // KM
    
        if (!userLat || !userLong) {
          return res.status(400).json({
            message: "Latitude and Longitude are required",
          });
        }
    
        const query = `
          SELECT
    u.id AS "userId",
    u.full_name,
    u.username,
    u.profile_pic,
    u.spec,
    u.gender,
    u.is_trainer,
    u.gym_name,

    ua.lat,
    ua.long,
    ua.city,
    ua.state,
    ua.pincode,

    (
        6371 * acos(
            cos(radians(:userLat))
            * cos(radians(ua.lat))
            * cos(radians(ua.long) - radians(:userLong))
            + sin(radians(:userLat))
            * sin(radians(ua.lat))
        )
    ) AS distance,

    COUNT(students.id) AS student_count

FROM "Users" u
INNER JOIN "UserAddresses" ua ON u.id = ua.user_id

LEFT JOIN "Users" students
    ON students.t_id = u.id
   AND students.id != u.id               -- prevent counting self as student (if ever possible)

WHERE LOWER(u.is_trainer) IN ('true', 'trainer', 'yes', '1')
  AND (
      6371 * acos(
          cos(radians(:userLat))
          * cos(radians(ua.lat))
          * cos(radians(ua.long) - radians(:userLong))
          + sin(radians(:userLat))
          * sin(radians(ua.lat))
      )
  ) <= :radius

GROUP BY
    u.id, ua.lat, ua.long, ua.city, ua.state, ua.pincode,
    u.full_name, u.username, u.profile_pic, u.spec, u.gender,
    u.is_trainer, u.gym_name

ORDER BY distance ASC;
        `;
    
        const trainers = await sequelize.query(query, {
          replacements: {
            userLat,
            userLong,
            radius,
          },
          type: sequelize.QueryTypes.SELECT,
        });
    
        return res.status(200).json(trainers);
      } catch (error) {
        console.error("Nearby trainers error:", error);
        return res.status(500).json({
          message: "Failed to fetch nearby trainers",
        });
      }
  };