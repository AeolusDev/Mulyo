const mongoose = require('mongoose');
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
let isConnected = false;

const connectDB = async () => {
    if (isConnected) {
        console.log('Using existing database connection');
        return;
    }

    try {
        const db = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            family: 4
        });

        isConnected = true;
        console.log(`MongoDB Connected: ${db.connection.host}`);

        // Handle connection errors
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
            isConnected = false;
        });

        return db;
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        isConnected = false;
        throw error;
    }
};

// Add a function to check connection status
const checkConnection = () => {
    return isConnected && mongoose.connection.readyState === 1;
};

const connectDBWithRetry = async (retryCount = 0) => {
    try {
        if (isConnected) {
            return;
        }

        const db = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            family: 4,
            retryWrites: true,
            w: 'majority'
        });

        isConnected = true;
        console.log(`MongoDB Connected: ${db.connection.host}`);
        return db;

    } catch (error) {
        console.error(`Connection attempt ${retryCount + 1} failed:`, error);

        if (retryCount < MAX_RETRIES) {
            console.log(`Retrying in ${RETRY_DELAY}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return connectDBWithRetry(retryCount + 1);
        }

        throw error;
    }
};

module.exports = { connectDB: connectDBWithRetry, checkConnection };
