import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, ArrowUpRight, BadgeDollarSign, HeartHandshake, Loader2, MessageCircle, Phone, ReceiptText, Search, UserMinus, UserCheck, Wallet, Calendar, Plus } from 'lucide-react';
import { AppContext } from '../types';

interface RecoveryDashboardViewProps {
  navigateTo: (view: any, context?: AppContext) => void;
}

export default function RecoveryDashboardView({ navigateTo }: RecoveryDashboardViewProps) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Single source of truth state using same Supabase tables
  const [diaries, setDiaries] = useState<any[]>([]);
  const [selectedDiary, setSelectedDiary] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [metrics, setMetrics] = useState({
    totalDue: 0,
    overdueCount: 0,
    monthlyCollection: 0,
    todayCollection: 0,
    activeDebtorsCount: 0,
  });

  const [overdueCustomers, setOverdueCustomers] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  useEffect(() => {
    const fetchRecoveryData = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const firstDayOfMonth = `${currentMonth}-01`;
        
        const dateObj = new Date();
        const y = dateObj.getFullYear();
        const m = dateObj.getMonth();
        const lastDay = new Date(y, m + 1, 0).getDate();
        const lastDayOfMonth = `${currentMonth}-${String(lastDay).padStart(2, '0')}`;

        // 1. Fetch data concurrently from the same databases
        const [
          diariesRes, 
          balancesRes, 
          customersRes, 
          paymentsRes,
          todayPaymentsRes
        ] = await Promise.all([
          supabase.from('diaries').select('id, name').order('name'),
          supabase.from('view_customer_balances').select('*').order('outstanding_balance', { ascending: false }),
          supabase.from('customers').select('id, phone, address, diary_id'),
          supabase.from('payments').select('id, amount, date, customer_id, payment_mode, recorded_by, customers(name)').gte('date', firstDayOfMonth).lte('date', lastDayOfMonth).order('date', { ascending: false }),
          supabase.from('payments').select('amount').eq('date', todayStr)
        ]);

        if (diariesRes.error) throw diariesRes.error;
        if (balancesRes.error) throw balancesRes.error;
        if (customersRes.error) throw customersRes.error;
        if (paymentsRes.error) throw paymentsRes.error;
        if (todayPaymentsRes.error) throw todayPaymentsRes.error;

        const diariesList = diariesRes.data || [];
        setDiaries(diariesList);

        const balancesList = balancesRes.data || [];
        const customersList = customersRes.data || [];

        // Map customers with balances and address/phone information
        const mappedCustomers = balancesList.map((bal: any) => {
          const custInfo = customersList.find((c: any) => c.id === bal.customer_id);
          return {
            ...bal,
            phone: custInfo?.phone || '',
            address: custInfo?.address || '',
            diary_id: custInfo?.diary_id || '',
          };
        });

        // 2. Compute metrics
        const totalDue = balancesList.reduce((acc, row) => acc + (Number(row.outstanding_balance) || 0), 0);
        const overdueCount = mappedCustomers.filter(c => c.status === 'OVER_LIMIT').length;
        const activeDebtorsCount = balancesList.filter(row => (Number(row.outstanding_balance) || 0) > 0).length;

        const monthlyCollection = (paymentsRes.data || []).reduce((acc, row) => acc + Number(row.amount), 0);
        const todayCollection = (todayPaymentsRes.data || []).reduce((acc, row) => acc + Number(row.amount), 0);

        setMetrics({
          totalDue,
          overdueCount,
          monthlyCollection,
          todayCollection,
          activeDebtorsCount,
        });

        // Set list of customers with outstanding balances
        setOverdueCustomers(mappedCustomers);
        
        // Map recent payments showing collection timeline
        const mappedPayments = (paymentsRes.data || []).slice(0, 10).map((p: any) => ({
          id: p.id,
          amount: Number(p.amount),
          date: p.date,
          mode: p.payment_mode,
          customerName: p.customers?.name || 'Unknown Buyer',
          customerId: p.customer_id
        }));
        setRecentPayments(mappedPayments);

      } catch (err: any) {
        console.error('Error fetching recovery dashboard data:', err);
        setErrorMsg(err.message || err.details || err.hint || 'Failed to sync recovery dashboard. Ensure you have proper network connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecoveryData();
  }, []);

  // Filter accounts based on selected diary and search query
  const filteredCustomers = overdueCustomers.filter(c => {
    const matchesDiary = selectedDiary === 'ALL' || c.diary_id === selectedDiary;
    const matchesSearch = c.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const hasOutstanding = (c.outstanding_balance || 0) > 0;
    return matchesDiary && matchesSearch && hasOutstanding;
  });

  if (loading) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center pt-32 text-on-surface-variant font-medium gap-3">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="text-sm">Generating real-time Recovery Intelligence...</span>
      </div>
    );
  }

  const recoveryProgress = metrics.totalDue + metrics.monthlyCollection > 0
    ? Math.round((metrics.monthlyCollection / (metrics.totalDue + metrics.monthlyCollection)) * 100)
    : 0;

  return (
    <div className="px-4 md:px-12 max-w-7xl mx-auto flex flex-col gap-6 pt-4 pb-12">
      {/* Top Welcome Title */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-surface-variant/50 pb-4 md:border-none md:pb-0">
        <div>
          <h2 className="text-3xl md:text-[48px] font-bold text-primary tracking-tight">Recovery Dashboard</h2>
          <p className="text-on-surface-variant font-medium text-[15px] mt-2">
            Active credit management, real-time debt resolution, and cash collection tracking.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigateTo('record-payment')}
            className="h-11 px-5 rounded-full bg-primary text-on-primary font-bold text-[13px] flex items-center gap-2 shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-transform cursor-pointer"
          >
            <Plus size={16} /> Record Payment
          </button>
        </div>
      </section>

      {errorMsg && (
        <div className="p-4 bg-error-container text-on-error-container text-sm font-medium rounded-xl border border-error/20">
          <p className="font-bold">Database Sync Error:</p>
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Main KPI metric cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Outstanding Due */}
        <div className="bg-error-container text-on-error-container p-6 md:p-8 rounded-xl shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)] border border-error/20 flex flex-col justify-between group transition-shadow hover:shadow-md">
          <div className="flex justify-between items-start mb-6">
            <span className="text-[11px] font-bold text-on-error-container/70 uppercase tracking-widest">Total Outstanding Due</span>
            <AlertCircle className="text-error group-hover:scale-110 transition-transform duration-300" />
          </div>
          <div>
            <div className="font-label-numeric text-4xl md:text-[44px] tracking-tight font-bold text-error mb-2">
              ₹ {metrics.totalDue.toLocaleString()}
            </div>
            <div className="text-[13px] text-on-error-container/80 flex items-center gap-1.5 font-medium">
              Across {metrics.activeDebtorsCount} credit buyers who owe money
            </div>
          </div>
        </div>

        {/* Overdue Limit Breach */}
        <div className="bg-surface-container-lowest p-6 md:p-8 rounded-xl shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)] border border-outline-variant/30 flex flex-col justify-between group transition-shadow hover:shadow-md">
          <div className="flex justify-between items-start mb-6">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Limit Breached Customers</span>
            <UserMinus className="text-secondary group-hover:scale-110 transition-transform duration-300" />
          </div>
          <div>
            <div className="font-label-numeric text-4xl md:text-[44px] tracking-tight font-bold text-secondary mb-2">
              {metrics.overdueCount}
            </div>
            <div className="text-[13px] text-on-surface-variant flex items-center gap-1.5 font-medium">
              Accounts exceeding physical credit thresholds
            </div>
          </div>
        </div>

        {/* Current Month Collection progress */}
        <div className="bg-surface-container-lowest p-6 md:p-8 rounded-xl shadow-[0_2px_12px_-2px_rgba(0,0,0,0.05)] border border-outline-variant/30 flex flex-col justify-between group transition-shadow hover:shadow-md">
          <div className="flex justify-between items-start mb-6">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Monthly Collection</span>
            <Wallet className="text-primary group-hover:scale-110 transition-transform duration-300" />
          </div>
          <div>
            <div className="font-label-numeric text-4xl md:text-[44px] tracking-tight font-bold text-primary mb-2">
              ₹ {metrics.monthlyCollection.toLocaleString()}
            </div>
            <div className="text-[13px] text-on-surface-variant flex items-center gap-1 md:gap-1.5 font-medium">
              <span>Today collected:</span>
              <span className="font-bold text-primary">₹{metrics.todayCollection.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Target & Forecast */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recovery Target */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-on-surface mb-5">Recovery Target</h3>
          <div className="flex-grow flex flex-col items-center justify-center py-4">
            <div className="relative w-40 h-40 rounded-full flex items-center justify-center shadow-sm" style={{ background: `conic-gradient(#0d9488 ${recoveryProgress}%, #e0e3e5 0)` }}>
              <div className="absolute inset-1.5 bg-surface-container-lowest rounded-full flex flex-col items-center justify-center shadow-inner">
                <span className="text-2xl font-label-numeric font-extrabold text-teal-600">{recoveryProgress}%</span>
                <span className="text-[11px] text-on-surface-variant mt-0.5 font-bold uppercase tracking-wider">Collected</span>
              </div>
            </div>
            <div className="mt-6 w-full flex justify-between px-4">
              <div className="flex flex-col items-center">
                <span className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">Total Value</span>
                <span className="font-label-numeric font-bold text-on-surface mt-1 text-[15px]">
                  ₹{( (metrics.totalDue + metrics.monthlyCollection) / 100000).toFixed(2)}L
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">Recovered</span>
                <span className="font-label-numeric font-bold text-primary mt-1 text-[15px]">
                  ₹{(metrics.monthlyCollection / 100000).toFixed(2)}L
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Payment Feed */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-6 border-b border-surface-variant/40 bg-surface-container-low/30">
            <h3 className="text-lg font-bold text-on-surface">Recent Collections</h3>
          </div>
          <div className="flex-grow overflow-y-auto max-h-[220px] divide-y divide-surface-variant/30">
            {recentPayments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-70 p-6 min-h-[160px]">
                <HeartHandshake size={24} className="mb-2 opacity-60 text-on-surface-variant" />
                <p className="text-xs font-medium">No collections recorded this month</p>
              </div>
            ) : (
              recentPayments.map((pay) => (
                <div key={pay.id} className="p-4 flex items-center justify-between hover:bg-surface-container-low/20 transition-colors">
                  <div>
                    <h4 className="text-sm font-bold text-on-surface">{pay.customerName}</h4>
                    <p className="text-xs text-on-surface-variant font-semibold mt-0.5">
                      {pay.date.split('-').reverse().join('/')} • Mode: {pay.mode}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-label-numeric text-[16px] font-bold text-primary">
                      + ₹{pay.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Overdue Accounts & Collection Filters */}
      <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden mb-6">
        <div className="p-5 border-b border-surface-variant/50 bg-surface-container-low/50 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-primary tracking-tight">Accounts Eligible for Recovery</h3>
            <p className="text-xs text-on-surface-variant font-medium mt-0.5">Filter by book/diary or search to perform instant recovery actions.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Search debtor name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 h-11 bg-surface-container border border-outline-variant/50 rounded-full text-xs font-semibold focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            
            {/* Diaries Filter */}
            <select
              value={selectedDiary}
              onChange={e => setSelectedDiary(e.target.value)}
              className="px-4 h-11 bg-surface-container border border-outline-variant/50 rounded-full text-xs font-semibold focus:outline-none focus:border-primary transition-colors cursor-pointer text-on-surface"
            >
              <option value="ALL">All Diaries / Zones</option>
              {diaries.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Customers list content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-surface-variant text-on-surface-variant/80 text-[11px] font-bold uppercase tracking-wider bg-surface-container-low/20">
                <th className="py-4 px-6">Customer Details</th>
                <th className="py-4 px-4 text-right">Outstanding (₹)</th>
                <th className="py-4 px-4 text-right">Credit Limit (₹)</th>
                <th className="py-4 px-4 text-center">Breach Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/40">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-on-surface-variant opacity-75 text-sm font-medium">
                    No matching debtor accounts with outstanding balances found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(cust => {
                  const overLimit = cust.status === 'OVER_LIMIT';
                  return (
                    <tr key={cust.customer_id} className="hover:bg-surface-container-low/25 transition-colors">
                      {/* Name and Zone/Address */}
                      <td className="py-4 px-6">
                        <div>
                          <h4 className="font-bold text-on-surface text-sm">{cust.customer_name}</h4>
                          <p className="text-[12px] text-on-surface-variant mt-0.5 flex items-center gap-1.5 font-medium">
                            {cust.phone ? (
                              <span className="flex items-center gap-0.5"><Phone size={11} /> {cust.phone}</span>
                            ) : (
                              <span className="italic opacity-60">No phone</span>
                            )}
                            {cust.address && <span className="opacity-40">•</span>}
                            {cust.address && <span className="truncate max-w-[150px]">{cust.address}</span>}
                          </p>
                        </div>
                      </td>

                      {/* Outstanding Balance */}
                      <td className="py-4 px-4 text-right">
                        <span className="font-label-numeric font-extrabold text-error text-md">
                          ₹{Number(cust.outstanding_balance).toLocaleString()}
                        </span>
                      </td>

                      {/* Credit Limit */}
                      <td className="py-4 px-4 text-right text-xs text-on-surface-variant font-bold font-label-numeric">
                        ₹{Number(cust.credit_limit || 0).toLocaleString()}
                      </td>

                      {/* Breach Status */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full ${overLimit ? 'bg-red-500/10 text-red-600 border border-red-500/20' : 'bg-amber-500/10 text-amber-700 border border-amber-500/20'}`}>
                          {overLimit ? (
                            <>
                              <AlertCircle size={11} /> Limit Breached
                            </>
                          ) : (
                            <>
                              <Calendar size={11} /> Balance Due
                            </>
                          )}
                        </span>
                      </td>

                      {/* Direct action buttons */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {/* Record Payment */}
                          <button
                            onClick={() => navigateTo('record-payment', { customerId: cust.customer_id })}
                            title="Record Payment"
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-teal-500/10 hover:bg-teal-500 text-teal-600 hover:text-white transition-all border border-teal-500/20 cursor-pointer"
                          >
                            <BadgeDollarSign size={16} />
                          </button>

                          {/* WhatsApp Reminder */}
                          {cust.phone && (
                            <button
                              onClick={() => navigateTo('whatsapp-reminder', { customerId: cust.customer_id })}
                              title="Send Reminder"
                              className="w-9 h-9 flex items-center justify-center rounded-lg bg-green-500/10 hover:bg-green-500 text-green-600 hover:text-white transition-all border border-green-500/20 cursor-pointer"
                            >
                              <MessageCircle size={16} />
                            </button>
                          )}

                          {/* Ledger */}
                          <button
                            onClick={() => navigateTo('customer-ledger', { customerId: cust.customer_id })}
                            title="Statement / Ledger"
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface border border-outline-variant/40 hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-all cursor-pointer"
                          >
                            <ReceiptText size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
