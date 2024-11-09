const BookingRating = require('../models/BookingRating');
const sequelize = require('../config/db'); // Ensure you have access to your sequelize instance

exports.createBookingRating = async (req, res) => {
    const { bookingId, gymId, rating } = req.body;
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
            return res.status(200).json({ message: 'Rating updated successfully', rating: existingRating });
        }

        // Calculate the average rating for the gym using a raw query
        const [results] = await sequelize.query(`
            SELECT AVG(rating) AS averageRating
            FROM "BookingRatings"
            WHERE "gymId" = :gymId
        `, {
            replacements: { gymId },
            type: sequelize.QueryTypes.SELECT
        });

        const averageRating = results.averageRating || 0; // Default to 0 if no ratings exist

        // Create the new rating before updating the gym's rating
        console.log("(averageRating + rating) / 2", (averageRating + rating) / 2);
        const newRating = await BookingRating.create({
            bookingId,
            gymId,
            userId,
            rating,
            ratedOn: new Date()
        });

      
        // Update the total rating for the gym using a raw query
        await sequelize.query(`
            UPDATE "Gyms"
            SET rating = :averageRating,
                total_rating_count = total_rating_count + 1
            WHERE id = :gymId
        `, {
            replacements: { averageRating: (averageRating + rating) / 2, gymId } // Update to average with new rating
        });
        
        return res.status(201).json({ message: 'Rating created successfully', rating: newRating });

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
