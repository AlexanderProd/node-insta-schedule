const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const { IncomingForm } = require('formidable');
const { readFile, rename, unlinkSync } = require('fs');
const Instagram = require('instagram-web-api');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const msm = require('mongo-scheduler-more');
const FileCookieStore = require('tough-cookie-filestore2');
const { promisify } = require('util');

const sendMail = require('./sendMail');
const withAuth = require('./withAuth');
const User = require('./models/User');
const config = require('../config.json');

const app = express();

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET || 'yHSHGuYkD4YMryOU1mJUId4zUihMNg';

const corsOptions = {
  origin: (origin, callback) => {
    if (config.whitelist.indexOf(origin) !== -1) {
      callback(null, true);
      // allow Postman requests for development
    } else if (origin === undefined) {
      callback(null, true);
    } else if (!isProd()) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

const connection = isProd() ? config.mongoDB.urlProd : config.mongoDB.urlDev;

const driverOptions = isProd()
  ? {
      useNewUrlParser: true,
      auth: {
        user: config.mongoDB.user,
        password: config.mongoDB.password,
      },
    }
  : { useNewUrlParser: true };

const scheduler = new msm(connection, driverOptions);
const readFilePromise = promisify(readFile);

let db = null;
let securityCode = null;

function isProd() {
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  return false;
}

const connectMongoClient = () => {
  return new Promise((resolve, reject) => {
    MongoClient.connect(connection, driverOptions, (err, client) => {
      if (err) reject(err);
      db = client.db('instagramSchedulerDB');
      resolve();
    });
  });
};

const mongooseConnect = () => {
  return new Promise((resolve, reject) => {
    mongoose.connect(connection, driverOptions, err => {
      if (err) reject(err);
      resolve();
    });
  });
};

const findPassword = (accountEmail, username) => {
  return new Promise(async (resolve, reject) => {
    try {
      const users = db.collection('users');
      const result = await users.findOne({ email: accountEmail });
      const { password } = result.instagramAccounts.find(
        account => account.username === username
      );
      console.log(password);
      resolve(password);
    } catch (error) {
      reject(error);
    }
  });
};

const postImage = async data => {
  const { accountEmail, instagramUsername, imageUrl, caption } = data;
  console.log(instagramUsername);
  try {
    const password = await findPassword(accountEmail, instagramUsername);
    const cookieStore = new FileCookieStore(
      __dirname + `/../cookies/${instagramUsername}.json`
    );
    const session = new Instagram({
      username: instagramUsername,
      password: password,
      cookieStore,
    });
    await session.login();

    await session.uploadPhoto({
      photo: imageUrl,
      caption: caption,
      post: 'feed',
    });

    unlinkSync(imageUrl);
  } catch (error) {
    console.error(error);
    await sendMail(error, data);
    unlinkSync(imageUrl);
  }
};

(async function main() {
  await connectMongoClient();
  await mongooseConnect();

  app.use(cors(corsOptions));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.use(cookieParser());

  app.post('/schedule', (req, res) => {
    const form = new IncomingForm();
    let data = {};

    // adds or subtracts 0-59 seconds
    const randomizeUploadDate = date => {
      const timeOffeset = Math.floor(Math.random() * 59000) + 1;
      if (Math.random() >= 0.5) {
        return date + timeOffeset;
      } else {
        return date - timeOffeset;
      }
    };

    const generateFileName = () =>
      String(
        Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15)
      );

    form.parse(req);

    form.on('file', (field, file) => {
      const fileName = `${generateFileName()}.jpg`;
      const imageUrl = `${__dirname}/../uploads/${fileName}`;

      rename(file.path, imageUrl, err => {
        if (err) return res.sendStatus(500);
      });

      data = {
        ...data,
        imageUrl: imageUrl,
        fileName: fileName,
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
        id: String(Date.now()),
        after: new Date(randomizeUploadDate(Number(data.uploadDate))),
        data: data,
      };

      scheduler.schedule(event);
      res.sendStatus(200);
    });
  });

  app.post('/list/posts', (req, res) => {
    const { accountEmail } = req.body;
    const filter = accountEmail ? { 'data.accountEmail': accountEmail } : {};

    scheduler.list({ bySchedule: true, query: filter }, (err, events) => {
      if (err) {
        console.error(err);
        res.sendStatus(500);
      }
      res.status(200).send(events);
    });
  });

  app.post('/remove', async (req, res) => {
    const { id } = req.query;

    const getFilePath = id => {
      const collection = db.collection('scheduled_events');

      return new Promise((resolve, reject) => {
        collection.find({ _id: ObjectId(id) }).toArray((err, items) => {
          if (err) {
            console.error(err);
            reject(err);
          }
          resolve(items[0].data.imageUrl);
        });
      });
    };

    if (id) {
      const params = {
        name: 'instagram-post',
        id: id,
      };
      const filePath = await getFilePath(id);
      scheduler.remove(params, (err, event) => {
        if (err) {
          console.error(err);
          res.sendStatus(500);
        }
        res.status(200).send(event.result);
      });
      unlinkSync(filePath);
    } else {
      res.status(200).send('Nothing specified to delete!');
    }
  });

  app.post('/authenticate', (req, res) => {
    const { email, password, stayLoggedIn } = req.body;

    User.findOne({ email }, (err, user) => {
      if (err) {
        console.error(err);
        res.status(500).json({
          error: 'Internal error please try again',
        });
      } else if (!user) {
        res.status(401).json({
          error: 'Incorrect email or password',
        });
      } else {
        user.isCorrectPassword(password, (err, same) => {
          if (err) {
            res.status(500).json({
              error: 'Internal error please try again',
            });
          } else if (!same) {
            res.status(401).json({
              error: 'Incorrect email or password',
            });
          } else {
            // Issue token
            const payload = { email };
            const options = stayLoggedIn ? {} : { expiresIn: '1h' };
            const token = jwt.sign(payload, SECRET, options);
            res.cookie('token', token, { httpOnly: false }).sendStatus(200);
          }
        });
      }
    });
  });

  app.post('/register', (req, res) => {
    const { email, password } = req.body;
    const user = new User({ email, password });
    user.save(err => {
      if (err) {
        console.log(err);
        res.status(500).send('Error registering new user please try again.');
      } else {
        res.status(200).send('Welcome to the club!');
      }
    });
  });

  app.post('/check-token', withAuth, (req, res) => {
    res.status(200).send(req.email);
  });

  app.post('/add-instagram', async (req, res) => {
    const { accountEmail, username, password } = req.body;

    try {
      const cookieStore = new FileCookieStore(
        __dirname + `/../cookies/${username}.json`
      );
      const session = new Instagram({ username, password, cookieStore });
      await session.login();

      const query = await User.updateOne(
        { email: accountEmail },
        {
          $push: {
            instagramAccounts: {
              username: username,
              password: password,
              //session: session,
            },
          },
        }
      );
      res.status(200).send(query);
    } catch (error) {
      console.error(error);
      res.status(500).send(error);
    }
  });

  app.post('/resolve-challenge', (req, res) => {
    const { code } = req.body;
    if (code === undefined) {
      res.status(404).send('No code provided!');
    }
    securityCode = code;
    res.sendStatus(200);
  });

  app.post('/list/instagram-accounts', async (req, res) => {
    const { accountEmail } = req.body;
    if (accountEmail === undefined) {
      return res.status(404).json({ error: 'No account email provided' });
    }
    try {
      const query = await User.find({ email: accountEmail });
      const { instagramAccounts } = query[0];
      const usernames = [];

      instagramAccounts.forEach(elem => {
        usernames.push(elem.username);
      });
      res.status(200).send(usernames);
    } catch (error) {
      res.sendStatus(500);
    }
  });

  app.use('/uploads', express.static(`${__dirname}/../uploads`));

  app.listen(PORT, () => {
    console.log(
      `App listening on port ${PORT} runnung in ${
        process.env.NODE_ENV ? process.env.NODE_ENV : 'dev'
      }!`
    );
  });

  scheduler.on('instagram-post', event => {
    postImage(event.data);
  });
})();
