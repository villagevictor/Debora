import React from 'react';
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  Building2,
  GitBranch,
  Warehouse,
  LogOut,
  User,
  Shield,
} from 'lucide-react';
import { Company, Branch, Warehouse as WarehouseType, UserProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';

export interface HeaderProps {
  onToggleSidebar?: () => void;
  onOpenSearch?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  companies?: Company[];
  activeCompany?: Company | null;
  activeCompanyId?: string;
  onSelectCompany?: ((company: Company) => void) | ((companyId: string) => void);
  branches?: Branch[];
  activeBranch?: Branch | null;
  onSelectBranch?: (branch: Branch) => void;
  warehouses?: WarehouseType[];
  activeWarehouse?: WarehouseType | null;
  onSelectWarehouse?: (warehouse: WarehouseType) => void;
  currentUser?: UserProfile | null;
  onLogout?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  activeModule?: string;
  onNavigate?: (module: any) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  onOpenSearch,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  companies = [],
  activeCompany,
  activeCompanyId,
  onSelectCompany,
  branches = [],
  activeBranch = null,
  onSelectBranch,
  warehouses = [],
  activeWarehouse = null,
  onSelectWarehouse,
  currentUser = null,
  onLogout,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const currentCompany =
    activeCompany ||
    (activeCompanyId ? companies.find((c) => c.id === activeCompanyId) : null) ||
    companies[0] ||
    null;
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 transition-colors">
      {/* Left section: Hamburger & Tenant Scope Selectors */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden dark:hover:bg-slate-800"
          title="Toggle Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Multi-company switcher (Requirement 10) */}
        <div className="hidden sm:flex items-center gap-2 border-r border-slate-200 pr-3 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={currentCompany?.id || ''}
              onChange={(e) => {
                const found = companies.find((c) => c.id === e.target.value);
                if (found && onSelectCompany) {
                  (onSelectCompany as any)(found);
                }
              }}
              className="font-semibold text-slate-800 dark:text-slate-200 bg-transparent border-none text-xs focus:ring-0 cursor-pointer"
            >
              {companies.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Branch Switcher */}
        {branches.length > 0 && (
          <div className="hidden md:flex items-center gap-1.5 border-r border-slate-200 pr-3 text-xs text-slate-500 dark:border-slate-800">
            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={activeBranch?.id || ''}
              onChange={(e) => {
                const found = branches.find((b) => b.id === e.target.value);
                if (found && onSelectBranch) onSelectBranch(found);
              }}
              className="text-slate-700 dark:text-slate-300 bg-transparent border-none text-xs focus:ring-0 cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Warehouse Switcher */}
        {warehouses.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
            <Warehouse className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={activeWarehouse?.id || ''}
              onChange={(e) => {
                const found = warehouses.find((w) => w.id === e.target.value);
                if (found && onSelectWarehouse) onSelectWarehouse(found);
              }}
              className="text-slate-700 dark:text-slate-300 bg-transparent border-none text-xs focus:ring-0 cursor-pointer"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right section: Global Search, PWA, Offline, Notification, Theme, User Profile */}
      <div className="flex items-center gap-2.5">
        {/* Global Search Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-500 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          title="Search anything (Ctrl+K)"
        >
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <span className="hidden sm:inline">Search ERP...</span>
          <kbd className="hidden sm:inline rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 border border-slate-200 dark:border-slate-700 dark:bg-slate-900">
            Ctrl K
          </kbd>
        </button>

        {/* Offline & Sync status */}
        <OfflineIndicator />

        {/* PWA Install */}
        <PWAInstallButton />

        {/* Notification Bell */}
        <button
          onClick={onOpenNotifications}
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:text-slate-400"
          title="System Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
          )}
        </button>

        {/* Dark/Light mode toggle */}
        <button
          onClick={onToggleDarkMode}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:text-slate-400"
          title="Toggle Light / Dark mode"
        >
          {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-900 dark:text-white">
              {currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : 'Admin User'}
            </span>
            <span className="inline-flex items-center justify-end gap-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
              <Shield className="w-2.5 h-2.5" />
              {currentUser?.role || 'Super Admin'}
            </span>
          </div>

          <button
            onClick={onLogout}
            className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition"
            title="Sign out of STOREMAN ERP"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
