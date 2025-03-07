const express = require("express");
const router = express.Router();
const {
  createNewManga,
  getSeries,
  uploadChapter,
  editSeries,
  getLatestUpdate,
  getSeriesDetails,
  getAllSeries,
  getUploadedImagesCount
} = require("../controllers/seriesController");

const { authMiddleware } = require("../middlewares/auth");
const multer = require('multer');

// Configure multer for file uploads with optimized settings
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
    fieldSize: 50 * 1024 * 1024, // 50MB limit for text fields
    files: 100, // Reasonable limit for number of files
    parts: 150 // Slightly more than files limit to account for fields
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

// Add a new manga to the database
router.post("/createNewSeries", createNewManga);

// Upload a new chapter
router.post("/uploadChapter", (req, res, next) => {
  console.log(`Body: `, req.body);
  // Log request details before processing
  console.log('\n=== Detailed Request Debug ===');
  console.log('Content-Length:', req.headers['content-length']);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Boundary:', req.headers['content-type'].split('boundary=')[1]);
  
  // Track raw data and form parsing
  let rawData = [];
  let totalSize = 0;
  let formDataFields = new Map();

  req.on('data', chunk => {
    rawData.push(chunk);
    totalSize += chunk.length;
    console.log(`\n=== Chunk Received ===`);
    console.log(`Chunk size: ${chunk.length} bytes`);
    console.log(`Total size so far: ${totalSize} bytes`);
    
    // Try to parse form data boundaries in the chunk
    const chunkStr = chunk.toString();
    const boundaryStr = req.headers['content-type'].split('boundary=')[1];
    
    if (chunkStr.includes(boundaryStr)) {
      console.log('Found form boundary in chunk');
      // Log the content after boundary
      const parts = chunkStr.split(boundaryStr);
      parts.forEach((part, index) => {
        if (part.includes('name=')) {
          console.log(`Form part ${index}:`, part.substring(0, 200));
        }
      });
    }
  });

  req.on('end', () => {
    console.log('\n=== Request Data Complete ===');
    console.log(`Total data size: ${totalSize} bytes`);
    console.log('Expected size:', req.headers['content-length']);
    
    // Check if sizes match
    if (totalSize !== parseInt(req.headers['content-length'])) {
      console.warn('Warning: Received data size does not match Content-Length');
    }
  });

  // Configure multer with increased limits
  const uploadMiddleware = upload.array('images', 100);
  
  // Create an AbortController with increased timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 30000); // 30 seconds timeout

  // Handle the upload with promise
  const uploadPromise = new Promise((resolve, reject) => {
    // Add request error handler
    req.on('error', (error) => {
      console.error('Request stream error:', error);
      reject(error);
    });

    uploadMiddleware(req, res, async (err) => {
      if (err) {
        console.error('\n=== Multer Error Details ===');
        console.error({
          name: err.name,
          message: err.message,
          code: err.code,
          field: err.field,
          storageErrors: err.storageErrors,
          stack: err.stack,
          boundary: req.headers['content-type'].split('boundary=')[1]
        });

        // Log raw form data for debugging
        console.log('\n=== Raw Form Data Preview ===');
        const fullData = Buffer.concat(rawData);
        console.log('First 500 bytes:', fullData.slice(0, 500).toString());
        console.log('Last 500 bytes:', fullData.slice(-500).toString());
        
        reject(err);
        return;
      }

      try {
        console.log('\n=== Successfully Parsed Form Data ===');
        console.log('Form fields:', req.body);
        console.log('Files received:', req.files?.length || 0);
        
        if (req.files && req.files.length > 0) {
          console.log('First file details:', {
            fieldname: req.files[0].fieldname,
            originalname: req.files[0].originalname,
            encoding: req.files[0].encoding,
            mimetype: req.files[0].mimetype,
            size: req.files[0].size
          });
        }

        const { nick, chapterNo, totalPageNo, batchNumber, totalBatches } = req.body;
        
        // Validate required fields
        if (!nick || !chapterNo || !totalPageNo) {
          console.error('Missing required fields:', { nick, chapterNo, totalPageNo });
          reject(new Error('Missing required fields'));
          return;
        }

        console.log('\n=== Batch Upload Details ===');
        console.log({
          nick,
          chapterNo,
          totalPageNo,
          batchNumber,
          totalBatches,
          filesReceived: req.files?.length || 0
        });

        if (!req.files || req.files.length === 0) {
          reject(new Error('No files received in batch'));
          return;
        }

        const currentCount = await getUploadedImagesCount(nick, chapterNo);
        console.log(`Current Cloudinary upload progress: ${currentCount}/${totalPageNo}`);

        resolve();
      } catch (error) {
        console.error('Processing error:', error);
        reject(error);
      }
    });
  });

  // Race between upload and timeout
  Promise.race([
    uploadPromise,
    new Promise((_, reject) => {
      controller.signal.addEventListener('abort', () => {
        reject(new Error('Batch upload timed out'));
      });
    })
  ])
  .then(() => {
    clearTimeout(timeoutId);
    // Use existing uploadChapter function
    return uploadChapter(req, res);
  })
  .catch(async err => {
    clearTimeout(timeoutId);
    console.error('Upload error:', err);

    // Match frontend retry mechanism
    const errorResponse = {
      success: false,
      batchNumber: req.body?.batchNumber,
      totalBatches: req.body?.totalBatches,
      currentProgress: {
        uploadedPages: await getUploadedImagesCount(req.body?.nick, req.body?.chapterNo),
        totalPages: parseInt(req.body?.totalPageNo || 0)
      }
    };

    if (err.message === 'Batch upload timed out') {
      return res.status(408).json({
        ...errorResponse,
        message: "Batch timed out - will retry"
      });
    }

    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        ...errorResponse,
        message: "Upload validation failed",
        error: err.message
      });
    }

    return res.status(500).json({
      ...errorResponse,
      message: "Server error during batch upload",
      error: err.message
    });
  });
});

// Edit series details
router.put("/editSeries/:mangaId", editSeries);

// Get series with URL parameters
router.get("/getSeries/:mangaId/:nick/:chapterNo", getSeries);

// Get latest Updates
router.get("/getLatestUpdate", getLatestUpdate);

// Get series details
router.get("/getSeriesDetails/:mangaId/:nick", getSeriesDetails);

// Get all series in database
router.get("/getAllSeries", getAllSeries);

// Add a new route for chunked uploads
router.post("/uploadChapterChunk", upload.single('chunk'), async (req, res) => {
  try {
    const { chunkNumber, totalChunks, fileId } = req.body;
    
    // Store chunk in temporary storage
    // You might want to use a service like Redis or temporary files
    
    if (chunkNumber === totalChunks) {
      // All chunks received, process the complete file
      // Combine chunks and call your existing upload logic
    }
    
    res.json({ success: true, chunkNumber });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
