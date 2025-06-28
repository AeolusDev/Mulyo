const B2 = require('backblaze-b2');
const NodeCache = require('node-cache');
const axios = require('axios');

// Cache for B2 authentication
const authCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL - reduced to avoid token expiration issues

// Initialize Backblaze B2
const b2 = new B2({
  applicationKeyId: process.env.BACKBLAZE_KEY_ID,
  applicationKey: process.env.BACKBLAZE_APP_KEY,
});

// B2 bucket configuration
const B2_BUCKET_NAME = process.env.BACKBLAZE_BUCKET_NAME;
const B2_BUCKET_ID = process.env.BACKBLAZE_BUCKET_ID;
const B2_PUBLIC_URL = process.env.BACKBLAZE_PUBLIC_URL;

// Helper function to authorize B2 and cache the token
async function authorizeB2(forceRefresh = false) {
  const cacheKey = 'b2_auth';
  let authInfo = !forceRefresh ? authCache.get(cacheKey) : null;

  if (!authInfo) {
    console.log('B2 auth cache miss or force refresh, authenticating with B2...');
    try {
      await b2.authorize();
      authInfo = {
        authorizationToken: b2.authorizationToken,
        apiUrl: b2.apiUrl,
        downloadUrl: b2.downloadUrl,
        timestamp: Date.now()
      };
      authCache.set(cacheKey, authInfo);
      console.log('B2 authentication successful and cached');
    } catch (error) {
      console.error('B2 authorization failed:', error.message);
      // Try one more time if it fails
      if (!forceRefresh) {
        console.log('Retrying B2 authorization...');
        return authorizeB2(true);
      }
      throw error;
    }
  } else {
    console.log('Using cached B2 auth token');
    // Check if token is getting old (> 45 minutes) and refresh preemptively if needed
    const tokenAge = (Date.now() - (authInfo.timestamp || 0)) / (1000 * 60); // age in minutes
    if (tokenAge > 45) {
      console.log(`B2 token is ${tokenAge.toFixed(1)} minutes old, refreshing preemptively`);
      return authorizeB2(true);
    }
    
    b2.authorizationToken = authInfo.authorizationToken;
    b2.apiUrl = authInfo.apiUrl;
    b2.downloadUrl = authInfo.downloadUrl;
  }

  return b2;
}

// Upload a file to Backblaze B2
async function uploadFile(fileBuffer, fileName, folderPath, retryCount = 0) {
  try {
    const authorizedB2 = await authorizeB2();

    // Get upload URL and authorization token
    const uploadUrlResponse = await authorizedB2.getUploadUrl({
      bucketId: B2_BUCKET_ID,
    });

    const { uploadUrl, authorizationToken } = uploadUrlResponse.data;

    // Full path for the file in B2
    const fullPath = `${folderPath}/${fileName}`;

    // Upload the file
    const uploadResponse = await authorizedB2.uploadFile({
      uploadUrl,
      uploadAuthToken: authorizationToken,
      fileName: fullPath,
      data: fileBuffer,
      contentType: 'image/png', // Default to PNG, adjust as needed
    });

    // Return the public URL of the uploaded file
    return {
      url: `${B2_PUBLIC_URL}/${fullPath}`,
      name: fileName,
      fileId: uploadResponse.data.fileId,
      size: fileBuffer.length,
    };
  } catch (error) {
    console.error(`Upload to B2 failed for ${fileName}:`, error);
    
    // Check if error is related to authentication or token issues
    const authErrors = [
      'unauthorized', 
      'expired', 
      'token', 
      'auth', 
      '401', 
      '403',
      'bad_auth_token'
    ];
    
    // If we've reached max retries or it's not an auth error, throw
    if (retryCount >= 3 || !authErrors.some(term => 
        error.message?.toLowerCase().includes(term) || 
        error.code?.toString().includes(term))) {
      throw error;
    }
    
    // Retry with force token refresh
    console.log(`Retrying upload for ${fileName} with fresh token (attempt ${retryCount + 1}/3)`);
    await authorizeB2(true); // Force token refresh
    return uploadFile(fileBuffer, fileName, folderPath, retryCount + 1);
  }
}

// List files in a folder
async function listFiles(folderPath, retryCount = 0) {
  try {
    const authorizedB2 = await authorizeB2();
    const validDurationInSeconds = 3600 * 24 * 7; // 7 days
    
    const response = await authorizedB2.listFileNames({
      bucketId: B2_BUCKET_ID,
      prefix: folderPath,
      maxFileCount: 1000,
    });
    
    console.log(`Listing files in folder: ${folderPath}`);
    
    // If no files found, return empty array
    if (!response.data.files || response.data.files.length === 0) {
      return [];
    }
    
    // Get download authorization for the folder
    const authResponse = await authorizedB2.getDownloadAuthorization({
      bucketId: B2_BUCKET_ID,
      fileNamePrefix: folderPath,
      validDurationInSeconds
    });
    
    // Map files to include their proper URLs with authorization
    const files = response.data.files.map(file => ({
      fileName: file.fileName,
      fileId: file.fileId,
      size: file.contentLength,
      url: `${B2_PUBLIC_URL}/${file.fileName}?Authorization=${authResponse.data.authorizationToken}`
    }));
    
    return files;
  } catch (error) {
    console.error(`Failed to list files in folder ${folderPath}:`, error);
    
    // Check if error is related to authentication or token issues
    const authErrors = [
      'unauthorized', 
      'expired', 
      'token', 
      'auth', 
      '401', 
      '403',
      'bad_auth_token'
    ];
    
    // If we've reached max retries or it's not an auth error, throw
    if (retryCount >= 3 || !authErrors.some(term => 
        error.message?.toLowerCase().includes(term) || 
        error.code?.toString().includes(term))) {
      throw error;
    }
    
    // Retry with force token refresh
    console.log(`Retrying listFiles for ${folderPath} with fresh token (attempt ${retryCount + 1}/3)`);
    await authorizeB2(true); // Force token refresh
    return listFiles(folderPath, retryCount + 1);
  }
}

// Delete a file from Backblaze B2
async function deleteFile(fileId, retryCount = 0) {
  try {
    const authorizedB2 = await authorizeB2();

    await authorizedB2.deleteFileVersion({
      fileId,
    });

    console.log(`File with ID ${fileId} deleted successfully.`);
    return true;
  } catch (error) {
    console.error(`Failed to delete file with ID ${fileId}:`, error);
    
    // Check if error is related to authentication or token issues
    const authErrors = [
      'unauthorized', 
      'expired', 
      'token', 
      'auth', 
      '401', 
      '403',
      'bad_auth_token'
    ];
    
    // If we've reached max retries or it's not an auth error, throw
    if (retryCount >= 3 || !authErrors.some(term => 
        error.message?.toLowerCase().includes(term) || 
        error.code?.toString().includes(term))) {
      throw error;
    }
    
    // Retry with force token refresh
    console.log(`Retrying deleteFile for ${fileId} with fresh token (attempt ${retryCount + 1}/3)`);
    await authorizeB2(true); // Force token refresh
    return deleteFile(fileId, retryCount + 1);
  }
}

// Export the Backblaze B2 connector
module.exports = {
  uploadFile,
  listFiles,
  deleteFile,
  authorizeB2  // Export for direct access if needed
};
