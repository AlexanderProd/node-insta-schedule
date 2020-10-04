/* eslint-disable */
module.exports = {
  apps: [
    {
      name: 'Instagram Scheduler',
      script: 'src',

      // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
      instances: 1,
      autorestart: true,
      watch: true,
      ignore_watch: ['cookies', 'uploads'],
      env_production: {
        NODE_ENV: 'production',
        PORT: 4480,
        SECRET: '',
      },
    },
  ],
};
