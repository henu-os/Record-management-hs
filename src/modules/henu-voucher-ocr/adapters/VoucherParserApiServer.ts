/**
 * HENU VOUCHER OCR — LOCAL HTTP API SERVER
 * Module: Henu Voucher OCR / Adapters
 *
 * Provides a local HTTP API for external automation platforms
 * (Opal, Make.com, n8n, Google Apps Script) to interact with
 * the HENU AI USB OCR pipeline.
 *
 * Endpoints:
 *   POST /api/voucher-parse     — Process a voucher image and return Google Sheets JSON
 *   GET  /api/voucher-parse/columns — Get column headers
 *   GET  /api/voucher-parse/status  — Get HENU AI engine status
 *   GET  /api/health                — Health check
 *
 * Binds ONLY to 127.0.0.1 (localhost) for security.
 * Default port: 8090 (configurable)
 *
 * SECURITY:
 *   - Localhost-only binding (no external access)
 *   - No authentication required for localhost
 *   - CORS headers for browser-based automation tools
 */

import http from 'http';
import { VoucherParserEndpoint, VoucherParserRequest } from './VoucherParserEndpoint';

const DEFAULT_PORT = 8090;
const MAX_BODY_SIZE = 50 * 1024 * 1024; // 50MB max (for large voucher images)

let server: http.Server | null = null;
let activePort: number = 0;

/**
 * Starts the local HTTP API server for VoucherParser automation.
 */
export function startVoucherParserApiServer(port: number = DEFAULT_PORT): Promise<number> {
  return new Promise((resolve, reject) => {
    if (server) {
      resolve(activePort);
      return;
    }

    const httpServer = http.createServer(async (req, res) => {
      // CORS headers for browser-based automation
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = req.url || '/';

      try {
        // ─── GET /api/health ───
        if (req.method === 'GET' && url === '/api/health') {
          res.writeHead(200);
          res.end(JSON.stringify({
            status: 'ok',
            service: 'HENU VoucherParser API',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
          }));
          return;
        }

        // ─── GET /api/voucher-parse/columns ───
        if (req.method === 'GET' && url === '/api/voucher-parse/columns') {
          const headers = VoucherParserEndpoint.getColumnHeaders();
          res.writeHead(200);
          res.end(JSON.stringify({ columns: headers }));
          return;
        }

        // ─── GET /api/voucher-parse/status ───
        if (req.method === 'GET' && url === '/api/voucher-parse/status') {
          const status = VoucherParserEndpoint.getEngineStatus();
          res.writeHead(200);
          res.end(JSON.stringify(status));
          return;
        }

        // ─── POST /api/voucher-parse ───
        if (req.method === 'POST' && url === '/api/voucher-parse') {
          const body = await readRequestBody(req);

          let payload: VoucherParserRequest;
          try {
            payload = JSON.parse(body);
          } catch {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
            return;
          }

          if (!payload.base64Image) {
            res.writeHead(400);
            res.end(JSON.stringify({
              success: false,
              error: 'Missing required field: base64Image',
              usage: {
                method: 'POST',
                url: '/api/voucher-parse',
                body: {
                  base64Image: '<base64 encoded image data>',
                  fileName: 'voucher.jpg (optional)',
                  languages: "['eng'] (optional)",
                },
              },
            }));
            return;
          }

          const result = await VoucherParserEndpoint.processImage(payload);
          res.writeHead(result.success ? 200 : 500);
          res.end(JSON.stringify(result));
          return;
        }

        // ─── 404 ───
        res.writeHead(404);
        res.end(JSON.stringify({
          error: 'Not Found',
          endpoints: {
            'POST /api/voucher-parse': 'Process a voucher image',
            'GET /api/voucher-parse/columns': 'Get column headers',
            'GET /api/voucher-parse/status': 'Get engine status',
            'GET /api/health': 'Health check',
          },
        }));
      } catch (err: any) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message || 'Internal server error' }));
      }
    });

    httpServer.listen(port, '127.0.0.1', () => {
      server = httpServer;
      activePort = port;
      console.log(`[VoucherParser API] Local HTTP server started on http://127.0.0.1:${port}`);
      resolve(port);
    });

    httpServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        // Try next port
        console.warn(`[VoucherParser API] Port ${port} in use, trying ${port + 1}`);
        httpServer.close();
        startVoucherParserApiServer(port + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Stops the local HTTP API server.
 */
export function stopVoucherParserApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        activePort = 0;
        console.log('[VoucherParser API] Local HTTP server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Returns the active port, or 0 if not running.
 */
export function getVoucherParserApiPort(): number {
  return activePort;
}

/**
 * Reads the full request body, enforcing size limits.
 */
function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error(`Request body exceeds ${MAX_BODY_SIZE / 1024 / 1024}MB limit`));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });

    req.on('error', reject);
  });
}
