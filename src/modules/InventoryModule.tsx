import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  ArrowDownUp,
  AlertTriangle,
  History,
  QrCode,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { dbRepository } from '../services/dbRepository';
import { inventoryService } from '../services/inventoryService';
import { Product, ProductCategory, UnitOfMeasure, InventoryTransaction, Warehouse } from '../types';
import { formatCurrency } from '../lib/utils';
import { authService } from '../services/authService';

interface InventoryModuleProps {
  companyId?: string;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ companyId }) => {
  const [activeTab, setActiveTab] = useState<'products' | 'ledger' | 'categories' | 'units'>('products');

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Forms
  const [productForm, setProductForm] = useState<Partial<Product>>({});
  const [adjustForm, setAdjustForm] = useState({
    transaction_type: 'STOCK_IN' as const,
    quantity: 1,
    unit_cost: 0,
    warehouse_id: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const prodList = await dbRepository.getAll<Product>('products', companyId);
    setProducts(prodList);

    const ledgerList = await inventoryService.getStockLedger(companyId);
    setTransactions(ledgerList);

    const catList = await dbRepository.getAll<ProductCategory>('product_categories', companyId);
    setCategories(catList);

    const unitList = await dbRepository.getAll<UnitOfMeasure>('units', companyId);
    setUnits(unitList);

    const whList = await dbRepository.getAll<Warehouse>('warehouses', companyId);
    setWarehouses(whList);
  };

  const handleOpenAddProduct = () => {
    setProductForm({
      company_id: companyId || '',
      type: 'Finished Goods',
      unit_of_measure: 'PCS',
      cost_price: 0,
      selling_price: 0,
      current_stock: 0,
      reorder_point: 10,
      is_active: true,
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dbRepository.insert('products', {
        ...productForm,
        company_id: companyId || '',
        sku: productForm.sku || `SKU-${Date.now().toString().slice(-6)}`,
        current_stock: Number(productForm.current_stock || 0),
        cost_price: Number(productForm.cost_price || 0),
        selling_price: Number(productForm.selling_price || 0),
        reorder_point: Number(productForm.reorder_point || 10),
      });
      setIsProductModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleOpenAdjust = (prod: Product) => {
    setSelectedProduct(prod);
    setAdjustForm({
      transaction_type: 'STOCK_IN',
      quantity: 10,
      unit_cost: prod.cost_price || 0,
      warehouse_id: warehouses[0]?.id || '',
      notes: 'Physical stock reconciliation',
    });
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const user = authService.getCurrentUser();

    try {
      await inventoryService.recordTransaction({
        company_id: companyId || selectedProduct.company_id,
        warehouse_id: adjustForm.warehouse_id,
        product_id: selectedProduct.id,
        transaction_type: adjustForm.transaction_type,
        quantity: Number(adjustForm.quantity),
        unit_cost: Number(adjustForm.unit_cost),
        reference_type: 'MANUAL_ADJUSTMENT',
        notes: adjustForm.notes,
        created_by: user ? user.id : 'system-admin',
      });

      setIsAdjustModalOpen(false);
      await loadData();
      alert('Stock transaction posted to ledger successfully!');
    } catch (err: any) {
      alert(`Stock transaction rejected: ${err.message}`);
    }
  };

  const productColumns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product Name',
      render: (r) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
          <div className="text-[10px] text-slate-400">SKU: {r.sku} • Barcode: {r.barcode || 'N/A'}</div>
        </div>
      ),
    },
    { key: 'type', header: 'Type' },
    {
      key: 'current_stock',
      header: 'On Hand',
      render: (r) => {
        const isLow = (r.current_stock || 0) <= (r.reorder_point || 10);
        return (
          <span
            className={`font-mono font-bold px-2 py-0.5 rounded-md ${
              isLow
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {r.current_stock || 0} {r.unit_of_measure}
          </span>
        );
      },
    },
    {
      key: 'cost_price',
      header: 'Cost Price',
      render: (r) => formatCurrency(r.cost_price || 0),
    },
    {
      key: 'selling_price',
      header: 'Selling Price',
      render: (r) => formatCurrency(r.selling_price || 0),
    },
    {
      key: 'reorder_point',
      header: 'Min Reorder',
      render: (r) => `${r.reorder_point || 0} ${r.unit_of_measure}`,
    },
  ];

  const ledgerColumns: Column<InventoryTransaction>[] = [
    {
      key: 'created_at',
      header: 'Timestamp',
      render: (r) => new Date(r.created_at).toLocaleString(),
    },
    {
      key: 'transaction_type',
      header: 'Type',
      render: (r) => {
        const isPlus = ['STOCK_IN', 'TRANSFER_IN', 'ADJUSTMENT_ADD', 'RETURN'].includes(r.transaction_type);
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isPlus ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}
          >
            {r.transaction_type}
          </span>
        );
      },
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (r) => <span className="font-mono font-bold">{r.quantity}</span>,
    },
    {
      key: 'unit_cost',
      header: 'Unit Cost',
      render: (r) => formatCurrency(r.unit_cost),
    },
    {
      key: 'total_cost',
      header: 'Total Value',
      render: (r) => formatCurrency(r.total_cost),
    },
    {
      key: 'notes',
      header: 'Reference / Notes',
      render: (r) => r.notes || r.reference_type,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Inventory & Stock Ledger
          </h1>
          <p className="text-xs text-slate-500">
            Strict transaction-driven perpetual inventory tracking, valuation, and reorders
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'products'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Products Catalog
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'ledger'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Stock Movement Ledger
          </button>
        </div>
      </div>

      {activeTab === 'products' && (
        <DataTable
          title="Product Master Catalog"
          subtitle="Manage item definitions, barcodes, pricing, and reorder levels"
          columns={productColumns}
          data={products}
          onAdd={handleOpenAddProduct}
          addLabel="Add Product"
          searchFields={['name', 'sku', 'barcode', 'type']}
          exportFileName="storeman_products"
          customActions={(prod) => (
            <button
              onClick={() => handleOpenAdjust(prod)}
              className="p-1 text-slate-500 hover:text-emerald-600 rounded-md hover:bg-slate-100"
              title="Post Stock Transaction / Adjustment"
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
            </button>
          )}
        />
      )}

      {activeTab === 'ledger' && (
        <DataTable
          title="Immutable Stock Movement Ledger"
          subtitle="Audit record of every physical inventory change"
          columns={ledgerColumns}
          data={transactions}
          searchFields={['transaction_type', 'reference_type', 'notes']}
          exportFileName="storeman_stock_ledger"
        />
      )}

      {/* Add Product Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title="Add New Inventory Product"
        maxWidth="xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Product Name *</label>
              <input
                type="text"
                required
                value={productForm.name || ''}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">SKU / Item Code</label>
              <input
                type="text"
                value={productForm.sku || ''}
                onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Auto-generated if blank"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium mb-1">Product Type</label>
              <select
                value={productForm.type || 'Finished Goods'}
                onChange={(e) => setProductForm({ ...productForm, type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="Finished Goods">Finished Goods</option>
                <option value="Raw Material">Raw Material</option>
                <option value="Consumable">Consumable</option>
                <option value="Service">Service</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Unit of Measure</label>
              <select
                value={productForm.unit_of_measure || 'PCS'}
                onChange={(e) => setProductForm({ ...productForm, unit_of_measure: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="PCS">PCS (Pieces)</option>
                <option value="KG">KG (Kilograms)</option>
                <option value="MTR">MTR (Meters)</option>
                <option value="LTR">LTR (Liters)</option>
                <option value="BOX">BOX (Cartons)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Barcode / EAN</label>
              <input
                type="text"
                value={productForm.barcode || ''}
                onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium mb-1">Cost Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={productForm.cost_price || 0}
                onChange={(e) => setProductForm({ ...productForm, cost_price: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Selling Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={productForm.selling_price || 0}
                onChange={(e) => setProductForm({ ...productForm, selling_price: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Reorder Point</label>
              <input
                type="number"
                value={productForm.reorder_point || 10}
                onChange={(e) => setProductForm({ ...productForm, reorder_point: parseInt(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsProductModalOpen(false)}
              className="px-4 py-2 rounded-lg border text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              Save Product
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title={`Stock Transaction: ${selectedProduct?.name}`}
        subtitle={`Current On-Hand Stock: ${selectedProduct?.current_stock || 0} ${selectedProduct?.unit_of_measure}`}
      >
        <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium mb-1">Transaction Type</label>
            <select
              value={adjustForm.transaction_type}
              onChange={(e) => setAdjustForm({ ...adjustForm, transaction_type: e.target.value as any })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="STOCK_IN">Stock IN (Receipt / Surplus)</option>
              <option value="STOCK_OUT">Stock OUT (Issue / Disposal)</option>
              <option value="ADJUSTMENT_ADD">Adjustment ADD (Inventory Count +)</option>
              <option value="ADJUSTMENT_SUB">Adjustment SUB (Damage / Shrinkage -)</option>
              <option value="RETURN">Customer Return (+)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                required
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Warehouse</label>
              <select
                value={adjustForm.warehouse_id}
                onChange={(e) => setAdjustForm({ ...adjustForm, warehouse_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Notes / Reason for Adjustment</label>
            <textarea
              required
              rows={2}
              value={adjustForm.notes}
              onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="px-4 py-2 rounded-lg border text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              Post to Stock Ledger
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
