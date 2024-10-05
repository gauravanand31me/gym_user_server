const BuddyRequest = require('../models/BuddyRequest');
const sequelize = require("../config/db");
const Notification  = require("../models/Notification");
const User = require('../models/User'); // Adjust your model imports as necessary

exports.getAllBuddyRequest = async (req, res) => {
    try {
        // Assuming you have the logged-in user's ID available in req.user.id
        const userId = req.user.id; // Replace this with your logic for fetching the logged-in user's ID.

        // Fetch buddy requests where the logged-in user is either the sender or the receiver
        const buddyRequests = await BuddyRequest.findAll({
            where: {
                [Op.or]: [
                    { fromUserId: userId },
                    { toUserId: userId }
                ]
            },
            include: [
                {
                    model: User,
                    as: 'fromUser', // Ensure that this alias matches your model association
                    attributes: ['id', 'user_name'] // Include necessary attributes
                },
                {
                    model: User,
                    as: 'toUser', // Ensure that this alias matches your model association
                    attributes: ['id', 'user_name'] // Include necessary attributes
                }
            ]
        });
        
        res.json(buddyRequests);
    } catch (error) {
        res.status(500).json({ error: 'Unable to fetch buddy requests.' });
    }
}

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
        });

        res.status(201).json(newRequest);
    } catch (error) {
        console.log("Error is", error);
        res.status(500).json({ error: 'Unable to create buddy request.' });
    }
}