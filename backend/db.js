const mongoose = require('mongoose');
const logger = require('./utils/logger');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        logger.info('MongoDB connected', { uri: process.env.MONGO_URI?.replace(/\/\/.*@/, '//***@') });
    } catch (error) {
        logger.error('MongoDB connection failed', { error: error.message });
        process.exit(1);
    }
};

module.exports = connectDB;