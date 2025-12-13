import { body, param, validationResult } from 'express-validator';

// Middleware to check validation results
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

// Auth validation rules
export const signupValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
        .trim()
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('name')
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Name must be between 1 and 50 characters'),
    validate
];

export const loginValidation = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    validate
];

// Expense validation rules
export const createExpenseValidation = [
    body('description')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Description must be between 1 and 200 characters'),
    body('amount')
        .isFloat({ min: 0.01, max: 1000000 })
        .withMessage('Amount must be between 0.01 and 1,000,000'),
    body('date')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format'),
    body('category')
        .optional()
        .isIn(['food', 'transport', 'entertainment', 'utilities', 'shopping', 'health', 'other'])
        .withMessage('Invalid category'),
    body('splitType')
        .isIn(['equal', 'exact', 'percentage'])
        .withMessage('Split type must be equal, exact, or percentage'),
    body('participants')
        .isArray({ min: 1 })
        .withMessage('At least one participant is required'),
    validate
];

// Group validation rules
export const createGroupValidation = [
    body('name')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Group name must be between 1 and 100 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    body('category')
        .optional()
        .isIn(['trip', 'home', 'couple', 'other'])
        .withMessage('Invalid category'),
    validate
];

export const updateGroupValidation = [
    param('groupId')
        .isMongoId()
        .withMessage('Invalid group ID'),
    body('name')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Group name must be between 1 and 100 characters'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description must not exceed 500 characters'),
    validate
];

// Settlement validation rules
export const createSettlementValidation = [
    body('amount')
        .isFloat({ min: 0.01, max: 1000000 })
        .withMessage('Amount must be between 0.01 and 1,000,000'),
    body('toUserId')
        .isMongoId()
        .withMessage('Invalid user ID'),
    validate
];

// User profile validation rules
export const updateUserValidation = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Name must be between 1 and 50 characters'),
    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('preferredCurrency')
        .optional()
        .isIn(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CNY', 'CHF', 'SEK', 'NZD', 'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY', 'RUB', 'BRL', 'ZAR'])
        .withMessage('Invalid currency'),
    validate
];

// MongoDB ID validation
export const mongoIdValidation = (paramName = 'id') => [
    param(paramName)
        .isMongoId()
        .withMessage('Invalid ID format'),
    validate
];
