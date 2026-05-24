const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./db');

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Root Route
app.get('/', (req, res) => {
  res.json({ message: 'DriveClique API is running' });
});

// Routes
app.use('/api/auth', require('./routes/authentication'));
app.use('/api/clubs', require('./routes/clubs'));
app.use('/api/drives', require('./routes/drives'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
