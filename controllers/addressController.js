const express = require('express');
const router = express.Router();
const UserAddress = require('../models/UserAddress');
const { v4: uuidv4 } = require('uuid'); // For generating UUIDs


// Middleware to get logged-in user's ID (assuming you have this set up)
const getUserId = (req) => {
    // Replace this with actual logic to get user ID from request
    return req.user.id;
};

// Register a new user
exports.addAddress = async (req, res) => {
    const userId = getUserId(req);

    const newAddress = await UserAddress.create({
        user_id: userId,
        lat: req.body.lat,
        long: req.body.long,
        address_line_1: req.body.address_line_1,
        address_line_2: req.body.address_line_2,
        city: req.body.city,
        state: req.body.state,
        pincode: req.body.pincode,
    });

    res.status(201).json(newAddress);
}




// Register a new user
exports.getAddress = async (req, res) => {
    const userId = getUserId(req);
    const addresses = await UserAddress.findAll({ where: { user_id: userId } });
    res.status(200).json(addresses);
}