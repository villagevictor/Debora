import React, { useState, useEffect } from 'react';
import { Truck, Fuel, Gauge, Plus } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { dbRepository } from '../services/dbRepository';
import { Vehicle } from '../types';
import { generateUUID } from '../lib/utils';

interface FleetModuleProps {
  companyId?: string;
}

export const FleetModule: React.FC<FleetModuleProps> = ({ companyId }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    plate_number: '',
    model: '',
    driver_name: '',
    odometer: 10000,
    status: 'Available' as const,
  });

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const cId = companyId || '';
    const vList = await dbRepository.getAll<Vehicle>('vehicles', cId);
    setVehicles(vList);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newV: Vehicle = {
        id: generateUUID(),
        company_id: companyId || '',
        plate_number: form.plate_number.toUpperCase(),
        make_model: form.model,
        model: form.model,
        driver_name: form.driver_name,
        mileage: Number(form.odometer) || 0,
        odometer: Number(form.odometer) || 0,
        year: new Date().getFullYear(),
        fuel_type: 'Diesel',
        insurance_expiry: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        status: form.status,
      };

      await dbRepository.insert('vehicles', newV);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Save vehicle failed: ${err.message}`);
    }
  };

  const columns: Column<Vehicle>[] = [
    {
      key: 'plate_number',
      header: 'License Plate',
      render: (r) => <span className="font-mono font-bold tracking-wider">{r.plate_number}</span>,
    },
    { key: 'make_model', header: 'Vehicle Make & Model', render: (r) => r.make_model || r.model || '' },
    { key: 'driver_name', header: 'Assigned Driver' },
    {
      key: 'mileage',
      header: 'Odometer (km)',
      render: (r) => `${(r.odometer ?? r.mileage ?? 0).toLocaleString()} km`,
    },
    {
      key: 'status',
      header: 'Logistics Status',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            r.status === 'Available'
              ? 'bg-emerald-100 text-emerald-800'
              : r.status === 'Dispatched'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          {r.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Logistics Fleet & Transportation
          </h1>
          <p className="text-xs text-slate-500">
            Delivery trucks, transport vans, driver allocations, odometer readings, and service logs
          </p>
        </div>
      </div>

      <DataTable
        title="Fleet Vehicles Master"
        subtitle="Manage transport vans, trucks, and route dispatch"
        columns={columns}
        data={vehicles}
        onAdd={() => setIsModalOpen(true)}
        addLabel="Add Vehicle"
        searchFields={['plate_number', 'make_model', 'status']}
        exportFileName="logistics_fleet"
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register Logistics Transport Vehicle"
      >
        <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">License Plate Number *</label>
              <input
                type="text"
                required
                value={form.plate_number}
                onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
                placeholder="e.g. CA-8492-TX"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Make / Model *</label>
              <input
                type="text"
                required
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="e.g. Ford Transit 350 Cargo"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Assigned Driver Name</label>
              <input
                type="text"
                value={form.driver_name}
                onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
                placeholder="Driver full name"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Current Odometer (km)</label>
              <input
                type="number"
                value={form.odometer}
                onChange={(e) => setForm({ ...form, odometer: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
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
              Save Vehicle
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
