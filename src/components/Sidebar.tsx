import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Package,
  ShoppingCart,
  TrendingUp,
  Receipt,
  CreditCard,
  Factory,
  CheckCircle,
  Users,
  Wrench,
  Truck,
  Hammer,
  Contact2,
  Briefcase,
  CheckSquare,
  BarChart3,
  Settings,
  ShieldCheck,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { UserRole } from '../types';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  section: string;
  requiredRole?: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  // Core
  { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, section: 'Overview' },
  { id: 'store', label: 'Store & Structure', icon: Building2, section: 'Core Setup' },

  // Operations
  { id: 'inventory', label: 'Inventory & Stock', icon: Package, section: 'Operations' },
  { id: 'purchase', label: 'Procurement & POs', icon: ShoppingCart, section: 'Operations' },
  { id: 'sales', label: 'Sales & Orders', icon: TrendingUp, section: 'Operations' },
  { id: 'pos', label: 'Point of Sale (POS)', icon: CreditCard, section: 'Operations' },

  // Finance
  { id: 'accounting', label: 'Double-Entry Finance', icon: Receipt, section: 'Finance' },

  // Industrial & Facilities
  { id: 'manufacturing', label: 'Manufacturing & BOM', icon: Factory, section: 'Industrial' },
  { id: 'quality', label: 'Quality Control', icon: CheckCircle, section: 'Industrial' },
  { id: 'maintenance', label: 'Machine Maintenance', icon: Wrench, section: 'Industrial' },
  { id: 'repair', label: 'Repairs & Warranty', icon: Hammer, section: 'Industrial' },
  { id: 'fleet', label: 'Fleet & Logistics', icon: Truck, section: 'Industrial' },

  // Workforce & Network
  { id: 'employees', label: 'HR & Employees', icon: Users, section: 'Workforce' },
  { id: 'contacts', label: 'Contacts & CRM', icon: Contact2, section: 'Workforce' },
  { id: 'agents', label: 'Sales Agents', icon: Briefcase, section: 'Workforce' },

  // Governance & Intelligence
  { id: 'approvals', label: 'Approval Workflows', icon: CheckSquare, section: 'Governance' },
  { id: 'reports', label: 'Analytics & Reports', icon: BarChart3, section: 'Governance' },
  { id: 'audit', label: 'Audit Trail Logs', icon: FileSpreadsheet, section: 'Governance' },

  // System
  { id: 'settings', label: 'System Settings', icon: Settings, section: 'Administration' },
  { id: 'users', label: 'Users & RBAC', icon: ShieldCheck, section: 'Administration' },
];

// Navigation Module Type
export type NavigationModule =
  | 'dashboard'
  | 'store'
  | 'stores'
  | 'inventory'
  | 'purchase'
  | 'purchases'
  | 'sales'
  | 'pos'
  | 'accounting'
  | 'manufacturing'
  | 'quality'
  | 'maintenance'
  | 'repair'
  | 'repairs'
  | 'fleet'
  | 'employees'
  | 'contacts'
  | 'agents'
  | 'approvals'
  | 'reports'
  | 'audit'
  | 'settings'
  | 'users';

export interface SidebarProps {
  currentModule?: string;
  activeModule?: string;
  onSelectModule: (moduleId: string) => void;
  isOpen?: boolean;
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
  currentCompanyName?: string;
  userRole?: UserRole;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  activeModule,
  onSelectModule,
  isOpen = true,
  collapsed = false,
  onClose,
  onToggleCollapse,
  currentCompanyName,
  userRole = 'Super Admin',
}) => {
  const selectedModule = activeModule || currentModule || 'dashboard';
  // Group navigation items by section
  const sections = Array.from(new Set(NAV_ITEMS.map((item) => item.section)));

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && onClose && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Main Sidebar Shell */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex ${collapsed ? 'w-20' : 'w-64'} flex-col border-r border-slate-200 bg-white transition-all duration-200 ease-in-out dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-xs">
              <Package className="h-5 w-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                  STOREMAN <span className="text-indigo-600 font-black">ERP</span>
                </div>
                <div className="text-[10px] font-medium text-slate-400 truncate">
                  {currentCompanyName || 'Enterprise Suite v2.5'}
                </div>
              </div>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {sections.map((section) => {
            const items = NAV_ITEMS.filter((i) => i.section === section);
            const visibleItems = items.filter(
              (item) => !item.requiredRole || item.requiredRole.includes(userRole)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section} className="space-y-1">
                {!collapsed && (
                  <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {section}
                  </div>
                )}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    selectedModule === item.id ||
                    (item.id === 'store' && selectedModule === 'stores') ||
                    (item.id === 'purchase' && selectedModule === 'purchases') ||
                    (item.id === 'repair' && selectedModule === 'repairs');

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectModule(item.id);
                        if (onClose && window.innerWidth < 1024) onClose();
                      }}
                      title={collapsed ? item.label : undefined}
                      className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isActive
                            ? 'text-white'
                            : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* System Status Footer */}
        <div className="border-t border-slate-200 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Engine Online
            </span>
            <span className="font-mono text-[10px] font-semibold">PWA Ready</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export { Header } from './Header';
