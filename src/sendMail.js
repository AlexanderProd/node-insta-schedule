const nodemailer = require("nodemailer");

const sendMail = async (error, data) => {
  const {
    account,
    imageUrl,
    caption,
  } = data;

  const transporter = nodemailer.createTransport({
    host: 'bernd.php-friends.de',
    port: 465,
    secure: true,
    auth: {
      user: 'bot@h2ecommerce.de',
      pass: 'f9W*iw',
    },
    debug: true,
  });

  const mailOptions = {
    from: '"H2 Bot" <bot@h2ecommerce.de>',
    to: "mail@h2ecommerce.de",
    subject: "❌ Instagram Post fehlgeschlagen!",
    text: 
      `Ein Instagram Post für ${account} ist fehlgeschlagen! \n\n
      Beschreibung: \n
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
