import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import User from '../models/User';

const router = Router();

// Get current user profile
router.get('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error: any) {
    console.error('Get profile error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

// Update profile
router.put(
  '/profile',
  authenticate,
  [
    body('nickname').optional().trim().isLength({ min: 1, max: 50 }),
    body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
  ],
  async (req: AuthRequest, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { nickname, avatar } = req.body;
      
      // Only update fields that are provided
      const updateData: { nickname?: string; avatar?: string } = {};
      if (nickname !== undefined) updateData.nickname = nickname;
      if (avatar !== undefined) updateData.avatar = avatar;

      const user = await User.findByIdAndUpdate(
        req.userId,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error: any) {
      console.error('Update profile error:', error);
      const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Server error' 
        : error.message || 'Server error';
      res.status(500).json({ error: errorMessage });
    }
  }
);

export default router;

