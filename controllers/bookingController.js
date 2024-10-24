const Booking = require('../models/Booking');
const sequelize = require("../config/db");
const Razorpay = require('razorpay');
const shortid = require('shortid'); // For generating unique order IDs
const moment = require('moment');
const User = require('../models/User'); // Adjust your model imports as necessary
const Notification = require("../models/Notification");
const BuddyRequest = require('../models/BuddyRequest');
const crypto = require("crypto");
const { v4: uuidv4 } = require('uuid');

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

        await Notification.destroy({
          where: {
            relatedId: requestId // Delete notification buddy request
          }
        });

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
      '    "Booking"."isCheckedIn" AS "visited",\n' +
      '    "Gyms".id AS "gymId", \n' +
      '    "Gyms".name AS "gymName",\n' +
      '    "Gyms".rating AS "gymRating",\n' +
      '    "Slots"."startTime" AS "slotStartTime",\n' +
      '    "Booking".price AS "subscriptionPrice",\n' +
      '    "Booking"."createdAt" AS "create",\n' +
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




// Create Order with custom bookingId and userId
exports.createOrder = async (req, res) => {
  const { amount } = req.body; // Get amount from frontend
  const userId = req.user.id;  // Assuming the user is authenticated and userId is available

  // Generate a custom bookingId
  const bookingId = uuidv4();

  const options = {
    amount: amount * 100, // Razorpay expects amount in paise (1 INR = 100 paise)
    currency: 'INR',
    receipt: bookingId, // Using bookingId as the receipt
    payment_capture: 1 // Automatic payment capture
  };

  try {
    // Step 1: Create Razorpay order
    const orderResponse = await razorpay.orders.create(options);

    // Step 2: Create Razorpay payment link
    const paymentLinkResponse = await razorpay.paymentLink.create({
      amount: amount * 100, // Amount in paise
      currency: 'INR',
      notes: {
        bookingId: bookingId, // Include bookingId in notes
        userId: userId, // Include userId in notes
      },
      callback_url: 'https://yupluck.com/user/api/booking/webhook', // Add your callback URL
      callback_method: 'get'
    });

    console.log("paymentLinkResponse", paymentLinkResponse);
    // Send response back to frontend
    res.json({
      orderId: orderResponse.id,
      currency: orderResponse.currency,
      amount: orderResponse.amount,
      bookingId: bookingId,
      userId: userId, // Send userId in the response
      paymentLink: paymentLinkResponse.short_url // Dynamic payment link
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'Something went wrong while creating the order' });
  }
};



exports.razorPayWebhook = async (req, res) => {
  const secret = 'teslago'; // Set your Razorpay webhook secret

  // Verify the webhook signature
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest('hex');
  console.log("digest is", digest);
  console.log("req.headers['x-razorpay-signature']", req.headers);
  console.log("req.body", req.body);
  if (digest === req.headers['x-razorpay-signature']) {
    // Signature verified, process the payment
    const paymentData = req.body.payload.payment.entity;

    try {
      // Extract necessary data
      const { id: paymentId, amount, currency, status, notes } = paymentData;
      const { bookingId, userId } = notes; // Extract bookingId and userId from notes

      // Save payment information in your database
      await Payment.create({
        paymentId: paymentId,
        bookingId: bookingId,
        userId: userId, // Save the userId along with the payment record
        amount: amount / 100, // Convert from paise to INR
        currency: currency,
        isPaid: status === 'captured', // Check if payment is captured
        paymentDate: new Date(),
      });

      // Optionally, update booking status to 'paid'
      await Booking.update({ isPaid: true }, { where: { bookingId } });

      // Send an HTML response for successful payment
      res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Successful</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background-color: #f4f4f4;
            }
            .container {
              text-align: center;
              background: #fff;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }
            h1 {
              color: #4caf50;
            }
            p {
              margin: 15px 0;
            }
            button {
              padding: 10px 20px;
              background-color: #4caf50;
              color: white;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 16px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Payment Successful!</h1>
            <p>Thank you for your payment.</p>
            <p>You can now close this window.</p>
            <button onclick="window.close()">Close Window</button>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Error processing payment:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Error</title>
        </head>
        <body>
          <h1>Payment Error</h1>
          <p>There was an issue processing your payment. Please contact support.</p>
        </body>
        </html>
      `);
    }
  } else {
    // Invalid signature
    res.status(403).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invalid Signature</title>
      </head>
      <body>
        <h1>Invalid Signature</h1>
        <p>Payment verification failed. Please contact support.</p>
      </body>
      </html>
    `);
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
    user.total_work_out_time += booking.duration;

    // Save the updated user data
    await user.save();

    // Step 5: Set isCheckIn to true for this booking
    booking.isCheckedIn = true;

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
WHERE "Booking"."isCheckedIn" = 'true'
AND "Booking"."userId" = :userId
GROUP BY "Gyms"."id", "Gyms"."name", "Gyms"."rating"
ORDER BY "totalWorkoutHours" DESC;
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






