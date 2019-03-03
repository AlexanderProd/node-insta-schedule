const Client = require('instagram-private-api').V1;
const express = require('express');
const Scheduler = require('mongo-scheduler-more');

const scheduler = new Scheduler('mongodb://localhost:27017/instagram-schedule');
const app = express();

const PORT = 3000 || process.env.PORT;

const postImage = data => {
  const { 
    account,
    image,
    caption
  } = data

  const device = new Client.Device(account);
  const storage = new Client.CookieFileStorage(__dirname + `/cookies/${account}.json`);

  Client.Session.create(device, storage, account, '123Jens456')
    .then(function (session) {
      // Now you have a session, we can follow / unfollow, anything...
      // And we want to follow Instagram official profile
      return [session, Client.Upload.photo(session, image)
        .then(function (upload) {
          // upload instanceof Client.Upload
          // nothing more than just keeping upload id
          // console.log(upload.params.uploadId);
          return Client.Media.configurePhoto(session, upload.params.uploadId, caption);
        })
        .then(function (medium) {
          // we configure medium, it is now visible with caption
          console.log(`Posted to account ${medium.params.user.username} with link ${medium.params.webLink}!`);
        })]
    });
}

app.post('/', function (req, res) {
  const event = {
    name: 'instagram-post',
    after: new Date(Date.now() + 120000),
    data: req.query,
  };
  scheduler.schedule(event);
  console.log(`Scheduled to account ${req.query.account}.`);
  res.sendStatus(200);
});

app.post('/list', (req, res) => {
  scheduler.list((err, events) => {
    if (err) {
      console.error(err);
      res.sendStatus(500);
    }
    res.send(events).status(200);
  });
});

app.post('/remove', (req, res) => {
  scheduler.remove('instagram-post', null, null, (err, event) => {
    if (err) {
      console.error(err);
      res.sendStatus(500);
    }
    res.send(event).status(200);
  });
});

app.listen(PORT, function () {
  console.log(`App listening on port ${PORT}!`);
});

scheduler.on('instagram-post', (meal, event) => {
  postImage(event.data);
});
