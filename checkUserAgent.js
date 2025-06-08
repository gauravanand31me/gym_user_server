// middleware/checkUserAgent.js

module.exports = function checkUserAgent(req, res, next) {
    const userAgent = req.headers['user-agent'] || '';
  
    // Define allowed identifier string
    const allowedUserAgent = 'YupluckApp';

    console.log("checkUserAgent", userAgent)
  
    // if (!userAgent.includes(allowedUserAgent)) {
    //   return res.status(403).json({
    //     message: 'Unauthorized request source: invalid User-Agent',
    //   });
    // }
  
    next();
  };