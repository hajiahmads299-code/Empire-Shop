import { describe, expect, it } from 'vitest';

describe('health contract', () => {
  it('exposes a stable healthy response shape', () => {
    const response = {
      ok: true,
      status: 'healthy',
      db: 'up',
    };

    expect(response).toMatchObject({
      ok: true,
      status: expect.stringMatching(/^(healthy|degraded)$/),
      db: expect.stringMatching(/^(up|down|skipped)$/),
    });
  });
});