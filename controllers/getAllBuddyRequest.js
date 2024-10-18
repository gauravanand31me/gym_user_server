const BuddyRequest = require('../models/BuddyRequest');
const sequelize = require("../config/db");
const Notification  = require("../models/Notification");
const User = require('../models/User'); // Adjust your model imports as necessary
const { Op } = require('sequelize');

exports.getAllBuddyRequest = async (req, res) => {
    try {
        // Assuming you have the logged-in user's ID available in req.user.id
        const userId = req.user.id; // Replace this with your logic for fetching the logged-in user's ID.
        const { bookingId } = req.query; // Assuming bookingId is passed as a query parameter

        // Fetch buddy requests where the logged-in user is either the sender or the receiver and optionally filter by bookingId
        const whereCondition = {
            [Op.or]: [
                { fromUserId: userId },
                { toUserId: userId }
            ]
        };

        

        // If bookingId is provided, add it to the where clause
        if (bookingId) {
            whereCondition.bookingId = bookingId;
        }

        const buddyRequests = await BuddyRequest.findAll({
            where: whereCondition,
            include: [
                {
                    model: User,
                    as: 'fromUser', // Ensure that this alias matches your model association
                    attributes: ['id', 'full_name', 'profile_pic'] // Include necessary attributes
                },
                {
                    model: User,
                    as: 'toUser', // Ensure that this alias matches your model association
                    attributes: ['id', 'full_name', 'profile_pic'] // Include necessary attributes
                }
            ]
        });

        res.json(buddyRequests);
    } catch (error) {
        console.error("Error is", error);
        res.status(500).json({ error: 'Unable to fetch buddy requests.' });
    }
};

exports.sendBuddyRequest = async (req, res) => {
    const { toUserId, bookingId } = req.body;
    
    const userId = req.user.id; // Replace this with your logic for fetching the logged-in user's ID.
    try {
        const newRequest = await BuddyRequest.create({
            fromUserId:userId,
            toUserId,
            bookingId
        });


        const fromUser = await User.findByPk(userId);
 

        // Create the notification for the user receiving the invite
        await Notification.create({
            userId: toUserId, // Recipient of the notification (the buddy receiving the invite)
            message: `${fromUser.full_name} has invited you to a workout session.`, // Custom message
            type: 'buddyInvite', // Notification type
            status: 'unread', // Set status to unread initially
            relatedId: bookingId, // Store the booking ID for reference (or invite request ID)
            profileImage: fromUser.profile_pic || "https://png.pngtree.com/png-vector/20190223/ourmid/pngtree-profile-glyph-black-icon-png-image_691589.jpg"
        });

        res.status(201).json(newRequest);
    } catch (error) {
        console.log("Error is", error);
        res.status(500).json({ error: 'Unable to create buddy request.' });
    }
}