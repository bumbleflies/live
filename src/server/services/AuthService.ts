import jwt from 'jsonwebtoken';

export interface AuthPayload {
  email: string;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
}

export function parseBearerToken(authHeader: string | undefined): string | undefined {
  if (!authHeader) {
    return undefined;
  }
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length < 2) {
    return undefined;
  }
  const [scheme, token] = parts;
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }
  return token;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '12h' });
}

export function verifyToken(token: string): AuthPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded === 'string' || !decoded) {
    throw new Error('invalid token payload');
  }
  const { email } = decoded as Partial<AuthPayload>;
  if (typeof email !== 'string' || email.length === 0) {
    throw new Error('invalid token payload');
  }
  return { email };
}
