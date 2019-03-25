const Client = require('instagram-private-api').V1;
const { IncomingForm } = require('formidable');
const { rename, unlinkSync } = require('fs');
const msm = require('mongo-scheduler-more');
const sendMail = require('./mailer');
const express = require('express');
// const mongo = require('mongodb');
const cors = require('cors');

const scheduler = new msm('mongodb://localhost:27017/instagram-schedule');
const app = express();
const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200
};
const passwords = {
  h2ecommerce: '123Jens456',
  nureinberg: 'gauche-turbid-red',
  biobalancegermany: 'fragment-mufti-plow'
};
const device = new Client.Device('iphone');
const proxy = 'http://213.136.86.234:80';
const PORT = process.env.PORT || 3000;

/* const db = mongo.MongoClient.connect('mongodb://localhost:27017/', (err, client) => {
  if (err) throw err;
  return client.db('instagram-schedule');
}); */

const postImage = data => {
  const {
    account,
    imageUrl,
    caption
  } = data;

  const password = passwords[account];
  const storage = new Client.CookieFileStorage(`${__dirname}/../cookies/${account}.json`);

  Client.Session.create(device, storage, account, password)
    .then(session => {
      Client.Request.setProxy(proxy);
      // Now you have a session, we can follow / unfollow, anything...
      // And we want to follow Instagram official profile
      return [session, Client.Upload.photo(session, imageUrl)
        .then(upload => {
          // upload instanceof Client.Upload
          // nothing more than just keeping upload id
          // console.log(upload.params.uploadId);
          return Client.Media.configurePhoto(session, upload.params.uploadId, caption);
        })
        .then(medium => {
          // we configure medium, it is now visible with caption
          console.log(`Posted to account ${medium.params.user.username} with link ${medium.params.webLink}!`);
          unlinkSync(imageUrl);
        })
        .catch(async error => {
          console.error(error);
          await sendMail(error, data).catch(console.error);
          unlinkSync(imageUrl);
        })]
    })
    .catch(async error => {
      console.error(error);
      await sendMail(error, data).catch(console.error);
      unlinkSync(imageUrl);
    });
};

app.use(cors(corsOptions));

app.post('/', (req, res) => {
  const form = new IncomingForm();
  let data = {};

  form.parse(req);

  form.on('file', (field, file) => {
    const fileName = `${Date.now()}-${(file.name).replace(/[^a-zA-Z0-9.]/g, "")}`;
    const imageUrl = `${__dirname}/../uploads/${fileName}`;

    rename(file.path, imageUrl, (err) => {
      if (err) throw err;
    });

    data = {
      ...data,
      'imageUrl': imageUrl,
      'fileName': fileName
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
    res.sendStatus(200);
  });
});

app.post('/list', (req, res) => {
  const filter = req.query.account 
    ? { 'data.account' : req.query.account } 
    : {};

  scheduler.list({ bySchedule: true, filter }, (err, events) => {
    if (err) {
      console.error(err);
      res.sendStatus(500);
    }
    res.send(events).status(200);
  });
});

app.post('/remove', (req, res) => {
  const { id } = req.query;
  
  if (id) {
    const params = { 
      name: 'instagram-post',
      id: id
    };

    scheduler.remove(params, (err, event) => {
      if (err) {
        console.error(err);
        res.sendStatus(500);
      }
      res.send(event.result).status(200);
      console.log(event.result);
      // unlinkSync(event.imageUrl);
    });
  } else {
    res.send('Nothing specified to delete!').status(200);
  }
});

/* app.post('/test', (req, res) => {
  const collection = db.collection('scheduled_events');
  const id = mongo.ObjectID('5c954fe8c0aa23ea7337b20b');

  collection.find({ _id: id}).toArray((err, docs) => {
    assert.equal(err, null);
    res.send(docs);
  });
}); */

app.use('/uploads', express.static(`${__dirname}/../uploads`));

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}!`);
});

scheduler.on('instagram-post', event => {
  postImage(event.data);
});
