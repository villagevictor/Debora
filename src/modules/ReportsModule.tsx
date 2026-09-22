import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  Download,
  Calendar,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { dbRepository } from '../services/dbRepository';
import { exportService } from '../services/exportService';
import { accountingService } from '../services/accountingService';
import { inventoryService } from '../services/inventoryService';
import { Product } from '../types';
import { formatCurrency } from '../lib/utils';

interface ReportsModuleProps {
  companyId?: string;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ companyId }) => {
  const [reportType, setReportType] = useState<
    'sales_summary' | 'inventory_valuation' | 'stock_ledger' | 'general_ledger' | 'fleet_utilization'
  >('sales_summary');

  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [salesData, setSalesData] = useState<any[]>([]);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [stockTxData, setStockTxData] = useState<any[]>([]);
  const [fleetData, setFleetData] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const cId = companyId || '';
    const soList = await dbRepository.getAll<any>('sales_orders', cId);
    setSalesData(soList);

    const prods = await dbRepository.getAll<Product>('products', cId);
    setInventoryData(
      prods.map((p) => ({
        sku: p.sku,
        name: p.name,
        current_stock: p.current_stock || 0,
        cost_price: p.cost_price,
        selling_price: p.selling_price,
        total_cost_valuation: (p.current_stock || 0) * (p.cost_price || 0),
        total_retail_valuation: (p.current_stock || 0) * (p.selling_price || 0),
      }))
    );

    const txs = await dbRepository.getAll<any>('inventory_transactions', cId);
    setStockTxData(txs);

    const vList = await dbRepository.getAll<any>('vehicles', cId);
    setFleetData(vList);
  };

  const handleExportCSV = () => {
    if (reportType === 'sales_summary') {
      exportService.exportToCSV('sales_summary_report', salesData);
    } else if (reportType === 'inventory_valuation') {
      exportService.exportToCSV('inventory_valuation_report', inventoryData);
    } else if (reportType === 'stock_ledger') {
      exportService.exportToCSV('stock_ledger_report', stockTxData);
    } else if (reportType === 'fleet_utilization') {
      exportService.exportToCSV('fleet_utilization_report', fleetData);
    }
  };

  const handlePrint = () => {
    const titles = {
      sales_summary: 'Commercial Sales & Fulfillment Audit Report',
      inventory_valuation: 'Perpetual Inventory Valuation Report',
      stock_ledger: 'Stock Movement Ledger Report',
      general_ledger: 'General Ledger Audit Report',
      fleet_utilization: 'Logistics Fleet Utilization Report',
    };
    exportService.printReport(titles[reportType]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Enterprise Reporting & Operational Analytics
          </h1>
          <p className="text-xs text-slate-500">
            Exportable audits, perpetual valuation, stock ledgers, and executive summaries
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Control Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Report Category:</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as any)}
            className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-3 py-1.5 font-semibold"
          >
            <option value="sales_summary">Commercial Sales Summary</option>
            <option value="inventory_valuation">Perpetual Inventory Valuation</option>
            <option value="stock_ledger">Stock Movement Audit Ledger</option>
            <option value="fleet_utilization">Logistics Fleet & Mileage</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Period:</span>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 px-2 py-1"
          />
        </div>
      </div>

      {/* Report Tables */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 shadow-xs overflow-x-auto">
        {reportType === 'sales_summary' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                <th className="py-2.5 px-3">Order Number</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Subtotal ($)</th>
                <th className="py-2.5 px-3 text-right">Tax ($)</th>
                <th className="py-2.5 px-3 text-right">Net Revenue ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {salesData.map((s, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-mono font-bold">{s.order_number}</td>
                  <td className="py-2.5 px-3">{s.order_date}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(s.subtotal || 0)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(s.tax_amount || 0)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600">
                    {formatCurrency(s.total_amount || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'inventory_valuation' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Product Name</th>
                <th className="py-2.5 px-3 text-right">On Hand Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Cost ($)</th>
                <th className="py-2.5 px-3 text-right">Total Inventory Value ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {inventoryData.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-mono">{item.sku}</td>
                  <td className="py-2.5 px-3 font-medium">{item.name}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">{item.stock}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(item.cost_price)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                    {formatCurrency(item.total_valuation)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'stock_ledger' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Reference Doc</th>
                <th className="py-2.5 px-3 text-right">Delta Quantity</th>
                <th className="py-2.5 px-3 text-right">Unit Cost</th>
                <th className="py-2.5 px-3">Audit Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {stockTxData.map((tx, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-mono text-[11px]">
                    {new Date(tx.created_at).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.transaction_type.includes('IN')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {tx.transaction_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">{tx.reference_id || tx.reference_type}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    {tx.transaction_type.includes('IN') ? `+${tx.quantity}` : `-${tx.quantity}`}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(tx.unit_cost || 0)}</td>
                  <td className="py-2.5 px-3 text-slate-400">{tx.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {reportType === 'fleet_utilization' && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                <th className="py-2.5 px-3">Plate Number</th>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Driver</th>
                <th className="py-2.5 px-3 text-right">Odometer (km)</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Last Service</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {fleetData.map((v, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-mono font-bold">{v.plate_number}</td>
                  <td className="py-2.5 px-3">{v.model}</td>
                  <td className="py-2.5 px-3">{v.driver_name || 'Unassigned'}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{v.odometer.toLocaleString()} km</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      {v.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">{v.last_service || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
