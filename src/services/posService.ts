/**
 * Point of Sale (POS) Service for STOREMAN ERP
 * Implements atomic end-to-end checkout:
 * POS Sale -> Inventory Reduction -> Sales Order -> Invoice -> Payment -> Accounting JE -> Receipt.
 */

import { POSTransaction, POSRegister, POSCartItem, SalesOrder, Invoice, Payment } from '../types';
import { dbRepository } from './dbRepository';
import { inventoryService } from './inventoryService';
import { accountingService } from './accountingService';
import { generateUUID, generateDocNumber } from '../lib/utils';
import { auditLogger } from '../lib/auditLogger';

class POSService {
  /**
   * Retrieves active open cash register for a given store/cashier.
   */
  async getActiveRegister(companyId: string, storeId: string): Promise<POSRegister | null> {
    const registers = await dbRepository.getAll<POSRegister>('pos_registers', companyId);
    return registers.find((r) => r.store_id === storeId && r.status === 'Open') || null;
  }

  /**
   * Opens a new cash register shift with opening cash balance.
   */
  async openRegister(params: {
    company_id: string;
    store_id: string;
    cashier_id: string;
    opening_balance: number;
  }): Promise<POSRegister> {
    const active = await this.getActiveRegister(params.company_id, params.store_id);
    if (active) {
      return active;
    }

    const register: POSRegister = {
      id: generateUUID(),
      company_id: params.company_id,
      store_id: params.store_id,
      cashier_id: params.cashier_id,
      opened_at: new Date().toISOString(),
      opening_balance: Number(params.opening_balance) || 0,
      cash_sales: 0,
      card_sales: 0,
      transfer_sales: 0,
      total_sales: 0,
      status: 'Open',
    };

    await dbRepository.insert('pos_registers', register);
    return register;
  }

  /**
   * Closes cash register shift and records reconciliation totals.
   */
  async closeRegister(registerId: string, closingBalance: number): Promise<POSRegister> {
    const reg = await dbRepository.getById<POSRegister>('pos_registers', registerId);
    if (!reg) throw new Error('Register not found');

    const updated = await dbRepository.update<POSRegister>('pos_registers', registerId, {
      status: 'Closed',
      closed_at: new Date().toISOString(),
      closing_balance: Number(closingBalance),
    });

    return updated;
  }

