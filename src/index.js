const Client = require('instagram-private-api').V1;
const schedule = require('node-schedule');
const express = require('express');
const Scheduler = require('mongo-scheduler-more');

const scheduler = new Scheduler('mongodb://3.121.177.95:27017/scheduler-test');
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
  // postImage(req.query);
  const event = {
    name: 'instagram-post',
    after: new Date(Date.now() + 120000),
    data: req.query,
  };
  scheduler.schedule(event);
  res.sendStatus(200);
});

app.post('/list', (req, res) => {
  scheduler.list((err, events) => {
    if (err) {
      console.error(err);
      res.sendStatus(500)
    }
    console.log(events);
    res.send(events).status(200);
  });
});

app.post('/remove', (req, res) => {
  scheduler.remove('instagram-post', null, null, (err, event) => {
    if (err) {
      console.error(err);
      res.sendStatus(500)
    }
    console.log(event);
    res.sendStatus(200);
  });
});

app.listen(3000, function () {
  console.log('App listening on port 3000!');
});

scheduler.on('instagram-post', (meal, event) => {
  console.log(event.data);
});
