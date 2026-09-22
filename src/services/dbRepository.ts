/**
 * Unified Database Repository for STOREMAN ERP
 * Intelligently switches between Supabase Remote DB and IndexedDB Offline Store.
 */

import { idbStorage } from '../lib/idb';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { generateUUID } from '../lib/utils';
import {
  SEED_COMPANIES,
  SEED_BRANCHES,
  SEED_WAREHOUSES,
  SEED_STORES,
  SEED_DEPARTMENTS,
  SEED_UNITS,
  SEED_CATEGORIES,
  SEED_PRODUCTS,
  SEED_CONTACTS,
  SEED_AGENTS,
  SEED_ACCOUNTS,
  SEED_BALANCED_JOURNAL_ENTRIES,
  SEED_EMPLOYEES,
  SEED_MACHINES,
  SEED_VEHICLES,
  SEED_QUALITY_RULES,
  SEED_MODULES,
  SEED_DEFAULT_USER,
  SEED_SYSTEM_SETTINGS,
} from './seedData';

class DatabaseRepository {
  private initialized: boolean = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    // Check if initial local store is seeded
    const existingCompanies = await idbStorage.getCollection('companies');
    if (existingCompanies.length === 0) {
      await idbStorage.saveCollection('companies', SEED_COMPANIES);
      await idbStorage.saveCollection('branches', SEED_BRANCHES);
      await idbStorage.saveCollection('warehouses', SEED_WAREHOUSES);
      await idbStorage.saveCollection('stores', SEED_STORES);
      await idbStorage.saveCollection('departments', SEED_DEPARTMENTS);
      await idbStorage.saveCollection('units', SEED_UNITS);
      await idbStorage.saveCollection('product_categories', SEED_CATEGORIES);
      await idbStorage.saveCollection('products', SEED_PRODUCTS);
      await idbStorage.saveCollection('contacts', SEED_CONTACTS);
      await idbStorage.saveCollection('agents', SEED_AGENTS);
      await idbStorage.saveCollection('accounts', SEED_ACCOUNTS);
      await idbStorage.saveCollection('journal_entries', SEED_BALANCED_JOURNAL_ENTRIES);
      await idbStorage.saveCollection('employees', SEED_EMPLOYEES);
      await idbStorage.saveCollection('machines', SEED_MACHINES);
      await idbStorage.saveCollection('vehicles', SEED_VEHICLES);
      await idbStorage.saveCollection('quality_rules', SEED_QUALITY_RULES);
      await idbStorage.saveCollection('modules', SEED_MODULES);
      await idbStorage.saveCollection('users', [SEED_DEFAULT_USER]);
      await idbStorage.putItem('settings', { id: 'default', ...SEED_SYSTEM_SETTINGS });
    }

    this.initialized = true;
  }

  async getAll<T extends { id: string }>(collection: string, companyId?: string): Promise<T[]> {
    await this.init();

    const client = getSupabaseClient();
    if (client && isSupabaseConfigured() && navigator.onLine) {
      try {
        let query = client.from(collection).select('*');
        if (companyId) {
          query = query.eq('company_id', companyId);
        }
        const { data, error } = await query;
        if (!error && data) {
          // Update local cache
          await idbStorage.saveCollection(collection, data as T[]);
          return data as T[];
        }
      } catch {
        // Fallback to local
      }
    }

    // Local IndexedDB query
    const localItems = await idbStorage.getCollection<T>(collection);
    if (companyId) {
      return localItems.filter((item) => (item as unknown as { company_id?: string }).company_id === companyId);
    }
    return localItems;
  }

  async getById<T extends { id: string }>(collection: string, id: string): Promise<T | null> {
    await this.init();
    const all = await this.getAll<T>(collection);
    return all.find((item) => item.id === id) || null;
  }

  async insert<T extends { id?: string }>(collection: string, item: T): Promise<T & { id: string }> {
    await this.init();
    const id = item.id || generateUUID();
    const enrichedItem = {
      ...item,
      id,
      created_at: (item as unknown as { created_at?: string }).created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as T & { id: string };

    // Persist locally first (offline-first mandate)
    await idbStorage.putItem(collection, enrichedItem);

    // Queue for sync or push to remote Supabase
    const client = getSupabaseClient();
    if (client && isSupabaseConfigured() && navigator.onLine) {
      try {
        const { error } = await client.from(collection).insert([enrichedItem]);
        if (error) throw error;
      } catch (err: unknown) {
        console.warn(`[Supabase Insert Fallback queued for ${collection}]`, err);
        await idbStorage.enqueueSyncItem({
          id: generateUUID(),
          table: collection,
          action: 'INSERT',
          data: enrichedItem as unknown as Record<string, unknown>,
          timestamp: new Date().toISOString(),
          version: 1,
        });
      }
    } else {
      await idbStorage.enqueueSyncItem({
        id: generateUUID(),
        table: collection,
        action: 'INSERT',
        data: enrichedItem as unknown as Record<string, unknown>,
        timestamp: new Date().toISOString(),
        version: 1,
      });
    }

    return enrichedItem;
  }

  async update<T extends { id: string } = any>(collection: string, id: string, updates: Partial<T> | Record<string, any>): Promise<T> {
    await this.init();
    const existing = await this.getById<T>(collection, id);
    if (!existing) {
      throw new Error(`Record with ID ${id} not found in collection ${collection}`);
    }

    const updated = {
      ...existing,
      ...updates,
      id,
      updated_at: new Date().toISOString(),
    } as T;

    await idbStorage.putItem(collection, updated);

    const client = getSupabaseClient();
    if (client && isSupabaseConfigured() && navigator.onLine) {
      try {
        const { error } = await client.from(collection).update(updated).eq('id', id);
        if (error) throw error;
      } catch (err: unknown) {
        console.warn(`[Supabase Update Fallback queued for ${collection}]`, err);
        await idbStorage.enqueueSyncItem({
          id: generateUUID(),
          table: collection,
          action: 'UPDATE',
          data: updated as unknown as Record<string, unknown>,
          timestamp: new Date().toISOString(),
          version: 1,
        });
      }
    } else {
      await idbStorage.enqueueSyncItem({
        id: generateUUID(),
        table: collection,
        action: 'UPDATE',
        data: updated as unknown as Record<string, unknown>,
        timestamp: new Date().toISOString(),
        version: 1,
      });
    }

    return updated;
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.init();
    await idbStorage.removeItem(collection, id);

    const client = getSupabaseClient();
    if (client && isSupabaseConfigured() && navigator.onLine) {
      try {
        await client.from(collection).delete().eq('id', id);
      } catch {
        await idbStorage.enqueueSyncItem({
          id: generateUUID(),
          table: collection,
          action: 'DELETE',
          data: { id },
          timestamp: new Date().toISOString(),
          version: 1,
        });
      }
    } else {
      await idbStorage.enqueueSyncItem({
        id: generateUUID(),
        table: collection,
        action: 'DELETE',
        data: { id },
        timestamp: new Date().toISOString(),
        version: 1,
      });
    }
  }

  // Clear & Reset demo data
  async resetToSeed(): Promise<void> {
    this.initialized = false;
    if (typeof localStorage !== 'undefined') {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith('storeman_')) localStorage.removeItem(k);
      }
    }
    await this.init();
  }
}

export const dbRepository = new DatabaseRepository();
