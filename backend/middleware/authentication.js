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
        // Pin the algorithm explicitly rather than trusting the token's own
        // header — defense-in-depth against alg-confusion-style bypasses if
        // the secret or library configuration ever changes.
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
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