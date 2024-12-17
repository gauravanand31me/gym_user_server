const sequelize = require("../config/db");
const PushNotification = require("../models/PushNotification");

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
    "Gyms"."addressLine1", 
    "Gyms"."addressLine2", 
    "Gyms".city, 
    "Gyms"."pinCode", 
    "Gyms".state, 
    "Gyms".rating,
    "Gyms".total_rating,
    json_agg(DISTINCT "GymImages"."imageUrl") FILTER (WHERE "GymImages".id IS NOT NULL) AS images, 
    json_agg(DISTINCT "Equipment".name) FILTER (WHERE "Equipment".id IS NOT NULL) AS equipment, 
    json_agg(DISTINCT "EquipmentList".*) FILTER (WHERE "EquipmentList".equipment_id IS NOT NULL) AS equipment_list, 
    json_agg(DISTINCT "Slots".*) FILTER (WHERE "Slots".id IS NOT NULL AND "Slots"."timePeriod" != 0) AS slots,
    json_agg(DISTINCT "Subscriptions".*) FILTER (WHERE "Subscriptions".id IS NOT NULL) AS subscriptions
  FROM "Gyms"
  LEFT JOIN "GymImages" ON "Gyms".id = "GymImages"."gymId"
  LEFT JOIN "Equipment" ON "Gyms".id = "Equipment"."gymId"
  LEFT JOIN "EquipmentList" ON "Equipment"."name" = "EquipmentList".equipment_name
  LEFT JOIN "Slots" ON "Gyms".id = "Slots"."gymId" AND "Slots"."timePeriod" != 0
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

exports.storePushToken = async (req, res) => {
    const receivedToken = req.body.expoPushToken || "NA";
    const notify = await PushNotification.findOne({ where: { userId: req.user.id } })
    
        if (notify) {
            // If user exists, update the expoPushToken
            notify.expoPushToken = receivedToken;
            await notify.save();
        
        } else {
            // If user doesn't exist, create a new record
          const newToken = new PushNotification({ userId: req.user.id , expoPushToken: receivedToken });
          await newToken.save();
          
        }

        return res.status(200).json({status: true});
}
