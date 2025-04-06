const BookingRating = require('../models/BookingRating');
const sequelize = require('../config/db'); // Ensure you have access to your sequelize instance

exports.createBookingRating = async (req, res) => {
    const { bookingId, gymId, rating, description } = req.body;
    const userId = req.user.id;

    try {
        // Check if a rating already exists for this bookingId and userId
        let existingRating = await BookingRating.findOne({
            where: {
                bookingId,
                userId
            }
        });

        if (existingRating) {
            // Update existing rating
            existingRating.rating = rating;
            existingRating.ratedOn = new Date();
            await existingRating.save();
        } else {
            // Create a new rating
            await BookingRating.create({
                bookingId,
                gymId,
                userId,
                rating,
                description,
                ratedOn: new Date()
            });
        }

        // Recalculate the average rating for the gym
        const [results] = await sequelize.query(`
            SELECT AVG(rating) AS averageRating, COUNT(rating) AS ratingCount
            FROM "BookingRatings"
            WHERE "gymId" = :gymId
        `, {
            replacements: { gymId },
            type: sequelize.QueryTypes.SELECT
        });

        
        const averageRating = Math.round(results.averagerating) || rating; // Default to 0 if no ratings exist
        const ratingCount = results.ratingcount || 0;

        console.log("results.averageRating", results.averageRating);
        // Update the gym's rating and rating count
        await sequelize.query(`
            UPDATE "Gyms"
            SET rating = :averageRating,
                total_rating = :ratingCount
            WHERE id = :gymId
        `, {
            replacements: { averageRating, ratingCount, gymId }
        });

        return res.status(200).json({
            message: existingRating ? 'Rating updated successfully' : 'Rating created successfully',
            rating: existingRating || { bookingId, gymId, userId, rating, ratedOn: new Date() }
        });

    } catch (error) {
        console.error('Error creating/updating booking rating:', error);
        return res.status(500).json({ message: 'An error occurred while processing your request', error });
    }
};





exports.getBookingRating = async (req, res) => {
    const { bookingId } = req.query; // Extract bookingId from query parameters
    const userId = req.user.id; // Assuming you're using middleware to populate req.user with the authenticated user's details

    try {
        // Fetch the booking rating for the given bookingId and userId
        const bookingRating = await BookingRating.findOne({
            where: {
                bookingId,
                userId
            }
        });

        if (!bookingRating) {
            return res.status(404).json({ message: 'Booking rating not found' });
        }

        // Return the booking rating as a response
        res.status(200).json({ bookingRating });
    } catch (error) {
        console.error('Error fetching booking rating:', error);
        res.status(500).json({ message: 'An error occurred while fetching the booking rating', error });
    }
};
