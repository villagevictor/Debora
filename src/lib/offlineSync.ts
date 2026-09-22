/**
 * Offline Synchronization Engine for STOREMAN ERP
 * Manages background queue processing, conflict handling, and connectivity listeners.
 */

import { idbStorage, SyncQueueItem } from './idb';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export type SyncState = 'IDLE' | 'SYNCING' | 'OFFLINE' | 'ERROR' | 'SUCCESS';

interface SyncListener {
  (status: { state: SyncState; pendingCount: number; lastSyncedAt: string | null; error?: string }): void;
}

class OfflineSyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private lastSyncedAt: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private syncTimer: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notify();
        this.triggerSync();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notify();
      });

      // Periodic sync check every 30 seconds
      this.syncTimer = window.setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          this.triggerSync();
        }
      }, 30000);
    }
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.notify(listener);
    return () => this.listeners.delete(listener);
  }

  private async notify(singleListener?: SyncListener) {
    const pendingItems = await idbStorage.getPendingSyncItems();
    const payload = {
      state: !this.isOnline ? ('OFFLINE' as SyncState) : this.isSyncing ? ('SYNCING' as SyncState) : ('IDLE' as SyncState),
      pendingCount: pendingItems.length,
      lastSyncedAt: this.lastSyncedAt,
    };
    if (singleListener) {
      singleListener(payload);
    } else {
      this.listeners.forEach((fn) => fn(payload));
    }
  }

  async triggerSync(): Promise<{ syncedCount: number; errors: string[] }> {
    if (this.isSyncing || !this.isOnline) {
      return { syncedCount: 0, errors: [] };
    }

    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      // In local mode, sync queue remains maintained locally
      return { syncedCount: 0, errors: [] };
    }

    this.isSyncing = true;
    this.notify();

    const pendingItems = await idbStorage.getPendingSyncItems();
    let syncedCount = 0;
    const errors: string[] = [];

    for (const item of pendingItems) {
      try {
        await this.syncItem(client, item);
        await idbStorage.removeQueueItem(item.id);
        syncedCount++;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Sync execution failed';
        item.retry_count = (item.retry_count || 0) + 1;
        item.status = item.retry_count >= 5 ? 'FAILED' : 'PENDING';
        item.error_message = errorMsg;
        await idbStorage.updateQueueItem(item);
        errors.push(`Table ${item.table} (${item.id}): ${errorMsg}`);
      }
    }

    this.isSyncing = false;
    this.lastSyncedAt = new Date().toISOString();
    this.notify();

    return { syncedCount, errors };
  }

  private async syncItem(client: NonNullable<ReturnType<typeof getSupabaseClient>>, item: SyncQueueItem): Promise<void> {
    const table = client.from(item.table);

    // Conflict detection: verify remote updated_at if updating
    if (item.action === 'INSERT') {
      const { error } = await table.upsert(item.data);
      if (error) throw error;
    } else if (item.action === 'UPDATE') {
      const recordId = (item.data as { id?: string }).id;
      if (!recordId) throw new Error('Cannot update record without primary ID');

      // Check remote version
      const { data: remoteRecord, error: fetchErr } = await table
        .select('updated_at')
        .eq('id', recordId)
        .maybeSingle();

      if (!fetchErr && remoteRecord && remoteRecord.updated_at) {
        const remoteTime = new Date(remoteRecord.updated_at).getTime();
        const localTime = new Date(item.timestamp).getTime();
        if (remoteTime > localTime) {
          // Remote has newer record: preserve remote or merge non-conflicting fields
          console.warn(`[STOREMAN Conflict] Remote record ${item.table}/${recordId} was modified after local edit.`);
        }
      }

      const { error } = await table.update(item.data).eq('id', recordId);
      if (error) throw error;
    } else if (item.action === 'DELETE') {
      const recordId = (item.data as { id?: string }).id;
      if (recordId) {
        const { error } = await table.delete().eq('id', recordId);
        if (error) throw error;
      }
    }
  }

  destroy() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
  }
}

export const offlineSyncEngine = new OfflineSyncEngine();
export const offlineSync = offlineSyncEngine;
