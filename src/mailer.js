const nodemailer = require("nodemailer");

const sendMail = async (error, data) => {
  const {
    account,
    imageUrl,
    caption,
  } = data;

  // create reusable transporter object using the default SMTP transport
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

  // setup email data with unicode symbols
  const mailOptions = {
    from: '"H2 Bot" <bot@h2ecommerce.de>',
    to: "mail@h2ecommerce.de",
    subject: "❌ Instagram Post fehlgeschlagen!",
    text: `
      Ein Instagram Post für ${account} ist fehlgeschlagen! \n\n
      Beschreibung: \n
      ${caption}
    `,
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

  // send mail with defined transport object
  const info = await transporter.sendMail(mailOptions);

  console.log(info);
}

module.exports = sendMail;
