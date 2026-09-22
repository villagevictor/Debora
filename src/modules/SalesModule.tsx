import React, { useState, useEffect } from 'react';
import { TrendingUp, FileText, CheckCircle2, Truck, Plus, DollarSign } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { dbRepository } from '../services/dbRepository';
import { inventoryService } from '../services/inventoryService';
import { authService } from '../services/authService';
import { SalesOrder, Contact, Product, Warehouse, Invoice } from '../types';
import { formatCurrency, generateDocNumber, generateUUID } from '../lib/utils';

interface SalesModuleProps {
  companyId?: string;
}

export const SalesModule: React.FC<SalesModuleProps> = ({ companyId }) => {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form
  const [orderForm, setOrderForm] = useState({
    customer_id: '',
    warehouse_id: '',
    product_id: '',
    quantity: 5,
    unit_price: 35.0,
    discount_amount: 0,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const cId = companyId || '';
    const orders = await dbRepository.getAll<SalesOrder>('sales_orders', cId);
    setSalesOrders(orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

    const contacts = await dbRepository.getAll<Contact>('contacts', cId);
    setCustomers(contacts.filter((c) => c.type === 'Customer'));

    const prods = await dbRepository.getAll<Product>('products', cId);
    setProducts(prods);

    const whs = await dbRepository.getAll<Warehouse>('warehouses', cId);
    setWarehouses(whs);
  };

  const handleOpenCreate = () => {
    setOrderForm({
      customer_id: customers[0]?.id || '',
      warehouse_id: warehouses[0]?.id || '',
      product_id: products[0]?.id || '',
      quantity: 5,
      unit_price: products[0]?.selling_price || 45,
      discount_amount: 0,
      notes: 'Standard corporate sales contract',
    });
    setIsModalOpen(true);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = authService.getCurrentUser();
    const qty = Number(orderForm.quantity);
    const price = Number(orderForm.unit_price);
    const subtotal = qty * price;
    const tax = Math.round(subtotal * 0.0825 * 100) / 100;
    const total = subtotal + tax - Number(orderForm.discount_amount);

    try {
      const newOrder: SalesOrder = {
        id: generateUUID(),
        company_id: companyId || '',
        order_number: generateDocNumber('SO'),
        customer_id: orderForm.customer_id,
        warehouse_id: orderForm.warehouse_id,
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        status: 'Draft',
        subtotal,
        tax_amount: tax,
        discount_amount: Number(orderForm.discount_amount),
        total_amount: total,
        items: [
          {
            product_id: orderForm.product_id,
            quantity: qty,
            delivered_quantity: 0,
            unit_price: price,
            tax_rate: 8.25,
            discount: 0,
            total,
          },
        ],
        notes: orderForm.notes,
        created_by: user ? user.id : 'usr-admin',
        created_at: new Date().toISOString(),
      };

      await dbRepository.insert('sales_orders', newOrder);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Save sales order failed: ${err.message}`);
    }
  };

  // Dispatch & Deliver action (Delivery Note + Stock Reduction)
  const handleDeliverOrder = async (order: SalesOrder) => {
    if (order.status === 'Delivered' || order.status === 'Paid') {
      alert('This sales order has already been fulfilled and dispatched.');
      return;
    }
    const user = authService.getCurrentUser();

    try {
      for (const item of order.items) {
        await inventoryService.recordTransaction({
          company_id: order.company_id,
          warehouse_id: order.warehouse_id,
          product_id: item.product_id,
          transaction_type: 'STOCK_OUT',
          quantity: item.quantity,
          unit_cost: item.unit_price,
          reference_type: 'DELIVERY_NOTE',
          reference_id: order.order_number,
          notes: `Goods dispatched for Sales Order #${order.order_number}`,
          created_by: user ? user.id : 'usr-admin',
        });
      }

      await dbRepository.update<SalesOrder>('sales_orders', order.id, {
        status: 'Delivered',
        items: order.items.map((i) => ({ ...i, delivered_quantity: i.quantity })),
      });

      await loadData();
      alert(`Sales order #${order.order_number} marked as Delivered! Inventory debited.`);
    } catch (err: any) {
      alert(`Dispatch failed: ${err.message}`);
    }
  };

  const columns: Column<SalesOrder>[] = [
    { key: 'order_number', header: 'Order Number' },
    {
      key: 'customer_id',
      header: 'Customer',
      render: (r) => {
        const c = customers.find((cust) => cust.id === r.customer_id);
        return c ? c.name : 'Walk-in / Client';
      },
    },
    { key: 'order_date', header: 'Date' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            r.status === 'Paid' || r.status === 'Delivered'
              ? 'bg-emerald-100 text-emerald-800'
              : r.status === 'Confirmed'
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
      header: 'Total Order Value',
      render: (r) => <span className="font-mono font-bold">{formatCurrency(r.total_amount)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Commercial Sales & Customer Orders
          </h1>
          <p className="text-xs text-slate-500">
            Pipeline: Quotations, Sales Orders, Warehouse Fulfillment, and Customer Invoices
          </p>
        </div>
      </div>

      <DataTable
        title="Sales Orders Master"
        subtitle="Manage customer orders, discounts, and dispatch fulfillment"
        columns={columns}
        data={salesOrders}
        onAdd={handleOpenCreate}
        addLabel="Create Sales Order"
        searchFields={['order_number', 'status', 'notes']}
        exportFileName="sales_orders"
        customActions={(order) =>
          order.status !== 'Delivered' && order.status !== 'Paid' ? (
            <button
              onClick={() => handleDeliverOrder(order)}
              className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white text-[10px] font-bold transition flex items-center gap-1"
              title="Dispatch & Deliver"
            >
              <Truck className="w-3 h-3" /> Fulfill
            </button>
          ) : (
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" /> Fulfilled
            </span>
          )
        }
      />

      {/* Create Order Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Commercial Sales Order"
      >
        <form onSubmit={handleSaveOrder} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Customer Client *</label>
              <select
                required
                value={orderForm.customer_id}
                onChange={(e) => setOrderForm({ ...orderForm, customer_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.company_name || 'Individual'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Fulfillment Warehouse *</label>
              <select
                required
                value={orderForm.warehouse_id}
                onChange={(e) => setOrderForm({ ...orderForm, warehouse_id: e.target.value })}
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
              <label className="block font-medium mb-1">Catalog Product *</label>
              <select
                required
                value={orderForm.product_id}
                onChange={(e) => {
                  const p = products.find((prod) => prod.id === e.target.value);
                  setOrderForm({
                    ...orderForm,
                    product_id: e.target.value,
                    unit_price: p?.selling_price || orderForm.unit_price,
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
              <label className="block font-medium mb-1">Order Quantity</label>
              <input
                type="number"
                min="1"
                required
                value={orderForm.quantity}
                onChange={(e) => setOrderForm({ ...orderForm, quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Unit Selling Price ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={orderForm.unit_price}
                onChange={(e) => setOrderForm({ ...orderForm, unit_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Special Delivery / Contract Notes</label>
            <textarea
              rows={2}
              value={orderForm.notes}
              onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
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
              Create Sales Order
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
