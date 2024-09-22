const isEmail = (identifier) => {
    // Regular expression for validating an Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(identifier);
};


const isMobileNumber = (identifier) => {
    // Regular expression for validating a mobile number
    // This example assumes a 10-digit mobile number
    const mobileRegex = /^\d{10}$/; // Adjust for international formats if needed
    return mobileRegex.test(identifier);
};

module.exports = {isEmail, isMobileNumber}
  