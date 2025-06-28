const { B2 } = require('backblaze-b2');
const { uploadFile, listFiles } = require('../utils/backblaze');
const { connectGoogleDrive, createFolder, getDriveFolder, getDriveFolderCaseInsensitive, uploadFileToDrive, getFileDetails } = require('../utils/google');
const { seriesList, latestRelease, stats } = require("../models/seriesList");
const { dashboardAuthMiddleware } = require("../middlewares/auth");
const { createUID } = require("../utils/createUID");
const multer = require('multer');
const path = require('path');
const chalk = require('chalk');
const cache = require('memory-cache');

// Configure multer for file uploads
const storage = multer.memoryStorage();

// Constants for B2
const B2_PUBLIC_URL = process.env.BACKBLAZE_PUBLIC_URL;

/*
================================== Create New Series ==========================================================
*/

// Create a new manga entry in the database
const createNewManga = async (req, res) => {
  
  const body = JSON.parse(req.body.toString());
  const {
    title,
    nick,
    desc,
    manga_status,
    author,
    anilist,
    mal,
    chapterCount,
    genre,
    releaseDate,
    thumbnail,
    visibility
  } = body;
  
  console.log(body)
  console.log("Creating new manga:", title);

  try {
    // Find the series list document or create one if it doesn't exist
    let list = await seriesList.findOne();
    if (!list) {
      list = new seriesList({ mangas: [] });
    }

    // Check if manga already exists
    const existingManga = list.mangas.find((m) => m.title === title);
    if (existingManga) {
      return res
        .status(400)
        .json({ success: false, message: "Manga already exists in DB" });
    }

    // Generate a unique ID for the manga
    const mangaId = createUID();

    // Add manga to the list
    list.mangas.push({
      manga: mangaId,
      title,
      nick,
      desc,
      thumbnail,
      manga_status,
      visibility,
      author,
      genre,
      releaseDate,
      anilist,
      mal,
      chapterCount,
      chapters: [], // Initialize chapters array
    });

    // Save the updated list
    await list.save();

    // Get the added manga
    const addedManga = list.mangas[list.mangas.length - 1];

    res.status(200).json({
      success: true,
      message: "Manga added to Database successfully",
      manga: addedManga,
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create new entry",
      error: error.message,
    });
  }
};

/*
================================== Upload New Chapter ==========================================================
*/

