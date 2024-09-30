const sequelize = require("../config/db");

// Fetch all information about a specific gym by gymId
exports.fetchIndividualGyms = async (req, res) => {
  const { gymId } = req.params;

  const query = `
  SELECT 
  "Gyms".id, 
  "Gyms".name, 
  "Gyms".description, 
  "Gyms".latitude, 
  "Gyms".longitude, 
  "Gyms".city, 
  "Gyms"."pinCode", 
  "Gyms".state, 
  json_agg(DISTINCT "GymImages".*) FILTER (WHERE "GymImages".id IS NOT NULL) AS images, 
  json_agg(DISTINCT "Equipment".*) FILTER (WHERE "Equipment".id IS NOT NULL) AS equipment, 
  json_agg(DISTINCT "Slots".*) FILTER (WHERE "Slots".id IS NOT NULL) AS slots,
  json_agg(DISTINCT "Subscriptions".*) FILTER (WHERE "Subscriptions".id IS NOT NULL) AS subscriptions
FROM "Gyms"
LEFT JOIN "GymImages" ON "Gyms".id = "GymImages"."gymId"
LEFT JOIN "Equipment" ON "Gyms".id = "Equipment"."gymId"
LEFT JOIN "Slots" ON "Gyms".id = "Slots"."gymId"
LEFT JOIN "Subscriptions" ON "Gyms".id = "Subscriptions"."gymId"
WHERE "Gyms".id = :gymId
GROUP BY "Gyms".id;
  `;

  try {
    // Execute the raw query using the sequelize instance, passing the gymId as a replacement parameter
    const [results] = await sequelize.query(query, {
      replacements: { gymId },
    });

    // Send the results as the response
    res.json({ status: true, results });
  } catch (error) {
    console.error("Error fetching gym information:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};
