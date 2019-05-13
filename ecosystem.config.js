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
  deploy: {
    production : {
      key: '~/.ssh/ubuntu-ec2.pem',
      user: 'ubuntu',
      host: 'ec2-3-121-177-95.eu-central-1.compute.amazonaws.com',
      ref: 'git@github.com:AlexanderProd/insta-schedule.git',
      repo: 'git@github.com:AlexanderProd/insta-schedule.git/master',
      path: '/home/ubuntu/test',
    }
  }
};