// Upload chapter
const uploadChapter = async (req, res) => {
  // Set CORS headers immediately for long-running requests
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-user-token');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  const { chapterName, nick, chapterNo, totalPageNo, visibility, batchNumber, totalBatches } = req.body;
  
  // Default values for batch parameters if not provided
  const currentBatch = parseInt(batchNumber) || 1;
  const batchTotal = parseInt(totalBatches) || 1;
  const isFinalBatch = currentBatch === batchTotal;

  console.log(`Processing batch ${currentBatch}/${batchTotal} for ${nick} chapter ${chapterNo}`);

  try {
    // Check if folders exist by attempting to list files
    const folderPath = `${nick}/${chapterNo}`;
    console.log("Target folder path:", folderPath);

    // Validate files array
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No files provided for upload",
        batchNumber: currentBatch,
        totalBatches: batchTotal
      });
    }

    // Sort files array based on filenames
    const sortedFiles = req.files.sort((a, b) => {
      const numA = parseInt(a.originalname.match(/\d+/)[0]);
      const numB = parseInt(b.originalname.match(/\d+/)[0]);
      return numA - numB;
    });

    // Get the highest page number from the filenames
    const highestPageInBatch = parseInt(sortedFiles[sortedFiles.length - 1].originalname.match(/\d+/)[0]);
    console.log(`Highest page number in current batch: ${highestPageInBatch}`);

    // Use Promise.all for concurrent uploads
    const uploadPromises = sortedFiles.map(file => {
      const public_id = path.parse(file.originalname).name;
      console.log(`Uploading file ${public_id} to ${folderPath}...`);
      
      return uploadFile(file.buffer, `${public_id}.png`, folderPath);
    });

    // Wait for all uploads to complete
    const uploadResults = await Promise.all(uploadPromises.map(p => p.catch(err => ({ error: err.message }))));

    console.log(`uploadPromises: `, uploadPromises);
    console.log(`uploadResults: `, uploadResults);
    
    // Check for any upload failures
    const failedUploads = uploadResults.filter(result => result.error);
    if (failedUploads.length > 0) {
      return res.status(500).json({
        success: false,
        message: "Some images failed to upload",
        failures: failedUploads,
        batchNumber: currentBatch,
        totalBatches: batchTotal
      });
    }

    // Get the current count of uploaded images
    const currentCount = await getUploadedImagesCount(nick, chapterNo);
    const isComplete = currentCount >= parseInt(totalPageNo);
    
    console.log(`Current progress: ${currentCount}/${totalPageNo}, Is complete: ${isComplete}`);
    
    // For non-final batches, return early with progress
    if (!isFinalBatch || !isComplete) {
      return res.status(200).json({
        success: true,
        message: `Batch ${currentBatch}/${batchTotal} uploaded successfully`,
        batchNumber: currentBatch,
        totalBatches: batchTotal,
        currentProgress: {
          uploadedPages: currentCount,
          totalPages: parseInt(totalPageNo),
          remaining: parseInt(totalPageNo) - currentCount
        }
      });
    }
    
    // If this is the final batch and uploads are complete, update database
    if (isComplete) {
      // Schedule database update as a background task
      process.nextTick(async () => {
        try {
          await updateDatabaseForChapter(nick, chapterNo, chapterName, totalPageNo, currentCount, visibility.toLowerCase());
          console.log(`Database updated for ${nick} chapter ${chapterNo}`);
        } catch (error) {
          console.error(`Failed to update database: ${error.message}`);
        }
      });
      
      // Return success response immediately
      return res.status(200).json({
        success: true,
        message: "Chapter upload complete. Database update scheduled.",
        uploads: uploadResults.map(result => ({
          url: result.url,
          displayName: result.name,
        })),
        currentProgress: {
          uploadedPages: currentCount,
          totalPages: parseInt(totalPageNo),
          remaining: 0,
          isComplete: true
        }
      });
    }
    
    // Return progress for incomplete uploads
    return res.status(200).json({
      success: true,
      message: `Chapter upload in progress. Uploaded ${currentCount} of ${totalPageNo} pages`,
      uploads: uploadResults.map(result => ({
        url: result.url,
        displayName: path.basename(result.fileName || ''),
      })),
      currentProgress: {
        uploadedPages: currentCount,
        totalPages: parseInt(totalPageNo),
        remaining: parseInt(totalPageNo) - currentCount
      }
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload chapter",
      error: error.message,
      batchNumber: currentBatch,
      totalBatches: batchTotal
    });
  }
};

// Create a separate function to update the database
async function updateDatabaseForChapter(nick, chapterNo, chapterName, totalPageNo, currentCount, visibility) {
  // Find the series list document or create one if it doesn't exist
  let list = await seriesList.findOne();
  if (!list) {
    throw new Error("Series list not found in database");
  }

  // Find the manga in the list
  const manga = list.mangas.find(m => m.nick.toLowerCase() === nick.toLowerCase());
  if (!manga) {
    throw new Error("Manga not found in database");
  }

  // Get the thumbnail URL from B2
  const thumbnailUrl = `${B2_PUBLIC_URL}/${nick}/${chapterNo}/1.png`;

  // Update or add chapter details
  const chapterIndex = manga.chapters.findIndex(c => c.chapterNo === chapterNo);
  if (chapterIndex !== -1) {
    manga.chapters[chapterIndex].isComplete = true;
    manga.chapters[chapterIndex].pageCount = currentCount;
    manga.chapters[chapterIndex].thumbnail = thumbnailUrl;
    manga.chapters[chapterIndex].visibility = visibility;
  } else {
    manga.chapters.push({
      chapterName: chapterName,
      chapterNo: chapterNo,
      isComplete: true,
      pageCount: currentCount,
      thumbnail: thumbnailUrl,
      visibility: manga.visibility,
    });
  }

  // Update chapter count
  manga.chapterCount = Math.max(manga.chapterCount || 0, parseInt(chapterNo));
  manga.maxChaptersUploaded = Math.max(manga.maxChaptersUploaded || 0, parseInt(chapterNo));
  
  // Save the updated list
  await list.save();

  // Create latest release entry
  try {
    // Check if previous chapter exists
    const prevChapter = parseInt(chapterNo) == 1 ? null : parseInt(chapterNo) - 1;

    // Create latest release entry
    const newRelease = new latestRelease({
      manga: manga.manga,
      chapterName: chapterName,
      title: manga.title,
      nick: manga.nick,
      chapterNo: chapterNo,
      previousChapter: prevChapter,
      thumbnail: thumbnailUrl,
      pageCount: currentCount,
      visibility: "public" ,
      uploadDate: new Date(),
      isComplete: true,
    });

    await newRelease.save();
    console.log("Created latest release entry:", newRelease);
  } catch (releaseError) {
    console.error("Failed to create latest release entry:", releaseError);
    throw releaseError;
  }
}

