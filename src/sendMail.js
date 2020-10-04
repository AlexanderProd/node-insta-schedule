const nodemailer = require('nodemailer');
const config = require('../config.json');

const sendMail = async (error, data) => {
  const { instagramUsername, accountEmail, imageUrl, caption } = data;

  const transporter = nodemailer.createTransport(config.mailer);

  const mailOptions = {
    from:
      '"Wertgebung Instagram Uploader" <noreply@instagram-uploader.wertgebung.de>',
    to: accountEmail,
    subject: '❌ Instagram Post fehlgeschlagen!',
    bcc: config.bcc,
    text: `Ein Instagram Post für ${instagramUsername} ist fehlgeschlagen! \n
      Beschreibung:
      ${caption}`,
    attachments: [
      {
        filename: 'error_log.txt',
        content: String(error),
      },
      {
        filename: 'data.json',
        content: JSON.stringify(data),
      },
      {
        path: imageUrl,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendMail;
