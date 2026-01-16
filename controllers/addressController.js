const express = require('express');
const router = express.Router();
const UserAddress = require('../models/UserAddress');
const { v4: uuidv4 } = require('uuid'); // For generating UUIDs
const User = require('../models/User');


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
          message: "Latitude and Longitude are required"
        });
      }
  
      const query = `
        SELECT
          "Users".id AS "userId",
          "Users".full_name,
          "Users".username,
          "Users".profile_pic,
          "Users".spec,
          "Users".gender,
          "Users".is_trainer,
  
          "UserAddresses".id AS "addressId",
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
  
        WHERE "Users".is_trainer = true
  
        HAVING (
          6371 * acos(
            cos(radians(:userLat))
            * cos(radians("UserAddresses".lat))
            * cos(radians("UserAddresses".long) - radians(:userLong))
            + sin(radians(:userLat))
            * sin(radians("UserAddresses".lat))
          )
        ) <= :radius
  
        ORDER BY distance ASC
      `;
  
      const trainers = await sequelize.query(query, {
        replacements: {
          userLat,
          userLong,
          radius
        },
        type: sequelize.QueryTypes.SELECT
      });
  
      return res.status(200).json(trainers);
    } catch (error) {
      console.error("Nearby trainers error:", error);
      return res.status(500).json({
        message: "Failed to fetch nearby trainers"
      });
    }
  };