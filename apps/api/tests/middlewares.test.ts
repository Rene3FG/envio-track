import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../src/errors/app-error';
import { validateBody, validateQuery } from '../src/middlewares/validate';

const schema = z.object({ n: z.coerce.number().int() });
const run = (mw: (req: Request, res: Response, next: NextFunction) => void, req: Partial<Request>) => {
  const next = jest.fn();
  mw(req as Request, {} as Response, next);
  return { req, err: next.mock.calls[0]?.[0] as unknown };
};

describe('validateBody / validateQuery', () => {
  it('deja pasar y normaliza el body válido', () => {
    const { req, err } = run(validateBody(schema), { body: { n: '3' } });
    expect(err).toBeUndefined();
    expect(req.body).toEqual({ n: 3 });
  });

  it('convierte el ZodError del body en 400 VALIDATION_ERROR con detalles', () => {
    const { err } = run(validateBody(schema), { body: { n: 'x' } });
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR', details: [{ path: 'n' }] });
  });

  it('deja pasar y normaliza la query válida', () => {
    const { req, err } = run(validateQuery(schema), { query: { n: '7' } });
    expect(err).toBeUndefined();
    expect(req.query).toEqual({ n: 7 });
  });

  it('convierte el ZodError de la query en 400', () => {
    const { err } = run(validateQuery(schema), { query: {} });
    expect(err).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('propaga errores que no son de validación', () => {
    const boom = { parse: () => { throw new Error('boom'); } } as unknown as z.ZodSchema;
    expect((run(validateBody(boom), { body: {} }).err as Error).message).toBe('boom');
    expect((run(validateQuery(boom), { query: {} }).err as Error).message).toBe('boom');
  });
});

describe('AppError', () => {
  it.each([
    [AppError.badRequest('x'), 400, 'VALIDATION_ERROR'],
    [AppError.unauthenticated(), 401, 'UNAUTHENTICATED'],
    [AppError.forbidden(), 403, 'FORBIDDEN'],
    [AppError.notFound(), 404, 'NOT_FOUND'],
    [AppError.conflict('x'), 409, 'CONFLICT'],
    [AppError.payloadTooLarge(), 413, 'PAYLOAD_TOO_LARGE'],
    [AppError.unsupportedMediaType(), 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [AppError.internal(), 500, 'INTERNAL'],
  ])('%#: status y código correctos', (err, status, code) => {
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ statusCode: status, code });
    expect(err.message.length).toBeGreaterThan(0);
  });

  it('acepta mensajes propios', () => {
    expect(AppError.forbidden('Solo admins').message).toBe('Solo admins');
  });
});
