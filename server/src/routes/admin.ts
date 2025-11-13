import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import User from '../models/User';

const router = Router();

// Check if user is admin (simplified - add proper admin check)
const isAdmin = async (userId: string): Promise<boolean> => {
  // TODO: Add proper admin role check
  const user = await User.findById(userId);
  return user?.email === process.env.ADMIN_EMAIL;
};

// Get all users (admin only)
router.get('/users', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!(await isAdmin(req.userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await User.find().select('-password').limit(100);
    res.json(users);
  } catch (error: any) {
    console.error('Get users error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

// Get analytics
router.get('/analytics', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!(await isAdmin(req.userId))) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const totalUsers = await User.countDocuments();
    const freeUsers = await User.countDocuments({ tier: 'free' });
    const premiumUsers = await User.countDocuments({ tier: 'premium' });
    const proUsers = await User.countDocuments({ tier: 'pro' });

    res.json({
      totalUsers,
      freeUsers,
      premiumUsers,
      proUsers,
      premiumRatio: totalUsers > 0 ? (premiumUsers / totalUsers) * 100 : 0,
      proRatio: totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0,
    });
  } catch (error: any) {
    console.error('Get analytics error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;

