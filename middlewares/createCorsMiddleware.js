// const cors = require('cors');
// const chalk = require('chalk');

// const createCorsMiddleware = () => {
//   const isDevelopment = process.env.NODE_ENV === 'development';
//   console.log(chalk.blue('Environment:', process.env.NODE_ENV));

//   const productionOrigins = [
//     'https://alternativescans.icu',
//     'https://altscans.netlify.app',
//     'https://staff-dashboard-six.vercel.app',
//     'https://alternativescans.pages.dev'
//   ];

//   const developmentOrigins = [
//     'http://localhost:3000',
//     'http://localhost:5173',
//     'http://localhost:8888',
//     'http://127.0.0.1:3000',
//     'http://127.0.0.1:5173',
//     'http://127.0.0.1:8888'
//   ];

//   const whitelist = isDevelopment 
//     ? [...developmentOrigins, ...productionOrigins]
//     : productionOrigins;

//   return cors({
//     origin: function(origin, callback) {
//       if (!origin || whitelist.includes(origin)) {
//         callback(null, true);
//       } else {
//         console.log(chalk.yellow('Not allowed by CORS: ', origin));
//         callback(new Error('Not allowed by CORS'));
//       }
//     },
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
//     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
//   });
// };

// const corsMiddleware = createCorsMiddleware();
// module.exports = corsMiddleware;