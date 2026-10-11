type RejectionListener = (reason: unknown) => void;

// Tests run on Node, but the app tsconfig has no Node types, so this is the
// one place process is reached for.
type NodeProcess = {
  on(event: 'unhandledRejection', listener: RejectionListener): void;
  off(event: 'unhandledRejection', listener: RejectionListener): void;
};

// Node reports an unhandled rejection after the microtask queue drains, so
// one macrotask after `run` settles is when a missed one has shown up.
export async function expectNoUnhandledRejection(
  run: () => Promise<void>,
): Promise<void> {
  const { process } = globalThis as unknown as { process: NodeProcess };
  const reasons: unknown[] = [];
  const listener: RejectionListener = (reason) => reasons.push(reason);
  process.on('unhandledRejection', listener);
  try {
    await run();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    process.off('unhandledRejection', listener);
  }
  expect(reasons).toEqual([]);
}
