import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Register
router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('username').trim().isLength({ min: 3, max: 20 }),
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, username } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = new User({
        email,
        password: hashedPassword,
        username,
        tier: 'free',
        coins: 100, // Starting coins
        xp: 0,
        level: 1,
        streak: 0,
      });

      await user.save();

      // Generate token
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          tier: user.tier,
          coins: user.coins,
          xp: user.xp,
          level: user.level,
          streak: user.streak,
        },
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      // Don't expose internal errors in production
      const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Server error during registration' 
        : error.message || 'Server error during registration';
      res.status(500).json({ error: errorMessage });
    }
  }
);

// Login
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          tier: user.tier,
          coins: user.coins,
          xp: user.xp,
          level: user.level,
          streak: user.streak,
        },
      });
    } catch (error: any) {
      console.error('Login error:', error);
      // Don't expose internal errors in production
      const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Server error during login' 
        : error.message || 'Server error during login';
      res.status(500).json({ error: errorMessage });
    }
  }
);

export default router;

