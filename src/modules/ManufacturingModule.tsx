import React, { useState, useEffect } from 'react';
import { Factory, Play, Plus, CheckCircle, Clock } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { dbRepository } from '../services/dbRepository';
import { inventoryService } from '../services/inventoryService';
import { authService } from '../services/authService';
import { BillOfMaterials, WorkOrder, Product } from '../types';
import { formatCurrency, generateDocNumber, generateUUID } from '../lib/utils';

interface ManufacturingModuleProps {
  companyId?: string;
}

export const ManufacturingModule: React.FC<ManufacturingModuleProps> = ({ companyId }) => {
  const [boms, setBoms] = useState<BillOfMaterials[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [activeTab, setActiveTab] = useState<'boms' | 'orders'>('orders');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isBomModalOpen, setIsBomModalOpen] = useState(false);

  // Work Order Form
  const [orderForm, setOrderForm] = useState({
    bom_id: '',
    target_product_id: '',
    quantity_to_produce: 10,
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const cId = companyId || '';
    const bomList = await dbRepository.getAll<BillOfMaterials>('boms', cId);
    setBoms(bomList);

    const woList = await dbRepository.getAll<WorkOrder>('work_orders', cId);
    setWorkOrders(woList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

    const prodList = await dbRepository.getAll<Product>('products', cId);
    setProducts(prodList);
  };

  const handleOpenAddOrder = () => {
    setOrderForm({
      bom_id: boms[0]?.id || '',
      target_product_id: boms[0]?.product_id || products[0]?.id || '',
      quantity_to_produce: 10,
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    });
    setIsOrderModalOpen(true);
  };

  const handleCreateWorkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = authService.getCurrentUser();
    const qty = Number(orderForm.quantity_to_produce);
    const estCost = qty * 125.0;

    try {
      const wo: WorkOrder = {
        id: generateUUID(),
        company_id: companyId || '',
        order_number: generateDocNumber('WO'),
        bom_id: orderForm.bom_id,
        target_product_id: orderForm.target_product_id,
        warehouse_id: 'wh-main-01',
        target_quantity: qty,
        produced_quantity: 0,
        waste_quantity: 0,
        quantity_to_produce: qty,
        quantity_produced: 0,
        status: 'Released',
        start_date: new Date().toISOString().split('T')[0],
        due_date: orderForm.due_date,
        total_cost: 0,
        total_estimated_cost: estCost,
        total_actual_cost: 0,
        materials_consumed: [],
        created_by: user ? user.id : 'usr-admin',
        created_at: new Date().toISOString(),
      };

      await dbRepository.insert('work_orders', wo);
      setIsOrderModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Create work order failed: ${err.message}`);
    }
  };

  // Complete Production Run - credits finished goods stock in Inventory!
  const handleCompleteOrder = async (wo: WorkOrder) => {
    if (wo.status === 'Completed') {
      alert('This production work order is already completed.');
      return;
    }
    const user = authService.getCurrentUser();

    try {
      // 1. Credit finished goods into inventory
      await inventoryService.recordTransaction({
        company_id: wo.company_id,
        warehouse_id: 'wh-main-01',
        product_id: wo.target_product_id,
        transaction_type: 'STOCK_IN',
        quantity: wo.quantity_to_produce || wo.target_quantity || 1,
        unit_cost: 125.0,
        reference_type: 'WORK_ORDER',
        reference_id: wo.order_number,
        notes: `Production completed for WO #${wo.order_number}`,
        created_by: user ? user.id : 'usr-admin',
      });

      // 2. Update Work Order status
      await dbRepository.update<any>('work_orders', wo.id, {
        status: 'Completed',
        quantity_produced: wo.quantity_to_produce || wo.target_quantity || 1,
        total_actual_cost: wo.total_estimated_cost || 0,
      });

      await loadData();
      alert(`Work order #${wo.order_number} completed! ${wo.quantity_to_produce || wo.target_quantity || 1} units credited to finished goods inventory.`);
    } catch (err: any) {
      alert(`Completion failed: ${err.message}`);
    }
  };

  const woColumns: Column<WorkOrder>[] = [
    { key: 'order_number', header: 'WO Number' },
    {
      key: 'target_product_id',
      header: 'Finished Product',
      render: (r) => {
        const p = products.find((prod) => prod.id === r.target_product_id);
        return p ? p.name : 'Target Item';
      },
    },
    { key: 'quantity_to_produce', header: 'Target Qty' },
    { key: 'due_date', header: 'Due Date' },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            r.status === 'Completed'
              ? 'bg-emerald-100 text-emerald-800'
              : r.status === 'In Progress'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'total_estimated_cost',
      header: 'Est. Cost',
      render: (r) => formatCurrency(r.total_estimated_cost),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Manufacturing & Production Orders
          </h1>
          <p className="text-xs text-slate-500">
            Bill of Materials (BOM), Work Orders, Material Consumption, and Finished Goods Intake
          </p>
        </div>
      </div>

      <DataTable
        title="Manufacturing Work Orders"
        subtitle="Active shop-floor production runs, routing steps, and material consumption"
        columns={woColumns}
        data={workOrders}
        onAdd={handleOpenAddOrder}
        addLabel="New Work Order"
        searchFields={['order_number', 'status']}
        exportFileName="work_orders"
        customActions={(wo) =>
          wo.status !== 'Completed' ? (
            <button
              onClick={() => handleCompleteOrder(wo)}
              className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white text-[10px] font-bold transition flex items-center gap-1"
            >
              <CheckCircle className="w-3 h-3" /> Complete Run
            </button>
          ) : (
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
              <CheckCircle className="w-3 h-3" /> Produced
            </span>
          )
        }
      />

      {/* Modal */}
      <Modal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        title="Create Manufacturing Work Order"
      >
        <form onSubmit={handleCreateWorkOrder} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium mb-1">Select Finished Product *</label>
            <select
              required
              value={orderForm.target_product_id}
              onChange={(e) => setOrderForm({ ...orderForm, target_product_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Production Batch Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={orderForm.quantity_to_produce}
                onChange={(e) => setOrderForm({ ...orderForm, quantity_to_produce: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Target Completion Date</label>
              <input
                type="date"
                required
                value={orderForm.due_date}
                onChange={(e) => setOrderForm({ ...orderForm, due_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsOrderModalOpen(false)}
              className="px-4 py-2 border rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
            >
              Release Work Order
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
