import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Plus } from 'lucide-react';
import { DataTable, Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { dbRepository } from '../services/dbRepository';
import { authService } from '../services/authService';
import { QualityRule, Product } from '../types';
import { generateUUID } from '../lib/utils';

interface QualityModuleProps {
  companyId?: string;
}

export const QualityModule: React.FC<QualityModuleProps> = ({ companyId }) => {
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [ruleForm, setRuleForm] = useState({
    rule_name: '',
    inspection_stage: 'Incoming GRN' as const,
    product_id: '',
    parameter_name: 'Tensile Strength / Dimension',
    standard_value: '12.5mm',
    tolerance: '±0.05mm',
    sampling_percentage: 10,
  });

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const cId = companyId || '';
    const rList = await dbRepository.getAll<QualityRule>('quality_rules', cId);
    setRules(rList);

    const pList = await dbRepository.getAll<Product>('products', cId);
    setProducts(pList);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newRule: QualityRule = {
        id: generateUUID(),
        company_id: companyId || '',
        title: ruleForm.rule_name || 'Standard QA Gate',
        module: (ruleForm.inspection_stage === 'Incoming GRN' ? 'Purchase' : 'Manufacturing') as any,
        criteria: `${ruleForm.parameter_name}: ${ruleForm.standard_value} (${ruleForm.tolerance})`,
        min_acceptable_score: 90,
        is_active: true,
        rule_name: ruleForm.rule_name,
        inspection_stage: ruleForm.inspection_stage,
        product_id: ruleForm.product_id || undefined,
        parameters: [
          {
            name: ruleForm.parameter_name,
            standard_value: ruleForm.standard_value,
            tolerance: ruleForm.tolerance,
          },
        ],
        sampling_percentage: Number(ruleForm.sampling_percentage) || 10,
        is_mandatory: true,
      };

      await dbRepository.insert('quality_rules', newRule);
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Save quality rule failed: ${err.message}`);
    }
  };

  const columns: Column<QualityRule>[] = [
    { key: 'title', header: 'Quality Standard Rule', render: (r) => r.rule_name || r.title },
    {
      key: 'module',
      header: 'Inspection Stage',
      render: (r) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
          {r.inspection_stage || r.module}
        </span>
      ),
    },
    {
      key: 'criteria',
      header: 'Inspection Parameters',
      render: (r) => (
        <div className="text-slate-700 dark:text-slate-300">
          {(r.parameters || []).map((p: any, idx: number) => (
            <div key={idx} className="text-[11px]">
              {p.name}: <span className="font-mono font-semibold">{p.standard_value}</span> ({p.tolerance})
            </div>
          ))}
          {!r.parameters && <span className="text-[11px]">{r.criteria}</span>}
        </div>
      ),
    },
    {
      key: 'min_acceptable_score',
      header: 'AQL Sample',
      render: (r) => `${r.sampling_percentage || 10}% of batch (Min ${r.min_acceptable_score}%)`,
    },
    {
      key: 'is_active',
      header: 'Enforcement',
      render: (r) => (
        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
          <ShieldCheck className="w-3.5 h-3.5" /> {r.is_mandatory ? 'Mandatory Gate' : 'Optional Check'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Quality Assurance & Inspection Rules
          </h1>
          <p className="text-xs text-slate-500">
            Incoming inspection gates, in-process testing standards, and non-conformance tracking (NCR)
          </p>
        </div>
      </div>

      <DataTable
        title="Quality Control Standards Master"
        subtitle="Mandatory inspection criteria applied across procurement and manufacturing runs"
        columns={columns}
        data={rules}
        onAdd={() => setIsModalOpen(true)}
        addLabel="Add Inspection Standard"
        searchFields={['title', 'module', 'criteria']}
        exportFileName="quality_rules"
      />

      {/* Add Quality Rule Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Define Quality Assurance Standard"
      >
        <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium mb-1">Standard / Rule Title *</label>
            <input
              type="text"
              required
              value={ruleForm.rule_name}
              onChange={(e) => setRuleForm({ ...ruleForm, rule_name: e.target.value })}
              placeholder="e.g. ISO-9001 Inbound Sensor Tolerance"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Inspection Stage</label>
              <select
                value={ruleForm.inspection_stage}
                onChange={(e) => setRuleForm({ ...ruleForm, inspection_stage: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="Incoming GRN">Incoming GRN Gate</option>
                <option value="In-Process">In-Process Shop Floor</option>
                <option value="Final Inspection">Final Finished Goods QC</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Sample Ratio (%)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={ruleForm.sampling_percentage}
                onChange={(e) => setRuleForm({ ...ruleForm, sampling_percentage: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-medium mb-1">Param Name</label>
              <input
                type="text"
                required
                value={ruleForm.parameter_name}
                onChange={(e) => setRuleForm({ ...ruleForm, parameter_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Standard Target</label>
              <input
                type="text"
                required
                value={ruleForm.standard_value}
                onChange={(e) => setRuleForm({ ...ruleForm, standard_value: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Tolerance Margin</label>
              <input
                type="text"
                required
                value={ruleForm.tolerance}
                onChange={(e) => setRuleForm({ ...ruleForm, tolerance: e.target.value })}
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
              Save QA Standard
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
