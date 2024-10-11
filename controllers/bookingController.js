const Booking = require('../models/Booking');
const sequelize = require("../config/db");
const Razorpay = require('razorpay');
const shortid = require('shortid'); // For generating unique order IDs


const razorpay = new Razorpay({
  key_id: process.env.RAZOR_PAY_PAYMENT_KEY,
  key_secret: process.env.RAZOR_PAY_PAYMENT_SECRET,
});

// Create a booking
exports.createBooking = async (req, res) => {
  const { subscriptionType, slotId, gymId, bookingDate, subscriptionId, duration, price } = req.body;
  console.log("Booking date received", bookingDate);
  const stringBookingId = `${gymId.substring(0, 3).toUpperCase()}${Math.floor(100000000 + Math.random() * 900000000)}`;
  try {
    const booking = await Booking.create({
      slotId,
      gymId,
      userId: req.user.id,
      bookingDate,
      type: subscriptionType,
      subscriptionId,
      duration,
      price,
      stringBookingId
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
      '    "Booking"."stringBookingId" AS "bookingId",\n' +
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



exports.createOrder = async (req, res) => {
  const { amount } = req.body; // You will send this from the frontend

  const payment_capture = 1; // Automatic capture after successful payment
  const currency = 'INR'; // You can change currency as per your need

  const options = {
    amount: amount * 100, // Razorpay expects amount in paise, so multiply by 100
    currency,
    receipt: shortid.generate(),
    payment_capture,
  };

  try {
    const response = await razorpay.orders.create(options);
 
    res.json({
      id: response.id,
      currency: response.currency,
      amount: response.amount,
      paymentLink: `https://rzp.io/rzp/P6ns3cf`
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};


exports.verifyBooking = async (req, res) => {

  try {
    const { bookingId } = req.query;

    // Step 1: Fetch the booking details by bookingId and userId
    const booking = await Booking.findOne({
      where: {
        stringBookingId: bookingId,
      },
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Step 2: Check if the booking date matches the current date
    const currentDate = moment().format('YYYY-MM-DD');
    const bookingDate = moment(booking.booking_date).format('YYYY-MM-DD');

    if (currentDate !== bookingDate) {
      return res.status(400).json({ message: 'Booking is not for today' });
    }



    // Step 4: Update the user's workout hours
    const user = await User.findOne({ where: { id: booking.userId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Increment the user's workout hours by the booking duration
    user.total_work_out_time += bookingDuration;

    // Save the updated user data
    await user.save();

    // Step 5: Set isCheckIn to true for this booking
    booking.isCheckIn = true;

    // Save the updated booking
    await booking.save();

    // Respond with success
    res.send("User Successfully verified");
  } catch (error) {
    console.error('Error in createOrder:', error);
    res.send("User cannot be verified");
  }


}



