import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function ocrApiPlugin(): Plugin {
  return {
    name: 'ocr-api-backend-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/ocr-config' && req.method === 'GET') {
          const cfgPath = path.resolve(__dirname, 'userData/ocr_api_config.json');
          if (fs.existsSync(cfgPath)) {
            const data = fs.readFileSync(cfgPath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            return res.end(data);
          }
        }
        if (req.url === '/api/ocr-secrets' && req.method === 'GET') {
          const secretsPath = path.resolve(__dirname, 'userData/ocr_api_secrets.json');
          let secrets: Record<string, any> = {};
          if (fs.existsSync(secretsPath)) {
            try {
              secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));
            } catch {}
          }
          // Also check .env.local
          const envLocalPath = path.resolve(__dirname, '.env.local');
          if (fs.existsSync(envLocalPath)) {
            const envContent = fs.readFileSync(envLocalPath, 'utf-8');
            const match = envContent.match(/GEMINI_API_KEY\s*=\s*([^\r\n]+)/);
            if (match && match[1] && (!secrets.gemini || !secrets.gemini.apiKey)) {
              secrets.gemini = { provider: 'gemini', apiKey: match[1].trim() };
            }
          }
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify(secrets));
        }
        if (req.url === '/api/ocr-config' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const cfgPath = path.resolve(__dirname, 'userData/ocr_api_config.json');
              fs.writeFileSync(cfgPath, body, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ error: err?.message }));
            }
          });
          return;
        }
        if (req.url === '/api/ocr-secrets' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const secretsPath = path.resolve(__dirname, 'userData/ocr_api_secrets.json');
              fs.writeFileSync(secretsPath, body, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              return res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ error: err?.message }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), ocrApiPlugin()],
  root: path.resolve(__dirname, 'src/renderer'),
  publicDir: path.resolve(__dirname, 'public'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
});
