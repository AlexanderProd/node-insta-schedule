const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const { IncomingForm } = require('formidable');
const { readFile, rename, unlinkSync } = require('fs');
const { IgApiClient, IgCheckpointError } = require('instagram-private-api');
const { MongoClient, ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const msm = require('mongo-scheduler-more');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const inquirer = require('inquirer');


const sendMail = require('./sendMail');
const withAuth = require('./withAuth');
const User = require('./models/User');
const config = require('../config.json')

const ig = new IgApiClient();
const app = express();

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET || 'yHSHGuYkD4YMryOU1mJUId4zUihMNg';

const corsOptions = {
  origin: (origin, callback) => {
    if (config.whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    // allow Postman requests for development
    } else if (origin === undefined && !isProd()) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

const connection = isProd()
  ? config.mongoDB.urlProd
  : config.mongoDB.urlDev;

const driverOptions = isProd()
  ? {
    useNewUrlParser: true,
    auth: {
      user: config.mongo.user,
      password: config.mongo.password
    }
  }
  : { useNewUrlParser: true };

const scheduler = new msm(connection, driverOptions);
const readFilePromise = promisify(readFile);

let db = null;


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
}

const mongooseConnect = () => {
  return new Promise((resolve, reject) => {
    mongoose.connect(connection, driverOptions, (err) => {
      if (err) reject(err);
      resolve();
    });
  });
}

const postImage = async data => {
  const {
    accountEmail,
    instagramUsername,
    imageUrl,
    caption
  } = data;
  
  try {
    await restoreSession(accountEmail, instagramUsername);
    await ig.publish.photo({
      file: await readFilePromise(imageUrl),
      'caption': caption,
    });
    unlinkSync(imageUrl);
  } catch (error) {
    await sendMail(error, data);
    unlinkSync(imageUrl);
  }
}

const createInstaSession = (username, password) => {
  return new Promise(async (resolve, reject) => {
    ig.state.generateDevice(username);
    await ig.simulate.preLoginFlow();

    try {
      await ig.account.login(username, password);
    } catch (error) {
      if (error instanceof IgCheckpointError) {
        await ig.challenge.auto(true);
        console.log(ig.state.checkpoint);
        const { code } = await inquirer.prompt([{
          type: 'input',
          name: 'code',
          message: 'Enter code',
        }]);
        try {
          await ig.challenge.sendSecurityCode(code);
        } catch (error) {
          console.error(error);
          reject(error);
        }
      } else {
        console.error(error);
        reject(error);
      }
    }

    const cookies = await ig.state.serializeCookieJar();
    const state = {
      deviceString: ig.state.deviceString,
      deviceId: ig.state.deviceId,
      uuid: ig.state.uuid,
      phoneId: ig.state.phoneId,
      adid: ig.state.adid,
      build: ig.state.build,
    }
    const session = {
      'cookies': cookies,
      'state': state,
    }
    const base64Session = Buffer.from(JSON.stringify(session)).toString('base64');
    resolve(base64Session);
  });
}

const restoreSession = async (accountEmail, instagramUsername) => {
  return new Promise(async (resolve, reject) => {
    const { instagramAccounts } = await User.findOne({ email: accountEmail });

    instagramAccounts.forEach(async ({ username, session }) => {
      if (username === instagramUsername) {
        const {
          cookies,
          state,
        } = JSON.parse(Buffer.from(session, 'base64').toString('ascii'));

        try {
          await ig.state.deserializeCookieJar(cookies);
          ig.state.deviceString = state.deviceString;
          ig.state.deviceId = state.deviceId;
          ig.state.uuid = state.uuid;
          ig.state.phoneId = state.phoneId;
          ig.state.adid = state.adid;
          ig.state.build = state.build;
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    });
  });
}

(async function main() {
  await connectMongoClient();
  await mongooseConnect();

  app.use(cors(corsOptions));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());
  app.use(cookieParser());

  app.post('/', (req, res) => {
    const form = new IncomingForm();
    let data = {};
    
    // adds or subtracts 0-59 seconds
    const randomizeUploadDate = date => {
      const timeOffeset = Math.floor(Math.random() * 59000) + 1
      if (Math.random() >= 0.5){
        return date + timeOffeset
      } else {
        return date - timeOffeset
      }
    }

    const generateFileName = () => (
      String(Math.random().toString(36).substring(2, 15) 
      + Math.random().toString(36).substring(2, 15))
    )

    form.parse(req);

    form.on('file', (field, file) => {
      const fileName = `${generateFileName()}.jpg`;
      const imageUrl = `${__dirname}/../uploads/${fileName}`;

      rename(file.path, imageUrl, (err) => {
        if (err) return res.sendStatus(500);
      });

      data = {
        ...data,
        'imageUrl': imageUrl,
        'fileName': fileName,
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
        after: new Date(
          randomizeUploadDate(Number(data.uploadDate))
        ),
        data: data,
      };

      scheduler.schedule(event);
      res.sendStatus(200);
    });
  });

  app.post('/list/posts', (req, res) => {
    const { accountEmail } = req.body;
    const filter = accountEmail
      ? { 'data.accountEmail': accountEmail }
      : {};

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
        id: id
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
        res.status(500)
          .json({
            error: 'Internal error please try again'
          });
      } else if (!user) {
        res.status(401)
          .json({
            error: 'Incorrect email or password'
          });
      } else {
        user.isCorrectPassword(password, (err, same) => {
          if (err) {
            res.status(500)
              .json({
                error: 'Internal error please try again'
              });
          } else if (!same) {
            res.status(401)
              .json({
                error: 'Incorrect email or password'
              });
          } else {
            // Issue token
            const payload = { email };
            const options = stayLoggedIn 
              ? {} 
              : { expiresIn: '1h' };
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
    user.save((err) => {
      if (err) {
        console.log(err);
        res.status(500).send("Error registering new user please try again.");
      } else {
        res.status(200).send("Welcome to the club!");
      }
    });
  });

  app.post('/checkToken', withAuth, (req, res) => {
    res.status(200).send(req.email);
  });

  app.post('/addInstagram', async (req, res) => {
    const {
      accountEmail,
      username,
      password,
    } = req.body;
    
    try {
      const session = await createInstaSession(username, password);
      const query = await User.updateOne(
        { email: accountEmail },
        {
          '$push': {
            instagramAccounts: {
              username: username,
              session: session,
            }
          }
        }
      );
      res.status(200).send(query);
    } catch (error) {
      res.status(500).send(error);
    }
  });

  app.post('/list/instagramAccounts', async (req, res) => {
    const { accountEmail } = req.body;
    if (accountEmail === undefined) {
      return res.status(404).json({ error: 'No account email provided' });
    }
    try {
      const query = await User.find({ email: accountEmail });
      const { instagramAccounts } = query[0];
      const usernames = []; 

      instagramAccounts.forEach((elem) => {
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
      `App listening on port ${PORT} runnung in ${process.env.NODE_ENV ? process.env.NODE_ENV : 'dev'}!`
    );
  });

  scheduler.on('instagram-post', event => {
    postImage(event.data);
  });
})();