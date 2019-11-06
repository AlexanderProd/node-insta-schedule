/* eslint-disable */
module.exports = {
  apps : [{
    name: 'Instagram Schedule',
    script: 'src',

    // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
    instances: 1,
    autorestart: true,
    watch: true,
    ignore_watch: ['cookies', 'uploads'],
    env: {
      NODE_ENV: 'production',
      PORT: 4480,
      SECRET: '',
    },
  }],
};
