const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// Register a new user
// route POST /api/auth/register
const registeredUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please fill all fields'
            });
        }

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Create new user
        const user = await User.create({
            username,
            email,
            password: bcrypt.hashSync(password, 10) // Hash the password before saving
        });

        res.status(201).json({
            success: true,
            user: {
                id: user._1,
                name: user.username,
                email: user.email,
                role: user.role,
            },
            token: generateToken(user._id)
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

// Login user
// route POST /api/auth/login
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user= await User.findOne({ email });

        if (user && bcrypt.compareSync(password, user.password)) {
            res.json({
                success: true,
                user: {
                    id: user._id,
                    name: user.username,
                    email: user.email,
                    role: user.role,
                },
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    registeredUser,
    loginUser, };


