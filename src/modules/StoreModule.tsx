import React, { useState, useEffect } from 'react';
import {
  Building2,
  GitBranch,
  Warehouse as WarehouseIcon,
  Store as StoreIcon,
  Users2,
  Plus,
  Check,
} from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { dbRepository } from '../services/dbRepository';
import { Company, Branch, Warehouse, RetailStore, Department } from '../types';
import { auditLogger } from '../lib/auditLogger';
import { generateUUID } from '../lib/utils';

interface StoreModuleProps {
  companyId?: string;
  activeCompany?: Company | null;
  onRefreshCompanies?: () => void;
}

export const StoreModule: React.FC<StoreModuleProps> = ({
  companyId,
  activeCompany: propCompany,
  onRefreshCompanies,
}) => {
  const [activeTab, setActiveTab] = useState<'companies' | 'branches' | 'warehouses' | 'stores' | 'departments'>('companies');

  // Datasets
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stores, setStores] = useState<RetailStore[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'company' | 'branch' | 'warehouse' | 'store' | 'department'>('company');
  const [formData, setFormData] = useState<Record<string, any>>({});

  const activeCompany = propCompany || companies.find((c) => c.id === companyId) || companies[0] || null;

  useEffect(() => {
    loadData();
  }, [companyId, propCompany]);

  const loadData = async () => {
    const compData = await dbRepository.getAll<Company>('companies');
    setCompanies(compData);

    const cId = companyId || activeCompany?.id;
    const branchData = await dbRepository.getAll<Branch>('branches', cId);
    setBranches(branchData);

    const whData = await dbRepository.getAll<Warehouse>('warehouses', cId);
    setWarehouses(whData);

    const storeData = await dbRepository.getAll<RetailStore>('stores', cId);
    setStores(storeData);

    const deptData = await dbRepository.getAll<Department>('departments', cId);
    setDepartments(deptData);
  };

  const handleOpenAdd = (type: typeof modalType) => {
    setModalType(type);
    setFormData({});
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalType === 'company') {
        await dbRepository.insert<any>('companies', {
          id: generateUUID(),
          name: formData.name,
          code: formData.code || `COMP-${Date.now().toString().slice(-4)}`,
          tax_id: formData.tax_id || '',
          currency: formData.currency || 'USD',
          email: formData.email || '',
          phone: formData.phone || '',
          address: formData.address || '',
          city: formData.city || '',
          country: formData.country || 'USA',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (onRefreshCompanies) onRefreshCompanies();
      } else if (modalType === 'branch') {
        await dbRepository.insert<any>('branches', {
          id: generateUUID(),
          company_id: activeCompany?.id || companyId || '',
          name: formData.name,
          code: formData.code || `BR-${Date.now().toString().slice(-4)}`,
          phone: formData.phone || '',
          address: formData.address || '',
          is_active: true,
          created_at: new Date().toISOString(),
        });
      } else if (modalType === 'warehouse') {
        await dbRepository.insert<any>('warehouses', {
          id: generateUUID(),
          company_id: activeCompany?.id || companyId || '',
          branch_id: formData.branch_id || branches[0]?.id || '',
          name: formData.name,
          code: formData.code || `WH-${Date.now().toString().slice(-4)}`,
          address: formData.address || formData.location || '',
          is_default: false,
          is_active: true,
          created_at: new Date().toISOString(),
        });
      } else if (modalType === 'store') {
        await dbRepository.insert<any>('stores', {
          id: generateUUID(),
          company_id: activeCompany?.id || companyId || '',
          branch_id: formData.branch_id || branches[0]?.id || '',
          warehouse_id: formData.warehouse_id || warehouses[0]?.id || '',
          name: formData.name,
          code: formData.code || `STR-${Date.now().toString().slice(-4)}`,
          is_active: true,
          created_at: new Date().toISOString(),
        });
      } else if (modalType === 'department') {
        await dbRepository.insert<any>('departments', {
          id: generateUUID(),
          company_id: activeCompany?.id || companyId || '',
          name: formData.name,
          code: formData.code || `DEP-${Date.now().toString().slice(-4)}`,
          is_active: true,
          created_at: new Date().toISOString(),
        });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleDelete = async (collection: string, id: string) => {
    if (confirm('Are you sure you want to delete this organizational record?')) {
      await dbRepository.delete(collection, id);
      await loadData();
    }
  };

  // Columns
  const companyColumns: Column<Company>[] = [
    { key: 'name', header: 'Company Name' },
    { key: 'code', header: 'Code' },
    { key: 'tax_id', header: 'Tax ID' },
    { key: 'currency', header: 'Base Currency' },
    { key: 'country', header: 'Country' },
    {
      key: 'is_active',
      header: 'Status',
      render: (r) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const branchColumns: Column<Branch>[] = [
    { key: 'name', header: 'Branch Name' },
    { key: 'code', header: 'Code' },
    { key: 'address', header: 'Address' },
    {
      key: 'is_active',
      header: 'Status',
      render: (r) => (r.is_active ? <span className="text-emerald-600 font-bold">Active</span> : 'Inactive'),
    },
  ];

  const warehouseColumns: Column<Warehouse>[] = [
    { key: 'name', header: 'Warehouse Name' },
    { key: 'code', header: 'Code' },
    { key: 'address', header: 'Location / Address' },
    {
      key: 'is_active',
      header: 'Active',
      render: (r) => (r.is_active ? 'Yes' : 'No'),
    },
  ];

  const storeColumns: Column<RetailStore>[] = [
    { key: 'name', header: 'Store Name' },
    { key: 'code', header: 'Code' },
    {
      key: 'is_active',
      header: 'POS Ready',
      render: (r) => (r.is_active ? 'Enabled' : 'Disabled'),
    },
  ];

  const deptColumns: Column<Department>[] = [
    { key: 'name', header: 'Department Name' },
    { key: 'code', header: 'Dept Code' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Store & Organizational Structure
          </h1>
          <p className="text-xs text-slate-500">
            Multi-Company hierarchy: Companies, Branches, Warehouses, Stores, and Departments
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('companies')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'companies'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Companies
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'branches'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Branches
          </button>
          <button
            onClick={() => setActiveTab('warehouses')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'warehouses'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Warehouses
          </button>
          <button
            onClick={() => setActiveTab('stores')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'stores'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Retail Outlets
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'departments'
                ? 'bg-white text-indigo-600 shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Departments
          </button>
        </div>
      </div>

      {activeTab === 'companies' && (
        <DataTable
          title="Corporate Entities (Multi-Company Master)"
          subtitle="All registered corporate entities in this STOREMAN ERP instance"
          columns={companyColumns}
          data={companies}
          onAdd={() => handleOpenAdd('company')}
          addLabel="Add Company"
          onDelete={(row) => handleDelete('companies', row.id)}
          searchFields={['name', 'code', 'tax_id']}
          exportFileName="storeman_companies"
        />
      )}

      {activeTab === 'branches' && (
        <DataTable
          title="Operating Branches"
          subtitle={`Branches scoped to ${activeCompany?.name || 'Active Company'}`}
          columns={branchColumns}
          data={branches}
          onAdd={() => handleOpenAdd('branch')}
          addLabel="Add Branch"
          onDelete={(row) => handleDelete('branches', row.id)}
          searchFields={['name', 'code', 'address']}
          exportFileName="storeman_branches"
        />
      )}

      {activeTab === 'warehouses' && (
        <DataTable
          title="Warehouses & Distribution Centers"
          subtitle="Storage nodes tracking real-time stock balances and bins"
          columns={warehouseColumns}
          data={warehouses}
          onAdd={() => handleOpenAdd('warehouse')}
          addLabel="Add Warehouse"
          onDelete={(row) => handleDelete('warehouses', row.id)}
          searchFields={['name', 'code', 'address']}
          exportFileName="storeman_warehouses"
        />
      )}

      {activeTab === 'stores' && (
        <DataTable
          title="Retail Stores & Outlets"
          subtitle="Point of Sale cash registers and customer-facing outlets"
          columns={storeColumns}
          data={stores}
          onAdd={() => handleOpenAdd('store')}
          addLabel="Add Retail Store"
          onDelete={(row) => handleDelete('stores', row.id)}
          searchFields={['name', 'code']}
          exportFileName="storeman_stores"
        />
      )}

      {activeTab === 'departments' && (
        <DataTable
          title="Organizational Departments"
          subtitle="Operational divisions for budget allocation and employee assignments"
          columns={deptColumns}
          data={departments}
          onAdd={() => handleOpenAdd('department')}
          addLabel="Add Department"
          onDelete={(row) => handleDelete('departments', row.id)}
          searchFields={['name', 'code']}
          exportFileName="storeman_departments"
        />
      )}

      {/* Organizational Entity Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Add New ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`}
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Name *</label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              placeholder={`e.g. ${modalType === 'company' ? 'Storeman Global Corp' : 'Downtown Depot'}`}
            />
          </div>

          <div>
            <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Code / Identifier</label>
            <input
              type="text"
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
              placeholder="e.g. US-HQ-01"
            />
          </div>

          {modalType === 'company' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Tax ID</label>
                <input
                  type="text"
                  value={formData.tax_id || ''}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Currency</label>
                <input
                  type="text"
                  value={formData.currency || 'USD'}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          )}

          {(modalType === 'branch' || modalType === 'warehouse') && (
            <div>
              <label className="block font-medium mb-1 text-slate-700 dark:text-slate-300">Physical Address</label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border rounded-lg text-slate-700 hover:bg-slate-50 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
            >
              Save Entity
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
