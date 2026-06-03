import React, { useState, useEffect } from 'react';
import { Search, Save, Calendar, FileText, Smartphone, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppContext } from '../types';
import { offlineSync } from '../lib/offlineSync';

export default function RecordPaymentView({ navigateTo, context }: { navigateTo: any, context?: AppContext }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomersDropdown, setShowCustomersDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [referenceNotes, setReferenceNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
       const { data: custData } = await supabase.from('customers').select('*');
       const { data: balData } = await supabase.from('view_customer_balances').select('*');
       
       if (custData && balData) {
           const processed = custData.map(c => {
               const balRow = balData.find(b => b.customer_id === c.id);
               return { ...c, balance: balRow ? Number(balRow.outstanding_balance) : 0 };
           });
           setCustomers(processed);
       }
    };
    fetchCustomers();
  }, []);

  React.useEffect(() => {
    if (context?.customerId && customers.length > 0 && !selectedCustomer) {
        const cust = customers.find(c => c.id === context.customerId);
        if (cust) setSelectedCustomer(cust);
    }
  }, [context?.customerId, customers, selectedCustomer]);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.phone && c.phone.includes(searchQuery))
  );

  const remainingDue = selectedCustomer ? (selectedCustomer.balance || 0) - (Number(amount) || 0) : 0;

  const handleSave = async () => {
    if (!selectedCustomer) {
        setErrorMsg('Please select a customer');
        return;
    }
    if (!amount || amount <= 0) {
        setErrorMsg('Please enter a valid amount');
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

            offlineSync.addPendingOp('payment', 'insert', {
                customer_id: selectedCustomer.id,
                recorded_by: userId,
                amount: Number(amount),
                payment_mode: paymentMode,
                reference_notes: referenceNotes ? `${referenceNotes} (Offline)` : 'Recorded Offline',
                date
            }, selectedCustomer.name);

            alert('You are offline or connection is weak. This payment transaction was saved locally and will auto-sync when online connection is restored.');
            navigateTo('customer-ledger', { customerId: selectedCustomer.id });
        } catch (offlineErr: any) {
            console.error('Offline payment save error:', offlineErr);
            setErrorMsg('Could not cache payment transaction locally.');
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
        
        const { error } = await supabase.from('payments').insert([{
            customer_id: selectedCustomer.id,
            recorded_by: userId,
            amount: Number(amount),
            payment_mode: paymentMode,
            reference_notes: referenceNotes,
            date
        }]);

        if (error) throw error;

        navigateTo('customer-ledger', { customerId: selectedCustomer.id });
    } catch (error: any) {
        console.error('Error saving payment:', error);
        if (isNetworkError(error)) {
            await saveOffline();
        } else {
            setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to save payment');
            alert(`Save Error: ${error.message || error.details || JSON.stringify(error)}`);
            setIsSubmitting(false);
        }
    }
  };

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-12 space-y-8 pb-32 selection:bg-secondary-fixed selection:text-on-secondary-fixed relative">
      <section className="space-y-6">
        {errorMsg && (
            <div className="p-4 bg-error-container text-on-error-container text-sm font-medium rounded-xl border border-error/20 mb-4">
              <p className="font-bold mb-1">Error:</p>
              <p>{errorMsg}</p>
            </div>
        )}
        <div className="flex flex-col md:flex-row gap-5">
           <div className="flex-1 border border-outline-variant/50 rounded-xl bg-surface-container-lowest p-5 relative focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
             <label className="block text-[10px] font-bold text-on-surface-variant mb-3 uppercase tracking-widest">Date</label>
             <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={20} />
                <input 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="w-full h-10 pl-11 pr-4 bg-transparent font-label-numeric font-bold text-xl text-on-surface focus:outline-none transition-colors" 
                  type="date" 
                />
             </div>
           </div>
           <div className="flex-[2] border border-outline-variant/50 rounded-xl bg-surface-container-lowest p-5 relative z-10 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
             <label className="block text-[10px] font-bold text-on-surface-variant mb-3 uppercase tracking-widest">Customer</label>
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={20} />
                <input 
                  className="w-full h-10 pl-11 pr-24 bg-transparent text-[17px] font-bold text-on-surface focus:outline-none transition-colors" 
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
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[11px] font-bold text-error bg-error-container/20 px-2.5 py-1 rounded-md">No selection</div>
                )}
                {selectedCustomer && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[11px] font-bold text-primary bg-primary-container px-2.5 py-1 rounded-md">
                        Due: ₹ {(selectedCustomer.balance || 0).toLocaleString()}
                    </div>
                )}
             </div>
             {showCustomersDropdown && filteredCustomers.length > 0 && (
                 <div className="absolute top-16 left-0 right-0 mt-2 bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] z-20 max-h-60 overflow-y-auto">
                     {filteredCustomers.map(c => (
                         <div 
                           key={c.id} 
                           onClick={() => {
                               setSelectedCustomer(c);
                               setSearchQuery(c.name);
                               setShowCustomersDropdown(false);
                           }}
                           className="p-4 hover:bg-surface-container cursor-pointer flex justify-between items-center border-b border-surface-variant/30 last:border-0"
                         >
                             <div>
                               <div className="font-bold text-[15px] text-on-surface">{c.name}</div>
                               <div className="text-[13px] text-on-surface-variant mt-0.5">{c.phone || c.address}</div>
                             </div>
                             <div className="font-label-numeric font-bold text-primary text-[15px]">
                               ₹ {(c.balance || 0).toLocaleString()}
                             </div>
                         </div>
                     ))}
                 </div>
             )}
           </div>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-2xl p-6 md:p-8 shadow-sm border border-surface-variant/80 relative focus-within:border-primary/50 transition-all z-0">
         <h3 className="text-[15px] font-bold text-on-surface tracking-tight mb-6 pb-4 border-b border-outline-variant/30">Payment Details</h3>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="col-span-1 md:col-span-2">
              <label className="block text-[11px] font-bold text-primary mb-2 uppercase tracking-widest">Amount Received (₹)</label>
              <input 
                value={amount}
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full h-16 md:h-20 px-4 bg-surface-container/30 border-2 border-outline-variant/20 rounded-xl font-label-numeric font-bold text-4xl md:text-5xl text-on-surface focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors" 
                type="number" 
                placeholder="0" 
                autoFocus 
              />
           </div>

           <div>
              <label className="block text-[10px] font-bold text-on-surface-variant mb-2 uppercase tracking-widest">Payment Mode</label>
              <div className="relative">
                 <select 
                   value={paymentMode}
                   onChange={e => setPaymentMode(e.target.value)}
                   className="w-full h-14 pl-5 pr-10 bg-surface-container/50 border border-outline-variant/50 rounded-xl text-[15px] font-bold text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none"
                 >
                    <option>Cash</option>
                    <option>UPI / PhonePe</option>
                    <option>Bank Transfer (NEFT/RTGS)</option>
                    <option>Cheque</option>
                 </select>
                 <Smartphone className="absolute right-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none" size={20} />
              </div>
           </div>

           <div>
              <label className="block text-[10px] font-bold text-on-surface-variant mb-2 uppercase tracking-widest">Reference / Remarks</label>
              <div className="relative">
                 <input 
                   value={referenceNotes}
                   onChange={e => setReferenceNotes(e.target.value)}
                   className="w-full h-14 pl-12 pr-4 bg-surface-container/50 border border-outline-variant/50 rounded-xl text-[15px] font-medium text-on-surface focus:outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/50" 
                   type="text" 
                   placeholder="Txn ID, Cheque No..." 
                 />
                 <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
              </div>
           </div>
         </div>
      </section>

      <div className="bg-surface-container border border-surface-variant/80 rounded-2xl shadow-md p-5 md:p-8 mt-12 relative z-10 transition-all">
         <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
            <div>
               <div className="text-[11px] text-on-surface-variant uppercase tracking-widest font-bold">Remaining Due</div>
               <div className="font-label-numeric text-[32px] font-bold tracking-tight text-on-surface mt-1 leading-none">
                 ₹ {selectedCustomer ? remainingDue.toLocaleString() : '0'}
                 {remainingDue < 0 && <span className="text-sm ml-2 font-medium text-error">(Surplus)</span>}
               </div>
            </div>
            
            <button 
              onClick={handleSave} 
              disabled={isSubmitting || !selectedCustomer || !amount}
              className="w-full sm:w-auto h-14 px-8 md:px-10 bg-primary text-on-primary text-[17px] font-bold rounded-xl shadow-md hover:bg-opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={20} fill="currentColor" /> {isSubmitting ? 'Saving...' : 'Save Payment'}
            </button>
         </div>
      </div>
    </div>
  )
}

