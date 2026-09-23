/** Runs `fn` over `items` with at most `concurrency` in flight at once. */
export async function asyncPool<T>(
  concurrency: number,
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}
