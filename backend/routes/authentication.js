const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getProfile, updateProfile, searchUsers } = require('../controllers/authController');
const { protect } = require('../middleware/authentication');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.get('/search', protect, searchUsers);

module.exports = router;
