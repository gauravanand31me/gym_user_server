const Booking = require('../models/Booking');
const sequelize = require("../config/db");
const Razorpay = require('razorpay');
const shortid = require('shortid'); // For generating unique order IDs
const moment = require('moment');
const User = require('../models/User'); // Adjust your model imports as necessary
const Notification  = require("../models/Notification");
const BuddyRequest = require('../models/BuddyRequest');

const razorpay = new Razorpay({
  key_id: process.env.RAZOR_PAY_PAYMENT_KEY,
  key_secret: process.env.RAZOR_PAY_PAYMENT_SECRET,
});

// Create a booking
exports.createBooking = async (req, res) => {
  const { subscriptionType, slotId, gymId, bookingDate, subscriptionId, duration, price, requestId } = req.body; // Added requestId

  
  // Generate a random booking ID string based on the gymId and a random number
  const stringBookingId = `${gymId.substring(0, 3).toUpperCase()}${Math.floor(100000000 + Math.random() * 900000000)}`;

  try {
    // Check if the requestId is available (this means a friend request is involved)
    if (requestId) {
      // Find the booking that the requestId (bookingId) refers to
      const relatedBooking = await Booking.findByPk(requestId);

      if (relatedBooking) {
        // Get the user who made the original booking (to notify them)
        const toUser = await User.findByPk(relatedBooking.userId); // User who will receive the notification
        const fromUser = await User.findByPk(req.user.id); // User who is accepting the buddy request

        // Create a notification for the recipient that the buddy request has been accepted
        const notification = await Notification.create({
          userId: relatedBooking.userId, // The user who made the original booking (to be notified)
          message: `${fromUser.full_name} has accepted your buddy request.`, // Notification message
          type: 'acceptedBuddyRequest', // Notification type
          status: 'unread', // Unread by default
          relatedId: requestId, // Related to the bookingId (buddy request)
          profileImage: fromUser.profile_pic || "https://png.pngtree.com/png-vector/20190223/ourmid/pngtree-profile-glyph-black-icon-png-image_691589.jpg" // Use default profile pic if not available
        });
        

        console.log("Notification created for buddy request:", notification);

        const buddyRequest = await BuddyRequest.findOne({
          where: { bookingId: requestId } // Adjust this if you have a different key for your buddy requests
        });
      
        if (buddyRequest) {
          buddyRequest.status = 'accepted'; // Update the status
          await buddyRequest.save(); // Save the changes
          console.log(`Buddy request with ID ${requestId} has been accepted.`);
        } else {
          console.log(`Buddy request with ID ${requestId} not found.`);
        }

      } else {
        console.log(`Booking with ID ${requestId} not found.`);
      }
    }

    // Create the booking in the database
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

    // Send the booking as a response
    res.status(201).send(booking);
  } catch (error) {
    console.log("Error while creating booking:", error);
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
      '    "Booking"."bookingId" AS "id",\n' +
      '    "Booking"."stringBookingId" AS "bookingId",\n' +
      '    "Booking"."userId" AS "userId",\n' +
      '    "Booking"."bookingDate" AS "bookingDate",\n' +
      '    "Gyms".id AS "gymId", \n' +
      '    "Gyms".name AS "gymName",\n' +
      '    "Gyms".rating AS "gymRating",\n' +
      '    "Slots"."startTime" AS "slotStartTime",\n' +
      '    "Booking".price AS "subscriptionPrice",\n' +
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
      paymentLink: `https://rzp.io/rzp/hPYrMUH`
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Something went wrong' });
  }
};


