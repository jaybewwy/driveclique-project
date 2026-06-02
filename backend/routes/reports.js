const express = require('express');
const router  = express.Router();
const { protect }       = require('../middleware/authentication');
const { validateInput } = require('../middleware/validation');
const { submitReport }  = require('../controllers/reportController');

router.use(protect);

/**
 * @route   POST /api/reports
 * @desc    Submit a content report
 * @access  Private
 */
router.post(
  '/',
  validateInput({
    targetType: { required: true, type: 'string', enum: ['user', 'club', 'drive'] },
    targetId:   { required: true, type: 'string', minLength: 24, maxLength: 24 },
    reason:     { required: true, type: 'string', enum: ['harassment', 'spam', 'dangerous', 'other'] },
    details:    { type: 'string', maxLength: 500 },
  }),
  submitReport,
);

module.exports = router;
