import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Database,
  Building,
  History,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { dbRepository } from '../services/dbRepository';
import { authService } from '../services/authService';
import { exportService } from '../services/exportService';
import { Company, AuditLog } from '../types';

interface SettingsModuleProps {
  companyId?: string;
  onCompanySwitch?: (cId: string) => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({ companyId, onCompanySwitch }) => {
  const [activeTab, setActiveTab] = useState<'company' | 'backup' | 'audit' | 'roles'>('company');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({});

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const comps = await dbRepository.getAll<Company>('companies');
    setCompanies(comps);

    const current = comps.find((c) => c.id === companyId) || comps[0];
    if (current) {
      setCompanyForm(current);
    }

    const logs = await dbRepository.getAll<AuditLog>('audit_logs', companyId);
    setAuditLogs(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.id) return;
    try {
      await dbRepository.update('companies', companyForm.id, companyForm);
      alert('Company profile & fiscal settings saved successfully!');
      await loadData();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  // Full Database Backup & Export
  const handleExportDatabase = async () => {
    try {
      const dump: Record<string, any[]> = {};
      const tables = [
        'companies',
        'warehouses',
        'stores',
        'products',
        'contacts',
        'inventory_transactions',
        'purchase_orders',
        'sales_orders',
        'accounts',
        'journal_entries',
        'pos_registers',
        'pos_transactions',
        'boms',
        'work_orders',
        'quality_rules',
        'employees',
        'machines',
        'vehicles',
        'repair_tickets',
        'audit_logs',
      ];

      for (const t of tables) {
        dump[t] = await dbRepository.getAll(t as any);
      }

      exportService.exportToJSON(`STOREMAN_ERP_FULL_BACKUP_${new Date().toISOString().split('T')[0]}`, dump);
    } catch (err: any) {
      alert(`Database export failed: ${err.message}`);
    }
  };

  // Database Restore
  const handleImportDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        for (const [table, records] of Object.entries(json)) {
          if (Array.isArray(records)) {
            for (const rec of records) {
              await dbRepository.insert(table as any, rec);
            }
          }
        }
        alert('Database restored successfully from backup!');
        window.location.reload();
      } catch (err: any) {
        alert(`Restore failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            System Administration & Settings
          </h1>
          <p className="text-xs text-slate-500">
            Multi-entity configuration, offline backups, audit trails, and role security policies
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('company')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'company'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Company Profile
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'backup'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Backup & Recovery
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'audit'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Audit Log
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'roles'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Role Permissions
          </button>
        </div>
      </div>

      {activeTab === 'company' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-xs max-w-3xl">
          <form onSubmit={handleUpdateCompany} className="space-y-4 text-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b pb-2">
              Corporate Legal Entity Details
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1">Company Registered Name *</label>
                <input
                  type="text"
                  required
                  value={companyForm.name || ''}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Company Legal Code / EIN</label>
                <input
                  type="text"
                  value={companyForm.code || ''}
                  onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium mb-1">Base Currency</label>
                <input
                  type="text"
                  value={companyForm.currency || 'USD'}
                  onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Fiscal Year Start</label>
                <input
                  type="text"
                  value={companyForm.fiscal_year_start || '01-01'}
                  onChange={(e) => setCompanyForm({ ...companyForm, fiscal_year_start: e.target.value })}
                  placeholder="MM-DD"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Tax Registration / VAT ID</label>
                <input
                  type="text"
                  value={companyForm.tax_id || ''}
                  onChange={(e) => setCompanyForm({ ...companyForm, tax_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium mb-1">Headquarters Physical Address</label>
              <textarea
                rows={2}
                value={companyForm.address || ''}
                onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
              >
                Save Entity Configuration
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          {/* Export card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Export Full Database Snapshot</h2>
            </div>
            <p className="text-xs text-slate-500">
              Download a complete JSON database dump containing all master files, inventory ledger, POS tickets, double-entry financial journals, and settings.
            </p>
            <button
              onClick={handleExportDatabase}
              className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition"
            >
              Download Database Backup (.json)
            </button>
          </div>

          {/* Import card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Restore Database From Backup</h2>
            </div>
            <p className="text-xs text-slate-500">
              Upload a previously exported STOREMAN ERP JSON snapshot. All records will be merged and reindexed into local IndexedDB and cloud sync queues.
            </p>
            <label className="block w-full text-center py-2.5 rounded-lg border border-dashed border-indigo-400 bg-indigo-50/50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition cursor-pointer dark:bg-indigo-950/30">
              Select JSON File to Restore
              <input type="file" accept=".json" onChange={handleImportDatabase} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Immutable System Audit Trail
            </h2>
            <span className="text-xs text-slate-500">{auditLogs.length} total events logged</span>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-slate-50 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">User</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Entity</th>
                  <th className="py-2 px-3">Entity ID</th>
                  <th className="py-2 px-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-medium">{log.user_id}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.action === 'CREATE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.action === 'UPDATE'
                            ? 'bg-blue-100 text-blue-800'
                            : log.action === 'DELETE'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold">{log.entity_name}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-400">{log.entity_id}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-400">{log.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-xs space-y-4 max-w-3xl">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white border-b pb-2">
            Role-Based Access Control (RBAC) Policies
          </h2>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="font-bold text-indigo-600">Super Admin / System Administrator</div>
              <p className="text-slate-500 mt-1">Full read/write/delete privileges across all companies, modules, general ledger entries, and audit logs.</p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="font-bold text-emerald-600">Accountant / Financial Controller</div>
              <p className="text-slate-500 mt-1">Full access to Chart of Accounts, Journal Vouchers, Trial Balance, P&L, Balance Sheet, Invoicing, and Three-Way Matching.</p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="font-bold text-blue-600">Store / Inventory Manager</div>
              <p className="text-slate-500 mt-1">Access to Warehouses, Retail Outlets, Stock Ledger, Goods Receipt Notes, Stock Transfers, Physical Counts, and Adjustments.</p>
            </div>
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="font-bold text-amber-600">Cashier / Retail Staff</div>
              <p className="text-slate-500 mt-1">POS Checkout register operations, cash drawer reconciliation, product search, and receipt printing.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
