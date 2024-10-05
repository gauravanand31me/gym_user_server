const sequelize = require("../config/db");

exports.getNotifications = async (req, res) => {
    const userId = req.user.id; // Get the logged-in user ID from the request

    try {
        // Execute the SQL query to fetch notifications
        const results = await sequelize.query(
            `SELECT "Notification".*, "Users".username, "Users".profile_pic 
             FROM "Notification" 
             JOIN "Users" ON "Notification"."userId" = "Users".id 
             WHERE "Notification"."userId" = :userId 
             ORDER BY "Notification"."createdAt" DESC`,
            {
                replacements: { userId: userId },
                type: sequelize.QueryTypes.SELECT,
            }
        );

        // Check if results are empty
        if (!results || results.length === 0) {
            return res.status(404).json({ message: 'No notifications found.' });
        }

        // Return the fetched results
        res.status(200).json({ results });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};
