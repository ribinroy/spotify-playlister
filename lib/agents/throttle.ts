import pLimit from "p-limit";
import type { QueueStatus } from "@/types";

const MAX_CONCURRENT = 5;
const limit = pLimit(MAX_CONCURRENT);

let paused = false;
let pendingCount = 0;
let activeCount = 0;
let completedCount = 0;
let statusListeners: Array<(status: QueueStatus) => void> = [];

function notifyListeners() {
  const status = getQueueStatus();
  statusListeners.forEach((fn) => fn(status));
}

export function onQueueStatusChange(
  listener: (status: QueueStatus) => void
): () => void {
  statusListeners.push(listener);
  return () => {
    statusListeners = statusListeners.filter((fn) => fn !== listener);
  };
}

export function getQueueStatus(): QueueStatus {
  return {
    pending: pendingCount,
    active: activeCount,
    completed: completedCount,
    paused,
  };
}

export function resetQueueCounters() {
  pendingCount = 0;
  activeCount = 0;
  completedCount = 0;
  paused = false;
  notifyListeners();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function throttledRequest<T>(
  fn: () => Promise<Response>
): Promise<T> {
  pendingCount++;
  notifyListeners();

  return limit(async () => {
    pendingCount--;
    activeCount++;
    notifyListeners();

    while (paused) {
      await sleep(100);
    }

    try {
      const response = await fn();

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "5", 10);
        paused = true;
        notifyListeners();
        await sleep(retryAfter * 1000);
        paused = false;
        notifyListeners();
        // Retry once after backoff
        const retryResponse = await fn();
        const data = await retryResponse.json();
        return data as T;
      }

      const data = await response.json();
      return data as T;
    } finally {
      activeCount--;
      completedCount++;
      notifyListeners();
    }
  });
}
