const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request start
  console.log(`\n=== Request Start ===`);
  console.log(`${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Content-Length:', req.headers['content-length']);
  console.log('Content-Type:', req.headers['content-type']);

  // Track actual data size
  let dataSize = 0;
  
  // Monitor data chunks as they come in
  req.on('data', chunk => {
    dataSize += chunk.length;
    console.log(`Received chunk of size: ${chunk.length}`);
    console.log(`Total data received so far: ${dataSize}`);
  });

  req.on('end', () => {
    console.log(`Final data size: ${dataSize}`);
  });

  // Log response details
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`\n=== Response ===`);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Total Bytes Received: ${dataSize}`);
    console.log('\n=== Request End ===\n');
  });

  next();
};

module.exports = requestLogger; 