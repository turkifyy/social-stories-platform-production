import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const eqIndex = trimmedLine.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmedLine.substring(0, eqIndex).trim();
        const value = trimmedLine.substring(eqIndex + 1).trim();
        if (value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

import express, { type Request, Response, NextFunction } from "express";
import * as cron from 'node-cron';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { ResourceMonitor } from './resource-monitor';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  const server = await registerRoutes(app);

  ResourceMonitor.start(300000);

  try {
    // Keep token auto-refresh as it's a backend maintenance task
    cron.schedule('0 * * * *', async () => {
      try {
        const { firestoreService } = await import('./firestore');
        const { refreshAccountToken } = await import('./cron-scheduler');
        const accountsNeedingRefresh = await firestoreService.getAccountsNeedingTokenRefresh();
        
        if (accountsNeedingRefresh.length > 0) {
          console.log(`🔄 Auto-refreshing ${accountsNeedingRefresh.length} accounts...`);
          
          for (const account of accountsNeedingRefresh) {
            await refreshAccountToken(account);
          }
        }
      } catch (error: any) {
        console.error('❌ Token auto-refresh failed:', error.message);
      }
    });

    console.log('✅ Cron system initialized');
  } catch (error: any) {
    console.error('❌ Failed to initialize cron system:', error.message);
  }

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    const possiblePaths = [
      path.resolve(process.cwd(), "dist", "public"),
      path.resolve(process.cwd(), "public"),
      path.join(__dirname, "public"),
      path.join(__dirname, "..", "dist", "public")
    ];

    let publicPath = "";
    for (const p of possiblePaths) {
      if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
        publicPath = p;
        break;
      }
    }

    if (publicPath) {
      console.log(`🚀 Serving static files from: ${publicPath}`);
      app.use(express.static(publicPath));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api")) return next();
        res.sendFile(path.join(publicPath, "index.html"));
      });
    } else {
      serveStatic(app);
    }
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
