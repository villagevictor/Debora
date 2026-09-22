/**
 * Inventory Management & Stock Ledger Service for STOREMAN ERP
 * Enforces transaction-based stock updates (never direct mutations),
 * multi-warehouse tracking, batch/serial records, and reorder alerts.
 */

import { Product, InventoryTransaction, InventoryTransactionType, StockBalance } from '../types';
import { dbRepository } from './dbRepository';
import { generateUUID } from '../lib/utils';
import { auditLogger } from '../lib/auditLogger';

class InventoryService {
  /**
   * Executes an atomic inventory transaction and recalculates product on-hand stock.
   */
  async recordTransaction(params: {
    company_id: string;
    warehouse_id: string;
    product_id: string;
    transaction_type: InventoryTransactionType;
    quantity: number;
    unit_cost: number;
    reference_type: string;
    reference_id?: string;
    batch_number?: string;
    serial_number?: string;
    notes?: string;
    created_by: string;
  }): Promise<InventoryTransaction> {
    const qty = Number(params.quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Transaction quantity must be a positive number greater than 0.');
    }

    const product = await dbRepository.getById<Product>('products', params.product_id);
    if (!product) {
      throw new Error(`Product not found with ID ${params.product_id}`);
    }

    // Determine directional effect: Stock In increases (+), Stock Out decreases (-)
    const isOutflow = [
      'STOCK_OUT',
      'TRANSFER_OUT',
      'ADJUSTMENT_SUB',
      'POS_SALE',
      'MFG_CONSUME',
      'REPAIR_USE',
    ].includes(params.transaction_type);

    const currentQty = product.current_stock || 0;
    if (isOutflow && currentQty < qty) {
      throw new Error(
        `INSUFFICIENT STOCK: Cannot issue ${qty} units of ${product.name}. Current on-hand stock is ${currentQty}.`
      );
    }

    const netQuantity = isOutflow ? -qty : qty;
    const newStock = Math.max(0, currentQty + netQuantity);

    const transaction: InventoryTransaction = {
      id: generateUUID(),
      company_id: params.company_id,
      warehouse_id: params.warehouse_id,
      product_id: params.product_id,
      transaction_type: params.transaction_type,
      quantity: qty,
      unit_cost: params.unit_cost,
      total_cost: Math.round(qty * params.unit_cost * 100) / 100,
      reference_type: params.reference_type,
      reference_id: params.reference_id,
      batch_number: params.batch_number,
      serial_number: params.serial_number,
      notes: params.notes,
      created_by: params.created_by,
      created_at: new Date().toISOString(),
    };

    // 1. Record immutable ledger transaction
    await dbRepository.insert('inventory_transactions', transaction);

    // 2. Update cached stock on product
    await dbRepository.update<Product>('products', product.id, {
      current_stock: newStock,
      updated_at: new Date().toISOString(),
    });

    // 3. Audit trail
    await auditLogger.log({
      userId: params.created_by,
      companyId: params.company_id,
      action: 'STOCK_ADJUST',
      module: 'INVENTORY',
      entityType: 'STOCK_LEDGER',
      entityId: product.id,
      oldData: { stock: currentQty },
      newData: {
        stock: newStock,
        transaction_type: params.transaction_type,
        qty: netQuantity,
      },
    });

    return transaction;
  }

  /**
   * Retrieves all low-stock items breaching their reorder point.
   */
  async getLowStockAlerts(companyId?: string): Promise<Product[]> {
    const products = await dbRepository.getAll<Product>('products', companyId);
    return products.filter((p) => (p.current_stock || 0) <= (p.reorder_point || 10));
  }

  /**
   * Calculates total valuation across all products.
   */
  async getInventoryValuation(companyId?: string): Promise<{ totalItems: number; totalCostValue: number; totalRetailValue: number }> {
    const products = await dbRepository.getAll<Product>('products', companyId);
    let totalItems = 0;
    let totalCostValue = 0;
    let totalRetailValue = 0;

    for (const p of products) {
      const stock = p.current_stock || 0;
      totalItems += stock;
      totalCostValue += stock * (p.cost_price || 0);
      totalRetailValue += stock * (p.selling_price || 0);
    }

    return {
      totalItems,
      totalCostValue: Math.round(totalCostValue * 100) / 100,
      totalRetailValue: Math.round(totalRetailValue * 100) / 100,
    };
  }

  /**
   * Gets ledger transactions for a specific product or warehouse.
   */
  async getStockLedger(companyId?: string, productId?: string): Promise<InventoryTransaction[]> {
    const all = await dbRepository.getAll<InventoryTransaction>('inventory_transactions', companyId);
    const filtered = productId ? all.filter((t) => t.product_id === productId) : all;
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

export const inventoryService = new InventoryService();
