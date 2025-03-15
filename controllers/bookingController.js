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
const { sendPushNotification } = require('../config/pushNotification');
const PushNotification = require('../models/PushNotification');

const razorpay = new Razorpay({
  key_id: process.env.RAZOR_PAY_PAYMENT_KEY,
  key_secret: process.env.RAZOR_PAY_PAYMENT_SECRET,
});




// Create a booking
exports.createBooking = async (req, res) => {
  let { subscriptionType, slotId, gymId, bookingDate, subscriptionId, duration, price, requestId } = req.body;

  const stringBookingId = `${gymId.substring(0, 3).toUpperCase()}${Math.floor(100000000 + Math.random() * 900000000)}`;

  try {

    if (subscriptionType === "Daily") {
      const [results] = await sequelize.query(`
        SELECT s."timePeriod", g.verified 
        FROM "Slots" s 
        JOIN "Gyms" g ON g.id = :gymId 
        WHERE s.id = :slotId`, {
        replacements: { gymId, slotId }
      });

      if (results.length === 0) {
        return res.status(400).send("Invalid slot or gym.");
      }

      const { timePeriod, verified } = results[0];

      if (timePeriod <= 0) {
        return res.status(400).send("Slot is not available for booking at this moment");
      }

      if (!verified) {
        return res.status(400).send("Gym is not available please try after sometime");
      }
    }
    // Raw SQL query to check slot and gym conditions


    // Format the booking date
    const date = new Date(bookingDate);
    const formattedDate = date.toISOString().slice(0, 10);




    // Create the booking in the database
    const booking = await Booking.create({
      slotId,
      gymId,
      userId: req.user.id,
      bookingDate: formattedDate,
      type: subscriptionType.toLowerCase(),
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




exports.declineBuddyRequest = async (req, res) => {
  try {
    // Find the buddy request
    const { requestId } = req.params; // Added requestId
    const buddyRequest = await BuddyRequest.findOne({
      where: { bookingId: requestId, toUserId: req.user.id },
    });

    if (!buddyRequest) {
      console.log(`Buddy request with ID ${requestId} not found.`);
      res.status(404).json({
        success: false,
        message: `Buddy request with ID ${requestId} not found.`,
      });
    }

    // Update the status to 'declined'
    if (requestId) {
      // Find the booking that the requestId (bookingId) refers to


      if (buddyRequest) {
        // Get the user who made the original booking (to notify them)
        const toUser = await User.findByPk(buddyRequest.fromUserId); // User who will receive the notification
        const fromUser = await User.findByPk(req.user.id); // User who is deleting the buddy request

        await Notification.destroy({
          where: {
            relatedId: requestId // Delete notification buddy request
          }
        });

        // Create a notification for the recipient that the buddy request has been accepted
        const notification = await Notification.create({
          userId: toUser.id, // The user who made the original booking (to be notified)
          message: `${fromUser.full_name} has declined your buddy request.`, // Notification message
          type: 'declinedBuddyRequest', // Notification type
          status: 'unread', // Unread by default
          relatedId: requestId, // Related to the bookingId (buddy request)
          profileImage: fromUser.profile_pic || "https://png.pngtree.com/png-vector/20190223/ourmid/pngtree-profile-glyph-black-icon-png-image_691589.jpg", // Use default profile pic if not available
          forUserId: req.user.id
        });


        console.log("Notification created for buddy request:", notification);
        buddyRequest.status = 'declined'; // Update the status
        await buddyRequest.save(); // Save the changes
        console.log(`Buddy request with ID ${requestId} has been deleted.`);


      } else {
        console.log(`Booking with ID ${requestId} not found.`);
      }
      res.status(200).json({
        status: true,
        message: 'workout request has been declined',
      });
    }
  } catch (error) {
    console.error("Error declining buddy request:", error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while declining the buddy request.',
    });
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
    const { selectedTab } = req.query;

    // Base query
    let query = `
      SELECT 
          "Booking"."bookingId" AS "id",
          "Booking"."stringBookingId" AS "bookingId",
          "Booking"."userId" AS "userId",
          "Booking"."bookingDate" AS "bookingDate",
          "Booking"."isCheckedIn" AS "visited",
          "Booking"."duration" AS "duration",
          "Booking"."isPaid" AS "isPaid",
          "Booking"."type" AS "type",
          "Gyms".id AS "gymId", 
          "Gyms".name AS "gymName",
          "Gyms".rating AS "gymRating",
          "Slots"."startTime" AS "slotStartTime",
          "Booking".price AS "subscriptionPrice",
          "Booking"."createdAt" AS "create",
          "BookingRatings"."rating" AS "rating",
          COUNT("BuddyRequests".id) AS "invitedBuddyCount"  
      FROM "Booking"
      JOIN "Slots" ON "Booking"."slotId" = "Slots".id
      JOIN "Gyms" ON "Slots"."gymId" = "Gyms".id
      JOIN "Subscriptions" ON "Slots"."gymId" = "Subscriptions"."gymId" 
      LEFT JOIN "BuddyRequests" ON "Booking"."bookingId" = "BuddyRequests"."bookingId"
      LEFT JOIN "BookingRatings" ON "Booking"."bookingId" = "BookingRatings"."bookingId"
      WHERE "Booking"."userId" = :userId
      AND "Booking"."isPaid" = true
    `;

    // Conditional filtering based on selectedTab
    if (selectedTab === 'Upcoming') {
      query += `
          AND (
              (
                  "Booking"."type" = 'daily'
                  AND ("Booking"."bookingDate"::date + "Slots"."startTime"::time + ("Booking"."duration" || ' minutes')::interval) > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
                  AND "Booking"."isCheckedIn" = false
              )
              OR (
                  "Booking"."type" = 'monthly'
                  AND "Booking"."bookingDate"::date + INTERVAL '1 month' >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
              )
              OR (
                  "Booking"."type" = 'quarterly'
                  AND "Booking"."bookingDate"::date + INTERVAL '3 months' >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
              )
              OR (
                  "Booking"."type" = 'halfyearly'
                  AND "Booking"."bookingDate"::date + INTERVAL '6 months' >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
              )
              OR (
                  "Booking"."type" = 'yearly'
                  AND "Booking"."bookingDate"::date + INTERVAL '1 year' >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
              )
          )
      `;
    } else if (selectedTab === 'Completed') {
      query += `
          AND (
              ("Booking"."type" = 'daily' AND "Booking"."isCheckedIn" = true)
              OR (
                  "Booking"."type" = 'monthly' 
                  AND "Booking"."bookingDate"::date + INTERVAL '1 month' < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
              )
              OR (
                  "Booking"."type" = 'quarterly'
                  AND "Booking"."bookingDate"::date + INTERVAL '3 months' < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
              )
              OR (
                  "Booking"."type" = 'halfyearly'
                  AND "Booking"."bookingDate"::date + INTERVAL '6 months' < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
              )
              OR (
                  "Booking"."type" = 'yearly'
                  AND "Booking"."bookingDate"::date + INTERVAL '1 year' < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
              )
          )
      `;
    } else if (selectedTab === 'No Show') {
      query += `
          AND ("Booking"."bookingDate"::date + "Slots"."startTime"::time + ("Booking"."duration" || ' minutes')::interval) <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
          AND "Booking"."isCheckedIn" = false
          AND "Booking"."type" = 'daily'
      `;
    }

    query += `
      GROUP BY "Booking"."bookingId", "Booking"."userId", "Booking"."duration", "Booking"."bookingDate", "Booking"."isPaid","Booking"."type",
               "Gyms".id, "Gyms".name, "Gyms".rating, "Slots"."startTime", "Subscriptions".daily, "BookingRatings"."rating"
      ORDER BY "Booking"."bookingDate" DESC;
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









// Create Order with custom bookingId and userId
exports.createOrder = async (req, res) => {
  const { amount, bookingId, requestId } = req.body; // Get amount from frontend
  const userId = req.user.id;  // Assuming the user is authenticated and userId is available

  const user = await User.findByPk(req.user.id); // User who is deleting the buddy request

  // Generate a custom bookingId


  const options = {
    amount: amount * 100, // Razorpay expects amount in paise (1 INR = 100 paise)
    currency: 'INR',
    receipt: bookingId, // Using bookingId as the receipt
    payment_capture: 1 // Automatic payment capture
  };

  let callback_url = `https://yupluck.com/user/api/booking/webhook?bookingId=${bookingId}&userId=${userId}`;
  const notes = {
    bookingId: bookingId, // Include bookingId in notes
    userId: userId, // Include userId in notes

  }
  if (requestId) {
    notes["request"] = requestId;
  }

  try {
    // Step 1: Create Razorpay order
    const orderResponse = await razorpay.orders.create(options);



    // Step 2: Create Razorpay payment link
    const paymentLinkResponse = await razorpay.paymentLink.create({
      amount: amount * 100, // Amount in paise
      currency: 'INR',
      notes,
      customer: {
        contact: user.mobile_number,
        name: user.full_name
      },
      options: {
        checkout: {
          prefill: {
            contact: user.mobile_number, // Explicitly prefill mobile number
          }
        }
      },
      callback_url: 'yupluck://payment-success', // Deep link back to your app
      callback_method: 'get' // HTTP method to use for callback (get or post)
    });


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
  console.log("I am called after payment", req.body);

  return res.status(200).send("Payment successful");

  // Access the notes
  // const notes = webhookData?.payload?.payment?.entity?.notes;
  // console.log("Notes:", notes);

}


exports.razorPayWebhookPost = async (req, res) => {
  const secret = 'Sourav@1992'; // Set your Razorpay webhook secret
  const webhookData = req.body;  // assuming you get the payload as JSON
  console.log("Webhook triggered");
  console.log("Request Header is", req.headers);
  console.log("Request body is", webhookData?.payload?.payment?.entity?.notes);
  // Verify the webhook signature
  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest('hex');
  const receivedSignature = req.headers['x-razorpay-signature'];

  if (webhookData?.payload?.payment?.entity?.notes && "bookingId" in webhookData?.payload?.payment?.entity?.notes) {
    const { bookingId, request, userId } = webhookData?.payload?.payment?.entity?.notes;
    const paymentId = webhookData?.payload?.payment?.entity?.id; // Extract the payment ID

    if (receivedSignature == digest) {
      if (request) {
        // Find the booking that the requestId (bookingId) refers to
        const relatedBooking = await Booking.findByPk(request);

        if (relatedBooking) {
          // Get the user who made the original booking (to notify them)
          const toUser = await User.findByPk(relatedBooking.userId); // User who will receive the notification
          const fromUser = await User.findByPk(userId); // User who is accepting the buddy request

          await Notification.destroy({
            where: {
              relatedId: request, // Delete notification buddy request
              userId: userId
            }
          });

          // Create a notification for the recipient that the buddy request has been accepted
          await Notification.create({
            userId: relatedBooking.userId, // The user who made the original booking (to be notified)
            message: `${fromUser.full_name} has accepted your workout invite.`, // Notification message
            type: 'acceptedBuddyRequest', // Notification type
            status: 'unread', // Unread by default
            relatedId: request, // Related to the bookingId (buddy request)
            profileImage: fromUser.profile_pic || "https://png.pngtree.com/png-vector/20190223/ourmid/pngtree-profile-glyph-black-icon-png-image_691589.jpg", // Use default profile pic if not available
            forUserId: fromUser.id
          });


          await Notification.create({
            userId: userId, // The user who made the original booking (to be notified)
            message: `you have accepted workout invite of ${toUser.full_name}`, // Notification message
            type: 'acceptedSelfBuddyRequest', // Notification type
            status: 'unread', // Unread by default
            relatedId: request, // Related to the bookingId (buddy request)
            profileImage: fromUser.profile_pic || "https://png.pngtree.com/png-vector/20190223/ourmid/pngtree-profile-glyph-black-icon-png-image_691589.jpg", // Use default profile pic if not available
            forUserId: fromUser.id
          });


          const notificationData = await PushNotification.findOne({
            where: { userId: relatedBooking.userId }
          });

          const notificationTitle = {
            title: "Workout request accepted",
            body: `${fromUser.full_name} has accepted your workout invitation.`, // Notification message
          }

          await sendPushNotification(notificationData?.expoPushToken, notificationTitle);




          const buddyRequest = await BuddyRequest.findOne({
            where: { bookingId: request, toUserId: userId } // Adjust this if you have a different key for your buddy requests
          });

          if (buddyRequest) {
            buddyRequest.status = 'accepted'; // Update the status
            await buddyRequest.save(); // Save the changes
            console.log(`Buddy request with ID ${request} has been accepted.`);
          } else {
            console.log(`Buddy request with ID ${request} not found.`);
          }

        } else {
          console.log(`Booking with ID ${request} not found.`);
        }
      }


      await Booking.update({ isPaid: true, "paymentId": paymentId }, { where: { bookingId } });

      const notificationData = await PushNotification.findOne({
        where: { userId }
      });

      const newnotificationTitle = {
        title: "Booking Successful",
        body: `Your booking is successful.`, // Notification message
      }

      const data = {
        reloadPayment: true
      };

      await sendPushNotification(notificationData?.expoPushToken, newnotificationTitle, data);





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

    } else {
      res.send("Payment Failed");
    }
  } else {
    res.send("Payment Failed");
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
        "Booking"."isPaid" AS "isPaid",
        "Booking".duration AS "bookingDuration",
        "Booking"."slotId" AS "bookingSlotId",
        "Booking"."subscriptionId" AS "bookingSubscriptionId",
        "Booking"."type" AS "bookingType"
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

    console.log("results[0]", results[0]);

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

    // Query to fetch all visited gyms with total workout hours from BookingCheckins
    const query = `
      SELECT 
          "Gyms"."id" AS "gymId",
          "Gyms"."name" AS "gymName",
          "Gyms"."rating" AS "gymRating",
          COALESCE(SUM("BookingCheckins"."duration"), 0) AS "totalWorkoutHours"
      FROM "BookingCheckins"
      JOIN "Booking" ON "BookingCheckins"."bookingId" = "Booking"."stringBookingId"
      JOIN "Gyms" ON "Booking"."gymId" = "Gyms"."id"
      WHERE "Booking"."userId" = :userId
      GROUP BY "Gyms"."id", "Gyms"."name", "Gyms"."rating"
      ORDER BY "totalWorkoutHours" DESC;
    `;

    // Execute the query
    const results = await sequelize.query(query, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT, // Ensures it returns an array
    });

    // Ensure results is always an array before sending
    res.status(200).json({ visitedGyms: Array.isArray(results) ? results : [] });
  } catch (error) {
    console.error("Error fetching visited gyms with workout hours:", error);
    res.status(500).json({ error: "Server error" });
  }
};


exports.getAllBuddiesWithWorkoutHours = async (req, res) => {
  try {
    const userId = req.query.id || req.user.id; // Get the logged-in user's ID

    // SQL query to fetch all buddies (toUserId) and their total workout hours from BookingCheckins
    const query = `
      SELECT 
        "Users"."id" AS "buddyId",
        "Users"."full_name" AS "buddyName",
        COALESCE(SUM("BookingCheckins"."duration"), 0) AS "totalWorkoutHours"
      FROM "BuddyRequests"
      JOIN "Users" ON "BuddyRequests"."toUserId" = "Users"."id"
      LEFT JOIN "Booking" ON "Booking"."userId" = "Users"."id"
      LEFT JOIN "BookingCheckins" ON "Booking"."stringBookingId" = "BookingCheckins"."bookingId"
      WHERE "BuddyRequests"."fromUserId" = :userId
      AND "BuddyRequests"."status" = 'accepted'
      GROUP BY "Users"."id", "Users"."full_name"
      ORDER BY "totalWorkoutHours" DESC;
    `;

    // Execute the query using Sequelize
    const results = await sequelize.query(query, {
      replacements: { userId },
      type: sequelize.QueryTypes.SELECT, // Ensures the result is an array
    });

    // Send the response ensuring it's always an array
    res.status(200).json({ buddiesWithWorkoutHours: Array.isArray(results) ? results : [] });
  } catch (error) {
    console.error("Error fetching buddies with workout hours:", error);
    res.status(500).json({ error: "Server error" });
  }
};







