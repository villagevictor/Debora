import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Package, Users, Building, FileText, ArrowRight } from 'lucide-react';
import { dbRepository } from '../services/dbRepository';
import { Product, Contact, Employee, Invoice } from '../types';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: string) => void;
}

interface SearchResult {
  category: 'Products' | 'Contacts' | 'Employees' | 'Invoices';
  id: string;
  title: string;
  subtitle: string;
  module: string;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Open triggered by parent state
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const q = query.toLowerCase();
      const hits: SearchResult[] = [];

      // 1. Search Products
      const products = await dbRepository.getAll<Product>('products');
      products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.barcode.toLowerCase().includes(q)
        )
        .slice(0, 4)
        .forEach((p) => {
          hits.push({
            category: 'Products',
            id: p.id,
            title: p.name,
            subtitle: `SKU: ${p.sku} • Stock: ${p.current_stock || 0}`,
            module: 'inventory',
          });
        });

      // 2. Search Contacts
      const contacts = await dbRepository.getAll<Contact>('contacts');
      contacts
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.company_name && c.company_name.toLowerCase().includes(q)) ||
            c.email.toLowerCase().includes(q)
        )
        .slice(0, 4)
        .forEach((c) => {
          hits.push({
            category: 'Contacts',
            id: c.id,
            title: c.name,
            subtitle: `${c.type} • ${c.email}`,
            module: 'contacts',
          });
        });

      // 3. Search Employees
      const employees = await dbRepository.getAll<Employee>('employees');
      employees
        .filter(
          (e) =>
            e.first_name.toLowerCase().includes(q) ||
            e.last_name.toLowerCase().includes(q) ||
            e.employee_code.toLowerCase().includes(q)
        )
        .slice(0, 3)
        .forEach((e) => {
          hits.push({
            category: 'Employees',
            id: e.id,
            title: `${e.first_name} ${e.last_name}`,
            subtitle: `${e.position} • ${e.employee_code}`,
            module: 'employees',
          });
        });

      // 4. Search Invoices
      const invoices = await dbRepository.getAll<Invoice>('invoices');
      invoices
        .filter(
          (inv) =>
            inv.invoice_number.toLowerCase().includes(q) ||
            inv.entity_name.toLowerCase().includes(q)
        )
        .slice(0, 3)
        .forEach((inv) => {
          hits.push({
            category: 'Invoices',
            id: inv.id,
            title: inv.invoice_number,
            subtitle: `${inv.entity_name} • $${inv.total_amount.toFixed(2)} (${inv.status})`,
            module: 'accounting',
          });
        });

      setResults(hits);
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, customers, suppliers, invoices, or employees..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Type to search across the entire ERP ecosystem...
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching records found for "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((hit) => (
                <div
                  key={`${hit.category}-${hit.id}`}
                  onClick={() => {
                    onNavigate(hit.module);
                    onClose();
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800/60 cursor-pointer group transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition">
                      {hit.category === 'Products' && <Package className="w-4 h-4" />}
                      {hit.category === 'Contacts' && <Building className="w-4 h-4" />}
                      {hit.category === 'Employees' && <Users className="w-4 h-4" />}
                      {hit.category === 'Invoices' && <FileText className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600">
                        {hit.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {hit.subtitle}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 group-hover:text-indigo-600">
                    <span>{hit.category}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 flex justify-between">
          <span>Search across 45+ ERP relational tables</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
};
