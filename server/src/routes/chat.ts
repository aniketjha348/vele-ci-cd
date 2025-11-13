import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { chatLimiter, skipLimiter } from '../middleware/rateLimit';
import User from '../models/User';
import { cache } from '../utils/cache';

const router = Router();

// Get skip count (with caching)
router.get('/skip-count', authenticate, async (req: AuthRequest, res) => {
  try {
    // Check cache first (5 second TTL for near real-time updates)
    const cacheKey = `skip-count:${req.userId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Reset skip count if it's a new day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastReset = user.lastSkipResetDate ? new Date(user.lastSkipResetDate) : null;

    if (!lastReset || lastReset < today) {
      user.skipsUsed = 0;
      user.lastSkipResetDate = today;
      await user.save();
      // Invalidate cache when updated
      cache.delete(cacheKey);
    }

    const maxSkips = user.tier === 'free' ? 5 : Infinity;
    const remainingSkips = Math.max(0, maxSkips - user.skipsUsed);

    const result = {
      skipsUsed: user.skipsUsed,
      maxSkips: maxSkips === Infinity ? 'unlimited' : maxSkips,
      remainingSkips: remainingSkips === Infinity ? 'unlimited' : remainingSkips,
      tier: user.tier,
    };

    // Cache the result
    cache.set(cacheKey, result, 5);

    res.json(result);
  } catch (error: any) {
    console.error('Get skip count error:', error);
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

// Use skip (invalidates cache)
router.post('/skip', authenticate, skipLimiter, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Reset skip count if it's a new day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastReset = user.lastSkipResetDate ? new Date(user.lastSkipResetDate) : null;

    if (!lastReset || lastReset < today) {
      user.skipsUsed = 0;
      user.lastSkipResetDate = today;
    }

    const maxSkips = user.tier === 'free' ? 5 : Infinity;

    if (user.tier === 'free' && user.skipsUsed >= maxSkips) {
      return res.status(400).json({ 
        error: 'Daily skip limit reached',
        message: 'Upgrade to Premium for unlimited skips!',
      });
    }

    user.skipsUsed += 1;
    await user.save();

    // Invalidate cache after skip
    cache.delete(`skip-count:${req.userId}`);

    const remainingSkips = maxSkips === Infinity ? 'unlimited' : maxSkips - user.skipsUsed;

    res.json({
      success: true,
      skipsUsed: user.skipsUsed,
      remainingSkips: remainingSkips === Infinity ? 'unlimited' : remainingSkips,
    });
  } catch (error: any) {
    console.error('Skip error:', error);
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

