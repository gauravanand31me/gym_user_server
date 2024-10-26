const sequelize = require("../config/db");
const { Op } = require('sequelize');
const Notification = require("../models/Notification");

exports.getNotifications = async (req, res) => {
    const userId = req.user.id; // Get the logged-in user ID from the request

    try {
        // Execute the SQL query to fetch notifications and unread count
        const notificationsQuery = `
            SELECT "Notification".*, "Users".username, "Users".profile_pic 
            FROM "Notification" 
            JOIN "Users" ON "Notification"."userId" = "Users".id 
            WHERE "Notification"."userId" = :userId 
            ORDER BY "Notification"."createdAt" DESC
        `;

        // Corrected query for unread count with proper string comparison
        const unreadCountQuery = `
            SELECT COUNT(*) AS unreadCount 
            FROM "Notification" 
            WHERE "userId" = :userId AND "status" = 'unread'
        `;

        // Execute both queries
        const [notifications, unreadCountResult] = await Promise.all([
            sequelize.query(notificationsQuery, {
                replacements: { userId: userId },
                type: sequelize.QueryTypes.SELECT,
            }),
            sequelize.query(unreadCountQuery, {
                replacements: { userId: userId },
                type: sequelize.QueryTypes.SELECT,
            })
        ]);



        // Check if notifications are empty
        if (!notifications || notifications.length === 0) {
            return res.status(404).json({ message: 'No notifications found.' });
        }

        // Extract unread count
        const unreadCount = unreadCountResult[0].unreadcount || 0;

        // Return the fetched results and unread count
        console.log({notifications, unreadCount});
        res.status(200).json({ notifications, unreadCount });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};

exports.markNotificationsAsRead = async (req, res) => {
    const userId = req.user.id; // Get the logged-in user ID from the request

    try {
        // Update the status of all notifications to 'read' for the current user
        const updateQuery = `
            UPDATE "Notification" 
            SET "status" = 'read' 
            WHERE "userId" = :userId AND "status" = 'unread'
        `;

        // Execute the query
        const result = await sequelize.query(updateQuery, {
            replacements: { userId: userId },
            type: sequelize.QueryTypes.UPDATE,
        });

        // Check if any notifications were updated
        if (result[1] === 0) {
            return res.status(404).json({ message: 'No unread notifications found.' });
        }

        res.status(200).json({ message: 'All notifications marked as read.' });

    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({ message: 'Server error.' });
    }
};




exports.deleteOldNotifications = async () => {
    try {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - 2); // Get date 7 days ago
  
      const deletedNotifications = await Notification.destroy({
        where: {
          createdAt: {
            [Op.lt]: daysAgo, // Deletes notifications older than 7 days
          },
        },
      });
  
      console.log(`${deletedNotifications} notifications older than 7 days have been deleted.`);
    } catch (error) {
      console.error('Error deleting old notifications:', error);
    }
};

