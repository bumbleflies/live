process.env.JWT_SECRET = 'test-secret';

import { describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { getJwtSecret } from '../services/AuthService.js';

const app = createApp();

function tokenFor(email: string): string {
  return jwt.sign({ email }, getJwtSecret(), { expiresIn: '1h' });
}

describe('auth', () => {
  it('rejects a missing cookie and bearer token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('rejects an invalid cookie', async () => {
    const res = await request(app).get('/auth/me').set('Cookie', 'live_token=garbage');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid bearer token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  it('rejects a bearer token signed with a different secret', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${jwt.sign({ email: 'user@bumbleflies.de' }, 'wrong-secret')}`);
    expect(res.status).toBe(401);
  });

  it('returns the email claim for a valid cookie', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', `live_token=${tokenFor('chris@bumbleflies.de')}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ email: 'chris@bumbleflies.de' });
  });

  it('accepts a bearer token, same as the cookie path', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenFor('sebi@bumbleflies.de')}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('sebi@bumbleflies.de');
  });

  it('health is open, room generation is not', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).post('/api/room')).status).toBe(401);
  });
});

describe('room + scene-collection endpoints', () => {
  const cookie = `live_token=${tokenFor('host@bumbleflies.de')}`;

  it('generates a room and downloads a matching scene collection', async () => {
    const room = await request(app).post('/api/room').set('Cookie', cookie);
    expect(room.status).toBe(200);
    const body = room.body as {
      room: string;
      password: string;
      guests: unknown[];
      obsSources: unknown[];
      guests_count: number;
    };
    expect(body.room).toMatch(/^bumbleLive[0-9a-f]{4}$/);
    expect(body.guests).toHaveLength(3);
    expect(body.obsSources).toHaveLength(3);

    const download = await request(app).post('/api/scene-collection').set('Cookie', cookie);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('application/json');
    expect(download.headers['content-disposition']).toContain(
      `filename="Bumbleflies-Live-${body.room}.json"`,
    );
  });

  it('scene collection 409s before any room was generated for this user', async () => {
    const res = await request(app)
      .post('/api/scene-collection')
      .set('Cookie', `live_token=${tokenFor('fresh@bumbleflies.de')}`);
    expect(res.status).toBe(409);
  });

  it('rejects the endpoints without auth', async () => {
    expect(
      (await request(app).post('/api/scene-collection')).status,
    ).toBe(401);
  });
});
