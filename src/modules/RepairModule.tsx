import React, { useState, useEffect } from 'react';
import { Hammer, Clock, CheckCircle2, Plus, DollarSign } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { dbRepository } from '../services/dbRepository';
import { RepairTicket, Contact } from '../types';
import { formatCurrency, generateDocNumber, generateUUID } from '../lib/utils';

interface RepairModuleProps {
  companyId?: string;
}

export const RepairModule: React.FC<RepairModuleProps> = ({ companyId }) => {
  const [tickets, setTickets] = useState<RepairTicket[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    customer_id: '',
    item_name: '',
    serial_number: '',
    problem_description: '',
    warranty_status: 'Under Warranty' as const,
    estimated_cost: 150,
  });

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const cId = companyId || '';
    const tList = await dbRepository.getAll<RepairTicket>('repair_tickets', cId);
    setTickets(tList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));

    const cList = await dbRepository.getAll<Contact>('contacts', cId);
    setCustomers(cList.filter((c) => c.type === 'Customer'));
  };

  const handleSaveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const docNum = generateDocNumber('RPR');
    try {
      const newTicket: RepairTicket = {
        id: generateUUID(),
        company_id: companyId || '',
        repair_number: docNum,
        type: 'Customer',
        ticket_number: docNum,
        customer_id: form.customer_id,
        item_name: form.item_name,
        serial_number: form.serial_number,
        problem_description: form.problem_description,
        warranty_status: form.warranty_status,
        status: 'Received',
        estimated_cost: Number(form.estimated_cost),
        created_at: new Date().toISOString(),
      };

      await dbRepository.insert('repair_tickets', newTicket);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Create ticket failed: ${err.message}`);
    }
  };

  const handleAdvanceStatus = async (ticket: RepairTicket) => {
    const nextStatus =
      ticket.status === 'Received'
        ? 'Diagnosing'
        : ticket.status === 'Diagnosing'
        ? 'In Repair'
        : ticket.status === 'In Repair'
        ? 'Ready'
        : 'Delivered';

    await dbRepository.update<RepairTicket>('repair_tickets', ticket.id, { status: nextStatus });
    await loadData();
  };

  const columns: Column<RepairTicket>[] = [
    { key: 'ticket_number', header: 'Ticket #' },
    {
      key: 'item_name',
      header: 'Device / Equipment Item',
      render: (r) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white">{r.item_name}</div>
          <div className="text-[10px] text-slate-400">SN: {r.serial_number}</div>
        </div>
      ),
    },
    {
      key: 'warranty_status',
      header: 'Warranty',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            r.warranty_status === 'Under Warranty'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-800'
          }`}
        >
          {r.warranty_status}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Repair Stage',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            r.status === 'Ready' || r.status === 'Delivered'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'estimated_cost',
      header: 'Est. Cost',
      render: (r) => <span className="font-mono">{formatCurrency(r.estimated_cost)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Repair Services & Warranty Center
          </h1>
          <p className="text-xs text-slate-500">
            Customer RMA tickets, diagnostic inspections, spare parts used, labor, and warranty claims
          </p>
        </div>
      </div>

      <DataTable
        title="Repair Tickets Queue"
        subtitle="Manage customer intake, diagnostics, and repairs"
        columns={columns}
        data={tickets}
        onAdd={() => setIsModalOpen(true)}
        addLabel="New Repair Ticket"
        searchFields={['ticket_number', 'item_name', 'serial_number', 'status']}
        exportFileName="repair_tickets"
        customActions={(t) =>
          t.status !== 'Delivered' && (
            <button
              onClick={() => handleAdvanceStatus(t)}
              className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white text-[10px] font-bold transition"
            >
              Advance Stage →
            </button>
          )
        }
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Intake New Repair Ticket"
      >
        <form onSubmit={handleSaveTicket} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium mb-1">Customer Client</label>
            <select
              value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.company_name || 'Individual'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Item / Device Description *</label>
              <input
                type="text"
                required
                value={form.item_name}
                onChange={(e) => setForm({ ...form, item_name: e.target.value })}
                placeholder="e.g. Servo Motor Inverter 45kW"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Serial Number *</label>
              <input
                type="text"
                required
                value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Warranty Status</label>
              <select
                value={form.warranty_status}
                onChange={(e) => setForm({ ...form, warranty_status: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="Under Warranty">Under Warranty (Free Repair)</option>
                <option value="Out of Warranty">Out of Warranty (Billable)</option>
                <option value="Extended AMC">Extended AMC Contract</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Estimated Repair Quote ($)</label>
              <input
                type="number"
                value={form.estimated_cost}
                onChange={(e) => setForm({ ...form, estimated_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Reported Defect / Symptoms</label>
            <textarea
              required
              rows={2}
              value={form.problem_description}
              onChange={(e) => setForm({ ...form, problem_description: e.target.value })}
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
              Create Ticket
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
