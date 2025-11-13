import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { gamificationLimiter } from '../middleware/rateLimit';
import User from '../models/User';

const router = Router();

// Apply gamification rate limiter to all routes in this router
router.use(gamificationLimiter);

// Get user stats (XP, level, coins, streak)
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select('xp level coins streak');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      xp: user.xp,
      level: user.level,
      coins: user.coins,
      streak: user.streak,
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

// Add XP (called after chat sessions, mini-games, etc.)
router.post('/add-xp', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amount } = req.body;
    
    // Validate amount
    if (typeof amount !== 'number' || amount <= 0 || amount > 1000) {
      return res.status(400).json({ error: 'Invalid XP amount (must be between 1 and 1000)' });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.xp += amount;
    
    // Calculate level (100 XP per level)
    const newLevel = Math.floor(user.xp / 100) + 1;
    if (newLevel > user.level) {
      user.level = newLevel;
    }

    await user.save();

    res.json({
      xp: user.xp,
      level: user.level,
    });
  } catch (error: any) {
    console.error('Add XP error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

// Update streak (called on daily login)
router.post('/update-streak', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate) : null;

    if (!lastLogin || lastLogin < today) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastLogin && lastLogin.getTime() === yesterday.getTime()) {
        user.streak += 1;
      } else {
        user.streak = 1;
      }
      
      user.lastLoginDate = today;
      // Reward coins for daily login
      user.coins += 10;
    }

    await user.save();

    res.json({
      streak: user.streak,
      coins: user.coins,
    });
  } catch (error: any) {
    console.error('Update streak error:', error);
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

// Spin the wheel (costs coins, gives rewards)
router.post('/spin-wheel', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const spinCost = 50; // Cost in coins
    if (user.coins < spinCost) {
      return res.status(400).json({ error: 'Not enough coins' });
    }

    user.coins -= spinCost;

    // Random rewards
    type Reward = 
      | { type: 'coins'; amount: number }
      | { type: 'xp'; amount: number }
      | { type: 'skip'; amount: number }
      | { type: 'temporary_premium'; duration: number };

    const rewards: Reward[] = [
      { type: 'coins', amount: 100 },
      { type: 'coins', amount: 200 },
      { type: 'coins', amount: 50 },
      { type: 'xp', amount: 50 },
      { type: 'skip', amount: 5 },
      { type: 'temporary_premium', duration: 24 }, // 24 hours
    ];

    const reward = rewards[Math.floor(Math.random() * rewards.length)];

    if (reward.type === 'coins') {
      user.coins += reward.amount;
    } else if (reward.type === 'xp') {
      user.xp += reward.amount;
    }

    await user.save();

    res.json({
      reward,
      coins: user.coins,
      xp: user.xp,
    });
  } catch (error: any) {
    console.error('Spin wheel error:', error);
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;

