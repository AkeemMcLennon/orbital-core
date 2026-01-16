import app from './app';

// Export app for Cloudflare Workers
export default app;

// Also export server utilities for local development and testing
export { startServer, type ServerInstance, type ServerOptions } from './server';
