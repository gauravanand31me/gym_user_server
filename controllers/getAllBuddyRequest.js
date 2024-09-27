const BuddyRequest = require('../models/BuddyRequest');
const sequelize = require("../config/db");

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
        res.status(201).json(newRequest);
    } catch (error) {
        console.log("Error is", error);
        res.status(500).json({ error: 'Unable to create buddy request.' });
    }
}