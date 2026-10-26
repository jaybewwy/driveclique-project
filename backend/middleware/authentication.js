const jwt = require('jsonwebtoken');

// The token in a request's `Authorization: Bearer …` header, if any
const bearerToken = (req) => {
    const header = req.headers.authorization;
    return header && header.startsWith('Bearer') ? header.split(' ')[1] : undefined;
};

// Pin the algorithm explicitly rather than trusting the token's own
// header — defense-in-depth against alg-confusion-style bypasses if
// the secret or library configuration ever changes.
const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

// Middleware to protect routes
const protect = (req, res, next) => {
    const token = bearerToken(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, no token'
        });
    }

    try { //Verify token
        req.user = verifyAccessToken(token); // Attach user info to request object

        next(); // Proceed to the next controller
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Not authorized, token failed or expired'
        });
    }
}

module.exports = { protect, bearerToken, verifyAccessToken };
