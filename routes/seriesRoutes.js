const express = require("express");
const router = express.Router();

//Import rate limit middleware
const { limiter } = require("../middlewares/rateLimit");

const {
  createNewManga,
  getChapter,
  uploadChapter,
  rawsUploader,
  editSeries,
  getLatestUpdate,
  getSeriesDetails,
  getAllSeries,
  getUploadedImagesCount,
  editChapterImages,
  addStats,
  updateChapterDetails,
  getStats
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
router.post("/createNewSeries", limiter, createNewManga);

// Upload a new chapter
router.post("/uploadChapter", limiter, (req, res, next) => {
  console.log(`Body: `, req.body);
  
  // Validate batch parameters
  const { nick, chapterNo, totalPageNo, batchNumber, totalBatches } = req.body;
  
  // Early response for empty requests
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing file data in request",
      currentProgress: 0
    });
  }
  
  // Use default values if batch parameters are missing
  const currentBatch = parseInt(batchNumber) || 1;
  const batchTotal = parseInt(totalBatches) || 1;
  
  console.log(`Processing batch ${currentBatch}/${batchTotal} for ${nick} chapter ${chapterNo}`);
  
  const uploadMiddleware = upload.array('images', 100);
  
  // Handle the upload
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      console.error('Upload middleware error:', err);
      return res.status(400).json({
        success: false,
        message: "File processing error",
        error: err.message,
        batchNumber: currentBatch,
        totalBatches: batchTotal
      });
    }
    
    try {
      // Check if we have files
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files received",
          batchNumber: currentBatch,
          totalBatches: batchTotal
        });
      }
      
      // Get current progress
      const currentProgress = await getUploadedImagesCount(nick, chapterNo);
      console.log(`Current upload progress: ${currentProgress}/${totalPageNo}`);
      
      // Forward to the chapter upload function
      return uploadChapter(req, res);
    } catch (error) {
      console.error('Processing error:', error);
      
      // Return detailed error for client retry
      return res.status(500).json({
        success: false,
        message: "Server error during upload",
        error: error.message,
        batchNumber: currentBatch,
        totalBatches: batchTotal,
        currentProgress: await getUploadedImagesCount(nick, chapterNo)
      });
    }
  });
});

// Upload raws to Google Drive
router.post("/uploadRaws", limiter, (req, res, next) => {
  console.log(`Google Drive Upload Request Body: `, req.body);
  
  const { nick, chapterNo, totalPageNo, batchNumber, totalBatches } = req.body;
  
  // Early response for empty requests
  if (!req.headers['content-type']?.includes('multipart/form-data')) {
    return res.status(400).json({ 
      success: false, 
      message: "Missing file data in request"
    });
  }
  
  const currentBatch = parseInt(batchNumber) || 1;
  const batchTotal = parseInt(totalBatches) || 1;
  
  console.log(`Processing Google Drive batch ${currentBatch}/${batchTotal} for ${nick} chapter ${chapterNo}`);
  
  const uploadMiddleware = upload.array('images', 100);
  
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      console.error('Upload middleware error:', err);
      return res.status(400).json({
        success: false,
        message: "File processing error",
        error: err.message,
        batchNumber: currentBatch,
        totalBatches: batchTotal
      });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files received",
        batchNumber: currentBatch,
        totalBatches: batchTotal
      });
    }
    
    // Forward to the Google Drive upload function
    return rawsUploader(req, res);
  });
});


// Update chapter Image(s)
router.post("/updateChapterImages", limiter, upload.array('image', 100), editChapterImages);

// Update chapter Details
router.post("/updateChapterDetails", limiter, updateChapterDetails);

// Edit series details
router.put("/editSeries/:mangaId", limiter, editSeries);

// Get series with URL parameters
router.get("/getSeries/:mangaId/:nick/:chapterNo", getChapter);

// Get latest Updates
router.get("/getLatestUpdate", getLatestUpdate);

// Get series details
router.get("/getSeriesDetails/:mangaId/:nick", getSeriesDetails);

// Get all series in database
router.get("/getAllSeries", getAllSeries);

// Get stats
router.get("/getStats", getStats);

// Add stats
router.post("/addStats", limiter, addStats);

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