/*
=========================================== Upload Raws ========================================================
*/

// Upload raws to Google Drive
const rawsUploader = async (req, res) => {
  // Set CORS headers for long-running requests
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-user-token');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  const body = JSON.parse(req.body.toString());
  const { title, nick, chapterNo, totalPageNo, batchNumber, totalBatches } = body;
  
  // Default values for batch parameters
  const currentBatch = parseInt(batchNumber) || 1;
  const batchTotal = parseInt(totalBatches) || 1;
  const isFinalBatch = currentBatch === batchTotal;

  console.log(`Processing Google Drive batch ${currentBatch}/${batchTotal} for ${title} chapter ${chapterNo}`);

  try {
    // Connect to Google Drive
    const drive = await connectGoogleDrive();
    
    if (!drive) {
      console.error("Failed to connect to Google Drive");
      return res.status(500).json({
        success: false,
        message: "Failed to connect to Google Drive",
        batchNumber: currentBatch,
        totalBatches: batchTotal
      });
    }
    
    // Check if series exists in DB
    let list = await seriesList.findOne();
    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Series list not found in database",
        batchNumber: currentBatch,
        totalBatches: batchTotal
      });
    }

    // Find the manga in the database using title or nick
    const existingManga = list.mangas.find((m) => 
      m.title === title || m.nick.toLowerCase() === nick.toLowerCase()
    );
    
    if (!existingManga) {
      return res.status(400).json({ 
        success: false, 
        message: "Series does not exist in DB",
        batchNumber: currentBatch,
        totalBatches: batchTotal
      });
    }
    
    // Use the series title from the database for folder structure
    const seriesTitle = existingManga.title;
    
    // Validate files array
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files provided for upload",
        batchNumber: currentBatch,
        totalBatches: batchTotal
      });
    }

    // Check if "Raws" root folder exists
    let rawsRootFolderId = await getDriveFolderCaseInsensitive("Raws");
    if (!rawsRootFolderId) {
      console.log(`Raws root folder not found in drive.`);
      return res.status(400).json({
        success: false,
        message: "Raws root folder not found in drive",
        batchNumber: currentBatch,
        totalBatches: batchTotal
      });
    }

    // Check if series folder exists under Raws, create if not (case-insensitive search)
    let seriesFolderId = await getDriveFolderCaseInsensitive(seriesTitle, rawsRootFolderId);
    if (!seriesFolderId) {
      console.log(`${seriesTitle} folder not found under Raws. Creating...`);
      seriesFolderId = await createFolder(seriesTitle, rawsRootFolderId);
      console.log(`Created series folder with ID: ${seriesFolderId}`);
    }
    
    // Check if chapter folder exists under series folder, create if not
    let chapterFolderId = await getDriveFolder(chapterNo, seriesFolderId);
    if (!chapterFolderId) {
      console.log(`Chapter ${chapterNo} folder not found under ${seriesTitle}. Creating...`);
      chapterFolderId = await createFolder(chapterNo, seriesFolderId);
      console.log(`Created chapter folder with ID: ${chapterFolderId}`);
    } else {
      console.log(`${seriesTitle}/${chapterNo} folder already exists in drive. Folder ID: ${chapterFolderId}`);
    }
    
    // Sort files by filename number
    const sortedFiles = req.files.sort((a, b) => {
      const numA = parseInt(a.originalname.match(/\d+/)?.[0] || 0);
      const numB = parseInt(b.originalname.match(/\d+/)?.[0] || 0);
      return numA - numB;
    });

    // Upload files to Google Drive
    const uploadPromises = sortedFiles.map(async (file) => {
      const fileName = `${path.parse(file.originalname).name}.png`;
      console.log(`Uploading ${fileName} to Google Drive folder: Raws/${seriesTitle}/${chapterNo}/`);
      
      try {
        const result = await uploadFileToDrive(
          file.buffer, 
          fileName, 
          chapterFolderId, 
          'image/png'
        );
        
        return {
          fileName: fileName,
          fileId: result.fileId,
          webViewLink: result.webViewLink,
          success: true
        };
      } catch (error) {
        console.error(`Failed to upload ${fileName}:`, error);
        return {
          fileName: fileName,
          error: error.message,
          success: false
        };
      }
    });

    // Wait for all uploads to complete
    const uploadResults = await Promise.all(uploadPromises);
    
    // Check for failed uploads
    const failedUploads = uploadResults.filter(result => !result.success);
    const successfulUploads = uploadResults.filter(result => result.success);
    
    if (failedUploads.length > 0) {
      console.error(`${failedUploads.length} files failed to upload to Google Drive`);
      return res.status(500).json({
        success: false,
        message: "Some files failed to upload to Google Drive",
        failures: failedUploads,
        successful: successfulUploads,
        batchNumber: currentBatch,
        totalBatches: batchTotal
      });
    }
    
    // For non-final batches, return progress
    if (!isFinalBatch) {
      return res.status(200).json({
        success: true,
        message: `Batch ${currentBatch}/${batchTotal} uploaded to Google Drive successfully`,
        uploads: successfulUploads,
        batchNumber: currentBatch,
        totalBatches: batchTotal,
        folderStructure: `Raws/${seriesTitle}/${chapterNo}`,
        rawsRootFolderId: rawsRootFolderId,
        seriesFolderId: seriesFolderId,
        chapterFolderId: chapterFolderId
      });
    }
    
    // Final batch - return complete success
    return res.status(200).json({
      success: true,
      message: "Chapter upload to Google Drive completed successfully",
      uploads: successfulUploads,
      totalUploaded: successfulUploads.length,
      folderStructure: `Raws/${seriesTitle}/${chapterNo}`,
      rawsRootFolderId: rawsRootFolderId,
      seriesFolderId: seriesTitle,
      chapterFolderId: chapterFolderId,
      batchNumber: currentBatch,
      totalBatches: batchTotal
    });
    
  } catch (error) {
    console.error("Google Drive upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload to Google Drive",
      error: error.message,
      batchNumber: currentBatch,
      totalBatches: batchTotal
    });
  }
};

