/**
 * IndexedDB Data Layer for STOREMAN ERP
 * Provides high-speed local persistence, offline access, and synchronization queue.
 */

const DB_NAME = 'storeman_erp_db';
const DB_VERSION = 1;
const SYNC_QUEUE_STORE = 'sync_queue';
const APP_STORE = 'app_entities';

export interface SyncQueueItem {
  id: string;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  data: Record<string, unknown>;
  timestamp: string;
  retry_count: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'RESOLVED';
  error_message?: string;
  version: number;
}

class IndexedDBStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported in this runtime environment.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(APP_STORE)) {
          const store = db.createObjectStore(APP_STORE, { keyPath: 'store_key' });
          store.createIndex('collection', 'collection', { unique: false });
        }
        if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
          const queue = db.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
          queue.createIndex('status', 'status', { unique: false });
          queue.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // Generic Entity Collection Operations
  async getCollection<T>(collection: string): Promise<T[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([APP_STORE], 'readonly');
        const store = transaction.objectStore(APP_STORE);
        const index = store.index('collection');
        const request = index.getAll(IDBKeyRange.only(collection));

        request.onsuccess = () => {
          const results = (request.result || []).map((row) => row.data as T);
          resolve(results);
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Fallback to localStorage if IndexedDB is blocked
      const raw = localStorage.getItem(`storeman_${collection}`);
      return raw ? JSON.parse(raw) : [];
    }
  }

  async saveCollection<T extends { id: string }>(collection: string, items: T[]): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([APP_STORE], 'readwrite');
        const store = transaction.objectStore(APP_STORE);

        // Clear existing for this collection first
        const index = store.index('collection');
        const request = index.openCursor(IDBKeyRange.only(collection));

        request.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            // Now insert all updated items
            for (const item of items) {
              store.put({
                store_key: `${collection}_${item.id}`,
                collection,
                id: item.id,
                data: item,
                updated_at: new Date().toISOString(),
              });
            }
          }
        };

        transaction.oncomplete = () => {
          // Keep localStorage backup for resilient sync
          try {
            localStorage.setItem(`storeman_${collection}`, JSON.stringify(items));
          } catch {
            // quota limit ignored
          }
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      try {
        localStorage.setItem(`storeman_${collection}`, JSON.stringify(items));
      } catch {
        // quota limit ignored
      }
    }
  }

  async putItem<T extends { id: string }>(collection: string, item: T): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([APP_STORE], 'readwrite');
        const store = transaction.objectStore(APP_STORE);
        store.put({
          store_key: `${collection}_${item.id}`,
          collection,
          id: item.id,
          data: item,
          updated_at: new Date().toISOString(),
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      // Fallback
      const all = await this.getCollection<T>(collection);
      const idx = all.findIndex((x) => x.id === item.id);
      if (idx >= 0) all[idx] = item;
      else all.push(item);
      localStorage.setItem(`storeman_${collection}`, JSON.stringify(all));
    }
  }

  async removeItem(collection: string, id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([APP_STORE], 'readwrite');
        const store = transaction.objectStore(APP_STORE);
        store.delete(`${collection}_${id}`);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      const all = await this.getCollection<{ id: string }>(collection);
      const filtered = all.filter((x) => x.id !== id);
      localStorage.setItem(`storeman_${collection}`, JSON.stringify(filtered));
    }
  }

  // Offline Sync Queue Operations
  async enqueueSyncItem(item: Omit<SyncQueueItem, 'status' | 'retry_count'>): Promise<void> {
    const queueItem: SyncQueueItem = {
      ...item,
      status: 'PENDING',
      retry_count: 0,
    };
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([SYNC_QUEUE_STORE], 'readwrite');
        const store = transaction.objectStore(SYNC_QUEUE_STORE);
        store.put(queueItem);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      const current = this.getLocalStorageQueue();
      current.push(queueItem);
      localStorage.setItem('storeman_sync_queue', JSON.stringify(current));
    }
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([SYNC_QUEUE_STORE], 'readonly');
        const store = transaction.objectStore(SYNC_QUEUE_STORE);
        const index = store.index('status');
        const request = index.getAll(IDBKeyRange.only('PENDING'));
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return this.getLocalStorageQueue().filter((x) => x.status === 'PENDING');
    }
  }

  async updateQueueItem(item: SyncQueueItem): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([SYNC_QUEUE_STORE], 'readwrite');
        const store = transaction.objectStore(SYNC_QUEUE_STORE);
        store.put(item);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      const current = this.getLocalStorageQueue();
      const idx = current.findIndex((x) => x.id === item.id);
      if (idx >= 0) current[idx] = item;
      localStorage.setItem('storeman_sync_queue', JSON.stringify(current));
    }
  }

  async removeQueueItem(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([SYNC_QUEUE_STORE], 'readwrite');
        const store = transaction.objectStore(SYNC_QUEUE_STORE);
        store.delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {
      const current = this.getLocalStorageQueue().filter((x) => x.id !== id);
      localStorage.setItem('storeman_sync_queue', JSON.stringify(current));
    }
  }

  private getLocalStorageQueue(): SyncQueueItem[] {
    const raw = localStorage.getItem('storeman_sync_queue');
    return raw ? JSON.parse(raw) : [];
  }
}

export const idbStorage = new IndexedDBStorage();
