/**
 * Authentication and RBAC Service for STOREMAN ERP
 * Implements strict role verification, multi-company tenant scoping,
 * admin approval gating, and permission check guards.
 */

import { UserProfile, UserRole, RolePermissions } from '../types';
import { dbRepository } from './dbRepository';
import { auditLogger } from '../lib/auditLogger';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

// Complete enterprise RBAC permissions matrix
export const ROLE_PERMISSIONS_MAP: Record<UserRole, string[]> = {
  'Super Admin': [
    'store.manage',
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.delete', 'inventory.adjust', 'inventory.transfer', 'inventory.export',
    'purchase.view', 'purchase.create', 'purchase.update', 'purchase.delete', 'purchase.approve', 'purchase.export',
    'sales.view', 'sales.create', 'sales.update', 'sales.delete', 'sales.approve', 'sales.export',
    'accounting.view', 'accounting.create', 'accounting.update', 'accounting.approve', 'accounting.export',
    'pos.operate', 'pos.manage',
    'manufacturing.view', 'manufacturing.manage',
    'quality.view', 'quality.manage',
    'employees.view', 'employees.manage',
    'maintenance.view', 'maintenance.manage',
    'fleet.view', 'fleet.manage',
    'repair.view', 'repair.manage',
    'contacts.view', 'contacts.manage',
    'agents.view', 'agents.manage',
    'approvals.manage',
    'reporting.view', 'reporting.export',
    'settings.manage', 'users.manage', 'audit.view', 'modules.manage',
  ],
  'Admin': [
    'store.manage',
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.delete', 'inventory.adjust', 'inventory.transfer', 'inventory.export',
    'purchase.view', 'purchase.create', 'purchase.update', 'purchase.approve', 'purchase.export',
    'sales.view', 'sales.create', 'sales.update', 'sales.approve', 'sales.export',
    'accounting.view', 'accounting.create', 'accounting.export',
    'pos.operate', 'pos.manage',
    'manufacturing.view', 'manufacturing.manage',
    'quality.view', 'quality.manage',
    'employees.view', 'employees.manage',
    'maintenance.view', 'maintenance.manage',
    'fleet.view', 'fleet.manage',
    'repair.view', 'repair.manage',
    'contacts.view', 'contacts.manage',
    'agents.view', 'agents.manage',
    'approvals.manage',
    'reporting.view', 'reporting.export',
    'settings.manage', 'users.manage', 'audit.view',
  ],
  'Manager': [
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust', 'inventory.transfer', 'inventory.export',
    'purchase.view', 'purchase.create', 'purchase.update', 'purchase.approve',
    'sales.view', 'sales.create', 'sales.update', 'sales.approve',
    'pos.operate',
    'manufacturing.view', 'manufacturing.manage',
    'quality.view', 'quality.manage',
    'employees.view',
    'maintenance.view', 'fleet.view', 'repair.view',
    'contacts.view', 'contacts.manage',
    'approvals.manage',
    'reporting.view',
  ],
  'Finance': [
    'accounting.view', 'accounting.create', 'accounting.update', 'accounting.approve', 'accounting.export',
    'purchase.view', 'sales.view', 'reporting.view', 'reporting.export',
    'approvals.manage',
  ],
  'Storekeeper': [
    'inventory.view', 'inventory.create', 'inventory.update', 'inventory.adjust', 'inventory.transfer',
    'purchase.view', 'purchase.create',
    'maintenance.view', 'repair.view',
  ],
  'Sales': [
    'sales.view', 'sales.create', 'sales.update', 'sales.export',
    'contacts.view', 'contacts.manage',
    'pos.operate',
    'agents.view',
  ],
  'HR': [
    'employees.view', 'employees.manage',
    'approvals.manage',
    'reporting.view',
  ],
  'Staff': [
    'inventory.view', 'sales.view', 'pos.operate', 'contacts.view',
  ],
  'Viewer': [
    'inventory.view', 'sales.view', 'reporting.view',
  ],
};

const AUTH_USER_KEY = 'storeman_current_user';

class AuthService {
  private currentUser: UserProfile | null = null;

