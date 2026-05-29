const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { emitter } = require('../services/notificationEmitter');

// Lightweight inline auth for SSE (EventSource can't set headers)
const protectSSE = (req, res, next) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).end();
  }
};

/**
 * @route   GET /api/notifications/stream
 * @desc    Server-Sent Events stream for the authenticated user
 * @access  Private (token via query param)
 */
router.get('/stream', protectSSE, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send a heartbeat every 25 seconds to keep the connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25000);

  const userId = req.user.id;

  const onEvent = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  emitter.on(`user:${userId}`, onEvent);

  req.on('close', () => {
    clearInterval(heartbeat);
    emitter.off(`user:${userId}`, onEvent);
  });
});

module.exports = router;
