require('dotenv').config();
const { google } = require('googleapis');

let driveInstance;

const connectGoogleDrive = () => {
  if (driveInstance) {
    console.log('Using existing Google Drive connection');
    return driveInstance;
  }

  try {
    // Configure authentication using JWT for service account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    // Create drive instance
    const drive = google.drive({ 
      version: 'v3', 
      auth 
    });

    driveInstance = drive;
    console.log("Google Drive connection successful.");

    return driveInstance;
  } catch (error) {
    console.error('Google Drive configuration error:', error);
    throw error;
  }
};


const createFolder = async (folderName, parentFolderId = null) => {
  const drive = connectGoogleDrive();
  
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  
  if (parentFolderId) {
    fileMetadata.parents = [parentFolderId];
  }
  
  try {
    const response = await drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    });
    
    return response.data.id;
  } catch (error) {
    console.error('Error creating Google Drive folder:', error);
    throw error;
  }
};

const getDriveFolder = async (folderName, parentFolderId = null) => {
  const drive = connectGoogleDrive();
  
  // Build query without parent folder condition if parentFolderId is null
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}'`;
  if (parentFolderId) {
    query = `${query} and '${parentFolderId}' in parents`;
  }
  
  try {
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    if (!response.data.files || response.data.files.length === 0) {
      console.log(`No folder found with name: ${folderName}`);
      return null;
    }
    
    console.log(`Found folder: ${folderName} with ID: ${response.data.files[0].id}`);
    return response.data.files[0].id;
  } catch (error) {
    console.error('Error getting Google Drive folder:', error);
    throw error;
  }
};


const uploadFileToDrive = async (fileBuffer, fileName, folderId, mimeType) => {
  const drive = connectGoogleDrive();
  
  const fileMetadata = {
    name: fileName,
    parents: folderId ? [folderId] : [],
  };
  
  // Convert buffer to stream for Google Drive API
  const { Readable } = require('stream');
  const fileStream = new Readable();
  fileStream.push(fileBuffer);
  fileStream.push(null); // End the stream
  
  const media = {
    mimeType,
    body: fileStream,
  };
  
  try {
    const response = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id,webViewLink,webContentLink',
    });
    
    return {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink
    };
  } catch (error) {
    console.error('Error uploading file to Google Drive:', error);
    throw error;
  }
};


const getFileDetails = async (fileId) => {
  const drive = connectGoogleDrive();
  
  try {
    const response = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,webViewLink,webContentLink,thumbnailLink',
    });
    
    return response.data;
  } catch (error) {
    console.error('Error getting Google Drive file details:', error);
    throw error;
  }
};

// New case-insensitive folder search function
const getDriveFolderCaseInsensitive = async (folderName, parentFolderId = null) => {
  const drive = connectGoogleDrive();
  
  // Build query to get all folders in the parent directory
  let query = `mimeType = 'application/vnd.google-apps.folder'`;
  if (parentFolderId) {
    query = `${query} and '${parentFolderId}' in parents`;
  }
  
  try {
    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    if (!response.data.files || response.data.files.length === 0) {
      console.log(`No folders found in parent directory`);
      return null;
    }
    
    console.log(response.data);
    
    // Find folder with case-insensitive name match
    const matchingFolder = response.data.files.find(folder => 
      folder.name.toLowerCase() === folderName.toLowerCase()
    );
    
    if (!matchingFolder) {
      console.log(`No folder found with name: ${folderName} (case-insensitive)`);
      return null;
    }
    
    console.log(`Found folder: ${matchingFolder.name} with ID: ${matchingFolder.id} (matched case-insensitively with: ${folderName})`);
    return matchingFolder.id;
  } catch (error) {
    console.error('Error getting Google Drive folder (case-insensitive):', error);
    throw error;
  }
};

module.exports = {
  connectGoogleDrive,
  createFolder,
  getDriveFolder,
  uploadFileToDrive,
  getFileDetails,
  getDriveFolderCaseInsensitive
};