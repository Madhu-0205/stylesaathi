import { useState, useEffect } from 'react';
import { syncService, SyncStatus } from '../lib/sync/syncService';
import { syncQueue } from '../lib/sync/syncQueue';

export interface SyncStatusInfo {
  status: SyncStatus;
  lastError: string | null;
  pendingCount: number;
  isOnline: boolean;
  statusLabel: string;
}

export function useSyncStatus(): SyncStatusInfo {
  const [status, setStatus] = useState<SyncStatus>(syncService.getStatus());
  const [lastError, setLastError] = useState<string | null>(syncService.getLastError());
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    const unsubSync = syncService.subscribe((newStatus, error) => {
      setStatus(newStatus);
      setLastError(error || null);
    });

    const updateStats = async () => {
      try {
        const stats = await syncQueue.getStats();
        setPendingCount(stats.pending + stats.inFlight);
      } catch {}
    };

    updateStats();
    const unsubQueue = syncQueue.subscribe(updateStats);

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
      unsubSync();
      unsubQueue();
    };
  }, []);

  let statusLabel = 'Saved on this device';
  if (!isOnline) {
    statusLabel = "Saved on this device · Syncing when you're back online";
  } else if (status === 'syncing') {
    statusLabel = 'Syncing changes with cloud...';
  } else if (status === 'synced' && pendingCount === 0) {
    statusLabel = 'All changes saved to cloud';
  } else if (pendingCount > 0) {
    statusLabel = `Saved on this device · ${pendingCount} pending cloud sync`;
  }

  return {
    status,
    lastError,
    pendingCount,
    isOnline,
    statusLabel,
  };
}
