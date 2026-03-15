
const Reel = require('../models/Reel');
const Feed = require('../models/Feed');
const User = require('../models/User');


const updateCloudFrontUrls = async (req, res) => {
    try {
        const oldUrl = 'https://d3tfjww6nofv30.cloudfront.net';
        const newUrl = 'https://d1ggj6jmm6y2ok.cloudfront.net';

        // Update Feed model
        await Feed.update(
            { imageUrl: sequelize.fn('REPLACE', sequelize.col('imageUrl'), oldUrl, newUrl) },
            { where: { imageUrl: { [sequelize.Op.like]: `${oldUrl}%` } } }
        );

        // Update Reels model
        await Reels.update(
            { videoUrl: sequelize.fn('REPLACE', sequelize.col('videoUrl'), oldUrl, newUrl) },
            { where: { videoUrl: { [sequelize.Op.like]: `${oldUrl}%` } } }
        );

        await Reels.update(
            { thumbnailUrl: sequelize.fn('REPLACE', sequelize.col('thumbnailUrl'), oldUrl, newUrl) },
            { where: { thumbnailUrl: { [sequelize.Op.like]: `${oldUrl}%` } } }
        );

        // Update User model for profile pictures
        await User.update(
            { profilePicUrl: sequelize.fn('REPLACE', sequelize.col('profilePicUrl'), oldUrl, newUrl) },
            { where: { profilePicUrl: { [sequelize.Op.like]: `${oldUrl}%` } } }
        );

        // Update Certificate model for certificates
        res.status(200).json({ message: 'CloudFront URLs updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while updating CloudFront URLs', error });
    }
};

module.exports = { updateCloudFrontUrls };