/*
================================== Edit Existing Series ========================================================
*/

// Edit Series Data in DB
const editSeries = async (req, res) => {
  try {
    console.log('Editing Series');
    const { id, nick, fields } = req.body;
    console.log(req.body);
    
    // Find the series list document
    let list = await seriesList.findOne();
    if (!list) {
      return res.status(404).json({
        success: false,
        message: "No series list found in database",
      });
    }

    // Locate the specific manga entry using the provided id or nick
    const mangaIndex = list.mangas.findIndex(
      (m) => m.manga === id || (nick && m.nick && m.nick.toLowerCase() === nick.toLowerCase())
    );

    if (mangaIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Manga not found in database",
      });
    }

    // Update only the fields that are present in the fields object
    const manga = list.mangas[mangaIndex];
    for (const [key, value] of Object.entries(fields)) {
      if (value.updated !== undefined) {
        manga[key] = value.updated;
      }
    }

    // Save the updated series list document
    await list.save();

    res.status(200).json({
      success: true,
      message: "Series updated successfully",
      manga,
    });
    
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to edit series",
      error: error.message,
    });
  }
};

/*
================================== Edit Existing Chapter ==========================================================
*/

// Edit chapter Images
const editChapterImages = async (req, res) => {
  const { nick, chapterNo } = req.body;

  console.log("req.body: ", req.body);
  console.log("Editing chapter:", { nick, chapterNo });

  try {
    // Check if folders exist by listing files
    const folderPath = `${nick}/${chapterNo}`;
    let existingFiles;
    
    try {
      existingFiles = await listFiles(folderPath);
    } catch (err) {
      return res.status(404).json({
        success: false,
        error: "Chapter folder not found",
      });
    }

    console.log("Target folder path:", folderPath);

    // Validate files array
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No files provided for upload",
      });
    }

    // Sort files array based on filenames
    const sortedFiles = req.files.sort((a, b) => {
      const numA = parseInt(a.originalname.match(/\d+/)[0]);
      const numB = parseInt(b.originalname.match(/\d+/)[0]);
      return numA - numB;
    });

    // Upload new files with original filenames
    const uploadPromises = sortedFiles.map((file) => {
      const public_id = path.parse(file.originalname).name;
      console.log(`Uploading file ${public_id} to ${folderPath}...`);
      
      return uploadFile(file.buffer, `${public_id}.png`, folderPath);
    });

    // Wait for the upload to complete
    const uploadResults = await Promise.all(uploadPromises.map(p => p.catch(err => ({ error: err.message }))));

    // Check for any upload failures
    const failedUploads = uploadResults.filter((result) => result.error);
    if (failedUploads.length > 0) {
      return res.status(500).json({
        success: false,
        message: "Some images failed to upload",
        failures: failedUploads,
      });
    }

    // Return success message
    res.status(200).json({
      success: true,
      message: "Chapter files replaced successfully",
      uploads: uploadResults.map((result) => ({
        url: result.url,
        displayName: path.basename(result.fileName || ''),
      })),
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to edit chapter",
      error: error.message,
    });
  }
};

