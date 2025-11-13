import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import Report from '../models/Report';
import Block from '../models/Block';

const router = Router();

// Report a user
router.post(
  '/user',
  authenticate,
  [
    body('socketId').notEmpty().withMessage('Socket ID is required'),
    body('reason').notEmpty().isLength({ min: 3, max: 100 }).withMessage('Reason is required (3-100 chars)'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description too long (max 500 chars)'),
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

      const { socketId, reason, description, chatLog } = req.body;

    const report = new Report({
      reporterId: req.userId,
      reportedSocketId: socketId,
      reason,
      description,
      chatLog: chatLog || [],
    });

    await report.save();

    res.json({
      success: true,
      message: 'User reported successfully. Our team will review it.',
    });
  } catch (error: any) {
    console.error('Report error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

// Block a user
router.post(
  '/block',
  authenticate,
  [
    body('socketId').notEmpty().withMessage('Socket ID is required'),
    body('userId').optional().isMongoId().withMessage('Invalid user ID format'),
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

      const { socketId, userId } = req.body;

    // Check if already blocked
    const existingBlock = await Block.findOne({
      blockerId: req.userId,
      blockedSocketId: socketId,
    });

    if (existingBlock) {
      return res.json({ success: true, message: 'User already blocked' });
    }

    const block = new Block({
      blockerId: req.userId,
      blockedSocketId: socketId,
      blockedUserId: userId,
    });

    await block.save();

    res.json({
      success: true,
      message: 'User blocked successfully',
    });
  } catch (error: any) {
    console.error('Block error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

// Get blocked users
router.get('/blocked', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const blocks = await Block.find({ blockerId: req.userId }).select('blockedSocketId createdAt');
    res.json({ blocked: blocks });
  } catch (error: any) {
    console.error('Get blocked error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

// Unblock a user
router.delete('/block/:socketId', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { socketId } = req.params;

    if (!socketId) {
      return res.status(400).json({ error: 'Socket ID is required' });
    }

    const result = await Block.deleteOne({
      blockerId: req.userId,
      blockedSocketId: socketId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Block not found' });
    }

    res.json({ success: true, message: 'User unblocked' });
  } catch (error: any) {
    console.error('Unblock error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;

