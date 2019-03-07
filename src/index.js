const Client = require('instagram-private-api').V1;
const express = require('express');
const Scheduler = require('mongo-scheduler-more');
const { IncomingForm } = require('formidable');
const cors = require('cors');
const { rename } = require('fs');

const scheduler = new Scheduler('mongodb://localhost:27017/instagram-schedule');
const app = express();
const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200
};

const passwords = {
  h2ecommerce: '123Jens456',
  nureinberg: 'gauche-turbid-red',
  biobalancegermany: 'fragment-mufti-plow'
}

const PORT = process.env.PORT || 3000;

app.use(cors(corsOptions));

const postImage = data => {
  const { 
    account,
    imageUrl,
    caption
  } = data;

  const password = passwords[account];
  const captionDecoded = decodeURI(caption);

  const device = new Client.Device(account);
  const storage = new Client.CookieFileStorage(`${__dirname}/cookies/${account}.json`);

  Client.Session.create(device, storage, account, password)
    .then(function (session) {
      // Now you have a session, we can follow / unfollow, anything...
      // And we want to follow Instagram official profile
      return [session, Client.Upload.photo(session, imageUrl)
        .then(function (upload) {
          // upload instanceof Client.Upload
          // nothing more than just keeping upload id
          // console.log(upload.params.uploadId);
          return Client.Media.configurePhoto(session, upload.params.uploadId, captionDecoded);
        })
        .then(function (medium) {
          // we configure medium, it is now visible with caption
          console.log(`Posted to account ${medium.params.user.username} with link ${medium.params.webLink}!`);
        })]
    });
};

app.post('/', (req, res) => {
  const form = new IncomingForm();
  let data = {};

  form.parse(req);

  form.on('file', (field, file) => {
    const imageUrl = `/home/ubuntu/insta-schedule/uploads/${escape(file.name)}`;

    rename(file.path, imageUrl, (err) => {
      if (err) throw err;
    });

    data = {
      ...data,
      'imageUrl': imageUrl,
    };

  });

  form.on('field', (field, value) => {
    data = {
      ...data,
      [field]: value,
    };
  });

  form.on('end', () => {
    const event = {
      name: 'instagram-post',
      after: new Date(Number(data.uploadDate)),
      data: data,
    };

    scheduler.schedule(event);
    console.log(`Scheduled to account ${data.account}.`);
  });
});

app.post('/list', (req, res) => {
  scheduler.list((err, events) => {
    if (err) {
      console.error(err);
      res.sendStatus(500);
    }
    res.send(events).status(200);
  });
  console.log('List route ran!')
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

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}!`);
});

scheduler.on('instagram-post', (meal, event) => {
  postImage(event.data);
});
