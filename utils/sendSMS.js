const twilio = require('twilio');

const accountSid = 'AC20f75a430ebbe9517dbb5c7df694d4cc';
const authToken = 'faafe009f5820d619890aecc69c65ba7';
const client = new twilio(accountSid, authToken);

exports.sendSMS = (to, body) => {
  client.messages.create({
    body,
    to,
    from: 'your-twilio-phone-number'
  }).then(message => console.log(message.sid))
    .catch(error => console.error(error));
};
