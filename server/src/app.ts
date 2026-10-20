import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { generalLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/errorHandler';
import apiRoutes from './routes';

export function createApp(): Express {
  const app = express();

  // 1. Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // Vite React app handles its own CSP in development
    })
  );

  // 2. CORS configuration (Sanitizes origin to strip trailing slashes & support wildcards/multiple domains)
  const allowedOrigins = env.CLIENT_ORIGIN.split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin) return callback(null, true);
        const cleanOrigin = requestOrigin.replace(/\/+$/, '');
        if (
          allowedOrigins.includes('*') ||
          allowedOrigins.includes(cleanOrigin) ||
          allowedOrigins.some((allowed) => cleanOrigin.endsWith(allowed.replace(/^https?:\/\//, '')))
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked: Origin ${requestOrigin} not permitted.`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // 3. Body & Cookie Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // 4. Structured HTTP Request Logging
  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        autoLogging: {
          ignore: (req) => req.url === '/health' || req.url === '/api/v1/health',
        },
      })
    );
  }

  // 5. Rate Limiter
  app.use('/api/', generalLimiter);

  // 6. Direct Health check route
  app.get('/health', (req, res) => {
    res.redirect('/api/v1/health');
  });

  // 7. Mount API v1
  app.use('/api/v1', apiRoutes);

  // 8. 404 Handler for undefined routes
  app.use('*', (req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} not found.`,
      },
    });
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
}
