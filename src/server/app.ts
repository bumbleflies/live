import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { buildLinks, generatePassword, generateRoomName, type Room } from './services/roomLinks.js';
import { createAuthRouter, initPassport, requireAuth } from './routes/auth.js';
import { getJwtSecret } from './services/AuthService.js';
import { healthHandler } from './health.js';
import { buildSceneCollectionJson, sceneCollectionFilename } from './routes/sceneCollection.js';

initPassport();

// Room state is intentionally session-scoped: the server keeps the last
// generated room per authenticated email in memory so the OBS
// scene-collection download can reuse the same room/password. No database —
// nothing else needs to survive a restart.
const lastRooms = new Map<string, Room>();

export function clearRooms(): void {
  lastRooms.clear();
}

export function createApp() {
  // Fail fast when JWT_SECRET is missing — otherwise every authed route
  // would 401 silently.
  getJwtSecret();

  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', healthHandler);

  app.use('/auth', createAuthRouter());

  app.post('/api/room', requireAuth, (_req: Request, res: Response) => {
    const room = buildLinks(generateRoomName(), generatePassword());
    lastRooms.set((res.locals.user as AuthPayload).email, room);
    res.json(room);
  });

  app.post('/api/scene-collection', requireAuth, (_req: Request, res: Response) => {
    const email = (res.locals.user as AuthPayload).email;
    const room = lastRooms.get(email);
    if (!room) {
      res.status(409).json({ error: 'generate a room first' });
      return;
    }
    const json = buildSceneCollectionJson(room);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${sceneCollectionFilename(room.room)}"`);
    res.send(json);
  });

  // Serve built client in production
  if (process.env.NODE_ENV === 'production') {
    const clientDir = path.join(__dirname, '../..');
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

interface AuthPayload {
  email: string;
}
