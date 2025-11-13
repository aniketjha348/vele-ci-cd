/**
 * Production-safe logger utility
 * Only logs in development mode or when explicitly enabled
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'error');

export const logger = {
  debug: (...args: any[]) => {
    if (LOG_LEVEL === 'debug' || isDevelopment) {
      console.log(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (LOG_LEVEL === 'info' || LOG_LEVEL === 'debug' || isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (LOG_LEVEL !== 'error' || isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors
    console.error(...args);
  },
};

