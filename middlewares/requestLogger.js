const chalk = require('chalk');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  console.log(chalk.blue(`\n=== Request Start ===`));
  console.log(chalk.blue(`${req.method} ${req.url}`));
  console.log(chalk.blue('Headers:', JSON.stringify(req.headers, null, 2)));
  console.log(chalk.blue('Content-Length:', req.headers['content-length']));
  console.log(chalk.blue('Content-Type:', req.headers['content-type']));

  let dataSize = 0;
  
  req.on('data', chunk => {
    dataSize += chunk.length;
    console.log(chalk.blue(`Received chunk of size: ${chunk.length}`));
    console.log(chalk.blue(`Total data received so far: ${dataSize}`));
  });

  req.on('end', () => {
    console.log(chalk.blue(`Final data size: ${dataSize}`));
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(chalk.green(`\n=== Response ===`));
    console.log(chalk.green(`Status: ${res.statusCode}`));
    console.log(chalk.green(`Duration: ${duration}ms`));
    console.log(chalk.green(`Total Bytes Received: ${dataSize}`));
    console.log(chalk.green(`\n=== Request End ===\n`));
  });

  next();
};

module.exports = requestLogger;