  /**
   * Completes atomic POS checkout:
   * 1. Reduces inventory stock for each cart item via Stock Ledger
   * 2. Creates Sales Order record
   * 3. Creates Paid Customer Invoice
   * 4. Creates Payment record
   * 5. Posts balanced Journal Entry to General Ledger (Debit Cash/Bank, Credit POS Revenue & Sales Tax)
   * 6. Updates Cash Register sales metrics
   * 7. Generates POS Transaction Receipt
   */
  async processCheckout(params: {
    company_id: string;
    store_id: string;
    warehouse_id: string;
    register_id: string;
    cashier_id: string;
    customer_id?: string;
    items: POSCartItem[];
    subtotal: number;
    tax_total: number;
    discount_total: number;
    total_amount: number;
    tender_type: 'Cash' | 'Card' | 'Transfer' | 'Split';
    amount_tendered: number;
  }): Promise<POSTransaction> {
    if (!params.items || params.items.length === 0) {
      throw new Error('Cannot complete checkout with an empty cart.');
    }

    const receiptNumber = generateDocNumber('POS-REC');
    const orderNumber = generateDocNumber('SO-POS');
    const invoiceNumber = generateDocNumber('INV-POS');
    const paymentNumber = generateDocNumber('PAY-POS');

    const changeDue = Math.max(0, params.amount_tendered - params.total_amount);

    // 1. Reduce stock for each cart item
    for (const item of params.items) {
      await inventoryService.recordTransaction({
        company_id: params.company_id,
        warehouse_id: params.warehouse_id,
        product_id: item.product.id,
        transaction_type: 'POS_SALE',
        quantity: item.quantity,
        unit_cost: item.product.cost_price || 0,
        reference_type: 'POS_RECEIPT',
        reference_id: receiptNumber,
        notes: `POS checkout at Store ${params.store_id}`,
        created_by: params.cashier_id,
      });
    }

    // 2. Create Sales Order
    const salesOrder: SalesOrder = {
      id: generateUUID(),
      company_id: params.company_id,
      order_number: orderNumber,
      customer_id: params.customer_id || 'walk-in-customer',
      warehouse_id: params.warehouse_id,
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: new Date().toISOString().split('T')[0],
      status: 'Paid',
      subtotal: params.subtotal,
      tax_amount: params.tax_total,
      discount_amount: params.discount_total,
      total_amount: params.total_amount,
      notes: `POS In-Store Checkout: Receipt ${receiptNumber}`,
      items: params.items.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
        delivered_quantity: i.quantity,
        unit_price: i.unit_price,
        tax_rate: i.tax_rate,
        discount: i.discount,
        total: i.total,
      })),
      created_by: params.cashier_id,
      created_at: new Date().toISOString(),
    };
    await dbRepository.insert('sales_orders', salesOrder);

    // 3. Create Paid Customer Invoice
    const invoice: Invoice = {
      id: generateUUID(),
      company_id: params.company_id,
      invoice_number: invoiceNumber,
      type: 'CUSTOMER',
      entity_id: params.customer_id || 'walk-in-customer',
      entity_name: 'POS Walk-in Customer',
      reference_order_id: salesOrder.id,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date().toISOString().split('T')[0],
      status: 'Paid',
      subtotal: params.subtotal,
      tax_amount: params.tax_total,
      discount_amount: params.discount_total,
      total_amount: params.total_amount,
      paid_amount: params.total_amount,
      balance_due: 0,
      items: params.items.map((i) => ({
        description: i.product.name,
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        tax_rate: i.tax_rate,
        total: i.total,
      })),
      created_at: new Date().toISOString(),
    };
    await dbRepository.insert('invoices', invoice);

    // 4. Create Payment record
    const payment: Payment = {
      id: generateUUID(),
      company_id: params.company_id,
      payment_number: paymentNumber,
      invoice_id: invoice.id,
      entity_id: params.customer_id || 'walk-in-customer',
      entity_type: 'Customer',
      payment_date: new Date().toISOString().split('T')[0],
      amount: params.total_amount,
      payment_method: params.tender_type === 'Cash' ? 'Cash' : params.tender_type === 'Card' ? 'Credit Card' : 'Bank Transfer',
      reference_number: receiptNumber,
      notes: `POS Register checkout`,
      created_by: params.cashier_id,
      created_at: new Date().toISOString(),
    };
    await dbRepository.insert('payments', payment);

    // 5. Post Balanced Journal Entry (Debit Cash or Bank, Credit POS Revenue & Sales Tax)
    const accounts = await dbRepository.getAll<{ id: string; account_code: string; account_type: string }>('accounts', params.company_id);
    const cashAcc = accounts.find((a) => a.account_code === (params.tender_type === 'Cash' ? '1010' : '1020')) || accounts[0];
    const revenueAcc = accounts.find((a) => a.account_code === '4020') || accounts.find((a) => a.account_type === 'Revenue') || accounts[0];
    const taxAcc = accounts.find((a) => a.account_code === '2100') || accounts.find((a) => a.account_type === 'Liability') || accounts[0];

    const netSales = Math.round((params.subtotal - params.discount_total) * 100) / 100;
    const tax = Math.round(params.tax_total * 100) / 100;
    const total = Math.round((netSales + tax) * 100) / 100;

    await accountingService.postJournalEntry({
      company_id: params.company_id,
      entry_date: new Date().toISOString().split('T')[0],
      description: `POS Checkout Receipt ${receiptNumber} (${params.tender_type})`,
      reference_type: 'POS_SALE',
      reference_id: receiptNumber,
      created_by: params.cashier_id,
      lines: [
        {
          account_id: cashAcc.id,
          description: `POS Collection (${params.tender_type})`,
          debit: total,
          credit: 0,
        },
        {
          account_id: revenueAcc.id,
          description: 'POS Retail Sales Revenue',
          debit: 0,
          credit: netSales,
        },
        {
          account_id: taxAcc.id,
          description: 'Sales Tax Collected',
          debit: 0,
          credit: tax,
        },
      ],
    });

    // 6. Update Register Sales
    const reg = await dbRepository.getById<POSRegister>('pos_registers', params.register_id);
    if (reg) {
      await dbRepository.update<POSRegister>('pos_registers', reg.id, {
        total_sales: (reg.total_sales || 0) + params.total_amount,
        cash_sales: params.tender_type === 'Cash' ? (reg.cash_sales || 0) + params.total_amount : reg.cash_sales,
        card_sales: params.tender_type === 'Card' ? (reg.card_sales || 0) + params.total_amount : reg.card_sales,
        transfer_sales: params.tender_type === 'Transfer' ? (reg.transfer_sales || 0) + params.total_amount : reg.transfer_sales,
      });
    }

    // 7. Save POS Transaction Receipt
    const transaction: POSTransaction = {
      id: generateUUID(),
      company_id: params.company_id,
      receipt_number: receiptNumber,
      register_id: params.register_id,
      customer_id: params.customer_id,
      cashier_id: params.cashier_id,
      items: params.items,
      subtotal: params.subtotal,
      tax_total: params.tax_total,
      discount_total: params.discount_total,
      total_amount: params.total_amount,
      tender_type: params.tender_type,
      amount_tendered: params.amount_tendered,
      change_due: changeDue,
      timestamp: new Date().toISOString(),
    };

    await dbRepository.insert('pos_transactions', transaction);

    await auditLogger.log({
      userId: params.cashier_id,
      companyId: params.company_id,
      action: 'PAYMENT',
      module: 'POS',
      entityType: 'POS_CHECKOUT',
      entityId: transaction.id,
      newData: { receipt: receiptNumber, total: params.total_amount },
    });

    return transaction;
  }
}

export const posService = new POSService();
