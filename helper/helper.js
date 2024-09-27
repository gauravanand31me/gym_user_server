const isEmail = (identifier) => {
    // Regular expression for validating an Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(identifier);
};


const isMobileNumber = (identifier) => {
    // Regular expression for validating a mobile number
    // This example assumes a 10-digit mobile number
    const indianMobileRegex = /^[6-9]\d{9}$/;
    return indianMobileRegex.test(identifier);
};

module.exports = {isEmail, isMobileNumber}
  