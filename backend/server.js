const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./db');

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test Route
app.get('/', (req, res) => {
  res.send('DriveClique Backend is running successfully!');
});

// === ROUTES ===
app.use('/api/clubs', require('./routes/clubs'));
// app.use('/api/auth', require('./routes/authentication'));  // Commented out - auth controller not implemented yet
// app.use('/api/drives', require('./routes/drives'));  // Uncomment when ready


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});