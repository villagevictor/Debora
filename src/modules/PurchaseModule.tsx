import React, { useState, useEffect } from 'react';
import { ShoppingCart, FileCheck, Truck, Plus, CheckCircle2, ArrowRight } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { dbRepository } from '../services/dbRepository';
import { inventoryService } from '../services/inventoryService';
import { authService } from '../services/authService';
import { PurchaseOrder, Contact, Product, Warehouse } from '../types';
import { formatCurrency, generateDocNumber, generateUUID } from '../lib/utils';

interface PurchaseModuleProps {
  companyId?: string;
}

export const PurchaseModule: React.FC<PurchaseModuleProps> = ({ companyId }) => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Form
  const [poForm, setPoForm] = useState({
    supplier_id: '',
    warehouse_id: '',
    product_id: '',
    quantity: 10,
    unit_price: 15.0,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const cId = companyId || '';
    const poList = await dbRepository.getAll<PurchaseOrder>('purchase_orders', cId);
    setPurchaseOrders(poList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

    const contacts = await dbRepository.getAll<Contact>('contacts', cId);
    setSuppliers(contacts.filter((c) => c.type === 'Supplier'));

    const prods = await dbRepository.getAll<Product>('products', cId);
    setProducts(prods);

    const whs = await dbRepository.getAll<Warehouse>('warehouses', cId);
    setWarehouses(whs);
  };

  const handleOpenCreate = () => {
    setPoForm({
      supplier_id: suppliers[0]?.id || '',
      warehouse_id: warehouses[0]?.id || '',
      product_id: products[0]?.id || '',
      quantity: 50,
      unit_price: products[0]?.cost_price || 25,
      notes: 'Standard replenishment order',
    });
    setIsModalOpen(true);
  };

  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = authService.getCurrentUser();
    const qty = Number(poForm.quantity);
    const price = Number(poForm.unit_price);
    const subtotal = qty * price;
    const tax = Math.round(subtotal * 0.0825 * 100) / 100;
    const total = subtotal + tax;
    const docNum = generateDocNumber('PO');

    try {
      const newPO: PurchaseOrder = {
        id: generateUUID(),
        company_id: companyId || '',
        po_number: docNum,
        order_number: docNum,
        supplier_id: poForm.supplier_id,
        warehouse_id: poForm.warehouse_id,
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        status: 'Draft',
        subtotal,
        tax_amount: tax,
        discount_amount: 0,
        total_amount: total,
        payment_terms: 'Net 30',
        approval_status: 'Approved',
        items: [
          {
            product_id: poForm.product_id,
            quantity: qty,
            received_quantity: 0,
            unit_price: price,
            tax_rate: 8.25,
            discount: 0,
            total,
          },
        ],
        notes: poForm.notes,
        created_by: user ? user.id : 'usr-admin',
        created_at: new Date().toISOString(),
      };

      await dbRepository.insert('purchase_orders', newPO);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Save PO failed: ${err.message}`);
    }
  };

  // Goods Receipt Note (GRN) action - increments inventory stock ledger!
  const handleReceiveGoods = async (po: PurchaseOrder) => {
    if (po.status === 'Received') {
      alert('This Purchase Order has already been fully received.');
      return;
    }
    const user = authService.getCurrentUser();
    const refNum = po.po_number || po.order_number || po.id;

    try {
      for (const item of po.items) {
        await inventoryService.recordTransaction({
          company_id: po.company_id,
          warehouse_id: po.warehouse_id,
          product_id: item.product_id,
          transaction_type: 'STOCK_IN',
          quantity: item.quantity,
          unit_cost: item.unit_price,
          reference_type: 'GOODS_RECEIPT_NOTE',
          reference_id: refNum,
          notes: `GRN received for PO #${refNum}`,
          created_by: user ? user.id : 'usr-admin',
        });
      }

      await dbRepository.update<PurchaseOrder>('purchase_orders', po.id, {
        status: 'Received',
        items: po.items.map((i) => ({ ...i, received_quantity: i.quantity })),
      });

      await loadData();
      alert(`PO #${refNum} received! Inventory stock balances have been credited.`);
    } catch (err: any) {
      alert(`GRN reception failed: ${err.message}`);
    }
  };

  const columns: Column<PurchaseOrder>[] = [
    { key: 'po_number', header: 'PO Number' },
    {
      key: 'supplier_id',
      header: 'Supplier',
      render: (r) => {
        const s = suppliers.find((sup) => sup.id === r.supplier_id);
        return s ? s.name : 'Vendor';
      },
    },
    { key: 'order_date', header: 'Date' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            r.status === 'Received'
              ? 'bg-emerald-100 text-emerald-800'
              : r.status === 'Ordered'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'total_amount',
      header: 'Total Amount',
      render: (r) => <span className="font-mono font-bold">{formatCurrency(r.total_amount)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Procurement & Purchase Orders
          </h1>
          <p className="text-xs text-slate-500">
            Lifecycle tracking: Purchase Orders, Three-Way Matching, and Goods Receipt Notes (GRN)
          </p>
        </div>
      </div>

      <DataTable
        title="Purchase Orders Master"
        subtitle="Manage procurement lifecycles and trigger stock delivery confirmations"
        columns={columns}
        data={purchaseOrders}
        onAdd={handleOpenCreate}
        addLabel="Create Purchase Order"
        searchFields={['po_number', 'status', 'notes']}
        exportFileName="purchase_orders"
        customActions={(po) =>
          po.status !== 'Received' ? (
            <button
              onClick={() => handleReceiveGoods(po)}
              className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white text-[10px] font-bold transition flex items-center gap-1"
              title="Receive Goods (GRN)"
            >
              <Truck className="w-3 h-3" /> Receive Goods
            </button>
          ) : (
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> In Stock
            </span>
          )
        }
      />

      {/* Create PO Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Issue New Purchase Order"
      >
        <form onSubmit={handleSavePO} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Supplier *</label>
              <select
                required
                value={poForm.supplier_id}
                onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.company_name || 'Vendor'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Target Warehouse *</label>
              <select
                required
                value={poForm.warehouse_id}
                onChange={(e) => setPoForm({ ...poForm, warehouse_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block font-medium mb-1">Product Item *</label>
              <select
                required
                value={poForm.product_id}
                onChange={(e) => {
                  const p = products.find((prod) => prod.id === e.target.value);
                  setPoForm({
                    ...poForm,
                    product_id: e.target.value,
                    unit_price: p?.cost_price || poForm.unit_price,
                  });
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                required
                value={poForm.quantity}
                onChange={(e) => setPoForm({ ...poForm, quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Agreed Unit Cost ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={poForm.unit_price}
                onChange={(e) => setPoForm({ ...poForm, unit_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Purchase Notes / Delivery Terms</label>
            <textarea
              rows={2}
              value={poForm.notes}
              onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
            >
              Issue Purchase Order
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
