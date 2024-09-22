// routes/friendRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Adjust your model imports as necessary
const FriendRequest  = require("../models/FriendRequest");
const sequelize = require("../config/db");


exports.sendFriendRequest = async (req, res) => {
    const { userId } = req.body; // ID of the user to send a friend request to
  const loggedInUserId = req.user.id; // ID of the logged-in user

  console.log("loggedInUserId", loggedInUserId);

  if (!userId || loggedInUserId === userId) {
    return res.status(400).json({ message: "Invalid request." });
  }

  try {
    // Check if a friend request already exists
    const existingRequest = await FriendRequest.findOne({
      where: {
        fromUserId: loggedInUserId,
        toUserId: userId,
        status: 'pending'
      }
    });

    if (existingRequest) {
      return res.status(400).json({ message: "Friend request already sent." });
    }

    // Create a new friend request
    const friendRequest = await FriendRequest.create({
      fromUserId: loggedInUserId,
      toUserId: userId,
      status: 'pending'
    });

    return res.status(201).json({ message: "Friend request sent.", friendRequest });
  } catch (error) {
    console.error("Error sending friend request:", error);
    return res.status(500).json({ message: "Server error." });
  }
}



exports.acceptRequest = async (req, res) => {
    const { requestId } = req.body;

    try {
        const request = await FriendRequest.findByPk(requestId);

        if (!request) {
            return res.status(404).json({ message: "Friend request not found." });
        }

        if (request.toUserId !== req.user.id) {
            return res.status(403).json({ message: "Not authorized." });
        }

        // Update the status to 'accepted'
        request.status = 'accepted';
        request.acceptedOn = new Date(); // Adding accepted timestamp
        await request.save();

       
        // Optionally, you can create a new entry for the reverse relationship
        await FriendRequest.create({
            fromUserId: request.toUserId,
            toUserId: request.fromUserId,
            status: 'accepted',
            sentOn: new Date(),
        });

        return res.status(200).json({ message: "Friend request accepted." });
    } catch (error) {
        console.error("Error accepting friend request:", error);
        return res.status(500).json({ message: "Server error." });
    }
};



exports.getFriendRequests = async (req, res) => {
    const userId = req.user.id;

    try {
        const requests = await sequelize.query(
            `SELECT fr.*, u.id as "fromUserId", u.full_name, u.profile_pic 
             FROM "FriendRequests" fr
             JOIN "Users" u ON fr."fromUserId" = u.id
             WHERE fr."toUserId" = :userId AND (fr.status = 'pending' OR fr.status = 'accepted')`,
            {
                replacements: { userId },
                type: sequelize.QueryTypes.SELECT
            }
        );

        const pendingRequests = requests.filter(req => req.status === 'pending');
        const acceptedRequests = requests.filter(req => req.status === 'accepted');

        res.status(200).json({ pending: pendingRequests, accepted: acceptedRequests });
    } catch (error) {
        console.error('Error fetching friend requests:', error);
        res.status(500).send('Server error');
    }
};



exports.rejectRequest = async (req, res) => {
    const { requestId } = req.body;

    try {
        const request = await FriendRequest.findByPk(requestId);

        if (!request) {
            return res.status(404).json({ message: "Friend request not found." });
        }

        if (request.toUserId !== req.user.id) {
            return res.status(403).json({ message: "Not authorized." });
        }

        // Remove entry from FriendRequest table
        await request.destroy();

        return res.status(200).json({ message: "Friend request rejected." });
    } catch (error) {
        console.error("Error rejecting friend request:", error);
        return res.status(500).json({ message: "Server error." });
    }
};
