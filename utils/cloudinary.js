const cloudinary = require('cloudinary').v2;

let cloudinaryInstance;

const connectCloudinary = () => {
    if (cloudinaryInstance) {
        return cloudinaryInstance;
    }

    try {
        // Configure Cloudinary with environment variables
        cloudinary.config({
            cloud_name: process.env.CLOUDINARYNAME, 
            api_key: process.env.CLOUDINARYKEY, 
            api_secret: process.env.CLOUDINARYSECRET,
            secure: true
        });

        cloudinaryInstance = cloudinary;
        console.log("Cloudinary connection successful.");

        return cloudinaryInstance;
    } catch (error) {
        console.error('Cloudinary configuration error:', error);
        throw error;
    }
};

module.exports = connectCloudinary;

