import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { botRouter, restoreBotsOnStartup } from './src/server/botRouter.js';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000');

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use('/api/bots', botRouter);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`✅ Server running on port ${PORT}`);
    const appUrl = process.env.APP_URL || '';
    await restoreBotsOnStartup(appUrl);
  });
}

startServer();