/*
================================== Update Chapter Details ==========================================================
*/

// Edit chapter Data in DB
const updateChapterDetails = async (req, res) => {
  try {
    console.log('Editing Chapter Details');
    const { id, nick, chapterNo, fields } = req.body;
    console.log(req.body);
    
    // If fields is not provided, extract update fields from req.body
    let updateFields = fields;
    if (!fields) {
      const { id, nick, chapterNo, ...otherFields } = req.body;
      updateFields = {};
      for (const [key, value] of Object.entries(otherFields)) {
        updateFields[key] = { updated: value };
      }
    }

    // Check if there are fields to update
    if (!updateFields || Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided for updating chapter details",
      });
    }

    // Find the series list document
    let list = await seriesList.findOne();
    if (!list) {
      return res.status(404).json({
        success: false,
        message: "No series list found in database",
      });
    }

    // Locate the specific manga entry using the provided id or nick
    const mangaIndex = list.mangas.findIndex(
      (m) => m.manga === id || (nick && m.nick && m.nick.toLowerCase() === nick.toLowerCase())
    );
    if (mangaIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Manga not found in database",
      });
    }

    // Find the specific chapter using the chapter number
    const manga = list.mangas[mangaIndex];
    const chapterIndex = manga.chapters.findIndex(
      (ch) => ch.chapterNo === chapterNo
    );
    if (chapterIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found in the manga",
      });
    }

    // Update only the fields that are present in the updateFields object
    const chapter = manga.chapters[chapterIndex];
    for (const [key, value] of Object.entries(updateFields)) {
      if (value.updated !== undefined) {
        chapter[key] = value.updated;
      }
    }

    // Save the updated series list document
    await list.save();

    res.status(200).json({
      success: true,
      message: "Chapter details updated successfully",
      chapter,
    });
    
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to edit series",
      error: error.message,
    });
  }
};


/*
================================== Get Series Details ==========================================================
*/

const getSeriesDetails = async (req, res) => {
  try {
    // Get parameters from URL
    const { mangaId, nick } = req.params;
    console.log("Manga ID:", mangaId);
    console.log("Series Name:", nick);

    // Validate required parameters
    if (!nick || !mangaId) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: nick and seriesId are required",
      });
    }

    // First get the series details from our database
    let list = await seriesList.findOne();
    if (!list) {
      return res.status(404).json({
        success: false,
        error: "No series list found in database",
      });
    }

    // Safe toLowerCase comparison
    const seriesNameLower = nick.toLowerCase();
    const seriesDetails = list.mangas.find(
      (m) =>
        m.manga === mangaId ||
        (m.title && m.title.toLowerCase() === seriesNameLower),
    );

    if (!seriesDetails) {
      return res.status(404).json({
        success: false,
        error: "Series not found",
      });
    }

    // Check if series is private and user is not authorized
    const authResult = dashboardAuthMiddleware(req, res);
    if (seriesDetails.visibility.toLowerCase() === 'private' && authResult !== "Is Dashboard") {
      return res.status(403).json({
        success: false,
        error: "This series is private. It is not available for public access.",
        visibility: seriesDetails.visibility
      });
    }
    
    //Get Chapters
    const latestReleases = await latestRelease
      .find({ manga: mangaId, nick: nick })
      .sort({ uploadDate: -1 });
    
    return res.status(200).json({
      success: true,
      seriesDetails,
      releases: latestReleases,
      nick,
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch series information",
      details: error.message,
    });
  }
}

/*
================================== Get Series ==========================================================
*/

