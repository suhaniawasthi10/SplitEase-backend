import express from 'express';
import { signUp, login, logout } from '../controllers/authController.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { signupValidation, loginValidation } from '../middleware/validation.js';

const router = express.Router();

// Apply strict rate limiting to auth routes
router.post('/signup', authLimiter, signupValidation, signUp);
router.post('/login', authLimiter, loginValidation, login);
router.post('/logout', logout);

export default router;