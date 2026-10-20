import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, UserDTO } from '@syncnshare/shared';
import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import { logger } from './utils/logger';
import { setupSocketIO } from './socket';

async function bootstrap() {
  try {
    // 1. Connect to Database
    await connectDB();

    // 2. Initialize Express application
    const app = createApp();
    const server = http.createServer(app);

    // 3. Initialize Socket.IO server on the same HTTP server
    const io = new SocketIOServer<
      ClientToServerEvents,
      ServerToClientEvents,
      Record<string, never>,
      { user: UserDTO }
    >(server, {
      cors: {
        origin: env.CLIENT_ORIGIN,
        credentials: true,
      },
      pingTimeout: 30000,
      pingInterval: 10000,
    });

    setupSocketIO(io);

    // 4. Start Server
    server.listen(env.PORT, () => {
      logger.info(
        `SyncNShare API & Real-Time Server running in ${env.NODE_ENV} mode on port ${env.PORT}`
      );
      logger.info(`Health check available at http://localhost:${env.PORT}/health`);
    });

    // 5. Graceful Shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        logger.info('HTTP server closed');
        await disconnectDB();
        process.exit(0);
      });

      // Force exit if not closed within 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.fatal({ err }, 'Failed to bootstrap application');
    process.exit(1);
  }
}

bootstrap();
