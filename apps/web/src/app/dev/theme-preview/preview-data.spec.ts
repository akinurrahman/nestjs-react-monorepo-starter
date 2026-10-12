import { peopleSource } from './preview-data';

const args = (signal: AbortSignal) => ({
  search: '',
  page: 1,
  limit: 5,
  parentValues: {},
  signal,
});

describe('preview sources', () => {
  it('removes its abort listener once the delay is over', async () => {
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');

    const page = await peopleSource.fetch(args(controller.signal));

    expect(page.options).toHaveLength(5);
    expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0]![1]);
  });

  it('rejects with the abort reason when aborted mid-delay', async () => {
    const controller = new AbortController();
    const pending = peopleSource.fetch(args(controller.signal));

    controller.abort(new Error('Stopped'));

    await expect(pending).rejects.toThrow('Stopped');
  });
});
