const express = require('express');
const router = express.Router();
const { registeredUser, loginUser } = require('../controllers/authController');

// Register a new user
router.post('/register', registeredUser);
router.post('/login', loginUser);

module.exports = router;
