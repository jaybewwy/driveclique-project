const jwt = require('jsonwebtoken');

// Middleware to protect routes
const protect = (req, res, next) => {
    let token; 

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1]; // Get token from header
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, no token'
        });
    }

    try { //Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Attach user info to request object

        next(); // Proceed to the next controller
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Not authorized, token failed or expired'
        });
    }
}

module.exports = { protect };