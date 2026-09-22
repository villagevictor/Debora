/**
 * Immutable Audit Logging for STOREMAN ERP
 * Records critical user actions, state changes, approvals, and financial adjustments.
 */

import { AuditLogEntry } from '../types';
import { generateUUID } from './utils';
import { idbStorage } from './idb';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

class AuditLogger {
  async log(params: {
    userId: string;
    userEmail?: string;
    companyId: string;
    action: AuditLogEntry['action'];
    module: string;
    entityType: string;
    entityId: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
  }): Promise<void> {
    const entry: AuditLogEntry = {
      id: generateUUID(),
      company_id: params.companyId,
      user_id: params.userId,
      user_email: params.userEmail,
      action: params.action,
      module: params.module,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_data: params.oldData || null,
      new_data: params.newData || null,
      timestamp: new Date().toISOString(),
    };

    // Store in local IndexedDB audit collection
    await idbStorage.putItem<AuditLogEntry>('audit_logs', entry);

    // If Supabase client is configured, also persist directly or enqueue
    const client = getSupabaseClient();
    if (client && isSupabaseConfigured()) {
      client.from('audit_logs').insert([entry]).then(({ error }) => {
        if (error) {
          console.error('[AuditLog Remote Insert Error]', error);
          idbStorage.enqueueSyncItem({
            id: generateUUID(),
            table: 'audit_logs',
            action: 'INSERT',
            data: entry as unknown as Record<string, unknown>,
            timestamp: entry.timestamp,
            version: 1,
          });
        }
      });
    }
  }

  async getLogs(companyId?: string, limit: number = 100): Promise<AuditLogEntry[]> {
    const all = await idbStorage.getCollection<AuditLogEntry>('audit_logs');
    const filtered = companyId ? all.filter((l) => l.company_id === companyId) : all;
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
  }
}

export const auditLogger = new AuditLogger();
