
const Reel = require('../models/Reel');
const Feed = require('../models/Feed');
const User = require('../models/User');
const sequelize = require('../config/db');
const { Op, Sequelize } = require('sequelize');

const updateCloudFrontUrls = async (req, res) => {
    try {

        
        const oldUrl = 'https://d1ggj6jmm6y2ok.cloudfront.net';
        const newUrl = 'https://d59q7mzjlaq7y.cloudfront.net';

        // Update Feed model
        

        // Update Reel model
        
        // Update User model for profile pictures
        await User.update(
            {
              profile_pic:
                "https://d59q7mzjlaq7y.cloudfront.net/thumbnails/empty.png",
            },
            {
              where: {
                profile_pic:
                  "https://d3tfjww6nofv30.cloudfront.net/a4c48204-30be-406c-a4a3-29708fd69aac/1749495872427_profileImage.jpg",
              },
            }
          );

        // Update Certificate model for certificates
        res.status(200).json({ message: 'CloudFront URLs updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while updating CloudFront URLs', error });
    }
};

module.exports = { updateCloudFrontUrls };