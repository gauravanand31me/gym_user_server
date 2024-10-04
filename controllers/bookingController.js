const Booking = require('../models/Booking');
const sequelize = require("../config/db");

// Create a booking
exports.createBooking = async (req, res) => {
  const { subscriptionType, slotId, gymId, bookingDate, subscriptionId } = req.body;

  try {
    const booking = await Booking.create({
      slotId,
      gymId,
      userId: req.user.id,
      bookingDate,
      type: subscriptionType,
      subscriptionId
    });

    res.status(201).send(booking);
  } catch (error) {
    console.log("Error is", error);
    res.status(400).send(error.message);
  }
};

// Invite Buddies
exports.inviteBuddies = async (req, res) => {
  const { bookingId, buddyIds } = req.body;

  try {
    const booking = await Booking.findByPk(bookingId);
    if (!booking) return res.status(404).send('Booking not found');

    await booking.update({ invitedBuddies: [...booking.invitedBuddies, ...buddyIds] });
    res.send('Buddies invited successfully');
  } catch (error) {
    res.status(400).send(error.message);
  }
};


// Fetch all Booking by User
exports.getAllBookingsByUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
SELECT 
    "Booking"."bookingId" AS "bookingId",
    "Booking"."userId" AS "userId",
    "Booking"."bookingDate" AS "bookingDate",
    "Gyms".id AS "gymId", 
    "Gyms".name AS "gymName",
    "Gyms".rating AS "gymRating",
    "Slots"."startTime" AS "slotStartTime",
    "Subscriptions".daily AS "subscriptionPrice"
FROM "Booking"
JOIN "Slots" ON "Booking"."slotId" = "Slots".id
JOIN "Gyms" ON "Slots"."gymId" = "Gyms".id
JOIN "Subscriptions" ON "Slots"."gymId" = "Subscriptions"."gymId" -- Change made here
WHERE "Booking"."userId" = :userId
ORDER BY "Booking"."bookingDate" DESC; -- Order by booking date
`;

    // Execute the booking query
    const [results] = await sequelize.query(query, {
      replacements: { userId: userId },
    });

    res.status(200).json({ Booking: results });
  } catch (error) {
    console.error('Error fetching Booking:', error);
    res.status(500).send('Server error');
  }
};



