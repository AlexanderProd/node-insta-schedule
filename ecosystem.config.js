/* eslint-disable */
module.exports = {
  apps : [{
    name: 'instagram-schedule',
    script: 'src/index.js',

    // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 4480,
    },
  }],
};
