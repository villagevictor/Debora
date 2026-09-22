/**
 * Double-Entry Accounting Service for STOREMAN ERP
 * Strictly enforces TOTAL DEBIT === TOTAL CREDIT, General Ledger posting,
 * Chart of Accounts, and real-time Financial Statement generation.
 */

import { Account, JournalEntry, JournalLine, Invoice, Payment, Expense } from '../types';
import { dbRepository } from './dbRepository';
import { generateUUID, generateDocNumber } from '../lib/utils';
import { auditLogger } from '../lib/auditLogger';

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  account_type: string;
  debit_balance: number;
  credit_balance: number;
}

export interface FinancialStatementSummary {
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  total_operating_expenses: number;
  net_income: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
}

class AccountingService {
  /**
   * Strictly validates and posts a double-entry journal transaction.
   * Throws an error if Debits != Credits.
   */
  async postJournalEntry(params: {
    company_id: string;
    entry_date: string;
    description: string;
    reference_type: string;
    reference_id?: string;
    created_by: string;
    lines: JournalLine[];
  }): Promise<JournalEntry> {
    if (!params.lines || params.lines.length < 2) {
      throw new Error('A valid journal entry must contain at least 2 lines (debit and credit).');
    }

    // Calculate total debits and credits with floating-point tolerance
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of params.lines) {
      totalDebit += Number(line.debit || 0);
      totalCredit += Number(line.credit || 0);
    }

    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;

    if (Math.abs(roundedDebit - roundedCredit) > 0.001) {
      throw new Error(
        `UNBALANCED JOURNAL ENTRY REJECTED: Total Debits ($${roundedDebit.toFixed(2)}) must exactly equal Total Credits ($${roundedCredit.toFixed(2)}).`
      );
    }

    const entryId = generateUUID();
    const entryNumber = generateDocNumber('JE');

    const entry: JournalEntry = {
      id: entryId,
      company_id: params.company_id,
      entry_number: entryNumber,
      entry_date: params.entry_date,
      reference_type: params.reference_type,
      reference_id: params.reference_id,
      description: params.description,
      lines: params.lines,
      total_debit: roundedDebit,
      total_credit: roundedCredit,
      is_posted: true,
      created_by: params.created_by,
      created_at: new Date().toISOString(),
    };

    // Save journal entry
    await dbRepository.insert('journal_entries', entry);

    // Update account balances in the Chart of Accounts
    const accounts = await dbRepository.getAll<Account>('accounts', params.company_id);
    for (const line of params.lines) {
      const acc = accounts.find((a) => a.id === line.account_id);
      if (acc) {
        let balanceChange = 0;
        // Asset & Expense accounts increase with Debit, decrease with Credit
        if (acc.account_type === 'Asset' || acc.account_type === 'Expense') {
          balanceChange = Number(line.debit) - Number(line.credit);
        } else {
          // Liability, Equity, Revenue accounts increase with Credit, decrease with Debit
          balanceChange = Number(line.credit) - Number(line.debit);
        }
        await dbRepository.update<Account>('accounts', acc.id, {
          current_balance: Math.round(((acc.current_balance || 0) + balanceChange) * 100) / 100,
        });
      }
    }

    await auditLogger.log({
      userId: params.created_by,
      companyId: params.company_id,
      action: 'CREATE',
      module: 'ACCOUNTING',
      entityType: 'JOURNAL_ENTRY',
      entityId: entryId,
      newData: { entry_number: entryNumber, total_amount: roundedDebit },
    });

    return entry;
  }

  /**
   * Generates real-time Trial Balance report directly from posted journal lines.
   */
  async getTrialBalance(companyId: string): Promise<{ rows: TrialBalanceRow[]; totalDebits: number; totalCredits: number }> {
    const accounts = await dbRepository.getAll<Account>('accounts', companyId);
    const rows: TrialBalanceRow[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const acc of accounts) {
      const balance = acc.current_balance || 0;
      let debit = 0;
      let credit = 0;

      if (acc.account_type === 'Asset' || acc.account_type === 'Expense') {
        if (balance >= 0) debit = balance;
        else credit = Math.abs(balance);
      } else {
        if (balance >= 0) credit = balance;
        else debit = Math.abs(balance);
      }

      totalDebits += debit;
      totalCredits += credit;

      rows.push({
        account_code: acc.account_code,
        account_name: acc.account_name,
        account_type: acc.account_type,
        debit_balance: debit,
        credit_balance: credit,
      });
    }

    return {
      rows: rows.sort((a, b) => a.account_code.localeCompare(b.account_code)),
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
    };
  }

  /**
   * Calculates comprehensive Profit & Loss and Balance Sheet figures.
   */
  async getFinancialSummary(companyId: string): Promise<FinancialStatementSummary> {
    const accounts = await dbRepository.getAll<Account>('accounts', companyId);

    let totalRevenue = 0;
    let totalCogs = 0;
    let totalOperatingExpenses = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const acc of accounts) {
      const bal = acc.current_balance || 0;
      if (acc.account_type === 'Revenue') {
        totalRevenue += bal;
      } else if (acc.account_type === 'Expense') {
        if (acc.sub_type === 'Direct Expense' || acc.account_code.startsWith('50')) {
          totalCogs += bal;
        } else {
          totalOperatingExpenses += bal;
        }
      } else if (acc.account_type === 'Asset') {
        totalAssets += bal;
      } else if (acc.account_type === 'Liability') {
        totalLiabilities += bal;
      } else if (acc.account_type === 'Equity') {
        totalEquity += bal;
      }
    }

    const grossProfit = totalRevenue - totalCogs;
    const netIncome = grossProfit - totalOperatingExpenses;

    return {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_cogs: Math.round(totalCogs * 100) / 100,
      gross_profit: Math.round(grossProfit * 100) / 100,
      total_operating_expenses: Math.round(totalOperatingExpenses * 100) / 100,
      net_income: Math.round(netIncome * 100) / 100,
      total_assets: Math.round(totalAssets * 100) / 100,
      total_liabilities: Math.round(totalLiabilities * 100) / 100,
      total_equity: Math.round(totalEquity * 100) / 100,
    };
  }
}

export const accountingService = new AccountingService();
