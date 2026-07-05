import React, { useState, useEffect } from 'react';
import { Search, X, Plus, Layers, Mountain, Package, Ruler, Save, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TransactionItem } from '../db/schema';
import { offlineSync, useOnlineStatus } from '../lib/offlineSync';

import { AppContext } from '../types';

export default function NewEntryView({ navigateTo, context }: { navigateTo: any, context?: AppContext }) {
  const { isOnline } = useOnlineStatus();
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomersDropdown, setShowCustomersDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
       const { data } = await supabase.from('customers').select('*');
       if (data) setCustomers(data);
    };
    fetchCustomers();
  }, []);

  React.useEffect(() => {
    if (context?.customerId && customers.length > 0 && !selectedCustomer) {
        const cust = customers.find(c => c.id === context.customerId);
        if (cust) setSelectedCustomer(cust);
    }
  }, [context?.customerId, customers, selectedCustomer]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [items, setItems] = useState<(TransactionItem & { id: string })[]>([
    { id: '1', material: '', qty: 1, unit: 'Trolley', rate: 0 }
  ]);
  const [cashPaid, setCashPaid] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState('Cash');

  const totalBill = items.reduce((acc, item) => acc + (item.qty * item.rate), 0);
  const finalDue = totalBill - (Number(cashPaid) || 0);

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), material: '', qty: 1, unit: 'Trolley', rate: 0 }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof TransactionItem, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.phone && c.phone.includes(searchQuery)) ||
    (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSave = async () => {
    if (!selectedCustomer) {
        setErrorMsg('Please select a customer');
        return;
    }
    if (items.some(item => !item.material || item.rate <= 0 || item.qty <= 0)) {
        setErrorMsg('Please fill all item details correctly');
        return;
    }
    
    setIsSubmitting(true);
    setErrorMsg(null);

    const isNetworkError = (error: any) => {
        if (!navigator.onLine) return true;
        const msg = (error?.message || '').toLowerCase();
        return msg.includes('fetch') || msg.includes('network') || msg.includes('cors') || error?.status === 0;
    };

    const saveOffline = async () => {
        try {
            const userRes = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
            const userId = userRes?.data?.user?.id;
            const validItems = items.map(({ id, ...rest }) => rest);
            
            offlineSync.addPendingOp('transaction', 'insert', {
                customer_id: selectedCustomer.id,
                recorded_by: userId,
                total_amount: totalBill,
                date,
                due_date: dueDate || null,
                items: validItems
            }, selectedCustomer.name);

            if (Number(cashPaid) > 0) {
                offlineSync.addPendingOp('payment', 'insert', {
                    customer_id: selectedCustomer.id,
                    recorded_by: userId,
                    amount: Number(cashPaid),
                    payment_mode: paymentMode,
                    reference_notes: 'Initial Payment (Offline)',
                    date
                }, selectedCustomer.name);
            }

            alert('You are currently offline or connection is unstable. Your entry has been saved locally and will sync automatically once network service is restored.');
            navigateTo('customer-ledger', { customerId: selectedCustomer.id });
        } catch (offlineErr: any) {
            console.error('Offline save error:', offlineErr);
            setErrorMsg('Failed to save operation to local cache');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!navigator.onLine) {
        await saveOffline();
        return;
    }

    try {
        const userRes = await supabase.auth.getUser();
        const userId = userRes.data.user?.id;
        const validItems = items.map(({ id, ...rest }) => rest);
        
        const { error: txError } = await supabase.from('transactions').insert([{
            customer_id: selectedCustomer.id,
            recorded_by: userId,
            total_amount: totalBill,
            date,
            due_date: dueDate || null,
            items: validItems
        }]);
        if (txError) throw txError;

        if (Number(cashPaid) > 0) {
            const { error: pyError } = await supabase.from('payments').insert([{
                customer_id: selectedCustomer.id,
                recorded_by: userId,
                amount: Number(cashPaid),
                payment_mode: paymentMode,
                reference_notes: 'Initial Payment',
                date
            }]);
            if (pyError) throw pyError;
        }

        navigateTo('customer-ledger', { customerId: selectedCustomer.id });
    } catch (error: any) {
        console.error('Error saving entry:', error);
        if (isNetworkError(error)) {
            await saveOffline();
        } else {
            setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to save entry');
            alert(`Save Error: ${error.message || error.details || JSON.stringify(error)}`);
            setIsSubmitting(false);
        }
    }
  };

  const quickAdd = (material: string, rate: number, unit: string) => {
      const emptyIndex = items.findIndex(item => !item.material);
      if (emptyIndex !== -1) {
          updateItem(items[emptyIndex].id, 'material', material);
          updateItem(items[emptyIndex].id, 'rate', rate);
          updateItem(items[emptyIndex].id, 'unit', unit);
      } else {
          setItems([...items, { id: Date.now().toString(), material, qty: 1, unit, rate }]);
      }
  };

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-12 space-y-8 pb-32 selection:bg-secondary-fixed selection:text-on-secondary-fixed relative">
      <section className="space-y-5">
        {errorMsg && (
            <div className="p-4 bg-error-container text-on-error-container text-sm font-medium rounded-xl border border-error/20">
              <p className="font-bold mb-1">Error:</p>
              <p>{errorMsg}</p>
            </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="flex-1 relative">
             <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-widest">Date</label>
             <div className="relative">
               <div className="w-full h-12 px-4 flex items-center bg-surface-container-lowest border border-outline-variant/60 rounded-lg font-label-numeric font-semibold text-on-surface shadow-sm pointer-events-none">
                  {date ? new Date(date).toLocaleDateString('en-GB') : 'DD/MM/YYYY'}
               </div>
               <input value={date} onChange={e => setDate(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" type="date" />
             </div>
          </div>
          <div className="flex-1 relative">
             <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-widest">Due Date</label>
             <div className="relative">
               <div className="w-full h-12 px-4 flex items-center bg-surface-container-lowest border border-outline-variant/60 rounded-lg font-label-numeric font-semibold text-on-surface shadow-sm pointer-events-none">
                  {dueDate ? new Date(dueDate).toLocaleDateString('en-GB') : 'DD/MM/YYYY'}
               </div>
               <input value={dueDate} onChange={e => setDueDate(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" type="date" />
             </div>
          </div>
          <div className="flex-1 relative">
             <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-widest">Customer</label>
             <div className="relative shadow-sm rounded-lg">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
                <input 
                  className="w-full h-12 pl-12 pr-20 bg-surface-container-lowest border border-outline-variant/60 rounded-lg text-[15px] font-semibold text-on-surface focus:outline-none focus:border-secondary transition-colors" 
                  placeholder="Search customer..." 
                  type="text" 
                  value={searchQuery}
                  onChange={e => {
                      setSearchQuery(e.target.value);
                      setShowCustomersDropdown(true);
                      setSelectedCustomer(null);
                  }}
                  onFocus={() => setShowCustomersDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCustomersDropdown(false), 200)}
                />
                {!selectedCustomer && searchQuery && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-error bg-error-container/20 px-2 py-1 rounded">No selection</div>
                )}
                {selectedCustomer && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-1 rounded">
                        Selected: {selectedCustomer.name}
                    </div>
                )}
             </div>
             {showCustomersDropdown && filteredCustomers.length > 0 && (
                 <div className="absolute top-full left-0 right-0 mt-2 bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-lg z-20 max-h-60 overflow-y-auto">
                     {filteredCustomers.map(c => (
                         <div 
                           key={c.id} 
                           onClick={() => {
                               setSelectedCustomer(c);
                               setSearchQuery(c.name);
                               setShowCustomersDropdown(false);
                           }}
                           className="p-3 hover:bg-surface-container cursor-pointer flex justify-between items-center border-b border-surface-variant/30 last:border-0"
                         >
                             <div className="font-bold text-sm text-primary">{c.name}</div>
                             <div className="text-xs text-on-surface-variant font-medium">{c.phone || c.address}</div>
                         </div>
                     ))}
                 </div>
             )}
          </div>
        </div>

        <div className="pt-2 relative z-0">
           <label className="block text-[10px] font-bold text-on-surface-variant mb-3 uppercase tracking-widest">Quick Add</label>
           <div className="flex flex-wrap gap-3">
             <button onClick={() => quickAdd('Sand', 7000, 'Trolley')} className="h-10 px-4 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface text-[13px] font-semibold hover:bg-surface-container-highest transition-colors flex items-center gap-2">
               <Layers size={16} /> Sand
             </button>
             <button onClick={() => quickAdd('Stone', 6500, 'Trolley')} className="h-10 px-4 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface text-[13px] font-semibold hover:bg-surface-container-highest transition-colors flex items-center gap-2">
               <Mountain size={16} /> Stone
             </button>
             <button onClick={() => quickAdd('Cement', 450, 'Bag')} className="h-10 px-4 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface text-[13px] font-semibold hover:bg-surface-container-highest transition-colors flex items-center gap-2">
               <Package size={16} /> Cement
             </button>
             <button onClick={() => quickAdd('Steel Rod', 85, 'Kg')} className="h-10 px-4 rounded-full bg-surface-container border border-outline-variant/30 text-on-surface text-[13px] font-semibold hover:bg-surface-container-highest transition-colors flex items-center gap-2">
               <Ruler size={16} /> Steel Rod
             </button>
           </div>
        </div>
      </section>

      <hr className="border-surface-variant/70 border-t-2" />

      <section className="space-y-5">
        <h2 className="text-[22px] font-bold text-on-surface tracking-tight">Items</h2>
        
        {items.map((item, index) => (
            <div key={item.id} className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-surface-variant/80 relative focus-within:border-secondary focus-within:shadow-md transition-all">
               {items.length > 1 && (
                   <button onClick={() => removeItem(item.id)} className="absolute -right-3 -top-3 w-8 h-8 bg-surface-container-high text-on-surface-variant rounded-full flex items-center justify-center shadow-sm hover:text-error hover:bg-error-container transition-colors border border-outline-variant/20">
                      <X size={16} strokeWidth={3} />
                   </button>
               )}
               <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                 <div className="md:col-span-5">
                    <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-widest">Material</label>
                    <input value={item.material} onChange={e => updateItem(item.id, 'material', e.target.value)} className="w-full h-10 px-2 bg-transparent border-b border-outline-variant/50 text-[17px] font-bold focus:outline-none focus:border-secondary transition-colors" type="text" placeholder="e.g. Sand" />
                 </div>
                 <div className="grid grid-cols-2 md:col-span-4 gap-4">
                   <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-widest">Qty</label>
                      <input value={item.qty} onChange={e => updateItem(item.id, 'qty', Number(e.target.value) || 0)} className="w-full h-10 px-2 bg-transparent border-b border-outline-variant/50 font-label-numeric font-bold text-lg focus:outline-none focus:border-secondary transition-colors text-right" type="number" />
                   </div>
                   <div>
                      <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-widest">Unit</label>
                      <select value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)} className="w-full h-10 px-2 bg-transparent border-b border-outline-variant/50 text-sm font-semibold focus:outline-none focus:border-secondary transition-colors appearance-none">
                         <option>Trolley</option>
                         <option>Bag</option>
                         <option>Kg</option>
                         <option>Piece</option>
                      </select>
                   </div>
                 </div>
                 <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-on-surface-variant mb-1 uppercase tracking-widest">Rate (₹)</label>
                    <input value={item.rate} onChange={e => updateItem(item.id, 'rate', Number(e.target.value) || 0)} className="w-full h-10 px-2 bg-transparent border-b border-outline-variant/50 font-label-numeric font-bold text-lg focus:outline-none focus:border-secondary transition-colors text-right" type="number" />
                 </div>
               </div>
               
               <div className="mt-5 flex justify-end items-center gap-3 text-on-surface-variant">
                  <span className="text-[13px] font-bold font-label-numeric tracking-wider">{item.qty} × {item.rate} =</span>
                  <span className="font-label-numeric text-[20px] text-on-surface font-bold tracking-tight">{(item.qty * item.rate).toLocaleString()}</span>
               </div>
            </div>
        ))}

        <button onClick={addItem} className="w-full h-14 border-2 border-dashed border-outline-variant/60 rounded-xl text-on-surface-variant font-bold flex items-center justify-center gap-2 hover:bg-surface-container hover:text-on-surface hover:border-outline-variant transition-colors text-sm">
           <Plus size={18} strokeWidth={3} /> Add Custom Item
        </button>
      </section>

      <div className="bg-surface-container border border-surface-variant/80 rounded-2xl shadow-md p-5 md:p-8 space-y-6 mt-12 relative z-10 transition-all">
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2 hidden md:block"></div>
            <div className="col-span-1">
               <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-widest">Total Bill</label>
               <div className="font-label-numeric text-[26px] text-on-surface font-bold tracking-tight leading-none">₹ {totalBill.toLocaleString()}</div>
            </div>
            <div className="col-span-1">
               <label className="block text-[10px] font-bold text-on-surface-variant mb-1.5 uppercase tracking-widest">Amount Paid (₹)</label>
               <input value={cashPaid} onChange={e => setCashPaid(e.target.value === '' ? '' : Number(e.target.value))} className="w-full h-11 px-3 bg-surface-container-lowest border border-outline-variant/50 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors font-label-numeric font-bold text-lg text-right" type="number" placeholder="0" />
            </div>
         </div>
         
         {Number(cashPaid) > 0 && (
            <div className="flex justify-end mt-4">
              <div className="w-full md:w-2/4">
                <label className="block text-[10px] font-bold text-on-surface-variant mb-2 uppercase tracking-widest text-right">Payment Mode</label>
                <div className="flex flex-wrap gap-2 justify-end">
                   {['Cash', 'PhonePe', 'UPI', 'Bank Transfer', 'Cheque'].map(mode => (
                       <button
                         key={mode}
                         type="button"
                         onClick={() => setPaymentMode(mode)}
                         className={`px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all border ${
                           paymentMode === mode 
                             ? 'bg-primary text-on-primary border-primary shadow-sm' 
                             : 'bg-surface-container/50 border-outline-variant/30 text-on-surface hover:bg-surface-container-high'
                         }`}
                       >
                         {mode}
                       </button>
                   ))}
                </div>
              </div>
            </div>
         )}
         
         <div className={`flex flex-col md:flex-row md:items-center justify-between rounded-xl p-5 shadow-sm gap-4 md:gap-0 ${finalDue > 0 ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'}`}>
            <div>
               <div className="text-[11px] opacity-80 uppercase tracking-widest font-bold">{finalDue > 0 ? 'Final Due' : 'Fully Paid'}</div>
               <div className="font-label-numeric text-[32px] md:text-[36px] font-bold tracking-tight mt-0.5 leading-none">
                   ₹ {Math.abs(finalDue).toLocaleString()}
                   {finalDue < 0 && <span className="text-sm ml-2 font-medium">(Surplus)</span>}
               </div>
            </div>
            <button 
              onClick={handleSave} 
              disabled={isSubmitting}
              className={`h-14 px-8 md:px-10 text-[17px] font-bold rounded-lg shadow-md hover:bg-opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 ${finalDue > 0 ? 'bg-on-error-container text-error-container' : 'bg-secondary text-on-secondary'} disabled:opacity-50`}
            >
              <Save size={20} fill="currentColor" /> {isSubmitting ? 'Saving...' : 'Save Entry'}
            </button>
         </div>
      </div>
    </div>
  )
}

