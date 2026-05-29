/**
 * Input Validation Middleware
 * Provides reusable validation functions for request data
 */

const { AppError } = require('./errorHandler');

/**
 * Validate required fields in request body
 * @param {string[]} fields - Array of required field names
 * @returns {Function} Middleware function
 */
const validateRequiredFields = (...fields) => {
  return (req, res, next) => {
    const missingFields = fields.filter(field => {
      const value = req.body[field];
      return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate username format (alphanumeric, underscores, 3-30 chars)
 * @param {string} username - Username to validate
 * @returns {boolean}
 */
const isValidUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
};

/**
 * Validate password strength (min 6 chars, at least one letter and one number)
 * @param {string} password - Password to validate
 * @returns {boolean}
 */
const isValidPassword = (password) => {
  return password && password.length >= 6;
};

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
};

/**
 * Validate string length
 * @param {string} value - Value to validate
 * @param {number} min - Minimum length
 * @param {number} max - Maximum length
 * @returns {boolean}
 */
const isValidLength = (value, min, max) => {
  if (!value) return false;
  return value.length >= min && value.length <= max;
};

/**
 * Sanitize string input (trim and remove special characters)
 * @param {string} value - Value to sanitize
 * @returns {string}
 */
const sanitizeString = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/[<>]/g, '');
};

/**
 * Validate and sanitize request body fields
 * @param {Object} rules - Validation rules for each field
 * @returns {Function} Middleware function
 */
const validateInput = (rules) => {
  return (req, res, next) => {
    const errors = [];
    const sanitizedBody = { ...req.body };

    for (const [field, rule] of Object.entries(rules)) {
      const value = req.body[field];

      // Check required
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip further validation if field is not present and not required
      if (value === undefined || value === null) continue;

      // Type validation
      if (rule.type) {
        if (rule.type === 'string' && typeof value !== 'string') {
          errors.push(`${field} must be a string`);
          continue;
        }
        if (rule.type === 'number' && typeof value !== 'number') {
          errors.push(`${field} must be a number`);
          continue;
        }
        if (rule.type === 'boolean' && typeof value !== 'boolean') {
          errors.push(`${field} must be a boolean`);
          continue;
        }
        if (rule.type === 'array' && !Array.isArray(value)) {
          errors.push(`${field} must be an array`);
          continue;
        }
        if (rule.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
          errors.push(`${field} must be an object`);
          continue;
        }
      }

      // String-specific validations
      if (typeof value === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${field} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${field} must be less than ${rule.maxLength} characters`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${field} format is invalid`);
        }
        if (rule.email && !isValidEmail(value)) {
          errors.push(`${field} must be a valid email address`);
        }
      }

      // Number-specific validations
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${field} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${field} must be at most ${rule.max}`);
        }
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
      }

      // Custom validation
      if (rule.custom && typeof rule.custom === 'function') {
        const customError = rule.custom(value);
        if (customError) {
          errors.push(customError);
        }
      }

      // Sanitize string values
      if (rule.sanitize && typeof value === 'string') {
        sanitizedBody[field] = sanitizeString(value);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join('; ')
      });
    }

    // Replace body with sanitized version
    req.body = sanitizedBody;

    next();
  };
};

/**
 * Validate query parameters
 * @param {Object} rules - Validation rules for query params
 * @returns {Function} Middleware function
 */
const validateQuery = (rules) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = req.query[field];

      if (rule.required && !value) {
        errors.push(`Query parameter '${field}' is required`);
        continue;
      }

      if (value && rule.maxLength && value.length > rule.maxLength) {
        errors.push(`Query parameter '${field}' must be at most ${rule.maxLength} characters`);
        continue;
      }

      if (value && rule.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`Query parameter '${field}' must be a number`);
          continue;
        }
        if (rule.min !== undefined && num < rule.min) {
          errors.push(`Query parameter '${field}' must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && num > rule.max) {
          errors.push(`Query parameter '${field}' must be at most ${rule.max}`);
        }
      }

      if (value && rule.enum && !rule.enum.includes(value)) {
        errors.push(`Query parameter '${field}' must be one of: ${rule.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join('; ')
      });
    }

    next();
  };
};

/**
 * Validate params (URL parameters)
 * @param {Object} rules - Validation rules for params
 * @returns {Function} Middleware function
 */
const validateParams = (rules) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
      const value = req.params[field];

      if (rule.required && !value) {
        errors.push(`Parameter '${field}' is required`);
        continue;
      }

      if (value && rule.objectId && !isValidObjectId(value)) {
        errors.push(`Parameter '${field}' must be a valid ID`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors.join('; ')
      });
    }

    next();
  };
};

module.exports = {
  validateRequiredFields,
  validateInput,
  validateQuery,
  validateParams,
  isValidEmail,
  isValidUsername,
  isValidPassword,
  isValidObjectId,
  isValidLength,
  sanitizeString
};