import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../src/app';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

describe('Upload Module Integration Tests (POST /api/upload)', () => {
  const app = createApp();

  const userToken = jwt.sign(
    { id: 'user-123', email: 'repartidor@envio.test', rol: 'REPARTIDOR' },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const testUploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  let createdFilePath: string | null = null;

  afterEach(() => {
    if (createdFilePath && fs.existsSync(createdFilePath)) {
      try {
        fs.unlinkSync(createdFilePath);
      } catch (_e) {
        // Ignorar si ya fue removido
      }
      createdFilePath = null;
    }
  });

  it('debe responder 401 si no hay token de autorización', async () => {
    const res = await request(app).post('/api/upload');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('debe responder 400 VALIDATION_ERROR si no se envía el campo foto', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('foto');
  });

  it('debe responder 415 UNSUPPORTED_MEDIA_TYPE si el formato no es JPEG o PNG', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('foto', Buffer.from('contenido de texto'), 'archivo.txt');

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('debe subir una foto válida y responder 201 con { fotoUrl: "/uploads/<nombre>.<ext>" }', async () => {
    // 1x1 pixel PNG dummy buffer
    const dummyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const res = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('foto', dummyPng, 'evidencia.png');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('fotoUrl');
    expect(res.body.fotoUrl).toMatch(/^\/uploads\/[a-f0-9-]+\.png$/);

    // Verificar que el archivo realmente se guardó físicamente
    const filename = path.basename(res.body.fotoUrl);
    createdFilePath = path.join(testUploadDir, filename);
    expect(fs.existsSync(createdFilePath)).toBe(true);
  });
});
