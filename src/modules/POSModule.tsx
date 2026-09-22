import React, { useState, useEffect } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  ArrowRight,
  Printer,
  CheckCircle2,
  Lock,
  Unlock,
  Package,
} from 'lucide-react';
import { dbRepository } from '../services/dbRepository';
import { posService } from '../services/posService';
import { exportService } from '../services/exportService';
import { authService } from '../services/authService';
import { Product, POSRegister, POSTransaction, POSCartItem, RetailStore, Warehouse, Contact } from '../types';
import { formatCurrency } from '../lib/utils';
import { Modal } from '../components/Modal';

interface POSModuleProps {
  companyId?: string;
}

export const POSModule: React.FC<POSModuleProps> = ({ companyId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<RetailStore[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [activeRegister, setActiveRegister] = useState<POSRegister | null>(null);

  // Filter & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [tenderType, setTenderType] = useState<'Cash' | 'Card' | 'Transfer'>('Cash');
  const [amountTendered, setAmountTendered] = useState<number>(0);

  // Modals
  const [receiptModal, setReceiptModal] = useState<POSTransaction | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<number>(200);
  const [closingBalance, setClosingBalance] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const prodList = await dbRepository.getAll<Product>('products', companyId);
    setProducts(prodList.filter((p) => p.is_active));

    const storeList = await dbRepository.getAll<RetailStore>('stores', companyId);
    setStores(storeList);

    const whList = await dbRepository.getAll<Warehouse>('warehouses', companyId);
    setWarehouses(whList);

    const custList = await dbRepository.getAll<Contact>('contacts', companyId);
    setCustomers(custList.filter((c) => c.type === 'Customer'));

    if (storeList.length > 0) {
      const reg = await posService.getActiveRegister(companyId || '', storeList[0].id);
      setActiveRegister(reg);
    }
  };

  // Add product to cart
  const handleAddToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * item.unit_price,
              }
            : item
        )
      );
    } else {
      const unitPrice = product.selling_price || 0;
      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          unit_price: unitPrice,
          tax_rate: 8.25, // 8.25% default sales tax
          discount: 0,
          total: unitPrice,
        },
      ]);
    }
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0
              ? { ...item, quantity: newQty, total: newQty * item.unit_price }
              : null;
          }
          return item;
        })
        .filter(Boolean) as POSCartItem[]
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  // Calculations
  const rawSubtotal = cart.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);
  const discountAmount = Math.round((rawSubtotal * (discountPercent / 100)) * 100) / 100;
  const taxableAmount = rawSubtotal - discountAmount;
  const taxTotal = Math.round((taxableAmount * 0.0825) * 100) / 100;
  const totalAmount = Math.round((taxableAmount + taxTotal) * 100) / 100;

  useEffect(() => {
    setAmountTendered(totalAmount);
  }, [totalAmount]);

  // Open register shift
  const handleOpenShift = async () => {
    if (!stores[0]) return;
    const user = authService.getCurrentUser();
    const reg = await posService.openRegister({
      company_id: companyId || '',
      store_id: stores[0].id,
      cashier_id: user ? user.id : 'usr-admin',
      opening_balance: openingBalance,
    });
    setActiveRegister(reg);
    setIsShiftModalOpen(false);
  };

  // Close register shift
  const handleCloseShift = async () => {
    if (!activeRegister) return;
    await posService.closeRegister(activeRegister.id, closingBalance);
    setActiveRegister(null);
    setIsShiftModalOpen(false);
    alert('Register shift closed and reconciled successfully!');
  };

  // Complete Checkout
  const handleCheckout = async () => {
    if (!activeRegister) {
      alert('Please open a Cash Register shift first before checking out.');
      return;
    }
    if (cart.length === 0) {
      alert('Cart is empty.');
      return;
    }
    if (amountTendered < totalAmount) {
      alert('Amount tendered is less than the total amount due.');
      return;
    }

    const user = authService.getCurrentUser();
    const targetStore = stores[0];
    const targetWh = warehouses[0];

    try {
      const receipt = await posService.processCheckout({
        company_id: companyId || '',
        store_id: targetStore?.id || '',
        warehouse_id: targetWh?.id || '',
        register_id: activeRegister.id,
        cashier_id: user ? user.id : 'usr-admin',
        customer_id: selectedCustomerId || undefined,
        items: cart,
        subtotal: rawSubtotal,
        tax_total: taxTotal,
        discount_total: discountAmount,
        total_amount: totalAmount,
        tender_type: tenderType,
        amount_tendered: amountTendered,
      });

      // Show receipt modal and reset cart
      setReceiptModal(receipt);
      setCart([]);
      setDiscountPercent(0);
      await loadData();
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
    }
  };

  // Filtered products for display
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'ALL' || (p.type || p.category_id) === selectedCategory;
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-4">
      {/* Top Shift Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${activeRegister ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {activeRegister ? <Unlock className="w-4 h-4 text-white" /> : <Lock className="w-4 h-4 text-white" />}
          </div>
          <div>
            <div className="text-xs font-bold">
              {activeRegister ? `Register Open (Store: ${stores[0]?.name || 'Retail HQ'})` : 'Register Shift Closed'}
            </div>
            <div className="text-[10px] text-slate-300">
              {activeRegister
                ? `Opening Cash: $${activeRegister.opening_balance.toFixed(2)} • Total Shift Sales: $${(activeRegister.total_sales || 0).toFixed(2)}`
                : 'Open register to begin taking payments'}
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsShiftModalOpen(true)}
          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 transition backdrop-blur-xs"
        >
          {activeRegister ? 'Reconcile & Close Register' : 'Open Register Shift'}
        </button>
      </div>

      {/* POS Main Workspace: Left Catalog, Right Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Product Catalog (8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Search & Category Pills */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode or type product name / SKU..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {['ALL', 'Finished Goods', 'Raw Material', 'Consumable'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[620px] overflow-y-auto p-1">
            {filteredProducts.map((prod) => {
              const inStock = (prod.current_stock || 0) > 0;
              return (
                <div
                  key={prod.id}
                  onClick={() => inStock && handleAddToCart(prod)}
                  className={`flex flex-col justify-between p-3.5 rounded-xl border transition select-none ${
                    inStock
                      ? 'border-slate-200 bg-white hover:border-indigo-500 hover:shadow-md cursor-pointer dark:border-slate-800 dark:bg-slate-900'
                      : 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed dark:border-slate-800 dark:bg-slate-800/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{prod.sku}</span>
                      <span className={inStock ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                        {inStock ? `${prod.current_stock} ${prod.unit_of_measure || 'units'}` : 'Out of stock'}
                      </span>
                    </div>
                    <div className="mt-1.5 font-bold text-xs text-slate-900 dark:text-white line-clamp-2">
                      {prod.name}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(prod.selling_price || 0)}
                    </span>
                    <button
                      disabled={!inStock}
                      className="p-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition disabled:opacity-30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Checkout Cart (4 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between shadow-xs overflow-hidden">
          {/* Cart Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">Active Order</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                {cart.length} items
              </span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-[11px] text-rose-500 hover:text-rose-700 font-medium"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Customer Selection */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <label className="block text-[10px] font-semibold text-slate-500 mb-1">Customer</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white px-2 py-1.5"
            >
              <option value="">Walk-in Retail Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.company_name || 'Individual'})
                </option>
              ))}
            </select>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[300px]">
            {cart.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                Cart is empty. Tap items on the left to add.
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40 flex items-center justify-between text-xs"
                >
                  <div className="flex-1 pr-2">
                    <div className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                      {item.product.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      ${item.unit_price.toFixed(2)} each
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
                      <button
                        onClick={() => handleUpdateQty(item.product.id, -1)}
                        className="p-1 text-slate-500 hover:text-slate-700"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 font-mono font-bold text-xs">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQty(item.product.id, 1)}
                        className="p-1 text-slate-500 hover:text-slate-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-bold font-mono text-slate-900 dark:text-white w-14 text-right">
                      ${item.total.toFixed(2)}
                    </span>

                    <button
                      onClick={() => handleRemoveItem(item.product.id)}
                      className="p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pricing Totals & Payment Summary */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3">
            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(rawSubtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Discount ({discountPercent}%)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-12 text-right px-1 py-0.5 text-xs rounded border border-slate-200 dark:border-slate-700"
                  />
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span>Sales Tax (8.25%)</span>
                <span>{formatCurrency(taxTotal)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Total Due</span>
                <span className="text-indigo-600 dark:text-indigo-400">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {/* Tender Buttons */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {(['Cash', 'Card', 'Transfer'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setTenderType(method)}
                  className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                    tenderType === method
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold dark:bg-indigo-950 dark:border-indigo-500 dark:text-indigo-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {/* Amount Tendered (for Cash change) */}
            {tenderType === 'Cash' && (
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500 font-medium">Cash Tendered:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="1"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(parseFloat(e.target.value) || 0)}
                    className="w-24 text-right px-2 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono font-bold"
                  />
                  <span className="text-[11px] text-emerald-600 font-bold">
                    Change: ${Math.max(0, amountTendered - totalAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Checkout Action Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || !activeRegister}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs tracking-wide uppercase shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Complete & Print Receipt
            </button>
          </div>
        </div>
      </div>

      {/* Shift Modal */}
      <Modal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        title={activeRegister ? 'Reconcile & Close Cash Register' : 'Open Cash Register Shift'}
      >
        <div className="space-y-4 text-xs">
          {activeRegister ? (
            <>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span>Opening Float:</span>
                  <span className="font-mono font-bold">${activeRegister.opening_balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Sales Recorded:</span>
                  <span className="font-mono font-bold">${(activeRegister.cash_sales || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Card / Electronic Sales:</span>
                  <span className="font-mono font-bold">${(activeRegister.card_sales || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>Expected Drawer Cash:</span>
                  <span className="font-mono text-indigo-600">
                    ${(activeRegister.opening_balance + (activeRegister.cash_sales || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Actual Counted Cash in Drawer ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloseShift}
                  className="px-4 py-2 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700"
                >
                  Close & Reconcile Shift
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block font-medium mb-1">Opening Cash Float ($)</label>
                <input
                  type="number"
                  step="1"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsShiftModalOpen(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOpenShift}
                  className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                >
                  Open Register Now
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* POS Receipt Modal */}
      <Modal
        isOpen={!!receiptModal}
        onClose={() => setReceiptModal(null)}
        title="Transaction Completed"
        maxWidth="md"
      >
        {receiptModal && (
          <div className="space-y-4 text-xs">
            <div className="p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50 font-mono text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <div className="font-bold text-sm">STOREMAN RETAIL OUTLET</div>
                <div className="text-[10px]">Receipt #{receiptModal.receipt_number}</div>
                <div className="text-[10px]">{new Date(receiptModal.timestamp).toLocaleString()}</div>
              </div>

              <div className="py-2 space-y-1">
                {receiptModal.items.map((i) => (
                  <div key={i.product.id} className="flex justify-between">
                    <span>
                      {i.quantity}x {i.product.name}
                    </span>
                    <span>${i.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${receiptModal.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (8.25%):</span>
                  <span>${receiptModal.tax_total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t">
                  <span>TOTAL:</span>
                  <span>${receiptModal.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>Tender ({receiptModal.tender_type}):</span>
                  <span>${receiptModal.amount_tendered.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Change:</span>
                  <span>${receiptModal.change_due.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-center pt-3 text-[10px] text-slate-500">
                Thank you for your business! Auto-posted to General Ledger & Stock Ledger.
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => exportService.printReport('Receipt')}
                className="flex items-center gap-1.5 px-4 py-2 border rounded-lg hover:bg-slate-100"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Receipt
              </button>
              <button
                onClick={() => setReceiptModal(null)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold"
              >
                Next Sale
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
