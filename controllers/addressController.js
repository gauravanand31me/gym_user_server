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
    const userLat = parseFloat(req.query.lat)
    const userLong = parseFloat(req.query.long)
    const radius = parseFloat(req.query.radius || 100) // KM

    // pagination
    const limit = parseInt(req.query.limit, 10) || 10
    const offset = parseInt(req.query.offset, 10) || 0

    // search
    const search = req.query.search?.trim() || ""

    if (Number.isNaN(userLat) || Number.isNaN(userLong)) {
      return res.status(400).json({
        message: "Latitude and Longitude are required",
      })
    }

    const query = `
      SELECT *
      FROM (
        SELECT
          "Users".id AS "userId",
          "Users".full_name,
          "Users".username,
          "Users".profile_pic,
          "Users".spec,
          "Users".gender,
          "Users".is_trainer,
          "Users".gym_name,

          "UserAddresses".lat,
          "UserAddresses".long,
          "UserAddresses".city,
          "UserAddresses".state,
          "UserAddresses".pincode,

          (
            6371 * acos(
              cos(radians(:userLat))
              * cos(radians("UserAddresses".lat))
              * cos(radians("UserAddresses".long) - radians(:userLong))
              + sin(radians(:userLat))
              * sin(radians("UserAddresses".lat))
            )
          ) AS distance

        FROM "UserAddresses"
        INNER JOIN "Users"
          ON "Users".id = "UserAddresses".user_id

        WHERE LOWER("Users".is_trainer) IN ('true', 'trainer', 'yes', '1')

        AND (
          :search = ''
          OR LOWER("Users".full_name) LIKE LOWER(:searchLike)
          OR LOWER("Users".username) LIKE LOWER(:searchLike)
        )
      ) AS trainer_distance

      WHERE distance <= :radius
      ORDER BY distance ASC
      LIMIT :limit OFFSET :offset
    `

    const trainers = await sequelize.query(query, {
      replacements: {
        userLat,
        userLong,
        radius,
        limit,
        offset,
        search,
        searchLike: `%${search}%`,
      },
      type: sequelize.QueryTypes.SELECT,
    })

    return res.status(200).json({
      limit,
      offset,
      count: trainers.length,
      data: trainers,
    })
  } catch (error) {
    console.error("Nearby trainers error:", error)
    return res.status(500).json({
      message: "Failed to fetch nearby trainers",
    })
  }
}

