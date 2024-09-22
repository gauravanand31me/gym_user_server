const nodemailer = require('nodemailer');

exports.sendEmail = (to, subject, text) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'sourav.satyamsing@gmail.com',
      pass: 'Sourav@1992Satyam'
    }
  });

  const mailOptions = {
    from: 'sourav.satyamsing@gmail.com',
    to,
    subject,
    text
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
};
