import { Express } from 'express';
import authRoutes from './auth';
import userRoutes from './user';
import subscriptionRoutes from './subscription';
import gamificationRoutes from './gamification';
import adminRoutes from './admin';
import chatRoutes from './chat';
import reportRoutes from './report';
import { apiLimiter } from '../middleware/rateLimit';

export const setupRoutes = (app: Express) => {
  // Root route - only show API info in development
  if (process.env.NODE_ENV !== 'production') {
    app.get('/', (req, res) => {
      res.json({ 
        message: 'Vele API Server',
        version: '1.0.0',
        endpoints: {
          health: '/api/health',
          auth: '/api/auth',
          user: '/api/user',
          subscription: '/api/subscription',
          gamification: '/api/gamification',
          admin: '/api/admin',
          chat: '/api/chat',
          report: '/api/report'
        }
      });
    });
  }

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Vele API is running' });
  });

  // Debug endpoint to check CORS configuration
  app.get('/api/debug/cors', (req, res) => {
    const isDev = process.env.NODE_ENV !== 'production';
    const envValue = process.env.CLIENT_URLS || process.env.CLIENT_URL || process.env.DEFAULT_ALLOWED_ORIGINS || 'NOT SET';
    
    // Parse allowed origins the same way the server does
    const origins = envValue
      .split(',')
      .map((o: string) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);
    
    res.json({
      allowedOrigins: origins,
      requestOrigin: req.headers.origin || 'no origin header',
      ...(isDev && {
        CLIENT_URLS: process.env.CLIENT_URLS || 'not set',
        CLIENT_URL: process.env.CLIENT_URL || 'not set',
        DEFAULT_ALLOWED_ORIGINS: process.env.DEFAULT_ALLOWED_ORIGINS || 'not set',
        rawEnvValue: envValue,
      }),
    });
  });

  // Apply general rate limiting to all API routes
  app.use('/api', apiLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/subscription', subscriptionRoutes);
  app.use('/api/gamification', gamificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/report', reportRoutes);

  // 404 handler for API routes
  app.all('/api/*', (req, res) => {
    // If it's an OPTIONS request, it should have been handled by CORS middleware
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    res.status(404).json({ 
      error: 'Not found',
      path: req.path,
      method: req.method,
      message: `The endpoint ${req.method} ${req.path} does not exist`
    });
  });
};