// Get Chapter
const getChapter = async (req, res) => {
  try {
    // Get parameters from URL
    const { mangaId, nick, chapterNo } = req.params;
    console.log("Series Name:", nick);
    console.log("Chapter Number:", chapterNo);

    // Validate required parameters
    if (!nick || !chapterNo) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: nick and chapterNo are required",
      });
    }

    // Query the database for the specific chapter
    const seriesDetails = await latestRelease.findOne({
      manga: mangaId,
      nick: nick,
      chapterNo: chapterNo,
    });

    console.log(seriesDetails);
    
    if (!seriesDetails) {
      return res.status(404).json({
        success: false,
        error: "Series not found in database",
      });
    }

    let list = await seriesList.findOne();
    if (!list) {
      return res.status(404).json({
        success: false,
        message: "No series list found in database",
      });
    }

    // Locate the specific manga entry using the provided id or nick
    const mangaIndex = list.mangas.findIndex(
      (m) => m.manga === mangaId || (nick && m.nick && m.nick.toLowerCase() === nick.toLowerCase())
    );
    if (mangaIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Manga not found in database",
      });
    }

    // Find the specific chapter using the chapter number
    const manga = list.mangas[mangaIndex];
    const chapterIndex = manga.chapters.findIndex(
      (ch) => ch.chapterNo === chapterNo
    );
    
    console.log(`Chapter index: ${chapterIndex}`)
    
    // Check authorization first
    const authResult = dashboardAuthMiddleware(req, res);
    const isDashboard = authResult === "Is Dashboard";
    
    // Check series-level visibility
    if (manga.visibility === 'private' && !isDashboard) {
      return res.status(403).json({
        success: false,
        error: "This series is private. It is not available for public access.",
        visibility: manga.visibility
      });
    }
    
    // Check chapter-level visibility if chapter exists in the series document
    if (chapterIndex !== -1) {
      const chapter = manga.chapters[chapterIndex];
      if (chapter.visibility === 'private' && !isDashboard) {
        return res.status(403).json({
          success: false,
          error: "This chapter is private. It is not available for public access.",
          visibility: chapter.visibility
        });
      }
    }
    
    // Also check the latestRelease visibility as a fallback
    if (seriesDetails.visibility === 'private' && !isDashboard) {
      return res.status(403).json({
        success: false,
        error: "This content is private. It is not available for public access.",
        visibility: seriesDetails.visibility
      });
    }
    
    console.log(`Getting cache for ${nick}-${chapterNo}`, cache.get(`${nick}-${chapterNo}`));
    if (cache.get(`${nick}-${chapterNo}`)) {
      console.log(`Cache hit for ${nick}-${chapterNo}`);
      
      return res.status(200).json({
        success: true,
        cacheHit: true,
        seriesDetails: cache.get(`${nick}-${chapterNo}`).seriesDetails,
        resources: cache.get(`${nick}-${chapterNo}`).resources,
        nick: cache.get(`${nick}-${chapterNo}`).nick,
        chapterNo: cache.get(`${nick}-${chapterNo}`).chapterNo,
      });
    }

    try {
      // Fetch resources from B2
      const folderPath = `${nick}/${chapterNo}`;
      console.log("Fetching from folder:", folderPath);

      const files = await listImages(nick, chapterNo, seriesDetails.pageCount);

      if (!files || files.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No chapter images found",
        });
      }
      
      cache.put(`${nick}-${chapterNo}`, {
        success: true,
        seriesDetails,
        resources: files,
        nick,
        chapterNo,
      });
      
      console.log(`Cache set for ${nick}-${chapterNo}`);
      cache.put(`${nick}-${chapterNo}-headers`, files.headers);
      res.set(files.headers)

      return res.status(200).json({
        success: true,
        seriesDetails,
        resources: files,
        nick,
        chapterNo,
      });
      
    } catch (error) {
      console.error("B2 error:", error);
      return res.status(404).json({
        success: false,
        error: "Chapter not found or inaccessible",
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch series information",
      details: error.message,
    });
  }
};

async function listImages(series, chapterNo, pageCount) {
  return Array.from({ length: pageCount }, (_, i) => `https://files.alternativescans.icu/file/public-chapter-images/${series}/${chapterNo}/${i + 1}.png`);
}

/*
================================== Get Latest Updates ==========================================================
*/

