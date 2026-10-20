import { makeUser, serveUsers, USERS_PATH } from './user-fixtures';

const send = (method: string, path: string, body?: unknown) =>
  fetch(new URL(path, window.location.origin), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// The rows apps/api/test/users.e2e-spec.ts pins down, with a valid body so
// the id is the only thing wrong.
describe('serveUsers', () => {
  it.each([
    ['GET', '', undefined],
    ['PATCH', '', { name: 'x' }],
    ['POST', '/disable', undefined],
    ['POST', '/enable', undefined],
    ['POST', '/password', { password: 'a brand new password' }],
  ])(
    'answers %s :id%s with a bad id with 400 on id',
    async (method, suffix, body) => {
      serveUsers();

      const response = await send(
        method,
        `${USERS_PATH}/not-a-uuid${suffix}`,
        body,
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [expect.objectContaining({ path: 'id' })],
      });
    },
  );

  it.each([
    ['PATCH', ''],
    ['POST', '/password'],
  ])('answers %s :id%s on the body before a bad id', async (method, suffix) => {
    serveUsers();

    const response = await send(method, `${USERS_PATH}/not-a-uuid${suffix}`, {
      bogus: 1,
    });

    expect(response.status).toBe(400);
    const { errors } = (await response.json()) as {
      errors: { path: string }[];
    };
    expect(errors.map(({ path }) => path)).not.toContain('id');
  });

  it('answers an unknown id with 404 USER_NOT_FOUND', async () => {
    serveUsers();

    const response = await send('GET', `${USERS_PATH}/${makeUser(999).id}`);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});
