const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test Route
app.get('/', (req, res) => {
  res.send('🚀 DriveClique Backend is running successfully!');
});

// ====================== ROUTES ======================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/drives', require('./routes/drives'));     // ← Added

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});