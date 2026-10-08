process.env.JWT_SECRET = 'test-secret';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'live-api-'));

import fs from 'fs';
import os from 'os';
import path from 'path';
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

  it('returns the current room resolved from the store', async () => {
    const room = await request(app).post('/api/room').set('Cookie', cookie);
    expect(room.status).toBe(200);
    const body = room.body as {
      room: string;
      password: string;
      guests: unknown[];
      obsSources: unknown[];
    };
    expect(body.room).toMatch(/^bumbleLive[0-9a-f]{4}$/);
    expect(body.guests).toHaveLength(3);
    expect(body.guests.length + (body.obsSources as unknown[]).length).toBe(7);
    expect((body.externalGuest as { name: string }).name).toBe('Guest');
  });

  it('is idempotent — repeated calls never rotate the room', async () => {
    const first = await request(app).post('/api/room').set('Cookie', cookie);
    const second = await request(app).post('/api/room').set('Cookie', cookie);
    expect(second.body.room).toBe(first.body.room);
    expect(second.body.password).toBe(first.body.password);
  });

  it('rotate returns a new room and /api/room follows the rotation', async () => {
    const before = await request(app).post('/api/room').set('Cookie', cookie);
    const rotated = await request(app).post('/api/room/rotate').set('Cookie', cookie);
    expect(rotated.status).toBe(200);
    expect(rotated.body.room).toMatch(/^bumbleLive[0-9a-f]{4}$/);
    expect(rotated.body.rotated).toBe(true);
    expect(rotated.body.room).not.toBe(before.body.room);

    const after = await request(app).post('/api/room').set('Cookie', cookie);
    expect(after.body.room).toBe(rotated.body.room);
    expect(after.body.password).toBe(rotated.body.password);
  });

  it('downloads a scene collection named after the current room', async () => {
    const room = await request(app).post('/api/room').set('Cookie', cookie);
    const download = await request(app).post('/api/scene-collection').set('Cookie', cookie);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('application/json');
    expect(download.headers['content-disposition']).toContain(
      `filename="Bumbleflies-Live-${(room.body as { room: string }).room}.json"`,
    );
    const disk = await request(app)
      .post('/api/scene-collection')
      .set('Cookie', `live_token=${tokenFor('other-user@bumbleflies.de')}`);
    expect(disk.status).toBe(200);
  });

  it('rejects the endpoints without auth', async () => {
    expect((await request(app).post('/api/room')).status).toBe(401);
    expect((await request(app).post('/api/room/rotate')).status).toBe(401);
    expect((await request(app).post('/api/scene-collection')).status).toBe(401);
  });
});
