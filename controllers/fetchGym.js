const sequelize = require('../config/db');
const UserAddress = require('../models/UserAddress'); // Import UserAddress model
const { Op } = require('sequelize'); // Import Op for query operators


// Fetch nearby gyms based on user's current location
exports.fetchGyms = async (req, res) => {
  const userId = req.user.id; // Get the logged-in user ID

  // Get the pagination parameters from the request query or use defaults
  const limit = parseInt(req.query.limit, 10) || 9; // Default limit is 9
  const page = parseInt(req.query.page, 10) || 1; // Default page is 1
  const offset = (page - 1) * limit; // Calculate offset
  let { lat, long } = req.query; // Destructure latitude and longitude from req.query

  try {
    let userLat, userLong;
  
    // Fetch current location if latitude and longitude are not provided
    if (!lat || !long) {
      const currentLocation = await UserAddress.findOne({
        where: {
          user_id: userId,
          is_selected: true,
        },
      });

      if (!currentLocation) {
        return res.status(400).send('User location is required');
      }

      userLat = currentLocation.lat;
      userLong = currentLocation.long;
    } else {
      userLat = parseFloat(lat); // Convert to float
      userLong = parseFloat(long); // Convert to float
    }
    
    // Query to fetch the total count of gyms
    const countQuery = `
      SELECT COUNT(DISTINCT "Gyms".id) AS totalGyms
      FROM "Gyms"
      LEFT JOIN "GymImages" ON "Gyms".id = "GymImages"."gymId"
      LEFT JOIN "Equipment" ON "Gyms".id = "Equipment"."gymId"
      LEFT JOIN "Slots" ON "Gyms".id = "Slots"."gymId"
      LEFT JOIN "Subscriptions" ON "Gyms".id = "Subscriptions"."gymId"
      WHERE (
        6371 * acos(
          cos(radians(:userLat)) * cos(radians("Gyms".latitude)) *
          cos(radians("Gyms".longitude) - radians(:userLong)) +
          sin(radians(:userLat)) * sin(radians("Gyms".latitude))
        )
      ) IS NOT NULL;
    `;

    // Execute the count query
    const [countResult] = await sequelize.query(countQuery, {
      replacements: { userLat, userLong },
    });

    const totalGyms = countResult[0].totalGyms; // Fix the property name to match SQL result
    const totalPages = Math.ceil(totalGyms / limit); // Calculate total pages

    // Query to fetch gyms with calculated distance and pagination
    const query = `
      SELECT 
        "Gyms".*, 
        json_agg(DISTINCT "GymImages".*) AS images, 
        json_agg(DISTINCT "Equipment".*) AS equipment, 
        json_agg(DISTINCT "Slots".*) AS slots,
        json_agg(DISTINCT "Subscriptions".*) AS subscriptions,
        (
          6371 * acos(
            cos(radians(:userLat)) * cos(radians("Gyms".latitude)) *
            cos(radians("Gyms".longitude) - radians(:userLong)) +
            sin(radians(:userLat)) * sin(radians("Gyms".latitude))
          )
        ) AS distance
      FROM "Gyms"
      LEFT JOIN "GymImages" ON "Gyms".id = "GymImages"."gymId"
      LEFT JOIN "Equipment" ON "Gyms".id = "Equipment"."gymId"
      LEFT JOIN "Slots" ON "Gyms".id = "Slots"."gymId"
      LEFT JOIN "Subscriptions" ON "Gyms".id = "Subscriptions"."gymId"
      GROUP BY "Gyms".id
      ORDER BY distance ASC, "Gyms".city, "Gyms"."pinCode", "Gyms".state
      LIMIT :limit OFFSET :offset;
    `;

    // Execute the gym query with pagination parameters
    const [results] = await sequelize.query(query, {
      replacements: { userLat, userLong, limit, offset },
    });

    // Send the paginated results with additional pagination info
    res.json({
      gyms: results,
      pagination: {
        currentPage: page,
        totalPages,
        totalGyms,
        limit,
      },
    });
  } catch (error) {
    console.error('Error fetching gym information:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};