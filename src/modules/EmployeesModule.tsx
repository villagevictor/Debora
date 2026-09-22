import React, { useState, useEffect } from 'react';
import { Users, Calendar, DollarSign, Plus, CheckCircle, Clock } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { dbRepository } from '../services/dbRepository';
import { Employee, Department } from '../types';
import { formatCurrency, generateUUID } from '../lib/utils';

interface EmployeesModuleProps {
  companyId?: string;
}

export const EmployeesModule: React.FC<EmployeesModuleProps> = ({ companyId }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    position: '',
    department_id: '',
    salary: 5000,
    hire_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const cId = companyId || '';
    const empList = await dbRepository.getAll<Employee>('employees', cId);
    setEmployees(empList);

    const deptList = await dbRepository.getAll<Department>('departments', cId);
    setDepartments(deptList);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newEmp: Employee = {
        id: generateUUID(),
        company_id: companyId || '',
        employee_code: `EMP-${Date.now().toString().slice(-4)}`,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: '',
        position: form.position,
        department_id: form.department_id || departments[0]?.id || '',
        employment_type: 'Full-time',
        status: 'Active',
        employment_status: 'Active',
        base_salary: Number(form.salary),
        salary: Number(form.salary),
        hire_date: form.hire_date,
        join_date: form.hire_date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      };

      await dbRepository.insert('employees', newEmp);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Save employee failed: ${err.message}`);
    }
  };

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee Name',
      render: (r) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white">
            {r.first_name} {r.last_name}
          </div>
          <div className="text-[10px] text-slate-400">{r.email}</div>
        </div>
      ),
    },
    { key: 'employee_code', header: 'Badge ID' },
    { key: 'position', header: 'Title / Position' },
    {
      key: 'department_id',
      header: 'Department',
      render: (r) => {
        const d = departments.find((dept) => dept.id === r.department_id);
        return d ? d.name : 'Corporate';
      },
    },
    {
      key: 'salary',
      header: 'Monthly Base Salary',
      render: (r) => <span className="font-mono font-bold">{formatCurrency(r.salary)}</span>,
    },
    {
      key: 'employment_status',
      header: 'Status',
      render: (r) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
          {r.employment_status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            HR, Personnel & Payroll Directory
          </h1>
          <p className="text-xs text-slate-500">
            Workforce directory, compensation records, department allocations, and leave
          </p>
        </div>
      </div>

      <DataTable
        title="Active Employee Directory"
        subtitle="Staff records, titles, assigned departments, and monthly compensation"
        columns={columns}
        data={employees}
        onAdd={() => setIsModalOpen(true)}
        addLabel="Onboard Employee"
        searchFields={['first_name', 'last_name', 'email', 'position', 'employee_code']}
        exportFileName="employees_directory"
      />

      {/* Onboard Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Onboard New Corporate Employee"
      >
        <form onSubmit={handleSaveEmployee} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">First Name *</label>
              <input
                type="text"
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Corporate Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Position / Job Title *</label>
              <input
                type="text"
                required
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Department</label>
              <select
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Monthly Base Salary ($)</label>
              <input
                type="number"
                step="100"
                required
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: parseFloat(e.target.value) || 0 })}
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
              Save Employee
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
