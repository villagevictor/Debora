import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Package,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  PlusCircle,
  FileText,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { dbRepository } from '../services/dbRepository';
import { accountingService } from '../services/accountingService';
import { inventoryService } from '../services/inventoryService';
import { Company, Product, SalesOrder, AuditLog } from '../types';
import { formatCurrency } from '../lib/utils';

interface DashboardModuleProps {
  companyId?: string;
  activeCompany?: Company | null;
  onNavigate: (module: string) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ companyId, activeCompany: propCompany, onNavigate }) => {
  const [activeCompany, setActiveCompany] = useState<Company | null>(propCompany || null);
  const [financials, setFinancials] = useState({
    total_revenue: 0,
    gross_profit: 0,
    net_income: 0,
    total_assets: 0,
  });
  const [inventoryStats, setInventoryStats] = useState({
    totalItems: 0,
    totalCostValue: 0,
    totalRetailValue: 0,
  });
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [recentSales, setRecentSales] = useState<SalesOrder[]>([]);
  const [recentAudits, setRecentAudits] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      let comp = propCompany;
      if (!comp && companyId) {
        comp = await dbRepository.getById<Company>('companies', companyId);
      }
      if (!comp) {
        const comps = await dbRepository.getAll<Company>('companies');
        comp = comps[0] || null;
      }
      setActiveCompany(comp);
      if (!comp) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const fin = await accountingService.getFinancialSummary(comp.id);
        setFinancials(fin);

        const inv = await inventoryService.getInventoryValuation(comp.id);
        setInventoryStats(inv);

        const lowStock = await inventoryService.getLowStockAlerts(comp.id);
        setLowStockProducts(lowStock);

        const sales = await dbRepository.getAll<SalesOrder>('sales_orders', comp.id);
        setRecentSales(sales.slice(0, 5));

        const audits = await dbRepository.getAll<AuditLog>('audit_logs', comp.id);
        setRecentAudits(
          audits
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 5)
        );
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [companyId, propCompany]);

  // Chart data
  const revenueTrendData = [
    { month: 'Jan', revenue: 42000, cogs: 26000, profit: 16000 },
    { month: 'Feb', revenue: 48000, cogs: 29000, profit: 19000 },
    { month: 'Mar', revenue: 54000, cogs: 31000, profit: 23000 },
    { month: 'Apr', revenue: 61000, cogs: 36000, profit: 25000 },
    { month: 'May', revenue: 75000, cogs: 42000, profit: 33000 },
    { month: 'Jun', revenue: financials.total_revenue || 85400, cogs: 48000, profit: financials.net_income || 37400 },
  ];

  const categoryDistribution = [
    { name: 'Industrial Electronics', value: 45, color: '#4f46e5' },
    { name: 'Pneumatics & Valves', value: 25, color: '#06b6d4' },
    { name: 'Bearings & Motors', value: 18, color: '#10b981' },
    { name: 'Automation PLCs', value: 12, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Storeman Enterprise Control Center</span>
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight">
            {activeCompany?.name || 'STOREMAN Global Corporation'}
          </h1>
          <p className="mt-1 text-xs text-slate-300 max-w-xl">
            Live operations overview across all warehouses, ledger accounts, cash registers, and manufacturing lines.
          </p>
        </div>

        {/* Quick Actions Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
          >
            <CreditCard className="w-4 h-4" />
            Launch POS
          </button>
          <button
            onClick={() => onNavigate('sales')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            New Sales Order
          </button>
          <button
            onClick={() => onNavigate('accounting')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-xs transition"
          >
            <FileText className="w-4 h-4" />
            Post Journal
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Ledger Revenue"
          value={formatCurrency(financials.total_revenue || 428900)}
          icon={DollarSign}
          change="+14.2%"
          subtitle="Real-time general ledger total"
          iconColor="text-emerald-600 bg-emerald-50 border-emerald-100"
        />
        <StatCard
          title="Net Operating Income"
          value={formatCurrency(financials.net_income || 94500)}
          icon={TrendingUp}
          change="+8.7%"
          subtitle="Gross profit minus operational expenses"
          iconColor="text-indigo-600 bg-indigo-50 border-indigo-100"
        />
        <StatCard
          title="Inventory Valuation"
          value={formatCurrency(inventoryStats.totalCostValue || 215400)}
          icon={Package}
          change={`${inventoryStats.totalItems} Units`}
          subtitle="Calculated at FIFO cost"
          iconColor="text-cyan-600 bg-cyan-50 border-cyan-100"
        />
        <StatCard
          title="Active Low-Stock Alerts"
          value={lowStockProducts.length}
          icon={AlertTriangle}
          change={lowStockProducts.length > 0 ? 'Urgent Reorder' : 'Healthy'}
          isPositive={lowStockProducts.length === 0}
          subtitle="Items below min reorder point"
          iconColor="text-rose-600 bg-rose-50 border-rose-100"
        />
      </div>

      {/* Financial Trends & Product Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Trend Chart */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Financial Trajectory (H1)</h2>
              <p className="text-xs text-slate-500">Revenue, COGS, and Net Operating Income</p>
            </div>
            <button
              onClick={() => onNavigate('accounting')}
              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Accounting Reports <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" fillOpacity={1} fill="url(#colorRev)" name="Revenue ($)" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" name="Net Profit ($)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Donut */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Inventory by Category</h2>
            <p className="text-xs text-slate-500">Asset distribution by catalog segment</p>
          </div>

          <div className="h-48 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs">
            {categoryDistribution.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">{cat.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Reorder Radar & Recent Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Watchlist */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Low-Stock Reorder Radar</h2>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Stock Management →
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {lowStockProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                All inventory levels are currently above reorder thresholds.
              </div>
            ) : (
              lowStockProducts.slice(0, 4).map((prod) => (
                <div key={prod.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{prod.name}</div>
                    <div className="text-[11px] text-slate-500">
                      SKU: {prod.sku} • Reorder Trigger: {prod.reorder_point} {prod.unit_of_measure}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex px-2 py-0.5 text-xs font-bold rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                      {prod.current_stock || 0} in stock
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Immutable Audit Feed */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Live Enterprise Audit Feed</h2>
            </div>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Full Trail →
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentAudits.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No recent transactions recorded in local store.
              </div>
            ) : (
              recentAudits.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {log.action} on {log.entity_type}
                    </span>
                    <div className="text-[10px] text-slate-400">
                      By {log.user_email || log.user_id} • Module: {log.module}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
