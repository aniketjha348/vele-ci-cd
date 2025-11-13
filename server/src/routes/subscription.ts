import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, AuthRequest } from '../middleware/auth';
import User from '../models/User';
import { createOrder, verifyPayment, SUBSCRIPTION_PLANS, razorpay } from '../utils/razorpay';

const router = Router();

// Get subscription status
router.get('/status', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      tier: user.tier,
      subscription: user.subscription,
    });
  } catch (error: any) {
    console.error('Get subscription error:', error);
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Server error' 
      : error.message || 'Server error';
    res.status(500).json({ error: errorMessage });
  }
});

// Create subscription order (Razorpay)
router.post(
  '/create',
  authenticate,
  [
    body('tier').isIn(['premium', 'pro']).withMessage('Tier must be premium or pro'),
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

      const { tier } = req.body; // 'premium' or 'pro'
      const user = await User.findById(req.userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if Razorpay is configured
      if (!razorpay) {
        console.warn('Razorpay not configured. Checking environment variables...');
        console.log('RAZORPAY_KEY_ID:', process.env.RAZORPAY_KEY_ID ? 'Set' : 'Not set');
        console.log('RAZORPAY_KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? 'Set' : 'Not set');
        
        // Fallback: Direct tier update (for testing without payment)
        if (process.env.NODE_ENV === 'development') {
          user.tier = tier as 'premium' | 'pro';
          user.subscription = {
            status: 'active',
            tier: tier as 'premium' | 'pro',
            startDate: new Date(),
          };
          await user.save();
          return res.json({
            message: 'Subscription created (development mode - no payment)',
            subscription: user.subscription,
            orderId: null, // Explicitly set to null so frontend knows
          });
        }
        return res.status(500).json({ 
          error: 'Payment gateway not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to server/.env' 
        });
      }

      // Create Razorpay order
      const order = await createOrder(tier, req.userId);

      // Type assertion: tier is validated to be 'premium' or 'pro' by express-validator
      const tierKey = tier as 'premium' | 'pro';

      res.json({
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        plan: SUBSCRIPTION_PLANS[tierKey],
      });
    } catch (error: any) {
      console.error('Create subscription error:', error);
      const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Server error' 
        : error.message || 'Server error';
      res.status(500).json({ error: errorMessage });
    }
  }
);

// Verify payment and activate subscription
router.post(
  '/verify',
  authenticate,
  [
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('paymentId').notEmpty().withMessage('Payment ID is required'),
    body('signature').notEmpty().withMessage('Signature is required'),
    body('tier').isIn(['premium', 'pro']).withMessage('Tier must be premium or pro'),
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

      const { orderId, paymentId, signature, tier } = req.body;
      const user = await User.findById(req.userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify payment signature
      const isValid = verifyPayment(orderId, paymentId, signature);
      
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid payment signature' });
      }

      // Update user subscription
      user.tier = tier as 'premium' | 'pro';
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

      user.subscription = {
        status: 'active',
        tier: tier as 'premium' | 'pro',
        startDate,
        endDate,
        razorpaySubscriptionId: paymentId, // Store payment ID for reference
      };

      await user.save();

      res.json({
        message: 'Subscription activated successfully',
        subscription: user.subscription,
      });
    } catch (error: any) {
      console.error('Verify payment error:', error);
      const errorMessage = process.env.NODE_ENV === 'production' 
        ? 'Server error' 
        : error.message || 'Server error';
      res.status(500).json({ error: errorMessage });
    }
  }
);

export default router;

