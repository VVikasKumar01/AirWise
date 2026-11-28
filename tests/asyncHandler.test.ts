import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { asyncHandler } from '../server/asyncHandler.ts';
import { apiErrorHandler } from '../server/errorHandler.ts';

test('asyncHandler forwards rejected route handlers to safe JSON error middleware', async () => {
  const app = express();
  app.get(
    '/failure',
    asyncHandler(async () => {
      throw new Error('internal database detail');
    }),
  );
  app.use(apiErrorHandler);

  const server = await new Promise<import('node:http').Server>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address() as import('node:net').AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/failure`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: 'An unexpected server error occurred.',
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
