import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { offlineSyncEngine, SyncState } from '../lib/offlineSync';

export const OfflineIndicator: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<{
    state: SyncState;
    pendingCount: number;
    lastSyncedAt: string | null;
  }>({
    state: 'IDLE',
    pendingCount: 0,
    lastSyncedAt: null,
  });

  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = offlineSyncEngine.subscribe((status) => {
      setSyncStatus(status);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    await offlineSyncEngine.triggerSync();
    setIsManualSyncing(false);
  };

  const isOffline = syncStatus.state === 'OFFLINE' || (typeof navigator !== 'undefined' && !navigator.onLine);

  return (
    <div className="flex items-center gap-2">
      {isOffline ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>Offline Mode ({syncStatus.pendingCount} queued)</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Wifi className="w-3.5 h-3.5" />
          <span>Online</span>
          {syncStatus.pendingCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded-full font-bold">
              {syncStatus.pendingCount}
            </span>
          )}
        </div>
      )}

      {syncStatus.pendingCount > 0 && !isOffline && (
        <button
          onClick={handleManualSync}
          disabled={isManualSyncing}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          title="Synchronize offline queue now"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
          Sync
        </button>
      )}
    </div>
  );
};
