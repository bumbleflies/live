import { Router, type Request, type Response, type NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, type VerifyCallback } from 'passport-google-oauth20';
import { parseBearerToken, signToken, verifyToken } from '../services/AuthService.js';

export const AUTH_COOKIE = 'live_token';

/**
 * Defense in depth: the shared bumbleflies Google OAuth client is already
 * restricted to Workspace accounts on the bumbleflies.de domain — that is the
 * real trust boundary. This check is cheap and documents the same restriction
 * in code.
 */
const ALLOWED_EMAIL_DOMAIN = '@bumbleflies.de';

function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  };
}

function googleOAuthUnavailable(_req: Request, res: Response, next: NextFunction): void {
  const { clientID, clientSecret } = googleCreds();
  if (!clientID || !clientSecret) {
    res.status(501).json({ error: 'google oauth not configured' });
    return;
  }
  next();
}

function googleCreds() {
  return {
    clientID: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL ?? '/auth/google/callback',
  };
}

interface GoogleProfile {
  emails?: { value: string }[];
}

function profileEmail(profile: GoogleProfile): string | undefined {
  return profile.emails?.[0]?.value?.toLowerCase();
}

export function initPassport(): void {
  const { clientID, clientSecret, callbackURL } = googleCreds();
  if (!clientID || !clientSecret) {
    return;
  }
  passport.use(
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL },
      (_accessToken: string, _refreshToken: string, profile: unknown, done: VerifyCallback) => {
        done(null, profile as GoogleProfile);
      },
    ),
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const bearer = parseBearerToken(req.headers.authorization);
  const token = bearer ?? req.cookies?.[AUTH_COOKIE];
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  try {
    res.locals.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

export function createAuthRouter() {
  const router = Router();

  router.get(
    '/google',
    googleOAuthUnavailable,
    passport.authenticate('google', {
      session: false,
      scope: ['profile', 'email'],
    }),
  );

  router.get(
    '/google/callback',
    googleOAuthUnavailable,
    // failureRedirect is browser-flow-only (HTML redirect, not a JSON API).
    passport.authenticate('google', { session: false, failureRedirect: '/' }),
    (req: Request, res: Response) => {
      const profile = req.user as unknown as GoogleProfile | undefined;
      const email = profile ? profileEmail(profile) : undefined;
      if (!email || !email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
        res.status(403).json({ error: 'not a bumbleflies account' });
        return;
      }
      const token = signToken({ email });
      res.cookie(AUTH_COOKIE, token, authCookieOptions());
      res.redirect('/');
    },
  );

  router.post('/logout', (_req: Request, res: Response) => {
    const cookieOptions = authCookieOptions();
    res.clearCookie(AUTH_COOKIE, {
      httpOnly: cookieOptions.httpOnly,
      sameSite: cookieOptions.sameSite,
      secure: cookieOptions.secure,
      path: cookieOptions.path,
    });
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, (_req: Request, res: Response) => {
    res.json({ user: res.locals.user });
  });

  return router;
}
