const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Get User Profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Update User Profile
const updateProfile = async (req, res) => {
  try {
    const { name, bio, avatar, car } = req.body;
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update fields
    if (name !== undefined) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    if (car !== undefined) {
      user.car = {
        year: car.year || '',
        make: car.make || '',
        model: car.model || ''
      };
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        bio: user.bio,
        avatar: user.avatar,
        car: user.car,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Search Users
const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.json({ success: true, users: [] });
    }

    const users = await User.find({
      username: { $regex: query, $options: 'i' }
    })
    .select('-password')
    .limit(10);

    res.json({ success: true, users });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Register User
const registerUser = async (req, res) => {
  try {
    const { username, email, password, name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Username, email and password are required" 
      });
    }

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ 
        success: false, 
        message: "User with this email or username already exists" 
      });
    }

    const user = await User.create({
      username,
      email,
      password,
      name: name || username
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully!",
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token: generateToken(user._id)
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Login User
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        success: true,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role
        },
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid username or password" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { registerUser, loginUser, getProfile, updateProfile, searchUsers };
