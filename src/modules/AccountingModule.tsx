import React, { useState, useEffect } from 'react';
import {
  Receipt,
  FileSpreadsheet,
  Plus,
  Scale,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Printer,
  Trash2,
} from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { dbRepository } from '../services/dbRepository';
import { accountingService, TrialBalanceRow, FinancialStatementSummary } from '../services/accountingService';
import { exportService } from '../services/exportService';
import { authService } from '../services/authService';
import { Account, JournalEntry, JournalLine } from '../types';
import { formatCurrency } from '../lib/utils';

interface AccountingModuleProps {
  companyId?: string;
}

export const AccountingModule: React.FC<AccountingModuleProps> = ({ companyId }) => {
  const [activeTab, setActiveTab] = useState<'coa' | 'journal' | 'trial_balance' | 'statements'>('coa');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [trialBalanceRows, setTrialBalanceRows] = useState<TrialBalanceRow[]>([]);
  const [tbTotals, setTbTotals] = useState({ debits: 0, credits: 0 });
  const [financials, setFinancials] = useState<FinancialStatementSummary | null>(null);

  // Journal Entry Modal
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split('T')[0]);
  const [journalDesc, setJournalDesc] = useState('');
  const [journalLines, setJournalLines] = useState<JournalLine[]>([
    { account_id: '', description: '', debit: 0, credit: 0 },
    { account_id: '', description: '', debit: 0, credit: 0 },
  ]);

  // Add Account Modal
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountForm, setAccountForm] = useState<Partial<Account>>({
    account_type: 'Asset',
    current_balance: 0,
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const cId = companyId || '';
    const accList = await dbRepository.getAll<Account>('accounts', cId);
    setAccounts(accList);

    const jeList = await dbRepository.getAll<JournalEntry>('journal_entries', cId);
    setJournalEntries(jeList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

    const tb = await accountingService.getTrialBalance(cId);
    setTrialBalanceRows(tb.rows);
    setTbTotals({ debits: tb.totalDebits, credits: tb.totalCredits });

    const fin = await accountingService.getFinancialSummary(cId);
    setFinancials(fin);
  };

  // Add/Remove lines in Journal modal
  const handleAddLine = () => {
    setJournalLines([...journalLines, { account_id: '', description: '', debit: 0, credit: 0 }]);
  };

  const handleRemoveLine = (idx: number) => {
    if (journalLines.length > 2) {
      setJournalLines(journalLines.filter((_, i) => i !== idx));
    }
  };

  const handleUpdateLine = (idx: number, field: keyof JournalLine, value: any) => {
    const next = [...journalLines];
    next[idx] = { ...next[idx], [field]: value };
    setJournalLines(next);
  };

  const totalModalDebit = journalLines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalModalCredit = journalLines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalModalDebit - totalModalCredit) < 0.001 && totalModalDebit > 0;

  const handlePostJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      alert('Cannot post unbalanced journal entry. Total debits must equal total credits.');
      return;
    }
    const user = authService.getCurrentUser();

    try {
      await accountingService.postJournalEntry({
        company_id: companyId || '',
        entry_date: journalDate,
        description: journalDesc,
        reference_type: 'MANUAL_GENERAL_JOURNAL',
        created_by: user ? user.id : 'usr-admin',
        lines: journalLines,
      });

      setIsJournalModalOpen(false);
      setJournalDesc('');
      setJournalLines([
        { account_id: '', description: '', debit: 0, credit: 0 },
        { account_id: '', description: '', debit: 0, credit: 0 },
      ]);
      await loadData();
      alert('Journal entry posted to General Ledger successfully!');
    } catch (err: any) {
      alert(`Posting rejected: ${err.message}`);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbRepository.insert('accounts', {
        ...accountForm,
        company_id: companyId || '',
        current_balance: Number(accountForm.current_balance || 0),
      });
      setIsAccountModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Save account failed: ${err.message}`);
    }
  };

  // Columns
  const coaColumns: Column<Account>[] = [
    { key: 'account_code', header: 'Account Code' },
    { key: 'account_name', header: 'Account Name' },
    {
      key: 'account_type',
      header: 'Type',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            r.account_type === 'Asset'
              ? 'bg-blue-100 text-blue-800'
              : r.account_type === 'Liability'
              ? 'bg-amber-100 text-amber-800'
              : r.account_type === 'Equity'
              ? 'bg-purple-100 text-purple-800'
              : r.account_type === 'Revenue'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {r.account_type}
        </span>
      ),
    },
    {
      key: 'current_balance',
      header: 'Current Balance',
      render: (r) => <span className="font-mono font-bold">{formatCurrency(r.current_balance || 0)}</span>,
    },
  ];

  const journalColumns: Column<JournalEntry>[] = [
    { key: 'entry_number', header: 'JE Number' },
    { key: 'entry_date', header: 'Date' },
    { key: 'description', header: 'Description' },
    {
      key: 'total_debit',
      header: 'Total Debit',
      render: (r) => <span className="font-mono">{formatCurrency(r.total_debit)}</span>,
    },
    {
      key: 'total_credit',
      header: 'Total Credit',
      render: (r) => <span className="font-mono">{formatCurrency(r.total_credit)}</span>,
    },
    {
      key: 'is_posted',
      header: 'Status',
      render: () => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
          Posted
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Double-Entry Accounting & Financial Reports
          </h1>
          <p className="text-xs text-slate-500">
            Strict debit-credit balance verification, General Ledger, and GAAP financial statements
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('coa')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'coa'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Chart of Accounts
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'journal'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Journal Entries
          </button>
          <button
            onClick={() => setActiveTab('trial_balance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'trial_balance'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Trial Balance
          </button>
          <button
            onClick={() => setActiveTab('statements')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'statements'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            P&L / Balance Sheet
          </button>
        </div>
      </div>

      {activeTab === 'coa' && (
        <DataTable
          title="Chart of Accounts Master"
          subtitle="Assets, Liabilities, Equity, Revenues, and Operating Expenses"
          columns={coaColumns}
          data={accounts}
          onAdd={() => setIsAccountModalOpen(true)}
          addLabel="Add Account"
          searchFields={['account_code', 'account_name', 'account_type']}
          exportFileName="chart_of_accounts"
        />
      )}

      {activeTab === 'journal' && (
        <DataTable
          title="General Journal Entries"
          subtitle="Immutable double-entry records posted to the General Ledger"
          columns={journalColumns}
          data={journalEntries}
          onAdd={() => setIsJournalModalOpen(true)}
          addLabel="Post Journal Entry"
          searchFields={['entry_number', 'description', 'reference_type']}
          exportFileName="general_journal_entries"
        />
      )}

      {activeTab === 'trial_balance' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Trial Balance Statement</h2>
              <p className="text-xs text-slate-500">As of {new Date().toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => exportService.printReport('Trial Balance')}
                className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-slate-50"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button
                onClick={() => exportService.exportToCSV('trial_balance', trialBalanceRows as any)}
                className="px-3 py-1.5 border rounded-lg text-xs font-medium hover:bg-slate-50"
              >
                CSV Export
              </button>
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-2.5 px-3">Account Code</th>
                <th className="py-2.5 px-3">Account Name</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-right">Debit ($)</th>
                <th className="py-2.5 px-3 text-right">Credit ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {trialBalanceRows.map((r) => (
                <tr key={r.account_code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-mono">{r.account_code}</td>
                  <td className="py-2.5 px-3 font-medium">{r.account_name}</td>
                  <td className="py-2.5 px-3 text-slate-400">{r.account_type}</td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {r.debit_balance > 0 ? formatCurrency(r.debit_balance) : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {r.credit_balance > 0 ? formatCurrency(r.credit_balance) : '-'}
                  </td>
                </tr>
              ))}
              {/* Totals Row */}
              <tr className="border-t-2 border-slate-900 dark:border-white font-bold bg-slate-50/80 dark:bg-slate-800/80">
                <td colSpan={3} className="py-3 px-3 uppercase tracking-wider">
                  Total Trial Balance
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-600">
                  {formatCurrency(tbTotals.debits)}
                </td>
                <td className="py-3 px-3 text-right font-mono text-emerald-600">
                  {formatCurrency(tbTotals.credits)}
                </td>
              </tr>
            </tbody>
          </table>

          {Math.abs(tbTotals.debits - tbTotals.credits) < 0.01 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold">
              <Scale className="w-4 h-4 text-emerald-600" />
              Trial Balance is in PERFECT BALANCE: Debits equal Credits.
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 text-rose-800 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              TRIAL BALANCE DISCREPANCY: Out of balance by $
              {Math.abs(tbTotals.debits - tbTotals.credits).toFixed(2)}.
            </div>
          )}
        </div>
      )}

      {activeTab === 'statements' && financials && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income Statement */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b pb-2">
              Income Statement (Profit & Loss)
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Total Operating Revenues</span>
                <span className="font-mono font-bold">{formatCurrency(financials.total_revenue)}</span>
              </div>
              <div className="flex justify-between py-1 border-b text-slate-500">
                <span>Cost of Goods Sold (COGS)</span>
                <span className="font-mono">-{formatCurrency(financials.total_cogs)}</span>
              </div>
              <div className="flex justify-between py-1.5 font-bold text-sm bg-slate-50 dark:bg-slate-800 px-2 rounded">
                <span>Gross Profit</span>
                <span className="font-mono text-indigo-600">{formatCurrency(financials.gross_profit)}</span>
              </div>
              <div className="flex justify-between py-1 border-b text-slate-500">
                <span>Total Operational & Admin Expenses</span>
                <span className="font-mono">-{formatCurrency(financials.total_operating_expenses)}</span>
              </div>
              <div className="flex justify-between py-2 font-black text-base border-t-2 border-slate-900 dark:border-white">
                <span>Net Operating Income</span>
                <span className="font-mono text-emerald-600">{formatCurrency(financials.net_income)}</span>
              </div>
            </div>
          </div>

          {/* Balance Sheet Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white border-b pb-2">
              Balance Sheet Summary
            </h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 font-bold text-sm bg-blue-50 dark:bg-blue-950/40 px-2 rounded text-blue-900 dark:text-blue-300">
                <span>Total Assets</span>
                <span className="font-mono">{formatCurrency(financials.total_assets)}</span>
              </div>
              <div className="flex justify-between py-1.5 font-bold text-sm bg-amber-50 dark:bg-amber-950/40 px-2 rounded text-amber-900 dark:text-amber-300">
                <span>Total Liabilities</span>
                <span className="font-mono">{formatCurrency(financials.total_liabilities)}</span>
              </div>
              <div className="flex justify-between py-1.5 font-bold text-sm bg-purple-50 dark:bg-purple-950/40 px-2 rounded text-purple-900 dark:text-purple-300">
                <span>Total Shareholder Equity</span>
                <span className="font-mono">{formatCurrency(financials.total_equity)}</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-[11px] text-slate-500 mt-4">
                Accounting Equation: Assets = Liabilities + Equity. Real-time updates posted automatically on every purchase, sales order, POS checkout, and manual journal voucher.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post Journal Entry Modal */}
      <Modal
        isOpen={isJournalModalOpen}
        onClose={() => setIsJournalModalOpen(false)}
        title="Post Double-Entry Journal Voucher"
        subtitle="Debit must strictly equal Credit to pass validation"
        maxWidth="2xl"
      >
        <form onSubmit={handlePostJournal} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Voucher Date</label>
              <input
                type="date"
                required
                value={journalDate}
                onChange={(e) => setJournalDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Journal Description</label>
              <input
                type="text"
                required
                value={journalDesc}
                onChange={(e) => setJournalDesc(e.target.value)}
                placeholder="e.g. Month-end Accrual / Depreciation"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Line items table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold">Journal Lines</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                + Add Line
              </button>
            </div>

            <div className="space-y-2">
              {journalLines.map((line, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    required
                    value={line.account_id}
                    onChange={(e) => handleUpdateLine(idx, 'account_id', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Select Account...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_code} - {a.account_name} ({a.account_type})
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Line Description"
                    value={line.description}
                    onChange={(e) => handleUpdateLine(idx, 'description', e.target.value)}
                    className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Debit"
                    value={line.debit || ''}
                    onChange={(e) => handleUpdateLine(idx, 'debit', parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono text-right"
                  />

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Credit"
                    value={line.credit || ''}
                    onChange={(e) => handleUpdateLine(idx, 'credit', parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono text-right"
                  />

                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    disabled={journalLines.length <= 2}
                    className="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Total debit / credit verification footer */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border">
              <span className="font-bold">Total Validation:</span>
              <div className="flex items-center gap-6 font-mono font-bold">
                <span className="text-slate-800 dark:text-slate-200">
                  Debit: ${totalModalDebit.toFixed(2)}
                </span>
                <span className="text-slate-800 dark:text-slate-200">
                  Credit: ${totalModalCredit.toFixed(2)}
                </span>
                <span className={isBalanced ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                  {isBalanced ? 'BALANCED ✓' : `OUT BY $${Math.abs(totalModalDebit - totalModalCredit).toFixed(2)} ✗`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsJournalModalOpen(false)}
              className="px-4 py-2 border rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isBalanced}
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Post to General Ledger
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Account Modal */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title="Add Account to Chart of Accounts"
      >
        <form onSubmit={handleSaveAccount} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Account Code *</label>
              <input
                type="text"
                required
                value={accountForm.account_code || ''}
                onChange={(e) => setAccountForm({ ...accountForm, account_code: e.target.value })}
                placeholder="e.g. 1050 or 6010"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Account Type *</label>
              <select
                value={accountForm.account_type || 'Asset'}
                onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Equity">Equity</option>
                <option value="Revenue">Revenue</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Account Name *</label>
            <input
              type="text"
              required
              value={accountForm.account_name || ''}
              onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })}
              placeholder="e.g. Petty Cash Vault or Cloud Hosting Expense"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(false)}
              className="px-4 py-2 border rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
            >
              Save Account
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
