const Client = require('instagram-private-api').V1;
const schedule = require('node-schedule');
const express = require('express');

const app = express();

const postImage = data => {
  const { 
    account,
    y,
    d,
    m,
    hour,
    minute,
    image,
    caption
  } = data

  const device = new Client.Device(account);
  const storage = new Client.CookieFileStorage(__dirname + `/cookies/${account}.json`);
  const date = new Date(y, m-1, d, hour, minute, 0);

  schedule.scheduleJob(date, function () {
    Client.Session.create(device, storage, account, '123Jens456')
      .then(function (session) {
        // Now you have a session, we can follow / unfollow, anything...
        // And we want to follow Instagram official profile
        return [session, Client.Upload.photo(session, image)
          .then(function (upload) {
            // upload instanceof Client.Upload
            // nothing more than just keeping upload id
            console.log(upload.params.uploadId);
            return Client.Media.configurePhoto(session, upload.params.uploadId, caption);
          })
          .then(function (medium) {
            // we configure medium, it is now visible with caption
            console.log(medium.params)
          })]
      })
  });
}

app.post('/', function (req, res) {
  console.log(req.query);
  res.sendStatus(200);
  postImage(req.query);
});

app.listen(3000, function () {
  console.log('App listening on port 3000!');
});
