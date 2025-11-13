import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { setupRoutes } from './routes';
import { setupSocketIO } from './socket';

// Load environment variables from .env file in server directory
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Environment configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isDevelopment = NODE_ENV === 'development';

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingEnvVars.length > 0 && isProduction) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Warn about weak JWT secret in production
if (isProduction && process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
  console.error('❌ WARNING: Using default JWT_SECRET in production! This is insecure!');
  process.exit(1);
}

/**
 * Validates and normalizes a URL origin
 */
function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, ''); // Remove trailing slashes
}

/**
 * Validates if a string is a valid URL origin
 */
function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Parses allowed origins from environment variables
 * Supports CLIENT_URLS, CLIENT_URL, or DEFAULT_ALLOWED_ORIGINS
 */
function getAllowedOrigins(): string[] {
  const envValue = process.env.CLIENT_URLS || process.env.CLIENT_URL || process.env.DEFAULT_ALLOWED_ORIGINS;
  
  if (!envValue) {
    if (isProduction) {
      console.error('❌ CRITICAL: No allowed origins configured! Set CLIENT_URLS environment variable.');
      process.exit(1);
    }
    return [];
  }

  const origins = envValue
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean)
    .filter(isValidOrigin);

  // Remove duplicates
  const uniqueOrigins = Array.from(new Set(origins));

  if (isDevelopment) {
    console.log('🔒 CORS Allowed Origins:', uniqueOrigins);
  }

  if (uniqueOrigins.length === 0 && isProduction) {
    console.error('❌ CRITICAL: No valid allowed origins found! CORS will reject all requests.');
    process.exit(1);
  }

  return uniqueOrigins;
}

const allowedOrigins = getAllowedOrigins();

// Log configured origins at startup (always log in production for debugging)
if (allowedOrigins.length > 0) {
  console.log(`🔒 CORS configured with ${allowedOrigins.length} allowed origin(s):`);
  allowedOrigins.forEach((origin, index) => {
    console.log(`   ${index + 1}. ${origin}`);
  });
} else {
  console.warn('⚠️  WARNING: No allowed origins configured!');
}

/**
 * CORS origin validation callback
 */
const corsOriginValidator = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void => {
  // Allow requests without Origin header (e.g., curl, Postman, health checks)
  if (!origin) {
    return callback(null, true);
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (allowedOrigins.includes(normalizedOrigin)) {
    if (isDevelopment) {
      console.log(`✅ CORS: Allowing origin ${origin}`);
    }
    return callback(null, true);
  }

  // Log rejection with details for debugging
  if (isDevelopment) {
    console.warn(`❌ CORS: Rejecting origin ${origin}`);
    console.warn(`   Normalized: ${normalizedOrigin}`);
    console.warn(`   Allowed origins:`, allowedOrigins);
  } else {
    // In production, log to help diagnose issues
    console.warn(`❌ CORS: Rejecting origin ${origin} (not in allowed list)`);
  }
  
  return callback(new Error(`Origin ${origin} not allowed by CORS`));
};

const corsOptions: CorsOptions = {
  origin: corsOriginValidator,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type'],
  maxAge: 86400, // 24 hours - cache preflight requests
};

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOriginValidator,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ CRITICAL: MONGODB_URI environment variable is required');
  process.exit(1);
}

// Trust proxy (required for Render and other cloud platforms)
app.set('trust proxy', true);

// Middleware
// CORS must come before other middleware
// Handle preflight OPTIONS requests first - this ensures OPTIONS gets CORS headers
app.options('*', (req, res, next) => {
  cors(corsOptions)(req, res, next);
});

// Apply CORS to all routes
app.use(cors(corsOptions));

// Configure Helmet to allow CORS and not interfere with CORS headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  // Don't set Cross-Origin-Opener-Policy for HTTP (causes browser warnings)
  crossOriginOpenerPolicy: false,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes - MUST be registered before static file serving
setupRoutes(app);

// Serve static files from client build (only in production)
const clientBuildPath = path.join(__dirname, '../../client/out');
if (isProduction) {
  // Serve static files (CSS, JS, images, etc.) - Express static only handles GET/HEAD
  // It will automatically skip if file not found and call next()
  app.use(express.static(clientBuildPath, { index: false }));

  // SPA fallback - serve index.html for all non-API GET requests that don't match static files
  app.get('*', (req, res, next) => {
    // Skip API routes completely
    if (req.path.startsWith('/api')) {
      return next(); // Let Express 404 handler deal with it
    }
    res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(404).json({ error: 'Not found' });
      }
    });
  });
}
setupSocketIO(io);

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    server.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Environment: ${NODE_ENV}`);
      if (isDevelopment) {
        console.log(`🌐 Allowed CORS origins: ${allowedOrigins.join(', ')}`);
      }
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    if (isDevelopment) {
      console.error('Full error:', error);
    }
    process.exit(1);
  });

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  server.close(() => {
    console.log('HTTP server closed');
  });

  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  if (isProduction) {
    // In production, log and continue
    console.error('Application will continue running');
  } else {
    // In development, exit to catch issues early
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});
