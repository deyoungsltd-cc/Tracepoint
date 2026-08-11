// ============================================================
// TRACEPOINT — API Request Queue
// Serializes concurrent API calls to avoid rate limit violations.
// Uses a priority queue with per-provider concurrency limits.
// ============================================================

type QueueTask<T = unknown> = {
  id: string;
  provider: string;
  priority: number;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  createdAt: number;
};

const queues = new Map<string, QueueTask[]>();
const running = new Map<string, number>(); // provider -> count of in-flight requests

const DEFAULT_CONCURRENCY: Record<string, number> = {
  numverify: 5,
  serper: 3,
  twilio: 5,
  openai: 2,
  cloudinary: 3,
  social_scraper: 2,
};

/**
 * Enqueue an API call for a provider.
 * Returns a promise that resolves when the task executes.
 */
export function enqueue<T>(
  provider: string,
  execute: () => Promise<T>,
  priority = 5
): Promise<T> {
  return new Promise((resolve, reject) => {
    const task: QueueTask<T> = {
      id: crypto.randomUUID(),
      provider,
      priority,
      execute,
      resolve,
      reject,
      createdAt: Date.now(),
    };

    if (!queues.has(provider)) queues.set(provider, []);
    queues.get(provider)!.push(task as QueueTask);

    // Sort by priority (lower = higher priority)
    queues.get(provider)!.sort((a, b) => a.priority - b.priority);

    processQueue(provider);
  });
}

/**
 * Get queue statistics for monitoring.
 */
export function getQueueStats(): Record<string, { queued: number; running: number; concurrency: number }> {
  const stats: Record<string, { queued: number; running: number; concurrency: number }> = {};
  for (const provider of queues.keys()) {
    stats[provider] = {
      queued: queues.get(provider)?.length || 0,
      running: running.get(provider) || 0,
      concurrency: DEFAULT_CONCURRENCY[provider] || 3,
    };
  }
  return stats;
}

/**
 * Clear all queued tasks (does not cancel running tasks).
 */
export function clearQueues(): void {
  for (const [provider, queue] of queues) {
    for (const task of queue) {
      task.reject(new Error('Queue cleared'));
    }
    queue.length = 0;
  }
}

// ---- Internal ----

function processQueue(provider: string): void {
  const queue = queues.get(provider);
  if (!queue || queue.length === 0) return;

  const maxConc = DEFAULT_CONCURRENCY[provider] || 3;
  const current = running.get(provider) || 0;

  if (current >= maxConc) return; // At capacity

  const task = queue.shift()!;
  running.set(provider, current + 1);

  task.execute()
    .then(result => {
      task.resolve(result);
    })
    .catch(err => {
      task.reject(err);
    })
    .finally(() => {
      const after = (running.get(provider) || 1) - 1;
      running.set(provider, after);
      // Process next task in queue
      processQueue(provider);
    });
}
