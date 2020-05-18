# Node Insta Schedule

This is a server side application built to automatically publish Instagram posts on a specific data and time. It uses MongoDB as data storage and supports multiple accounts. This is only the backend part, you’ll still need a frontend to make the necessary REST API request for scheduling a photo though. But you can obviously do this with postman or curl manually.

The account login session is being created and stored in the DB after creating a POST request against the `/add-instagram` route.

To schedule a picture you just have to make another POST request against `/upload-photo` with the image, description and username included.

## ️⚠️ Warning 
Since this project relies an unofficial Instagram API wrapper there can be occasional problems like sessions getting invalidated or challenges when logging in. Unfortunately Instagram doesn’t offer a public api to publish photos at the moment. The new publishing api is only available for selected Instagram partners. 

Also theres no dynamic challenge handling built in yet. A challange is an event that Instagram might when a new and suspicious device tries to login to your account.

Accounts that utilize 2FA aren't supported yet either.

## Features
- Email notifications.
- Multi-user support.
- Upload date gets slightly randomized to decrease many uploads at the exact same time.
- Delete scheduled posts.
- List and filter scheduled posts.
- Includes routes for frontend user authentication and handling.
- Exposes the /uploads directory to view uploaded images.
- Included ecosystem file for Pm2 Node processs manager. 

### 📩 Email notifications.
Whenever a post failed a mail including photo, description and error report will be sent to the user who scheduled the post. This uses Nodemailer and you'll need to add the credentials to an email account to the config file.

### Multi user support.
You can add multiple users, every user will have its own Instagram account(s). Users can only schedule posts to the accounts added by themselves. They can also only see their own scheduled posts. This features is only interesting if you use this application with a dedicated fronted. Every action is supported by the REST API.

### ❌ Delete posts.
You can delete scheduled posts before they're posted.

### 🔑 Logic for frontend user authentication.
Logic and REST routes for authentication based on [json web token](https://de.wikipedia.org/wiki/JSON_Web_Token) and MongoDB.

## REST Endpoints

### POST `/schedule`
This endpoint expects form data encoding with the image file attached. 

| field | required | description |
|-------------------|----------|------------------------------------------------------------|
| instagramUsername | true | The Instagram username to which the photo shall be posted. |
| file | true | The attached image that is going to be scheduled. |
| caption | false | The Instagram post caption. |
| uploadDate | true | The upload date. |
| accountEmail | true | The account email by which the post was scheduled. |

### POST `/list/posts`
This endpoint expects the data in the request body.

| field | required | description |
|--------------|----------|----------------------------------------------------------------------------------------------------------------------------------------|
| accountEmail | false | Can be used to filter the results by email.<br>(e.g. only posts by this account.)<br>If not present, all scheduled posts are returned. |

### POST `/remove`
Used to delete a scheduled posts.
This endpoint expects the data in the request body.

| field | required | description |
|-------|----------|-------------------------------------------------------|
| id | true | Delete post with the corresponding MongoDB object ID. |

### POST `/authenticate`
Used to login into the frontend dashboard.
Expects the data in the request body.

| field | required | description |
|--------------|----------|-------------------------------|
| email | true | Account email to login. |
| password | true | Account password. |
| stayLoggedIn | false | JWT won't expire in one hour. |

### POST `/register`
Used to register a new user for the frontend dashboard.
Expects the data in the request body.

| field | required | description |
|----------|----------|-------------------|
| email | true | Account email. |
| password | true | Account password. |

### POST `/check-token`
Used to check if the webtoken is still valid.
Expects JWT either in body, query, header or as attached cookie. 

### POST `/add-instagram`
Used to add a new instagram account to a user. This creates a session and saves it to the DB.
Expects the data in the request body.

| field | required | description |
|--------------|----------|-----------------------------------------------------|
| accountEmail | true | Email for frontend account which owns this account. |
| username | true | Instagram username. |
| password | true | Instagram password. |

### POST `/resolve-challenge`
⚠️ Work in progress, not yet completely implemented. (See ToDo's)

### POST `/list/instagram-accounts`
Returns the Instagram accounts a frontend user has connected.
Expects the data in the request body.

| field | required | description |
|--------------|----------|----------------------------|
| accountEmail | true | Email of frontend account. |

## Database Model
ToDo

## Getting started
1. Edit the config file to provide your MongoDB and Email credentials. The whitelist array is used for CORS to only allow incoming requests from certain IP addresses. 
2. `$ yarn install`
3. `yarn dev`

## 📌 ToDo
- [ ] Add challenge handling to register route.
- [ ] Support accounts with 2FA enabled.
- [ ] Add DB model to readme.
