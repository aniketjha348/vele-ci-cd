import Razorpay from 'razorpay';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file explicitly (in case this module is imported before index.ts)
// Try multiple paths to ensure we find the .env file
const envPath1 = path.join(process.cwd(), '.env');
const envPath2 = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath1 });
dotenv.config({ path: envPath2, override: false }); // Don't override if already loaded

// Get environment variables
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID?.trim();
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET?.trim();

// Log Razorpay configuration status (for debugging)
if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.warn('⚠️  Razorpay credentials not found in environment variables');
  console.log('RAZORPAY_KEY_ID:', RAZORPAY_KEY_ID ? `Set (${RAZORPAY_KEY_ID.substring(0, 15)}...)` : 'Missing');
  console.log('RAZORPAY_KEY_SECRET:', RAZORPAY_KEY_SECRET ? `Set (${RAZORPAY_KEY_SECRET.substring(0, 10)}...)` : 'Missing');
  console.log('All env vars:', Object.keys(process.env).filter(k => k.includes('RAZORPAY')));
} else {
  console.log('✅ Razorpay credentials loaded successfully');
  console.log('Key ID:', RAZORPAY_KEY_ID.substring(0, 15) + '...');
}

// Initialize Razorpay instance
export const razorpay = RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET
  ? new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    })
  : null;

// Subscription plans (in paise - 1 INR = 100 paise)
export const SUBSCRIPTION_PLANS = {
  premium: {
    name: 'Premium Plan',
    amount: 49900, // ₹499.00 in paise
    currency: 'INR',
    interval: 'month',
    interval_count: 1,
  },
  pro: {
    name: 'Pro Plan',
    amount: 99900, // ₹999.00 in paise
    currency: 'INR',
    interval: 'month',
    interval_count: 1,
  },
};

// Create a Razorpay order
export const createOrder = async (tier: 'premium' | 'pro', userId: string) => {
  if (!razorpay) {
    throw new Error('Razorpay is not configured');
  }

  const plan = SUBSCRIPTION_PLANS[tier];
  
  // Generate a short receipt (Razorpay limit: 40 characters)
  // Format: rzp_[userId_first8]_[timestamp_last8]
  const userIdShort = userId.toString().substring(0, 8);
  const timestamp = Date.now().toString().slice(-8);
  const receipt = `rzp_${userIdShort}_${timestamp}`; // Max 20 chars: rzp_12345678_12345678

  const order = await razorpay.orders.create({
    amount: plan.amount,
    currency: plan.currency,
    receipt: receipt, // Must be <= 40 characters
    notes: {
      userId,
      tier,
    },
  });

  return order;
};

// Verify Razorpay payment signature
export const verifyPayment = (orderId: string, paymentId: string, signature: string): boolean => {
  if (!RAZORPAY_KEY_SECRET) {
    return false;
  }

  const payload = `${orderId}|${paymentId}`;
  const generatedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(payload)
    .digest('hex');

  return generatedSignature === signature;
};

// Create a subscription (for recurring payments)
export const createSubscription = async (tier: 'premium' | 'pro', userId: string) => {
  if (!razorpay) {
    throw new Error('Razorpay is not configured');
  }

  const plan = SUBSCRIPTION_PLANS[tier];
  
  // Create a plan first (one-time setup)
  // Note: In production, you should create plans once and reuse them
  const planData = await razorpay.plans.create({
    period: plan.interval === 'month' ? 'monthly' : 'yearly',
    interval: plan.interval_count,
    item: {
      name: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      description: `${tier.toUpperCase()} subscription for Vele`,
    },
  });

  // Create subscription
  const subscription = await razorpay.subscriptions.create({
    plan_id: planData.id,
    customer_notify: 1,
    total_count: 12, // 12 months subscription
    notes: {
      userId,
      tier,
    },
  });

  return { subscription, plan: planData };
};

// Get payment details
export const getPaymentDetails = async (paymentId: string) => {
  if (!razorpay) {
    throw new Error('Razorpay is not configured');
  }

  return await razorpay.payments.fetch(paymentId);
};

// Get subscription details
export const getSubscriptionDetails = async (subscriptionId: string) => {
  if (!razorpay) {
    throw new Error('Razorpay is not configured');
  }

  return await razorpay.subscriptions.fetch(subscriptionId);
};

// Cancel subscription
export const cancelSubscription = async (subscriptionId: string) => {
  if (!razorpay) {
    throw new Error('Razorpay is not configured');
  }

  return await razorpay.subscriptions.cancel(subscriptionId);
};

