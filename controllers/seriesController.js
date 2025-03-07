const { seriesList, latestRelease } = require("../models/seriesList");
const createUID = require("../utils/createUID");
const connectCloudinary = require("../utils/cloudinary");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create a new manga entry in the database
const createNewManga = async (req, res) => {
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
    thumbnail
  } = req.body;

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

const uploadChapter = async (req, res) => {
  const { chapterName, nick, chapterNo, totalPageNo } = req.body;

  console.log("Uploading chapter:", { chapterName, nick, chapterNo, totalPageNo });

  try {
    // Load Cloudinary
    const cloudinary = connectCloudinary();

    // Check if folders exist
    const folderCheck = await getFolder(nick, chapterNo);

    // Create folders if they don't exist
    if (folderCheck.error) {
      console.log("Creating necessary folders...");
      try {
        // Create series folder if it doesn't exist
        if (folderCheck.error === "Series Not Found") {
          await cloudinary.api.create_folder(nick);
          console.log(`Created series folder: ${nick}`);
        }

        // Create chapter folder
        const chapterPath = `${nick}/${chapterNo}`;
        await cloudinary.api.create_folder(chapterPath);
        console.log(`Created chapter folder: ${chapterPath}`);
      } catch (folderError) {
        console.error("Failed to create folders:", folderError);
        return res.status(500).json({
          success: false,
          error: "Failed to create necessary folders",
          details: folderError.message,
        });
      }
    }

    const folderPath = `${nick}/${chapterNo}`;
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

    // Get the highest page number from the filenames
    const highestPageNumber = parseInt(sortedFiles[sortedFiles.length - 1].originalname.match(/\d+/)[0]);
    console.log(`Highest page number in current batch: ${highestPageNumber}`);

    // Upload files with original filenames as public_id and display_name
    const uploadPromises = sortedFiles.map((file) => {
      return new Promise((resolve, reject) => {
        const public_id = path.parse(file.originalname).name;

        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: folderPath,
            public_id: public_id,
            resource_type: "auto", // Automatically detect resource type
          },
          (error, result) => {
            if (error) {
              console.error(`Failed to upload image ${public_id}:`, error);
              reject({ error: error.message, public_id });
            } else {
              resolve(result);
            }
          }
        );

        uploadStream.end(file.buffer);
      });
    });

    // Wait for all uploads to complete
    const uploadResults = await Promise.all(uploadPromises);

    // Check for any upload failures
    const failedUploads = uploadResults.filter((result) => result.error);
    if (failedUploads.length > 0) {
      return res.status(500).json({
        success: false,
        message: "Some images failed to upload",
        failures: failedUploads,
      });
    }

    // Check if the highest page number matches the totalPageNo
    const isComplete = highestPageNumber === parseInt(totalPageNo);
    console.log(`Total pages expected: ${totalPageNo}, Is complete: ${isComplete}`);

    // Update the manga's chapter count and create latest release entry
    let list = await seriesList.findOne();
    if (list) {
      const manga = list.mangas.find(
        (m) => m.nick.toLowerCase() === nick.toLowerCase(),
      );

      if (manga) {
        // Update or add chapter details
        const chapterIndex = manga.chapters.findIndex(
          (c) => c.chapterNo === chapterNo
        );

        // After upload results are complete, add this code to find page 01
        const firstPageImage = sortedFiles.find(file => {
          const fileName = path.parse(file.originalname).name;
          return fileName.endsWith('01') || fileName === '1';
        });
        
        // Find the corresponding upload result for page 01
        const thumbnailImage = firstPageImage ? uploadResults.find(result => 
          result.public_id.endsWith(path.parse(firstPageImage.originalname).name)
        ) : null;
        
        // Get the thumbnail URL if page 01 was uploaded
        const thumbnailUrl = thumbnailImage ? thumbnailImage.secure_url : null;
        
        // Update the chapter details section to include the thumbnail
        if (chapterIndex !== -1) {
          manga.chapters[chapterIndex].isComplete = isComplete;
          manga.chapters[chapterIndex].pageCount = highestPageNumber;
          if (thumbnailUrl) {
            manga.chapters[chapterIndex].thumbnail = thumbnailUrl;
          }
        } else {
          manga.chapters.push({
            chapterName: chapterName,
            chapterNo: chapterNo,
            isComplete: isComplete,
            pageCount: highestPageNumber,
            thumbnail: thumbnailUrl,
          });
        }

        // Update chapter count if the chapter is complete
        if (isComplete) {
          manga.chapterCount = Math.max(
            manga.chapterCount || 0,
            parseInt(chapterNo),
          );
          
          // Update maxChaptersUploaded
          manga.maxChaptersUploaded = Math.max(
            manga.maxChaptersUploaded || 0, 
            parseInt(chapterNo)
          );
        }

        await list.save();

        if (isComplete) {
          try {
            
            // Get the stored thumbnail or fetch it if not available
            const chapterDetails = manga.chapters.find(c => c.chapterNo === chapterNo);
            const storedThumbnail = chapterDetails?.thumbnail;
        
            // If no thumbnail is stored, try to fetch it from Cloudinary
            let finalThumbnail = storedThumbnail;
            if (!finalThumbnail) {
              const cloudinary = connectCloudinary();
              const folderPath = `${nick}/${chapterNo}`;
              const resources = await cloudinary.search.expression(
                `folder:${folderPath}`
              ).sort_by('display_name').execute();
        
              const page01 = resources.resources.find(r => 
                r.display_name.endsWith('01') || r.display_name === '1'
              );
              finalThumbnail = page01?.secure_url || uploadResults[0].secure_url;
            }

            // Create latest release entry with the correct thumbnail
            const newRelease = new latestRelease({
              manga: manga.manga,
              title: manga.title,
              nick: manga.nick,
              chapterNo: chapterNo,
              previousChapter: parseInt(chapterNo) - 1,
              thumbnail: finalThumbnail,
              pageCount: highestPageNumber,
              uploadDate: new Date(),
              isComplete: isComplete,
            });
        
            await newRelease.save();
            console.log("Created latest release entry:", newRelease);
        
            // Send comprehensive response
            res.status(200).json({
              success: true,
              message: "Chapter uploaded successfully and marked as complete",
              uploads: uploadResults.map((result) => ({
                url: result.secure_url,
                displayName: result.public_id,
              })),
              latestRelease: {
                manga: manga.manga,
                title: manga.title,
                chapterNo: chapterNo,
                thumbnail: finalThumbnail,
                pageCount: highestPageNumber,
                uploadDate: newRelease.uploadDate,
                isComplete: isComplete,
              },
              mangaDetails: {
                id: manga.manga,
                title: manga.title,
                chapterCount: manga.chapterCount,
              },
            });
          } catch (releaseError) {
            console.error("Failed to create latest release entry:", releaseError);
            // Send response without latest release data if it fails
            res.status(200).json({
              success: true,
              message:
                "Chapter uploaded successfully, but failed to create latest release entry",
              uploads: uploadResults.map((result) => ({
                url: result.secure_url,
                displayName: result.public_id,
              })),
              mangaDetails: {
                id: manga.manga,
                title: manga.title,
                chapterCount: manga.chapterCount,
              },
            });
          }
        } else {
          // Send response indicating chapter is incomplete
          res.status(200).json({
            success: true,
            message: `Chapter upload in progress. Uploaded up to page ${highestPageNumber} of ${totalPageNo}`,
            uploads: uploadResults.map((result) => ({
              url: result.secure_url,
              displayName: result.public_id,
            })),
            mangaDetails: {
              id: manga.manga,
              title: manga.title,
              chapterCount: manga.chapterCount,
            },
            currentProgress: {
              uploadedPages: highestPageNumber,
              totalPages: parseInt(totalPageNo),
              remaining: parseInt(totalPageNo) - highestPageNumber
            }
          });
        }
      } else {
        // Manga not found in database
        res.status(200).json({
          success: true,
          message:
            "Chapter uploaded successfully, but manga not found in database",
          uploads: uploadResults.map((result) => ({
            url: result.secure_url,
            displayName: result.public_id,
          })),
        });
      }
    } else {
      // Series list not found
      res.status(200).json({
        success: true,
        message: "Chapter uploaded successfully, but series list not found",
        uploads: uploadResults.map((result) => ({
          url: result.secure_url,
          displayName: result.public_id,
        })),
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload chapter",
      error: error.message,
    });
  }
};

