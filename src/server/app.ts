import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { buildLinks } from './services/roomLinks.js';
import { getRoom, rotateRoom } from './services/roomStore.js';
import { createAuthRouter, initPassport, requireAuth } from './routes/auth.js';
import { getJwtSecret } from './services/AuthService.js';
import { healthHandler } from './health.js';
import { buildSceneCollectionJson, sceneCollectionFilename } from './routes/sceneCollection.js';

initPassport();

export function createApp() {
  // Fail fast when JWT_SECRET is missing — otherwise every authed route
  // would 401 silently.
  getJwtSecret();

  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', healthHandler);

  app.use('/auth', createAuthRouter());

  // Idempotent: returns the currently stored room's links. Never rotates —
  // an explicitly confirmed POST /api/room/rotate is the only mutation.
  app.post('/api/room', requireAuth, (_req: Request, res: Response) => {
    const { room, password } = getRoom();
    res.json(buildLinks(room, password));
  });

  app.post('/api/room/rotate', requireAuth, (_req: Request, res: Response) => {
    const { room, password } = rotateRoom();
    res.json({ ...buildLinks(room, password), rotated: true });
  });

  app.post('/api/scene-collection', requireAuth, (_req: Request, res: Response) => {
    const { room, password } = getRoom();
    const json = buildSceneCollectionJson(buildLinks(room, password));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${sceneCollectionFilename(room)}"`);
    res.send(json);
  });

  // Serve built client in production
  if (process.env.NODE_ENV === 'production') {
    const clientDir = path.join(__dirname, '../..');
    // Agent discovery lives under a dot-dir; express.static ignores dotfiles
    // by default, so serve it explicitly (siblings web/edu expose the same
    // file via nginx).
    app.get('/.well-known/agent-card.json', (_req: Request, res: Response) => {
      res.sendFile(path.join(clientDir, '.well-known', 'agent-card.json'), {
        dotfiles: 'allow',
      });
    });
    app.use(express.static(clientDir));
    app.get('/*splat', (req, res, next: NextFunction) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/auth')) {
        return next();
      }
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  return app;
}
