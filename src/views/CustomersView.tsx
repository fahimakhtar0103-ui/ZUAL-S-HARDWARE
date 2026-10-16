import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, MapPin, Edit, Trash2, Plus, X, Phone, Loader2, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppContext } from '../types';
import { offlineSync, useOnlineStatus } from '../lib/offlineSync';
import { cacheCustomers, readCachedCustomers } from '../lib/customerCache';

export default function CustomersView({ navigateTo, context }: { navigateTo: any, context?: AppContext }) {
  const { isOnline, pendingCount } = useOnlineStatus();
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(60);
  
  const diaryId = context?.diaryId;
  
  // Data state
  const [customers, setCustomers] = useState<any[]>(() => readCachedCustomers());
  const [isLoading, setIsLoading] = useState(true);
  const [diaries, setDiaries] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'OUTSTANDING' | 'OVER_LIMIT'>('ALL');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      let baseQuery = supabase.from('customers').select('*');
      if (diaryId) {
         baseQuery = baseQuery.eq('diary_id', diaryId);
      }
      
      const { data: custData, error: custErr } = await baseQuery.order('created_at', { ascending: false });
      if (custErr) throw custErr;

      const { data: balData, error: balErr } = await supabase.from('view_customer_balances').select('customer_id, outstanding_balance, status');
      if (balErr) throw balErr;
      
      const balanceByCustomer = new Map((balData || []).map((b: any) => [b.customer_id, b]));
      const mapped = (custData || []).map((c: any) => {
          const bal: any = balanceByCustomer.get(c.id);
          return {
              ...c,
              balance: Number(bal?.outstanding_balance) || 0,
              status: bal?.status || 'CLEARED'
          };
      });

      // Optimistically append pending offline customers
      const pendingCustomerOps = offlineSync.getPendingOps().filter(op => op.type === 'customer' && op.action === 'insert');
      const pendingCustomers = pendingCustomerOps.map(op => ({
          ...op.payload,
          id: op.payload.id || op.id, // Ensure stable client key
          balance: 0,
          status: 'CLEARED',
          isPending: true
      }));

      setCustomers([...pendingCustomers, ...mapped]);
      // Cache the last successful customer directory for temporary mobile outages.
      if (!diaryId) cacheCustomers(mapped);

    } catch (error: any) {
      console.error('Error fetching customers:', error);
      
      // Fallback: If completely offline / query fails, we can still load from the queue
      const pendingCustomerOps = offlineSync.getPendingOps().filter(op => op.type === 'customer' && op.action === 'insert');
      const pendingCustomers = pendingCustomerOps.map(op => ({
          ...op.payload,
          id: op.payload.id || op.id,
          balance: 0,
          status: 'CLEARED',
          isPending: true
      }));
      const cached = readCachedCustomers().filter(c => !diaryId || c.diary_id === diaryId);
      setCustomers([...pendingCustomers, ...cached]);
      setErrorMsg(cached.length ? 'Showing saved customer directory. Balances may be outdated until online.' : (error.message || 'Unable to load customers. Check your connection.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [diaryId, pendingCount]);

  useEffect(() => {
    const fetchDiariesList = async () => {
      try {
        const { data, error } = await supabase.from('diaries').select('id, name').order('name');
        if (!error && data) {
          setDiaries(data);
        }
      } catch (err) {
        console.error('Error fetching diaries:', err);
      }
    };
    fetchDiariesList();
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const normalizeSearch = (value: unknown) => String(value ?? '').normalize('NFKD').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const normalizedQuery = normalizeSearch(searchQuery);
  const filteredCustomers = customers.filter(c => {
    const matchesQuery = !normalizedQuery || [c.name, c.phone, c.address]
      .some(value => normalizeSearch(value).includes(normalizedQuery));
    if (!matchesQuery) return false;
    
    if (filterType === 'OUTSTANDING') {
      return (c.balance || 0) > 0;
    }
    if (filterType === 'OVER_LIMIT') {
      return c.status === 'OVER_LIMIT';
    }
    return true;
  }).sort((a, b) => {
    if (!normalizedQuery) return 0;
    const rank = (c: any) => { const name = normalizeSearch(c.name); const tokens = name.split(' '); return name.startsWith(normalizedQuery) ? 0 : tokens.some(t => t.startsWith(normalizedQuery)) ? 1 : name.includes(normalizedQuery) ? 2 : 3; };
    return rank(a) - rank(b);
  });

  useEffect(() => { setVisibleCount(60); }, [searchQuery, filterType, diaryId]);

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id.toString().startsWith('cust-') || id.toString().startsWith('customer-')) {
      alert('This customer is still pending offline synchronization. Please delete it when online, or refresh to discard offline cache.');
      return;
    }
    setCustomerToDelete(id);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;
    const id = customerToDelete;
    
    setErrorMsg(null);
    try {
      // Never cascade-delete the customer's ledger or payment history.
      // A customer with financial records must be retained for audit integrity.
      const [salesCheck, paymentsCheck] = await Promise.all([
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('customer_id', id),
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('customer_id', id)
      ]);
      if (salesCheck.error) throw salesCheck.error;
      if (paymentsCheck.error) throw paymentsCheck.error;
      if ((salesCheck.count || 0) > 0 || (paymentsCheck.count || 0) > 0) {
        throw new Error('This customer has sales or payments. Deletion is blocked to protect financial records.');
      }

      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      await fetchCustomers();
      setCustomerToDelete(null);
    } catch (error: any) {
      console.error('Error deleting:', error);
      setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to delete customer');
      alert(`Delete Error: ${error.message || error.details || JSON.stringify(error)}`);
      setCustomerToDelete(null);
    }
  };

  const openAddModal = () => {
    setEditingCustomer({ name: '', phone: '', address: '', credit_limit: 0, diary_id: diaryId || '' });
    setIsModalOpen(true);
  };

  const openEditModal = (customer: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer({ ...customer });
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async () => {
    if (!editingCustomer?.name) return;
    if (!editingCustomer?.diary_id) {
        setErrorMsg('Please select a diary for this customer');
        return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);

    const isNetworkError = (error: any) => {
        if (!navigator.onLine) return true;
        const msg = (error?.message || '').toLowerCase();
        return msg.includes('fetch') || msg.includes('network') || msg.includes('cors') || error?.status === 0;
    };

    const isEditing = !!editingCustomer.id;
    const tempId = editingCustomer.id || `customer-temp-${Date.now()}`;
    const payload = {
       id: tempId,
       name: editingCustomer.name,
       phone: editingCustomer.phone,
       address: editingCustomer.address,
       credit_limit: editingCustomer.credit_limit || editingCustomer.creditLimit || 0,
       diary_id: editingCustomer.diary_id || null,
    };

    const saveOffline = () => {
        if (isEditing) {
            alert('Editing offline profiles is not supported yet. Please restore connectivity first.');
            setIsSubmitting(false);
            return;
        }

        try {
          offlineSync.addPendingOp('customer', 'insert', payload, payload.name);
          alert(`You are offline. Customer "${payload.name}" was saved locally and will synchronize on reconnect.`);
          setIsModalOpen(false);
        } catch (storageError: any) {
          setErrorMsg(storageError?.message || 'Unable to save customer offline; no record was saved.');
        } finally {
          setIsSubmitting(false);
        }
    };

    if (!navigator.onLine) {
        saveOffline();
        return;
    }
    
    try {
      if (isEditing) {
         const payloadWithoutId = { ...payload };
         delete payloadWithoutId.id;
         const { error } = await supabase.from('customers').update(payloadWithoutId).eq('id', editingCustomer.id);
         if (error) throw error;
      } else {
         const payloadWithoutId = { ...payload };
         delete payloadWithoutId.id;
         const { error } = await supabase.from('customers').insert([payloadWithoutId]);
         if (error) throw error;
      }
      
      setIsModalOpen(false);
      await fetchCustomers();
    } catch (error: any) {
      console.error('Error saving customer:', error);
      if (isNetworkError(error)) {
          saveOffline();
      } else {
          setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to save customer');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTotalOutstanding = () => customers.reduce((acc, c) => acc + (c.balance || 0), 0);
  const getOverdueCount = () => customers.filter(c => c.status === 'OVER_LIMIT').length;

  return (
    <div className="zl-legacy-page zl-customers-page w-full px-4 md:px-12 max-w-7xl mx-auto flex flex-col gap-4 md:gap-6 pt-4 pb-28 relative min-w-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl md:text-[48px] font-bold text-primary tracking-tight">Customers</h2>
          <p className="text-base text-on-surface-variant mt-2 hidden md:block">Manage credit accounts and outstanding balances.</p>
        </div>
        <button onClick={openAddModal} className="h-12 bg-primary text-on-primary px-6 rounded-full flex items-center justify-center gap-2 font-bold text-sm hover:bg-inverse-surface shadow-sm transition-colors">
           <Plus size={18} /> New Customer
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:gap-3 w-full min-w-0 font-medium">
        <div className="flex-1 w-full min-w-0 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search Name or Phone..." 
            className="w-full h-12 pl-12 pr-4 bg-surface-container-lowest rounded-full border border-outline-variant/50 text-on-surface placeholder:text-on-surface-variant focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-colors"
          />
        </div>
        <button 
          onClick={() => {
            setFilterType(prev => {
              if (prev === 'ALL') return 'OUTSTANDING';
              if (prev === 'OUTSTANDING') return 'OVER_LIMIT';
              return 'ALL';
            });
          }}
          className={`h-12 w-full sm:w-auto px-4 sm:px-6 rounded-xl flex items-center justify-center gap-2 text-sm border transition-colors whitespace-nowrap ${
            filterType !== 'ALL' 
              ? 'bg-secondary-container text-on-secondary-container border-secondary/30 font-bold' 
              : 'bg-surface-container text-on-surface hover:bg-surface-container-high border-outline-variant/20 font-medium'
          }`}
        >
          <SlidersHorizontal size={18} />
          {filterType === 'ALL' && 'All Customers'}
          {filterType === 'OUTSTANDING' && 'Outstanding Balances'}
          {filterType === 'OVER_LIMIT' && 'Over Limit Only'}
        </button>
      </div>

      <div className="min-w-0 w-full -mx-0 md:mx-0">
        {errorMsg && !isModalOpen && (
            <div className="mb-4 p-4 bg-error-container text-on-error-container text-sm font-medium rounded-xl border border-error/20">
              <p className="font-bold mb-1">Error:</p>
              <p>{errorMsg}</p>
            </div>
        )}
        <div className="hidden md:grid grid-cols-3 gap-6 mb-8 mt-2">
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] border border-outline-variant/20">
             <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Total Outstanding</p>
             <p className="text-4xl text-primary mt-2 font-label-numeric font-bold tracking-tight">₹ {getTotalOutstanding().toLocaleString()}</p>
          </div>
          <div className="bg-error-container/20 p-6 rounded-xl shadow-sm border border-error/10">
             <p className="text-[10px] text-error uppercase tracking-wider font-bold">Overdue Accounts</p>
             <p className="text-4xl text-error mt-2 font-label-numeric font-bold tracking-tight">{getOverdueCount()}</p>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] border border-outline-variant/20">
             <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold">Active Customers</p>
             <p className="text-4xl text-primary mt-2 font-label-numeric font-bold tracking-tight">{customers.length}</p>
          </div>
        </div>

        {isLoading ? (
            <div className="flex items-center justify-center py-20 text-on-surface-variant font-medium gap-2">
              <Loader2 className="animate-spin" size={20} /> Loading customers...
            </div>
        ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant gap-4">
                <Search size={48} className="opacity-20" />
                <p className="font-bold">No customers found</p>
            </div>
        ) : (
            <div className="flex flex-col gap-3 pb-8">
               {filteredCustomers.slice(0, visibleCount).map((c) => {
                 const isOverdue = c.status === 'OVER_LIMIT';
                 const isHealthy = !isOverdue && (c.balance || 0) < 50000;
                 return (
                 <div key={c.id} onClick={() => navigateTo('customer-ledger', { customerId: c.id })} className="rounded-xl bg-surface-container-lowest shadow-sm cursor-pointer border border-outline-variant/30 hover:shadow-md transition-shadow relative group">
                   <div className="p-3.5 sm:p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
                     <div className="flex items-start gap-2.5 sm:gap-4 min-w-0 w-full flex-1">
                        <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${isOverdue ? 'bg-error-container text-on-error-container' : isHealthy ? 'bg-surface-variant text-on-surface-variant' : 'bg-secondary-container text-on-secondary-container'}`}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <h3 className="text-[15px] sm:text-[18px] font-bold text-primary tracking-tight break-words">{c.name}</h3>
                            {c.isPending && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse whitespace-nowrap">
                                <WifiOff size={10} /> Pending Sync
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-on-surface-variant flex flex-col sm:flex-row sm:flex-wrap items-start gap-x-2 gap-y-1 mt-1 font-medium min-w-0">
                            <span className="flex items-center gap-1 min-w-0 break-all"><Phone size={12} className="text-outline" /> {c.phone || 'N/A'}</span>
                            <span className="text-outline-variant">•</span>
                            <span className="flex items-start gap-1 min-w-0 break-words"><MapPin size={12} className="text-outline" /> {c.address || 'N/A'}</span>
                          </p>
                        </div>
                     </div>
                     <div className="w-full md:w-auto flex flex-row md:flex-col-reverse justify-between md:justify-between items-center md:items-end gap-2 border-t border-outline-variant/30 pt-3 md:border-0 md:pt-0 shrink-0">
                        <div className="flex items-center gap-2 order-2 md:order-none md:mb-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                           <button onClick={(e) => openEditModal(c, e)} className="p-2 md:p-1.5 text-on-surface-variant hover:text-secondary rounded-full hover:bg-secondary-container transition-colors bg-surface-container md:bg-transparent"><Edit size={16} /></button>
                           <button onClick={(e) => handleDeleteClick(c.id, e)} className="p-2 md:p-1.5 text-on-surface-variant hover:text-error rounded-full hover:bg-error-container transition-colors bg-surface-container md:bg-transparent"><Trash2 size={16} /></button>
                        </div>
                        <p className={`font-label-numeric order-1 md:order-none text-[18px] sm:text-[22px] md:text-2xl font-bold tracking-tight ${isOverdue ? 'text-error' : 'text-primary'}`}>
                           ₹ {(c.balance || 0).toLocaleString()}
                        </p>
                     </div>
                   </div>
                 </div>
               )})}
               {filteredCustomers.length > visibleCount && (
                 <button type="button" onClick={() => setVisibleCount(count => count + 60)}
                   className="min-h-12 rounded-xl bg-surface-container text-primary font-bold text-sm w-full border border-outline-variant/30">
                   Show more customers ({Math.min(visibleCount, filteredCustomers.length)} of {filteredCustomers.length})
                 </button>
               )}
            </div>
        )}
      </div>

      {isModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-4 bg-scrim/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden mobile-dialog flex flex-col border border-outline-variant/30">
                <div className="px-6 py-5 border-b border-surface-variant/50 flex justify-between items-center bg-surface-container/30">
                    <h3 className="text-xl font-bold text-primary tracking-tight">{editingCustomer?.id ? 'Edit Customer' : 'Add New Customer'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors text-on-surface-variant"><X size={20} /></button>
                </div>

                {errorMsg && (
                    <div className="px-6 pt-4">
                        <div className="p-3 bg-error/10 text-error text-sm font-medium rounded-lg border border-error/20">
                            {errorMsg}
                        </div>
                    </div>
                )}
                
                <form onSubmit={(e) => { e.preventDefault(); handleSaveCustomer(); }}>
                <div className="p-6 flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Assign to Diary <span className="text-error">*</span></label>
                        <select 
                            required 
                            value={editingCustomer?.diary_id || ''} 
                            onChange={(e) => setEditingCustomer({...editingCustomer, diary_id: e.target.value})} 
                            className="w-full h-12 px-4 bg-surface-container/50 border border-outline-variant/60 rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:border-secondary transition-colors"
                        >
                            <option value="" disabled>Select a Diary</option>
                            {diaries.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Customer Name <span className="text-error">*</span></label>
                        <input autoFocus required value={editingCustomer?.name || ''} onChange={(e) => setEditingCustomer({...editingCustomer, name: e.target.value})} className="w-full h-12 px-4 bg-surface-container/50 border border-outline-variant/60 rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:border-secondary transition-colors" placeholder="e.g. B. Kumar Builders" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Phone Number</label>
                            <input value={editingCustomer?.phone || ''} onChange={(e) => setEditingCustomer({...editingCustomer, phone: e.target.value})} className="w-full h-12 px-4 bg-surface-container/50 border border-outline-variant/60 rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:border-secondary transition-colors font-label-numeric" placeholder="10-digit number" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Credit Limit (₹)</label>
                            <input type="number" value={editingCustomer?.credit_limit || editingCustomer?.creditLimit || ''} onChange={(e) => setEditingCustomer({...editingCustomer, credit_limit: Number(e.target.value)})} className="w-full h-12 px-4 bg-surface-container/50 border border-outline-variant/60 rounded-lg text-sm font-bold text-on-surface focus:outline-none focus:border-secondary transition-colors font-label-numeric" placeholder="0.00" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Address / Location</label>
                        <textarea value={editingCustomer?.address || ''} onChange={(e) => setEditingCustomer({...editingCustomer, address: e.target.value})} className="w-full p-4 bg-surface-container/50 border border-outline-variant/60 rounded-lg text-sm font-medium text-on-surface focus:outline-none focus:border-secondary transition-colors resize-none" rows={3} placeholder="City, Area, or full address..." />
                    </div>
                </div>

                <div className="p-4 border-t border-surface-variant/50 flex justify-end gap-3 bg-surface-container/20">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-lg text-sm font-bold text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50">Cancel</button>
                    <button type="submit" disabled={!editingCustomer?.name || isSubmitting} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : 'Save Customer'}
                    </button>
                </div>
                </form>
            </div>
        </div>
      )}
      {customerToDelete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-4 bg-scrim/40 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden mobile-dialog flex flex-col border border-outline-variant/30 p-6">
                <h3 className="text-xl font-bold text-error tracking-tight mb-2">Delete Customer</h3>
                <p className="text-sm text-on-surface-variant mb-6 text-balance">
                    Are you sure you want to delete this customer? This will also permanently delete all of their transactions and payments.
                </p>
                <div className="flex gap-3 justify-end mt-2">
                    <button onClick={() => setCustomerToDelete(null)} className="px-5 py-2.5 rounded-xl font-bold text-on-surface bg-surface-container hover:bg-surface-variant transition-colors" disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button onClick={confirmDelete} className="px-5 py-2.5 rounded-xl font-bold text-on-error bg-error hover:bg-error/90 transition-colors shadow-sm" disabled={isSubmitting}>
                        Delete
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}