const editSeries = async (req, res) => {
  try {
    console.log('Editing Series');
    const { id, nick, fields } = req.body;

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
      (m) => m.manga === id || m.nick.toLowerCase() === nick.toLowerCase()
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




const getSeriesDetails = async (req, res) => {
  try {
    // Get parameters from URL
    const { mangaId, nick } = req.params;
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



const getSeries = async (req, res) => {
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
        error: "Series not found in database",
      });
    }

    try {
      // Get Cloudinary instance and fetch resources
      const cloudinary = connectCloudinary();
      const folderPath = `${nick}/${chapterNo}`;
      console.log("Fetching from folder:", folderPath);

      const resources = await cloudinary.search.expression(
          `folder: ${folderPath}` // add your folder
          ).max_results(100).sort_by('display_name').execute().then(result=> {
            return result
          });
      
      if (
        !resources ||
        !resources.resources ||
        resources.resources.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error: "No chapter images found",
        });
      }

      
      // Sort resources by filename number
      const imageUrls = resources.resources
        .sort((a, b) => {
          // Extract numbers from file name (e.g., "001" -> 1)
          const numA = parseInt(a.display_name.match(/\d+/)[0]);
          const numB = parseInt(b.display_name.match(/\d+/)[0]);
          return numA - numB;
        })
        .map((resource) => resource.url);
      
      return res.status(200).json({
        success: true,
        seriesDetails,
        resources: imageUrls,
        nick,
        chapterNo,
      });
    } catch (cloudinaryError) {
      console.error("Cloudinary error:", cloudinaryError);
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

const getLatestUpdate = async (req, res) => {
  try {
    //Get the first 10 entries from latestReleases
    const latestReleases = await latestRelease
      .find()
      .sort({ uploadDate: -1 })
      .limit(10);
    res.status(200).json({ success: true, latestReleases });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch latest updates",
      error: error.message,
    });
  }
};

