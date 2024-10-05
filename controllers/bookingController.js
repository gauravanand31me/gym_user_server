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

    const query = 'SELECT \n' +
      '    "Booking"."bookingId" AS "bookingId",\n' +
      '    "Booking"."userId" AS "userId",\n' +
      '    "Booking"."bookingDate" AS "bookingDate",\n' +
      '    "Gyms".id AS "gymId", \n' +
      '    "Gyms".name AS "gymName",\n' +
      '    "Gyms".rating AS "gymRating",\n' +
      '    "Slots"."startTime" AS "slotStartTime",\n' +
      '    "Subscriptions".daily AS "subscriptionPrice",\n' +
      '    COUNT("BuddyRequests".id) AS "invitedBuddyCount"  -- Count of buddies invited\n' +
      'FROM "Booking"\n' +
      'JOIN "Slots" ON "Booking"."slotId" = "Slots".id\n' +
      'JOIN "Gyms" ON "Slots"."gymId" = "Gyms".id\n' +
      'JOIN "Subscriptions" ON "Slots"."gymId" = "Subscriptions"."gymId" \n' +
      'LEFT JOIN "BuddyRequests" ON "Booking"."bookingId" = "BuddyRequests"."bookingId"  -- Left join to BuddyRequests\n' +
      `WHERE "Booking"."userId" = '${userId}'\n` +
      'GROUP BY "Booking"."bookingId", "Booking"."userId", "Booking"."bookingDate", "Gyms".id, "Gyms".name, "Gyms".rating, "Slots"."startTime", "Subscriptions".daily\n' +  // Corrected here
      'ORDER BY "Booking"."bookingDate" DESC; -- Order by booking date';

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



