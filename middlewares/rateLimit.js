const rateLimit = require('express-rate-limit');
const chalk = require('chalk');

const getIp = (req) => {
  return req.headers['x-nf-client-connection-ip'] || req.ip;
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  keyGenerator: getIp,
  handler: (req, res) => {
    console.log(chalk.red('Rate limit exceeded for IP:', getIp(req)));
    res.status(429).json({ message: 'Too many requests, please try again later.' });
  }
});

const limiterAnonymous = rateLimit({
  windowMs: 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
  max: 1, // limit each IP to 1 request per windowMs
  keyGenerator: getIp,
  handler: (req, res) => {
    console.log(chalk.red('Rate limit exceeded for IP:', getIp(req)));
    res.status(429).json({ message: 'Too many requests, please try again later.' });
  }
});

module.exports = {
  limiter,
  limiterAnonymous
};