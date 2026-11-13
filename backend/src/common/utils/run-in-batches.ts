/**
 * Runs async tasks at most `limit` at a time and returns their results in order,
 * like Promise.all but without starting everything at once.
 *
 * A page that fires a dozen queries through one Promise.all asks the pool for a
 * dozen connections in the same instant. On a host that caps connections per
 * account, two such page loads during a restart overlap were enough to go over
 * the cap. Running them a few at a time keeps a single request from taking the
 * whole pool, at the cost of a few milliseconds.
 */
export async function runInBatches<T extends readonly (() => Promise<unknown>)[]>(
  tasks: [...T],
  limit: number,
): Promise<{ -readonly [K in keyof T]: T[K] extends () => Promise<infer R> ? R : never }> {
  const results: unknown[] = new Array(tasks.length);
  const width = Math.max(1, Math.floor(limit) || 1);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(width, tasks.length) }, () => worker()));
  return results as { -readonly [K in keyof T]: T[K] extends () => Promise<infer R> ? R : never };
}