exports.razorPayWebhook = async (req, res) => {
  const secret = "dolbina";

  const shasum = crypto.createHmac("sha256", secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest("hex");

  if (digest === req.headers["x-razorpay-signature"]) {
    // Payment was successful
    const paymentData = req.body;
    
    // Handle successful payment logic here (e.g., update database, notify user)

    console.log("Payment successful:", paymentData);
    res.status(200).json({ status: "ok" });
  } else {
    // Invalid signature
    res.status(403).json({ status: "Invalid signature" });
  }
}

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
    user.total_work_out_time += booking.duration;

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


exports.getIndividualBooking = async (req, res) => {
  const { requestId } = req.query; // Extract requestId from query parameters

  try {
    // Query to fetch booking details with slot and gym information
    const query = `
      SELECT 
        "Booking"."stringBookingId" AS "bookingId",
        "Booking"."userId" AS "userId",
        "Booking"."bookingDate" AS "bookingDate",
        "Gyms".id AS "gymId",
        "Gyms".name AS "gymName",
        "Gyms".rating AS "gymRating",
        "Slots"."startTime" AS "slotStartTime",
        "Booking".price AS "subscriptionPrice",
        "Booking".duration AS "bookingDuration",
        "Booking"."slotId" AS "bookingSlotId",
        "Booking"."subscriptionId" AS "bookingSubscriptionId"
      FROM "Booking"
      JOIN "Slots" ON "Booking"."slotId" = "Slots".id
      JOIN "Gyms" ON "Slots"."gymId" = "Gyms".id
      WHERE "Booking"."bookingId" = :requestId
    `;

    // Execute the booking query
    const [results] = await sequelize.query(query, {
      replacements: { requestId },
    });

    // Check if the booking exists
    if (results.length === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Send the booking details as a response
    res.status(200).json({ booking: results[0] }); // Return the first result
  } catch (error) {
    console.error('Error fetching individual booking:', error);
    res.status(500).send('Server error');
  }
};




exports.getAllVisitedGymsWithWorkoutHours = async (req, res) => {
  try {
    const userId = req.query.id || req.user.id; // Get the logged-in user's ID

    // Query to fetch all visited gyms with total workout hours for the user
    const query = `
      SELECT 
        "Gyms"."id" AS "gymId",
        "Gyms"."name" AS "gymName",
        "Gyms"."rating" AS "gymRating",
        SUM("Booking"."duration") AS "totalWorkoutHours" -- Sum of workout duration at each gym
      FROM "Booking"
      JOIN "Gyms" ON "Booking"."gymId" = "Gyms"."id"
      WHERE "Booking"."userId" = :userId
      GROUP BY "Gyms"."id", "Gyms"."name", "Gyms"."city", "Gyms"."rating"
      ORDER BY "totalWorkoutHours" DESC; -- Order by total workout hours
    `;

    // Execute the query
    const [results] = await sequelize.query(query, {
      replacements: { userId },
    });

    // Send the results as a response
    res.status(200).json({ visitedGyms: results });
  } catch (error) {
    console.error('Error fetching visited gyms with workout hours:', error);
    res.status(500).send('Server error');
  }
};


exports.getAllBuddiesWithWorkoutHours = async (req, res) => {
  try {
    const userId = req.query.id || req.user.id; // Get the logged-in user's ID

    // SQL query to fetch all buddies (toUserId) and their total workout hours where fromUserId is the logged-in user
    const query = `
      SELECT 
        "Users"."id" AS "buddyId",
        "Users"."full_name" AS "buddyName",
        SUM("Booking"."duration") AS "totalWorkoutHours" -- Sum of workout hours for each buddy
      FROM "BuddyRequests"
      JOIN "Users" ON "BuddyRequests"."toUserId" = "Users"."id"
      LEFT JOIN "Booking" ON "Booking"."userId" = "Users"."id" 
      WHERE "BuddyRequests"."fromUserId" = :userId
      AND "BuddyRequests"."status" = 'accepted'
      GROUP BY "Users"."id", "Users"."full_name"
      ORDER BY "totalWorkoutHours" DESC; -- Order by workout hours in descending order
    `;

    // Execute the query using Sequelize or any database connection
    const [results] = await sequelize.query(query, {
      replacements: { userId },
    });

    // Send the buddy workout data as a response
    res.status(200).json({ buddiesWithWorkoutHours: results });
  } catch (error) {
    console.error('Error fetching buddies with workout hours:', error);
    res.status(500).send('Server error');
  }
};






