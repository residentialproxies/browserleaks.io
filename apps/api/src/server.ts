import app from './app';
import { config } from './config';
import { log } from './middleware/logger';

const PORT = parseInt(config.API_PORT, 10);

const server = app.listen(PORT, '0.0.0.0', () => {
  log.info('API server started', { port: PORT, env: config.NODE_ENV });
  log.info('Health endpoint ready', { url: `http://localhost:${PORT}/health` });
  log.info('API root ready', { url: `http://localhost:${PORT}/v1` });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log.warn('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    log.info('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  log.warn('SIGINT signal received: closing HTTP server');
  server.close(() => {
    log.info('HTTP server closed');
    process.exit(0);
  });
});