// Get all series in database
const getAllSeries = async (req, res) => {
  try {
    const series = await seriesList.find();
    res.status(200).json({ success: true, series });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all series",
      error: error.message,
    });
  }
};

// Util Functions

async function getFolder(nick, chapterNo) {
  try {
    const cloudinary = connectCloudinary();
    const folderRoot = await cloudinary.api.root_folders();

    // Check if series Folder is there or not
    const checkSeries = folderRoot.folders.find(
      (folder) => folder.name.toLowerCase() === nick.toLowerCase(),
    );

    if (!checkSeries) {
      return { error: "Series Not Found" };
    }

    const subFolder = await cloudinary.api.sub_folders(checkSeries.path);
    const checkChapter = subFolder.folders.find(
      (folder) => folder.name.toLowerCase() === chapterNo.toLowerCase(),
    );

    if (!checkChapter) {
      return { error: "Chapter No. Not Found" };
    }

    return { checkSeries, checkChapter };
  } catch (error) {
    return { error: "Folder Check Failed", errorMessage: error };
  }
}

async function getUploadedImagesCount(nick, chapterNo) {
  try {
    const cloudinary = connectCloudinary();
    const folderPath = `${nick}/${chapterNo}`;
    const resources = await cloudinary.search.expression(
      `folder: ${folderPath}`
    ).sort_by('display_name').execute();
    return resources.resources.length;
  } catch (error) {
    console.error("Failed to get uploaded images count:", error);
    return 0;
  }
}

module.exports = { createNewManga, getSeries, uploadChapter, getLatestUpdate, getSeriesDetails, getUploadedImagesCount, getAllSeries, editSeries };