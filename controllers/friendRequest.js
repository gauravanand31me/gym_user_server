// routes/friendRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Adjust your model imports as necessary
const FriendRequest  = require("../models/FriendRequest");
const Notification  = require("../models/Notification");
const sequelize = require("../config/db");
const { v4: uuidv4 } = require('uuid');
const PushNotification = require('../models/PushNotification');

exports.sendFriendRequest = async (req, res) => {
    const { userId } = req.body; // ID of the user to send a friend request to
    const loggedInUserId = req.user.id; // ID of the logged-in user
  
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
        id: uuidv4(),
        fromUserId: loggedInUserId,
        toUserId: userId,
        status: 'pending'
      });
  
      // Fetch the user who is sending the request
      const fromUser = await User.findOne({
        where: { id: loggedInUserId },
        attributes: ['id', 'full_name', 'profile_pic'] // Get only the needed fields like id and name
      });
      
  
      // Create a new notification for the recipient
      const notification = await Notification.create({
        userId: userId, // Recipient of the notification (the person receiving the friend request)
        message: `${fromUser.full_name} has sent you a friend request.`, // Notification message
        type: 'friendRequest', // Type of notification
        status: 'unread', // Notification status (you could use 'unread' as default)
        relatedId: friendRequest.id, // Store related friend request ID
        profileImage: fromUser.profile_pic || "https://png.pngtree.com/png-vector/20190223/ourmid/pngtree-profile-glyph-black-icon-png-image_691589.jpg"
      });

      const notificationData = await PushNotification.findOne({
        where: { id: userId }
      });

      const notificationTitle = {
        title: "New Friend Request",
        message: `${fromUser.full_name} has sent you a friend request.`, // Notification message
      }

      await sendPushNotification(notificationData?.expoPushToken, notificationTitle);
  
      return res.status(201).json({ 
        message: "Friend request sent and notification created.",
        friendRequest,
        notification
      });
    } catch (error) {
      console.error("Error sending friend request:", error);
      return res.status(500).json({ message: "Server error." });
    }
};



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

        // Fetch the user who sent the friend request
        const fromUser = await User.findOne({
            where: { id: request.toUserId },
            attributes: ['id', 'full_name', 'profile_pic'] // Get only the needed fields
        });

        // Delete the existing notification for the friend request
        await Notification.destroy({
            where: {
              relatedId: requestId // The friend request ID
            }
        });

       

        // Optionally, you can create a new entry for the reverse relationship
        await FriendRequest.create({
            id: uuidv4(),
            fromUserId: request.toUserId,
            toUserId: request.fromUserId,
            status: 'accepted',
            sentOn: new Date(),
        });


        await FriendRequest.create({
          id: uuidv4(),
          fromUserId: request.fromUserId,
          toUserId: request.toUserId,
          status: 'accepted',
          sentOn: new Date(),
        });

        // Update the friend counts for both users
        await User.increment('followers_count', { by: 1, where: { id: request.fromUserId } });
        await User.increment('followers_count', { by: 1, where: { id: request.toUserId } });

        // Create a new notification for the sender
        await Notification.create({
            userId: request.fromUserId, // Recipient of the notification (the person who sent the request)
            message: `${fromUser.full_name} has accepted your friend request.`, // Notification message
            type: 'friendRequestAcceptance', // Type of notification
            status: 'unread', // Notification status
            relatedId: requestId, // Store related friend request ID
            profileImage: fromUser.profile_pic || "https://png.pngtree.com/png-vector/20190223/ourmid/pngtree-profile-glyph-black-icon-png-image_691589.jpg"
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
             WHERE fr."toUserId" = :userId AND (fr.status = 'accepted')`,
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

      

      // Delete both entries from the FriendRequest table
      await FriendRequest.destroy({
          where: {
              fromUserId: request.fromUserId,
              toUserId: request.toUserId
          }
      });

      if (request.status == "accepted") {
        await FriendRequest.destroy({
          where: {
              fromUserId: request.toUserId,
              toUserId: request.fromUserId
          }
        });
        await User.increment('followers_count', { by: -1, where: { id: request.fromUserId } });
        await User.increment('followers_count', { by: -1, where: { id: request.toUserId } });
      }
      

      // Decrement friend counts for both users
      

      return res.status(200).json({ message: "Friend request rejected." });
  } catch (error) {
      console.error("Error rejecting friend request:", error);
      return res.status(500).json({ message: "Server error." });
  }
};





const sendPushNotification = async (expoPushToken, message) => {
  const body = {
      to: expoPushToken,
      sound: 'default',
      title: message.title,
      body: message.body,
      data: { someData: 'goes here' },
  };

  try {
      const response = await axios.post('https://exp.host/--/api/v2/push/send', body);
      return response.data;
  } catch (error) {
      console.error('Error sending push notification:', error.response ? error.response.data : error.message);
  }
};