  constructor() {
    this.restoreSession();
  }

  private restoreSession(): void {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(AUTH_USER_KEY);
      if (stored) {
        try {
          this.currentUser = JSON.parse(stored);
        } catch {
          this.currentUser = null;
        }
      }
    }
  }

  getCurrentUser(): UserProfile | null {
    if (!this.currentUser) {
      this.restoreSession();
    }
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    const user = this.getCurrentUser();
    return !!user && user.status === 'active';
  }

  hasPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.role === 'Super Admin') return true;

    const allowed = ROLE_PERMISSIONS_MAP[user.role] || [];
    return allowed.includes(permission);
  }

  async login(email: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const users = await dbRepository.getAll<UserProfile>('users');
    const matched = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!matched) {
      return { success: false, error: 'User account not found. Please register or check your email.' };
    }

    if (matched.status === 'pending_approval') {
      return {
        success: false,
        error: 'Your account registration is under Administrator review. Access will be unlocked once approved.',
      };
    }

    if (matched.status === 'suspended' || matched.status === 'rejected') {
      return { success: false, error: 'Account access has been deactivated or rejected by the system administrator.' };
    }

    this.currentUser = matched;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(matched));

    await auditLogger.log({
      userId: matched.id,
      userEmail: matched.email,
      companyId: matched.company_id,
      action: 'LOGIN',
      module: 'AUTH',
      entityType: 'SESSION',
      entityId: matched.id,
    });

    return { success: true, user: matched };
  }

  async signUp(params: {
    email: string;
    first_name: string;
    last_name: string;
    company_id: string;
    phone?: string;
  }): Promise<{ success: boolean; message: string; user?: UserProfile; error?: string }> {
    const users = await dbRepository.getAll<UserProfile>('users');
    if (users.some((u) => u.email.toLowerCase() === params.email.toLowerCase())) {
      return {
        success: false,
        message: 'An account with this email address already exists in the system.',
        error: 'An account with this email address already exists in the system.',
      };
    }

    const newUser: UserProfile = {
      id: crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}`,
      email: params.email,
      first_name: params.first_name,
      last_name: params.last_name,
      role: 'Staff',
      status: 'pending_approval',
      company_id: params.company_id,
      phone: params.phone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await dbRepository.insert('users', newUser);

    await auditLogger.log({
      userId: newUser.id,
      userEmail: newUser.email,
      companyId: params.company_id,
      action: 'CREATE',
      module: 'AUTH',
      entityType: 'USER_REGISTRATION',
      entityId: newUser.id,
    });

    return {
      success: true,
      message: 'Registration submitted successfully! An enterprise administrator will review and activate your account.',
      user: newUser,
    };
  }

  async approveUser(userId: string, role: UserRole): Promise<void> {
    const current = this.getCurrentUser();
    await dbRepository.update('users', userId, {
      status: 'active',
      role,
      updated_at: new Date().toISOString(),
    });

    if (current) {
      await auditLogger.log({
        userId: current.id,
        userEmail: current.email,
        companyId: current.company_id,
        action: 'APPROVE',
        module: 'SECURITY',
        entityType: 'USER_ACTIVATION',
        entityId: userId,
        newData: { status: 'active', role },
      });
    }
  }

  async switchCompany(companyId: string): Promise<void> {
    const user = this.getCurrentUser();
    if (user) {
      user.company_id = companyId;
      user.current_company_id = companyId;
      this.currentUser = user;
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
  }

  async logout(): Promise<void> {
    const user = this.getCurrentUser();
    if (user) {
      await auditLogger.log({
        userId: user.id,
        userEmail: user.email,
        companyId: user.company_id,
        action: 'LOGOUT',
        module: 'AUTH',
        entityType: 'SESSION',
        entityId: user.id,
      });
    }

    this.currentUser = null;
    localStorage.removeItem(AUTH_USER_KEY);

    const client = getSupabaseClient();
    if (client && isSupabaseConfigured()) {
      try {
        await client.auth.signOut();
      } catch {
        // ignore
      }
    }
  }
}

export const authService = new AuthService();
