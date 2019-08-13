const nodemailer = require("nodemailer");

const sendMail = async (error, data) => {
  const {
    instagramUsername,
    accountEmail,
    imageUrl,
    caption,
  } = data;

  const transporter = nodemailer.createTransport({
    host: 'bernd.php-friends.de',
    port: 465,
    secure: true,
    auth: {
      user: 'insta-bot@alexanderhoerl.de',
      pass: 'jV6S9yKgtZ0mT3u2',
    },
    debug: true,
  });

  const mailOptions = {
    from: '"H2 Bot" <insta-bot@alexanderhoerl.de>',
    to: accountEmail,
    subject: '❌ Instagram Post fehlgeschlagen!',
    text: 
      `Ein Instagram Post für ${instagramUsername} ist fehlgeschlagen! \n
      Beschreibung:
      ${caption}`,
    attachments: [
      {
        filename: 'error_log.txt',
        content: String(error)
      },
      {
        filename: 'data.json',
        content: JSON.stringify(data)
      },
      {
        path: imageUrl
      },
    ]
  };

  await transporter.sendMail(mailOptions);
}

module.exports = sendMail;
