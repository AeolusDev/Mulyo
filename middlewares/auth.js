const chalk = require('chalk');
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        console.log(chalk.red('Token is missing \n Origin: ', req.headers.origin));
        return res.status(401).json({ message: 'Authentication token missing' });
    }

    try {
        jwt.verify(token, process.env.JWT_SECRET);
        console.log(chalk.green('Token verified authMiddleware \nOrigin: ', req.headers.origin));
        next();
    } catch (err) {
      if(process.env.NODE_ENV === 'development') {
          console.log(chalk.red('Authentication token invalid'));
          console.log(chalk.red('Auth Token Received: ', token));
          console.log(chalk.red('Actual Auth Token: ', process.env.FRONT_JWT_SECRET));
          console.log(chalk.red('Error: ', err));
          return res.status(401).json({ message: 'Authentication token invalid' });
      }
      
      console.log(chalk.red('Authentication token invalid'));
      return res.status(401).json({ message: 'Authentication token invalid' });
    }
};

const frontAuthMiddleware = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        console.log(chalk.red('Token is missing \n Origin: ', req.headers.origin));
        return res.status(401).json({ message: 'Authentication token missing' });
    }

    try {
        jwt.verify(token, process.env.FRONT_JWT_SECRET);
        console.log(chalk.green('Token verified frontAuthMiddleware \nOrigin: ', req.headers.origin));
        next();
    } catch (err) {
        if(process.env.NODE_ENV === 'development') {
            console.log(chalk.red('Authentication token invalid'));
            console.log(chalk.red('Auth Token Received: ', token));
            console.log(chalk.red('Actual Auth Token: ', process.env.FRONT_JWT_SECRET));
            console.log(chalk.red('Error: ', err));
            return res.status(401).json({ message: 'Authentication token invalid' });
        }
        
        console.log(chalk.red('Authentication token invalid'));
        return res.status(401).json({ message: 'Authentication token invalid' });
    }
};

const dashboardAuthMiddleware = (req, res, next) => {
  // Check if req parameter exists
  if (!req || !req.headers) {
    console.log(chalk.red('Missing request object or headers'));
    return res.status(400).json({ message: 'Invalid request' });
  }
    const origin = req.headers.origin || req.headers.host;
  
  if (origin !== `` && origin !== `` && origin !== `http://localhost:3000`) {
    console.log(chalk.red(`Received origin: ${origin}`));
    return "Is not Dashboard";
  };
  
  return "Is Dashboard";
}

module.exports = { authMiddleware, frontAuthMiddleware, dashboardAuthMiddleware };
