import React, { useState, useEffect } from 'react';
import { Contact2, Building, Mail, Phone, Plus, DollarSign } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { dbRepository } from '../services/dbRepository';
import { Contact } from '../types';
import { formatCurrency, generateUUID } from '../lib/utils';

interface ContactsModuleProps {
  companyId?: string;
}

export const ContactsModule: React.FC<ContactsModuleProps> = ({ companyId }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    name: '',
    company_name: '',
    type: 'Customer' as const,
    email: '',
    phone: '',
    credit_limit: 10000,
    payment_terms_days: 30,
  });

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const cId = companyId || '';
    const cList = await dbRepository.getAll<Contact>('contacts', cId);
    setContacts(cList);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newContact: Contact = {
        id: generateUUID(),
        company_id: companyId || '',
        name: form.name,
        company_name: form.company_name,
        type: form.type,
        email: form.email,
        phone: form.phone,
        current_balance: 0,
        outstanding_balance: 0,
        credit_limit: Number(form.credit_limit),
        payment_terms_days: Number(form.payment_terms_days),
        billing_address: '',
        tags: [],
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await dbRepository.insert('contacts', newContact);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Save contact failed: ${err.message}`);
    }
  };

  const columns: Column<Contact>[] = [
    {
      key: 'name',
      header: 'Primary Contact',
      render: (r) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white">{r.name}</div>
          <div className="text-[10px] text-slate-400">{r.company_name || 'Individual'}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Relationship',
      render: (r) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            r.type === 'Customer'
              ? 'bg-blue-100 text-blue-800'
              : r.type === 'Supplier'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-purple-100 text-purple-800'
          }`}
        >
          {r.type}
        </span>
      ),
    },
    { key: 'email', header: 'Email' },
    { key: 'phone', header: 'Phone' },
    {
      key: 'credit_limit',
      header: 'Credit Limit',
      render: (r) => formatCurrency(r.credit_limit || 0),
    },
    {
      key: 'current_balance',
      header: 'Current Balance',
      render: (r) => (
        <span className="font-mono font-bold">{formatCurrency(r.current_balance || 0)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Contacts & CRM Directory
          </h1>
          <p className="text-xs text-slate-500">
            Customers, Suppliers, Vendors, Credit Limits, Terms, and Outstanding Balances
          </p>
        </div>
      </div>

      <DataTable
        title="Contacts & Accounts Directory"
        subtitle="Manage client and vendor entities, credit terms, and communication details"
        columns={columns}
        data={contacts}
        onAdd={() => setIsModalOpen(true)}
        addLabel="Add Contact / Company"
        searchFields={['name', 'company_name', 'email', 'phone', 'type']}
        exportFileName="contacts_crm"
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register New Contact Entity"
      >
        <form onSubmit={handleSaveContact} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Contact Person Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Company / Organization</label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium mb-1">Contact Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="Customer">Customer</option>
                <option value="Supplier">Supplier / Vendor</option>
                <option value="Both">Both (Dual Partner)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Credit Limit ($)</label>
              <input
                type="number"
                step="500"
                value={form.credit_limit}
                onChange={(e) => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Payment Terms (Days)</label>
              <input
                type="number"
                value={form.payment_terms_days}
                onChange={(e) => setForm({ ...form, payment_terms_days: parseInt(e.target.value) || 30 })}
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
              Save Contact
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
