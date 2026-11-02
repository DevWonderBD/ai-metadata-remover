/**
 * Stats and Telemetry Service for AI Metadata Remover
 * DevWonder Open Source Initiative
 * 
 * Tracks metrics (Visitor count, Total images cleaned, AI detections)
 * Supports full offline queuing and local persistence so stats never reset on page refresh.
 * When server connection is restored, pending offline queue is pushed and cleared.
 */

const STATS_API = import.meta.env.VITE_STATS_API_URL || '/api/stats.php';
const OFFLINE_QUEUE_KEY = 'devwonder_stats_queue';
const CACHED_STATS_KEY = 'devwonder_cached_stats';
const VISIT_RECORDED_KEY = 'devwonder_visit_recorded';

export function getDefaultStats() {
  return {
    total_visits: 1,
    unique_visitors: 1,
    images_cleaned: 0,
    ai_detected_count: 0,
  };
}

export function getStoredStats() {
  try {
    const raw = localStorage.getItem(CACHED_STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        total_visits: Number(parsed.total_visits) || 1,
        unique_visitors: Number(parsed.unique_visitors) || 1,
        images_cleaned: Number(parsed.images_cleaned) || 0,
        ai_detected_count: Number(parsed.ai_detected_count) || 0,
      };
    }
  } catch (e) {
    // fallback
  }
  const def = getDefaultStats();
  setStoredStats(def);
  return def;
}

export function setStoredStats(stats) {
  try {
    localStorage.setItem(CACHED_STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    // ignore local storage errors
  }
}

export async function fetchCurrentStats() {
  const localStats = getStoredStats();

  try {
    const res = await fetch(STATS_API, { method: 'GET' });
    if (!res.ok) throw new Error('Network error');
    const json = await res.json();
    if (json && json.data) {
      const serverStats = {
        total_visits: Math.max(Number(json.data.total_visits) || 0, localStats.total_visits),
        unique_visitors: Math.max(Number(json.data.unique_visitors) || 0, localStats.unique_visitors),
        images_cleaned: Math.max(Number(json.data.images_cleaned) || 0, localStats.images_cleaned),
        ai_detected_count: Math.max(Number(json.data.ai_detected_count) || 0, localStats.ai_detected_count),
      };
      setStoredStats(serverStats);
      // If there are unsynced offline items, sync them now
      syncOfflineQueue();
      return serverStats;
    }
  } catch (e) {
    // Server is unreachable or running offline/localhost: return persistent local stats
  }

  return localStats;
}

export async function recordVisit() {
  const isUnique = !localStorage.getItem(VISIT_RECORDED_KEY);
  if (isUnique) {
    localStorage.setItem(VISIT_RECORDED_KEY, '1');
  }

  // Update local stats immediately
  const localStats = getStoredStats();
  const sessionKey = 'devwonder_session_visit';
  if (!sessionStorage.getItem(sessionKey)) {
    sessionStorage.setItem(sessionKey, '1');
    localStats.total_visits += 1;
    if (isUnique) localStats.unique_visitors += 1;
    setStoredStats(localStats);
  }

  if (!navigator.onLine) {
    queueOfflineData({ type: 'visit', unique: isUnique });
    return;
  }

  try {
    await fetch(STATS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'visit', unique: isUnique }),
    });
  } catch (e) {
    queueOfflineData({ type: 'visit', unique: isUnique });
  }
}

export async function recordCleanedImages(count, aiCount = 0) {
  if (count <= 0) return;

  // 1. Immediately increment local persistent stats so refresh NEVER resets count
  const localStats = getStoredStats();
  localStats.images_cleaned += count;
  localStats.ai_detected_count += aiCount;
  setStoredStats(localStats);

  // 2. If offline, queue for sync
  if (!navigator.onLine) {
    queueOfflineData({ type: 'clean', count, aiCount });
    return;
  }

  // 3. Try to push to server
  try {
    const res = await fetch(STATS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clean', count, ai_count: aiCount }),
    });
    if (!res.ok) throw new Error('API request failed');
  } catch (e) {
    // Server failed or offline: queue data so it can be pushed later
    queueOfflineData({ type: 'clean', count, aiCount });
  }
}

function queueOfflineData(item) {
  try {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    queue.push(item);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    // ignore storage quota errors
  }
}

export async function syncOfflineQueue() {
  if (!navigator.onLine) return;

  let queue = [];
  try {
    queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch (e) {
    return;
  }

  if (!queue.length) return;

  // Aggregate pending metrics to send in minimal network calls
  let totalCleanCount = 0;
  let totalAiCount = 0;
  let visitCount = 0;

  for (const item of queue) {
    if (item.type === 'clean') {
      totalCleanCount += item.count || 0;
      totalAiCount += item.aiCount || 0;
    } else if (item.type === 'visit') {
      visitCount++;
    }
  }

  try {
    if (visitCount > 0) {
      await fetch(STATS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'visit', unique: false }),
      });
    }

    if (totalCleanCount > 0) {
      await fetch(STATS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clean', count: totalCleanCount, ai_count: totalAiCount }),
      });
    }

    // Only when successfully pushed to server, clear local pending queue to 0
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (e) {
    // will retry on next online event or sync
  }
}

// Auto-register window listener for online sync
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOfflineQueue();
  });
}
