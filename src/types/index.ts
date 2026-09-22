/**
 * STOREMAN ERP - Complete Enterprise Domain Types & Database Definitions
 */

export type UUID = string;

// User Roles & Auth
export type UserRole =
  | 'Super Admin'
  | 'Admin'
  | 'Manager'
  | 'Finance'
  | 'Storekeeper'
  | 'Sales'
  | 'HR'
  | 'Staff'
  | 'Viewer';

export type UserStatus = 'pending_approval' | 'active' | 'suspended' | 'rejected';

export interface UserProfile {
  id: UUID;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  role: UserRole;
  status: UserStatus;
  company_id: UUID;
  current_company_id?: UUID;
  branch_id?: UUID;
  warehouse_id?: UUID;
  department_id?: UUID;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  name: string;
  module: string;
  description: string;
}

export interface RolePermissions {
  role: UserRole;
  permissions: string[];
}

// Multi-Company Structure
export interface Company {
  id: UUID;
  name: string;
  code: string;
  tax_id: string;
  currency: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  logo_url?: string;
  is_active: boolean;
  fiscal_year_start?: string;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: UUID;
  company_id: UUID;
  name: string;
  code: string;
  phone: string;
  address: string;
  is_active: boolean;
  created_at: string;
}

export interface Warehouse {
  id: UUID;
  company_id: UUID;
  branch_id: UUID;
  name: string;
  code: string;
  address: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

export interface Store {
  id: UUID;
  company_id: UUID;
  branch_id: UUID;
  warehouse_id: UUID;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface Department {
  id: UUID;
  company_id: UUID;
  name: string;
  code: string;
  manager_id?: UUID;
  is_active: boolean;
  created_at: string;
}

export interface Location {
  id: UUID;
  warehouse_id: UUID;
  aisle: string;
  rack: string;
  bin: string;
  code: string;
  is_active: boolean;
}

// Inventory & Products
export interface ProductCategory {
  id: UUID;
  company_id: UUID;
  name: string;
  code: string;
  description?: string;
}

export interface Unit {
  id: UUID;
  name: string;
  code: string;
  symbol: string;
}

export interface Product {
  id: UUID;
  company_id: UUID;
  category_id: UUID;
  unit_id: UUID;
  sku: string;
  barcode: string;
  name: string;
  description?: string;
  cost_price: number;
  selling_price: number;
  min_stock_level: number;
  max_stock_level: number;
  reorder_point: number;
  is_batch_tracked: boolean;
  is_serial_tracked: boolean;
  tax_rate: number;
  type?: string;
  unit_of_measure?: string;
  image_url?: string;
  is_active: boolean;
  current_stock?: number;
  created_at: string;
  updated_at: string;
}

export type InventoryTransactionType =
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT_ADD'
  | 'ADJUSTMENT_SUB'
  | 'RETURN'
  | 'OPENING_BALANCE'
  | 'POS_SALE'
  | 'MFG_CONSUME'
  | 'MFG_FINISH'
  | 'REPAIR_USE';

export interface InventoryTransaction {
  id: UUID;
  company_id: UUID;
  warehouse_id: UUID;
  product_id: UUID;
  transaction_type: InventoryTransactionType;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reference_type: string;
  reference_id?: UUID;
  batch_number?: string;
  serial_number?: string;
  notes?: string;
  created_by: UUID;
  created_at: string;
}

export interface StockBalance {
  product_id: UUID;
  warehouse_id: UUID;
  current_quantity: number;
  total_valuation: number;
  reorder_needed: boolean;
}

export interface InventoryAdjustment {
  id: UUID;
  company_id: UUID;
  warehouse_id: UUID;
  adjustment_number: string;
  date: string;
  reason: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  created_by: UUID;
  approved_by?: UUID;
  items: {
    product_id: UUID;
    system_qty: number;
    counted_qty: number;
    diff_qty: number;
    unit_cost: number;
  }[];
  created_at: string;
}

export interface StockTransfer {
  id: UUID;
  company_id: UUID;
  transfer_number: string;
  source_warehouse_id: UUID;
  destination_warehouse_id: UUID;
  status: 'Draft' | 'In Transit' | 'Received' | 'Cancelled';
  date: string;
  notes?: string;
  created_by: UUID;
  items: {
    product_id: UUID;
    quantity: number;
  }[];
  created_at: string;
}

// Contacts: Suppliers, Customers, CRM
export type ContactType = 'Customer' | 'Supplier' | 'Employee' | 'Partner' | 'Agent';

export interface Contact {
  id: UUID;
  company_id: UUID;
  type: ContactType;
  name: string;
  company_name?: string;
  email: string;
  phone: string;
  tax_number?: string;
  credit_limit?: number;
  outstanding_balance: number;
  current_balance?: number;
  payment_terms_days: number;
  billing_address: string;
  shipping_address?: string;
  tags: string[];
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Purchasing
export type PurchaseStatus = 'Draft' | 'Submitted' | 'Approved' | 'Ordered' | 'Received' | 'Invoiced' | 'Closed' | 'Cancelled';

export interface PurchaseRequisition {
  id: UUID;
  company_id: UUID;
  pr_number: string;
  requester_id: UUID;
  department_id: UUID;
  required_date: string;
  reason: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Converted to PO';
  items: {
    product_id: UUID;
    quantity: number;
    estimated_cost: number;
  }[];
  created_at: string;
}

export interface RFQ {
  id: UUID;
  company_id: UUID;
  rfq_number: string;
  supplier_id: UUID;
  date: string;
  expiry_date: string;
  status: 'Draft' | 'Sent' | 'Received' | 'Accepted' | 'Declined';
  delivery_terms: string;
  payment_terms: string;
  items: {
    product_id: UUID;
    quantity: number;
    quoted_price: number;
    tax_rate: number;
  }[];
  created_at: string;
}

export interface PurchaseOrder {
  id: UUID;
  company_id: UUID;
  po_number: string;
  order_number?: string;
  supplier_id: UUID;
  warehouse_id: UUID;
  order_date: string;
  expected_delivery: string;
  status: PurchaseStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_terms: string;
  approval_status: 'Pending' | 'Approved' | 'Rejected';
  notes?: string;
  items: {
    product_id: UUID;
    quantity: number;
    received_quantity: number;
    unit_price: number;
    tax_rate: number;
    discount: number;
    total: number;
  }[];
  created_by: UUID;
  created_at: string;
}

export interface PurchaseReceipt {
  id: UUID;
  company_id: UUID;
  receipt_number: string;
  po_id: UUID;
  supplier_id: UUID;
  warehouse_id: UUID;
  receipt_date: string;
  quality_status: 'Pending QC' | 'Passed' | 'Failed' | 'Partial';
  items: {
    product_id: UUID;
    quantity_received: number;
    unit_cost: number;
    batch_number?: string;
  }[];
  created_by: UUID;
  created_at: string;
}

// Sales
export type SalesStatus = 'Draft' | 'Quotation' | 'Confirmed' | 'Delivered' | 'Invoiced' | 'Paid' | 'Cancelled';

export interface Quotation {
  id: UUID;
  company_id: UUID;
  quotation_number: string;
  customer_id: UUID;
  date: string;
  expiry_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Expired' | 'Converted to Order';
  items: {
    product_id: UUID;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    discount: number;
    total: number;
  }[];
  notes?: string;
  created_by: UUID;
  created_at: string;
}

export interface SalesOrder {
  id: UUID;
  company_id: UUID;
  order_number: string;
  customer_id: UUID;
  warehouse_id: UUID;
  order_date: string;
  delivery_date: string;
  status: SalesStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  agent_id?: UUID;
  commission_amount?: number;
  notes?: string;
  items: {
    product_id: UUID;
    quantity: number;
    delivered_quantity: number;
    unit_price: number;
    tax_rate: number;
    discount: number;
    total: number;
  }[];
  created_by: UUID;
  created_at: string;
}

export interface SalesDelivery {
  id: UUID;
  company_id: UUID;
  delivery_number: string;
  sales_order_id: UUID;
  customer_id: UUID;
  warehouse_id: UUID;
  delivery_date: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Returned';
  tracking_number?: string;
  items: {
    product_id: UUID;
    quantity: number;
  }[];
  created_at: string;
}

// Invoicing & Payments
export type InvoiceType = 'CUSTOMER' | 'SUPPLIER';
export type InvoiceStatus = 'Draft' | 'Posted' | 'Partially Paid' | 'Paid' | 'Void';

export interface Invoice {
  id: UUID;
  company_id: UUID;
  invoice_number: string;
  type: InvoiceType;
  entity_id: UUID; // Customer or Supplier ID
  entity_name: string;
  reference_order_id?: UUID;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  items: {
    description: string;
    product_id?: UUID;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    total: number;
  }[];
  created_at: string;
}

export interface Payment {
  id: UUID;
  company_id: UUID;
  payment_number: string;
  invoice_id?: UUID;
  entity_id: UUID;
  entity_type: 'Customer' | 'Supplier';
  payment_date: string;
  amount: number;
  payment_method: 'Cash' | 'Bank Transfer' | 'Credit Card' | 'Cheque' | 'POS';
  reference_number?: string;
  notes?: string;
  created_by: UUID;
  created_at: string;
}

// Double-Entry Accounting
export type AccountType =
  | 'Asset'
  | 'Liability'
  | 'Equity'
  | 'Revenue'
  | 'Expense';

export interface Account {
  id: UUID;
  company_id: UUID;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  sub_type?: string;
  is_header: boolean;
  parent_id?: UUID;
  current_balance: number;
  is_active: boolean;
}

export interface JournalLine {
  id?: string;
  account_id: UUID;
  account_code?: string;
  account_name?: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: UUID;
  company_id: UUID;
  entry_number: string;
  entry_date: string;
  reference_type: string;
  reference_id?: UUID;
  description: string;
  lines: JournalLine[];
  total_debit: number;
  total_credit: number;
  is_posted: boolean;
  created_by: UUID;
  created_at: string;
}

export interface Expense {
  id: UUID;
  company_id: UUID;
  expense_number: string;
  date: string;
  category: string;
  amount: number;
  tax_amount: number;
  payment_method: string;
  paid_to: string;
  account_id: UUID;
  receipt_url?: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Paid';
  created_by: UUID;
  created_at: string;
}

// POS (Point of Sale)
export interface POSRegister {
  id: UUID;
  company_id: UUID;
  store_id: UUID;
  cashier_id: UUID;
  opened_at: string;
  closed_at?: string;
  opening_balance: number;
  closing_balance?: number;
  cash_sales: number;
  card_sales: number;
  transfer_sales: number;
  total_sales: number;
  status: 'Open' | 'Closed';
}

export interface POSCartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  total: number;
}

export interface POSTransaction {
  id: UUID;
  company_id: UUID;
  receipt_number: string;
  register_id: UUID;
  customer_id?: UUID;
  cashier_id: UUID;
  items: POSCartItem[];
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total_amount: number;
  tender_type: 'Cash' | 'Card' | 'Transfer' | 'Split';
  amount_tendered: number;
  change_due: number;
  timestamp: string;
}

// Manufacturing
export interface BOM {
  id: UUID;
  company_id: UUID;
  product_id: UUID;
  bom_code: string;
  version: string;
  output_quantity: number;
  unit_id: UUID;
  is_active: boolean;
  components: {
    material_product_id: UUID;
    quantity: number;
    unit_cost: number;
    scrap_percentage: number;
  }[];
  labor_cost: number;
  overhead_cost: number;
  total_estimated_cost: number;
  created_at: string;
}

export interface ProductionOrder {
  id: UUID;
  company_id: UUID;
  order_number: string;
  bom_id: UUID;
  target_product_id: UUID;
  warehouse_id: UUID;
  target_quantity: number;
  produced_quantity: number;
  quantity_to_produce?: number;
  quantity_produced?: number;
  due_date?: string;
  waste_quantity: number;
  start_date: string;
  end_date?: string;
  status: 'Planned' | 'Released' | 'In Progress' | 'QC Inspection' | 'Completed' | 'Cancelled' | string;
  assigned_machine?: string;
  materials_consumed: {
    product_id: UUID;
    planned_qty: number;
    actual_qty: number;
  }[];
  total_cost: number;
  total_estimated_cost?: number;
  total_actual_cost?: number;
  created_by?: UUID;
  created_at: string;
}

// Quality Management
export interface QualityRule {
  id: UUID;
  company_id: UUID;
  title: string;
  module: 'Purchase' | 'Manufacturing' | 'Sales Returns' | 'Repair';
  criteria: string;
  min_acceptable_score: number;
  is_active: boolean;
  rule_name?: string;
  inspection_stage?: string;
  product_id?: string;
  parameters?: { name: string; standard_value: string; tolerance: string }[];
  sampling_percentage?: number;
  is_mandatory?: boolean;
}

export interface QualityInspection {
  id: UUID;
  company_id: UUID;
  inspection_number: string;
  rule_id: UUID;
  reference_type: string;
  reference_id: UUID;
  inspector_id: UUID;
  inspection_date: string;
  status: 'Passed' | 'Failed' | 'Conditional';
  score: number;
  findings: string;
  defects: {
    description: string;
    severity: 'Minor' | 'Major' | 'Critical';
    corrective_action?: string;
  }[];
  created_at: string;
}

// Employees / HR
export interface Employee {
  id: UUID;
  company_id: UUID;
  first_name: string;
  last_name: string;
  employee_code: string;
  email: string;
  phone: string;
  department_id: UUID;
  position: string;
  employment_type: 'Full-time' | 'Part-time' | 'Contract';
  status: 'Active' | 'On Leave' | 'Terminated' | string;
  employment_status?: 'Active' | 'On Leave' | 'Terminated' | string;
  base_salary: number;
  salary?: number;
  hire_date?: string;
  join_date: string;
  created_at: string;
}

export interface Attendance {
  id: UUID;
  company_id: UUID;
  employee_id: UUID;
  date: string;
  check_in: string;
  check_out?: string;
  status: 'Present' | 'Late' | 'Absent' | 'Half Day';
}

export interface LeaveRequest {
  id: UUID;
  company_id: UUID;
  employee_id: UUID;
  leave_type: 'Annual' | 'Sick' | 'Maternity' | 'Unpaid';
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approved_by?: UUID;
  created_at: string;
}

// Maintenance & Fleet
export interface AssetMachine {
  id: UUID;
  company_id: UUID;
  asset_tag: string;
  code?: string;
  name: string;
  model: string;
  serial_number: string;
  category?: 'Machinery' | 'Vehicle' | 'IT Equipment' | 'Facility' | string;
  location?: string;
  purchase_date?: string;
  purchase_cost?: number;
  status: 'Operational' | 'Under Maintenance' | 'Maintenance' | 'Decommissioned' | string;
  last_service_date?: string;
  next_service_date?: string;
  last_maintenance?: string;
  next_maintenance?: string;
  created_at?: string;
}

export interface MaintenanceOrder {
  id: UUID;
  company_id: UUID;
  order_number: string;
  asset_id: UUID;
  technician_id?: UUID;
  scheduled_date: string;
  completed_date?: string;
  type: 'Preventive' | 'Corrective' | 'Emergency';
  status: 'Scheduled' | 'In Progress' | 'Waiting for Parts' | 'Completed';
  parts_cost: number;
  labor_cost: number;
  total_cost: number;
  work_description: string;
  created_at: string;
}

export interface Vehicle {
  id: UUID;
  company_id: UUID;
  plate_number: string;
  make_model: string;
  model?: string;
  year: number;
  driver_id?: UUID;
  driver_name?: string;
  mileage: number;
  odometer?: number;
  fuel_type: 'Diesel' | 'Petrol' | 'Electric' | 'Hybrid';
  insurance_expiry: string;
  status: 'Active' | 'Grounded' | 'In Maintenance' | 'Available' | 'Dispatched' | string;
}

export interface FuelLog {
  id: UUID;
  company_id: UUID;
  vehicle_id: UUID;
  driver_id: UUID;
  date: string;
  liters: number;
  cost_per_liter: number;
  total_amount: number;
  odometer_reading: number;
  gas_station?: string;
}

// Repair Module
export interface RepairRequest {
  id: UUID;
  company_id: UUID;
  repair_number: string;
  type: 'Customer' | 'Internal';
  ticket_number?: string;
  item_name?: string;
  serial_number?: string;
  problem_description?: string;
  warranty_status?: string;
  estimated_cost?: number;
  customer_id?: UUID;
  asset_id?: UUID;
  item_description?: string;
  problem_reported?: string;
  technician_id?: UUID;
  status: any;
  parts?: {
    product_id: UUID;
    quantity: number;
    unit_cost: number;
  }[];
  labor_hours?: number;
  labor_rate?: number;
  total_cost?: number;
  invoice_id?: UUID;
  created_at: string;
  updated_at?: string;
}

// Agents & Commission
export interface Agent {
  id: UUID;
  company_id: UUID;
  name: string;
  code: string;
  email: string;
  phone: string;
  commission_rate: number; // percentage e.g. 5.0
  total_sales: number;
  total_earned: number;
  total_paid: number;
  is_active: boolean;
}

export interface CommissionRecord {
  id: UUID;
  company_id: UUID;
  agent_id: UUID;
  sales_order_id: UUID;
  order_total: number;
  commission_rate: number;
  commission_amount: number;
  status: 'Pending' | 'Approved' | 'Paid';
  created_at: string;
}

// Generic Workflow & Approval Engine
export type WorkflowType = 'Purchase' | 'Expense' | 'Leave' | 'Stock Adjustment' | 'Sales' | 'Custom';
export type ApprovalStatus = 'Draft' | 'Submitted' | 'Level 1' | 'Level 2' | 'Finance' | 'Approved' | 'Rejected';

export interface ApprovalRequest {
  id: UUID;
  company_id: UUID;
  workflow_type: WorkflowType;
  reference_id: UUID;
  reference_number: string;
  amount?: number;
  requester_id: UUID;
  requester_name: string;
  current_step: number;
  total_steps: number;
  status: ApprovalStatus;
  history: {
    step: number;
    actor_id: UUID;
    actor_name: string;
    action: 'Submitted' | 'Approved' | 'Rejected' | 'Commented';
    comment?: string;
    timestamp: string;
  }[];
  created_at: string;
  updated_at: string;
}

// Notifications
export interface NotificationItem {
  id: UUID;
  company_id: UUID;
  user_id?: UUID;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  related_entity_type?: string;
  related_entity_id?: UUID;
  is_read: boolean;
  created_at: string;
}

// Audit Log
export interface AuditLogEntry {
  id: UUID;
  company_id: UUID;
  user_id: UUID;
  user_email?: string;
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'PAYMENT' | 'STOCK_ADJUST' | 'CONFIG';
  module: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  ip_address?: string;
  timestamp: string;
  created_at?: string;
}

// Module Store / App Marketplace
export interface ERPAppModule {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  is_enabled: boolean;
  is_core: boolean; // cannot be disabled
  dependencies: string[];
}

// Global System Settings
export interface SystemSettings {
  company_name: string;
  currency: string;
  currency_symbol: string;
  date_format: string;
  timezone: string;
  fiscal_year_start: string;
  tax_rate: number;
  tax_name: string;
  low_stock_threshold: number;
  require_pr_approval: boolean;
  require_po_approval: boolean;
  require_expense_approval: boolean;
  dark_mode: boolean;
}

// Module Aliases for cross-system consistency
export type RetailStore = Store;
export type AuditLog = AuditLogEntry;
export type RepairTicket = RepairRequest;
export type Machine = AssetMachine;
export type BillOfMaterials = BOM;
export type WorkOrder = ProductionOrder;
export type User = UserProfile;
export type UnitOfMeasure = Unit;

export interface AppNotification {
  id: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER';
  title: string;
  message: string;
  timestamp?: string;
  created_at?: string;
  is_read: boolean;
  link?: string;
}
