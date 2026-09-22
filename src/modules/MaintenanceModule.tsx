import React, { useState, useEffect } from 'react';
import { Wrench, AlertCircle, CheckCircle, Plus } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { dbRepository } from '../services/dbRepository';
import { Machine } from '../types';
import { generateUUID } from '../lib/utils';

interface MaintenanceModuleProps {
  companyId?: string;
}

export const MaintenanceModule: React.FC<MaintenanceModuleProps> = ({ companyId }) => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    name: '',
    serial_number: '',
    model: '',
    location: '',
    status: 'Operational' as const,
    preventive_interval_days: 30,
  });

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const cId = companyId || '';
    const mList = await dbRepository.getAll<Machine>('machines', cId);
    setMachines(mList);
  };

  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const nextService = new Date(Date.now() + Number(form.preventive_interval_days) * 86400000)
        .toISOString()
        .split('T')[0];

      const newM: Machine = {
        id: generateUUID(),
        company_id: companyId || '',
        asset_tag: `EQ-${Date.now().toString().slice(-4)}`,
        code: `EQ-${Date.now().toString().slice(-4)}`,
        name: form.name,
        serial_number: form.serial_number,
        model: form.model,
        location: form.location,
        status: form.status,
        last_maintenance: new Date().toISOString().split('T')[0],
        next_maintenance: nextService,
        created_at: new Date().toISOString(),
      };

      await dbRepository.insert('machines', newM);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Save equipment failed: ${err.message}`);
    }
  };

  const handleLogService = async (machine: Machine) => {
    const nextDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    await dbRepository.update('machines', machine.id, {
      status: 'Operational',
      last_maintenance: new Date().toISOString().split('T')[0],
      next_maintenance: nextDate,
    });
    await loadData();
    alert(`Preventive maintenance logged for ${machine.name}. Status reset to Operational.`);
  };

  const columns: Column<Machine>[] = [
    {
      key: 'name',
      header: 'Machinery / Asset',
      render: (r) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
          <div className="text-[10px] text-slate-400">
            Model: {r.model} • SN: {r.serial_number}
          </div>
        </div>
      ),
    },
    { key: 'code', header: 'Asset Code' },
    { key: 'location', header: 'Facility Location' },
    {
      key: 'status',
      header: 'Condition',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            r.status === 'Operational'
              ? 'bg-emerald-100 text-emerald-800'
              : r.status === 'Maintenance' || r.status === 'Under Maintenance'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {r.status}
        </span>
      ),
    },
    { key: 'last_maintenance', header: 'Last Service' },
    { key: 'next_maintenance', header: 'Next PM Due' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Machinery & Preventive Maintenance
          </h1>
          <p className="text-xs text-slate-500">
            Equipment catalog, scheduled PM intervals, downtime logs, and service history
          </p>
        </div>
      </div>

      <DataTable
        title="Industrial Equipment Master"
        subtitle="Operational status and preventive maintenance calendar"
        columns={columns}
        data={machines}
        onAdd={() => setIsModalOpen(true)}
        addLabel="Register Machine"
        searchFields={['name', 'asset_tag', 'serial_number', 'model']}
        exportFileName="machinery_catalog"
        customActions={(m) => (
          <button
            onClick={() => handleLogService(m)}
            className="px-2 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-600 hover:text-white text-[10px] font-bold transition flex items-center gap-1"
            title="Log PM Service Completed"
          >
            <Wrench className="w-3 h-3" /> Log Service
          </button>
        )}
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register Industrial Machinery"
      >
        <form onSubmit={handleSaveMachine} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Equipment Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. CNC Milling Center 4-Axis"
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
              <label className="block font-medium mb-1">Model / Maker</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Floor Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Bay 4 - Assembly Line"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
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
              Save Equipment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
