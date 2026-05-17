const twilio = require('twilio');

const client = new twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.sendSMS = (to, body) => {
  client.messages.create({
    body,
    to,
    from: process.env.TWILIO_FROM_NUMBER,
  }).then(message => console.log(message.sid))
    .catch(error => console.error(error));
};