const getLatestUpdate = async (req, res) => {
  try {
    // Get the first 10 entries from latestReleases
    const latestReleases = await latestRelease
      .find(
        { visibility:  { $ne: 'private' } }
      )
      .sort({ uploadDate: -1 })
      .limit(10);

    // Fetch series details for each latest release to get the series thumbnail
    const seriesListDoc = await seriesList.findOne();
    if (!seriesListDoc) {
      return res.status(404).json({
        success: false,
        message: "No series list found in database",
      });
    }

    const releasesWithThumbnails = latestReleases.map(release => {
      const series = seriesListDoc.mangas.find(manga => manga.manga === release.manga);
      return {
        ...release._doc,
        seriesThumbnail: series ? series.thumbnail : null,
      };
    });

    res.status(200).json({ success: true, latestReleases: releasesWithThumbnails });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch latest updates",
      error: error.message,
    });
  }
};

/*
================================== Get All Series ==========================================================
*/

// Get all series in database
const getAllSeries = async (req, res) => {
  try {
    const series = await seriesList.find({});
      
    // Check authorization first
    const authResult = dashboardAuthMiddleware(req, res);
    const isDashboard = authResult === "Is Dashboard";
    
    if (isDashboard) {
      // Dashboard users can see everything (including private content)
      const allSeries = series.map(serie => {
        const allMangas = serie.mangas.map(manga => ({
          ...manga.toObject(),
          // Include all chapters for dashboard users
          chapters: manga.chapters
        }));

        return {
          ...serie.toObject(),
          mangas: allMangas
        };
      }).filter(serie => serie.mangas.length > 0);

      res.status(200).json({ success: true, series: allSeries });
    } else {
      console.log('Not dashboard');
      // Non-dashboard users only see public content
      const filteredSeries = series.map(serie => {
        const publicMangas = serie.mangas
          .filter(manga => manga.visibility.toLowerCase() !== 'private')
          .map(manga => ({
            ...manga.toObject(),
            // Also filter out private chapters
            chapters: manga.chapters.filter(chapter => chapter.visibility.toLowerCase() !== 'private')
          }));

        return {
          ...serie.toObject(),
          mangas: publicMangas
        };
      }).filter(serie => serie.mangas.length > 0);

      res.status(200).json({ success: true, series: filteredSeries });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all series",
      error: error.message,
    });
  }
};

/*
================================== Add Stats To Series ==========================================================
*/

const addStats = async (req, res) => {
  try {
    const { seriesId, views, likes, dislikes } = req.body;
    const updatedSeries = await stats.findByIdAndUpdate(
      seriesId,
      { $inc: { views, likes, dislikes } },
      { new: true }
    );
    res.status(200).json({ success: true, updatedSeries });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add stats",
      error: error.message,
    });
  }
};

/*
================================== Get Stats Of Series ==========================================================
*/

const getStats = async (req, res) => {
  try {
    const { seriesId } = req.params;
    const series = await stats.findById(seriesId);
    if (!series) {
      return res.status(404).json({ success: false, message: "Series not found" });
    }
    res.status(200).json({ success: true, stats: series.stats });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
      error: error.message,
    });
  }
};

/*
================================== Utility Functions ==========================================================
*/

// Function to check if folder exists and create if necessary (B2 doesn't need folder creation)
async function getFolder(nick, chapterNo) {
  try {
    const folderPath = `${nick}/${chapterNo}`;
    const files = await listFiles(folderPath);
    return { checkSeries: { name: nick }, checkChapter: { name: chapterNo } };
  } catch (error) {
    // If we can't list files, the folder might not exist yet, which is fine for B2
    return { checkSeries: { name: nick }, checkChapter: { name: chapterNo } };
  }
}

// Function to get the number of uploaded images
async function getUploadedImagesCount(nick, chapterNo) {
  try {
    const folderPath = `${nick}/${chapterNo}`;
    const files = await listFiles(folderPath);
    console.log(`File length: `,files.length);
    console.log(files);
    return files.length;
  } catch (error) {
    console.error("Failed to get uploaded images count:", error);
    return 0;
  }
}

// Helper function to extract the numerical part from the filename
function extractNumber(filename) {
  const baseName = path.basename(filename, path.extname(filename));
  const match = baseName.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

module.exports = { 
  createNewManga, 
  getChapter, 
  uploadChapter, 
  rawsUploader,
  getLatestUpdate, 
  getSeriesDetails, 
  getUploadedImagesCount, 
  getAllSeries, 
  editSeries, 
  editChapterImages,
  updateChapterDetails, 
  addStats, 
  getStats 
};
