import type { Express, Request, Response } from 'express';
import { stateStore } from '../app/state-store';
import { createLogger } from '../app/logger';

const logger = createLogger('SSE');

// Connection tracking for prevention
let activeConnections = 0;
const MAX_CONNECTIONS = 8; // Conservative limit
const CLEANUP_INTERVAL = 60000; // Clean up every minute

export function mountSseEndpoint(app: Express): void {

  // Periodic cleanup of dead connections
  setInterval(() => {
    const currentCount = stateStore.getSSEConnectionCount();
    if (currentCount > activeConnections) {
      console.log(`[SSE] Connection count increased: ${activeConnections} → ${currentCount}`);
    }
    activeConnections = currentCount;
    
    if (activeConnections > MAX_CONNECTIONS) {
      console.warn(`[SSE] High connection count detected: ${activeConnections}`);
    }
  }, CLEANUP_INTERVAL);

  app.get('/api/stream', (req: Request, res: Response) => {
    // Set proper headers to prevent TIME_WAIT issues
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'close', // Use 'close' instead of 'keep-alive'
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no', // Disable buffering
    });

    // Set shorter timeout to prevent hanging connections
    res.setTimeout(15000, () => {
      logger.debug('SSE connection timeout, closing');
      res.end();
    });

    // Track this connection
    activeConnections++;

    // Send initial connected event
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const listener = (event: string, data: any) => {
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        // client disconnected
      }
    };

    const added = stateStore.addSSEListener(listener);
    if (!added) {
      logger.warn('SSE connection limit reached, rejecting connection');
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Too many connections');
      return;
    }

    // Keep-alive ping every 30s (reduced frequency)
    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch (err) {
        logger.debug('Keep-alive failed, cleaning up:', err instanceof Error ? err.message : String(err));
        clearInterval(keepAlive);
        stateStore.removeSSEListener(listener);
        res.end();
      }
    }, 30000);

    req.on('close', () => {
      stateStore.removeSSEListener(listener);
      clearInterval(keepAlive);
      activeConnections--;
      logger.debug(`SSE client disconnected (active: ${activeConnections})`);
      res.end(); // Explicitly close response
    });

    req.on('error', (err) => {
      logger.debug('SSE connection error:', err instanceof Error ? err.message : String(err));
      stateStore.removeSSEListener(listener);
      clearInterval(keepAlive);
      activeConnections--;
      res.end();
    });

    req.on('aborted', () => {
      logger.debug('SSE connection aborted');
      stateStore.removeSSEListener(listener);
      clearInterval(keepAlive);
      activeConnections--;
      res.end();
    });

    logger.debug(`SSE client connected (total: ${stateStore.getSSEConnectionCount()})`);
  });

  logger.info('SSE endpoint mounted at /api/stream');
}
