import React, { useState, useEffect } from 'react';
import { Sidebar, NavigationModule } from './components/Sidebar';
import { Header as TopHeader } from './components/Header';
import { GlobalSearch } from './components/GlobalSearch';
import { NotificationCenter } from './components/NotificationCenter';
import { dbRepository } from './services/dbRepository';
import { authService } from './services/authService';
import { Company, User, Branch, Warehouse as WarehouseType, AppNotification } from './types';

// Modules
import { DashboardModule } from './modules/DashboardModule';
import { StoreModule } from './modules/StoreModule';
import { InventoryModule } from './modules/InventoryModule';
import { POSModule } from './modules/POSModule';
import { AccountingModule } from './modules/AccountingModule';
import { PurchaseModule } from './modules/PurchaseModule';
import { SalesModule } from './modules/SalesModule';
import { ManufacturingModule } from './modules/ManufacturingModule';
import { QualityModule } from './modules/QualityModule';
import { EmployeesModule } from './modules/EmployeesModule';
import { MaintenanceModule } from './modules/MaintenanceModule';
import { FleetModule } from './modules/FleetModule';
import { RepairModule } from './modules/RepairModule';
import { ContactsModule } from './modules/ContactsModule';
import { ReportsModule } from './modules/ReportsModule';
import { SettingsModule } from './modules/SettingsModule';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeModule, setActiveModule] = useState<NavigationModule>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Search & Notification Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'notif-1',
      type: 'INFO',
      title: 'Storeman ERP Ready',
      message: 'IndexedDB & Supabase Sync Engine initialized and running.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      is_read: false,
    },
    {
      id: 'notif-2',
      type: 'SUCCESS',
      title: 'POS Offline Engine Active',
      message: 'Instant local register caching is enabled for high-speed checkout.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      is_read: false,
    },
  ]);

  // Multi-Company State
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('comp-hq-01');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [activeWarehouse, setActiveWarehouse] = useState<WarehouseType | null>(null);

  // Theme & User
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('storeman_theme') === 'dark';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('storeman_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('storeman_theme', 'light');
    }
  }, [isDarkMode]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 -> Instant POS Quick switch
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveModule('pos');
      }
      // Ctrl+K / Cmd+K -> Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const initializeApp = async () => {
    try {
      await dbRepository.init();
      const compList = await dbRepository.getAll<Company>('companies');
      setCompanies(compList);

      const branchList = await dbRepository.getAll<Branch>('branches');
      setBranches(branchList);
      if (branchList.length > 0) setActiveBranch(branchList[0]);

      const whList = await dbRepository.getAll<WarehouseType>('warehouses');
      setWarehouses(whList);
      if (whList.length > 0) setActiveWarehouse(whList[0]);

      const user = authService.getCurrentUser();
      setCurrentUser(user);
      if (user?.current_company_id) {
        setActiveCompanyId(user.current_company_id);
      } else if (compList.length > 0) {
        setActiveCompanyId(compList[0].id);
      }

      setIsInitialized(true);
    } catch (err) {
      console.error('Failed to initialize STOREMAN ERP:', err);
      setIsInitialized(true);
    }
  };

  const handleCompanyChange = async (newCompanyId: string) => {
    setActiveCompanyId(newCompanyId);
    await authService.switchCompany(newCompanyId);
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-base font-bold tracking-wider">STOREMAN ERP</div>
        <div className="text-xs text-slate-400 mt-1">Booting Enterprise Engine & IndexedDB Ledger...</div>
      </div>
    );
  }

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex transition-colors duration-200 antialiased font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        activeModule={activeModule}
        onSelectModule={(mod) => setActiveModule(mod as NavigationModule)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        currentCompanyName={activeCompany?.name || 'STOREMAN HQ'}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <TopHeader
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          unreadNotificationsCount={notifications.filter((n) => !n.is_read).length}
          activeModule={activeModule}
          companies={companies}
          activeCompany={activeCompany}
          activeCompanyId={activeCompanyId}
          onSelectCompany={(c: any) => handleCompanyChange(c?.id || c)}
          branches={branches}
          activeBranch={activeBranch}
          onSelectBranch={setActiveBranch}
          warehouses={warehouses}
          activeWarehouse={activeWarehouse}
          onSelectWarehouse={setActiveWarehouse}
          currentUser={currentUser}
          onLogout={async () => {
            await authService.logout();
            window.location.reload();
          }}
          onNavigate={(mod) => setActiveModule(mod as NavigationModule)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />

        {/* Dynamic Module Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="max-w-[1700px] mx-auto pb-12">
            {activeModule === 'dashboard' && (
              <DashboardModule
                companyId={activeCompanyId}
                onNavigate={(mod) => setActiveModule(mod as NavigationModule)}
              />
            )}
            {(activeModule === 'store' || activeModule === 'stores') && (
              <StoreModule companyId={activeCompanyId} />
            )}
            {activeModule === 'inventory' && <InventoryModule companyId={activeCompanyId} />}
            {activeModule === 'pos' && <POSModule companyId={activeCompanyId} />}
            {activeModule === 'accounting' && <AccountingModule companyId={activeCompanyId} />}
            {(activeModule === 'purchase' || activeModule === 'purchases') && (
              <PurchaseModule companyId={activeCompanyId} />
            )}
            {activeModule === 'sales' && <SalesModule companyId={activeCompanyId} />}
            {activeModule === 'manufacturing' && <ManufacturingModule companyId={activeCompanyId} />}
            {activeModule === 'quality' && <QualityModule companyId={activeCompanyId} />}
            {activeModule === 'employees' && <EmployeesModule companyId={activeCompanyId} />}
            {activeModule === 'maintenance' && <MaintenanceModule companyId={activeCompanyId} />}
            {activeModule === 'fleet' && <FleetModule companyId={activeCompanyId} />}
            {(activeModule === 'repair' || activeModule === 'repairs') && (
              <RepairModule companyId={activeCompanyId} />
            )}
            {activeModule === 'contacts' && <ContactsModule companyId={activeCompanyId} />}
            {activeModule === 'reports' && <ReportsModule companyId={activeCompanyId} />}
            {(activeModule === 'settings' ||
              activeModule === 'users' ||
              activeModule === 'audit' ||
              activeModule === 'approvals' ||
              activeModule === 'agents') && (
              <SettingsModule
                companyId={activeCompanyId}
                onCompanySwitch={handleCompanyChange}
              />
            )}
          </div>
        </main>
      </div>

      {/* Global Search Modal */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={(mod) => {
          setActiveModule(mod as NavigationModule);
          setIsSearchOpen(false);
        }}
      />

      {/* Notification Center Drawer */}
      <NotificationCenter
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationRead}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
      />
    </div>
  );
}
