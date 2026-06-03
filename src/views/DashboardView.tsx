import React, { useState, useEffect } from 'react';
import { AlertTriangle, BadgeDollarSign, TrendingUp, Users, ArrowRight, Loader2, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function DashboardView({ navigateTo }: { navigateTo: any }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
     totalOutstanding: 0,
     activeCustomersCount: 0,
     diariesCount: 0,
     todaysCollection: 0,
     monthlySales: 0,
     upcomingPayments: [] as any[],
     recoveryTarget: 0,
     recoveredAmount: 0
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
       setLoading(true);
       try {
           const todayStr = new Date().toISOString().split('T')[0];
           const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
           
           const firstDayOfMonth = `${currentMonth}-01`;
           const dateObj = new Date();
           const y = dateObj.getFullYear();
           const m = dateObj.getMonth();
           const lastDay = new Date(y, m + 1, 0).getDate();
           const lastDayOfMonth = `${currentMonth}-${String(lastDay).padStart(2, '0')}`;

           const targetDate = new Date();
           targetDate.setDate(targetDate.getDate() + 7);
           const targetDateStr = targetDate.toISOString().split('T')[0];

           // Using Promise.all to fetch them concurrently for speed
           const [balancesRes, customersRes, diariesRes, todaysCollectionRes, monthlySalesRes, upcomingRes, monthlyPaymentsRes] = await Promise.all([
               supabase.from('view_customer_balances').select('outstanding_balance'),
               supabase.from('customers').select('id', { count: 'exact', head: true }),
               supabase.from('diaries').select('id', { count: 'exact', head: true }),
               supabase.from('payments').select('amount').eq('date', todayStr),
               supabase.from('transactions').select('total_amount').gte('date', firstDayOfMonth).lte('date', lastDayOfMonth),
               supabase.from('transactions').select('id, due_date, total_amount, customers(id, name)').not('due_date', 'is', null).gte('due_date', todayStr).lte('due_date', targetDateStr).order('due_date', { ascending: true }).limit(5),
               supabase.from('payments').select('amount').gte('date', firstDayOfMonth).lte('date', lastDayOfMonth)
           ]);

           let totalOutstanding = 0;
           if (balancesRes.data) {
               totalOutstanding = balancesRes.data.reduce((acc, row) => acc + (Number(row.outstanding_balance) || 0), 0);
           }
           
           const activeCustomersCount = customersRes.count || 0;
           const diariesCount = diariesRes.count || 0;
           
           let todaysCollection = 0;
           if (todaysCollectionRes.data) {
               todaysCollection = todaysCollectionRes.data.reduce((acc, row) => acc + Number(row.amount), 0);
           }
           
           let monthlySales = 0;
           if (monthlySalesRes.data) {
               monthlySales = monthlySalesRes.data.reduce((acc, row) => acc + Number(row.total_amount), 0);
           }
           
           let recoveredAmount = 0;
           if (monthlyPaymentsRes.data) {
               recoveredAmount = monthlyPaymentsRes.data.reduce((acc, row) => acc + Number(row.amount), 0);
           }

           const recoveryTarget = totalOutstanding + recoveredAmount;
           
           let upcomingPayments = [] as any[];
           if (upcomingRes.data) {
               upcomingPayments = upcomingRes.data.map((tx: any) => ({
                   id: tx.id,
                   dueDate: tx.due_date,
                   amount: tx.total_amount,
                   customerName: tx.customers?.name || 'Unknown',
                   customerId: tx.customers?.id
               }));
           }

           setMetrics({
               totalOutstanding,
               activeCustomersCount,
               diariesCount,
               todaysCollection,
               monthlySales,
               upcomingPayments,
               recoveryTarget,
               recoveredAmount
           });

       } catch (error: any) {
           console.error('Error fetching dashboard data:', error);
           setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to load dashboard data');
       } finally {
           setLoading(false);
       }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
      return <div className="flex-1 flex items-center justify-center pt-20 text-on-surface-variant font-medium gap-2"><Loader2 className="animate-spin" size={20}/> Loading dashboard...</div>;
  }

  const { totalOutstanding, activeCustomersCount, diariesCount, todaysCollection, monthlySales, upcomingPayments, recoveryTarget, recoveredAmount } = metrics;
  
  const recoveryPercentage = recoveryTarget > 0 ? Math.round((recoveredAmount / recoveryTarget) * 100) : 0;

  return (
    <div className="px-4 md:px-12 max-w-7xl mx-auto flex flex-col gap-6 pt-4 pb-12">
      {errorMsg && (
        <div className="mb-4 p-4 bg-error-container text-on-error-container text-sm font-medium rounded-xl shadow-sm border border-error/20">
          <p className="font-bold mb-1">Error Loading Data:</p>
          <p>{errorMsg}</p>
        </div>
      )}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Outstanding Card */}
        <div className="bg-primary text-on-primary rounded-xl p-6 flex flex-col justify-between shadow-md relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-10 transform group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <AlertTriangle size={120} />
          </div>
          <div className="flex items-center gap-2 mb-4 relative z-10">
             <AlertTriangle className="text-on-primary-fixed-variant" size={20} />
             <h2 className="text-xs text-surface-variant uppercase tracking-wider font-medium">Total Outstanding</h2>
          </div>
          <div className="relative z-10">
             <div className="flex items-baseline gap-1">
               <span className="text-xl text-surface-variant font-medium">₹</span>
               <span className="text-4xl font-label-numeric font-bold tracking-tight">{(totalOutstanding / 100000).toFixed(2)}</span>
               <span className="text-xl text-surface-variant font-medium">Lakh</span>
             </div>
             <p className="text-[11px] mt-1 text-primary-fixed-dim">Across {activeCustomersCount} buyers in {diariesCount} diaries</p>
          </div>
        </div>

        {/* Today's Collection */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container flex flex-col justify-between shadow-sm">
           <div className="flex items-center gap-2 mb-4 text-secondary">
             <BadgeDollarSign size={20} />
             <h2 className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Today's Collection</h2>
           </div>
           <div>
             <div className="flex items-baseline gap-1 text-on-surface">
               <span className="text-xl text-on-surface-variant font-medium">₹</span>
               <span className="text-3xl font-label-numeric font-bold tracking-tight">{todaysCollection.toLocaleString()}</span>
             </div>
           </div>
        </div>

        {/* Monthly Sales */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container flex flex-col justify-between shadow-sm">
           <div className="flex items-center gap-2 mb-4 text-primary-container">
             <TrendingUp size={20} />
             <h2 className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Monthly Sales</h2>
           </div>
           <div>
             <div className="flex items-baseline gap-1 text-on-surface">
               <span className="text-xl text-on-surface-variant font-medium">₹</span>
               <span className="text-3xl font-label-numeric font-bold tracking-tight">{(monthlySales / 100000).toFixed(2)}</span>
               <span className="text-xl text-on-surface-variant font-medium">Lakh</span>
             </div>
           </div>
        </div>

        {/* Total Diaries */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container flex flex-col justify-between shadow-sm">
           <div className="flex items-center gap-2 mb-4 text-secondary">
             <BookOpen size={20} />
             <h2 className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Total Diaries</h2>
           </div>
           <div>
             <div className="text-on-surface">
               <span className="text-3xl font-label-numeric font-bold tracking-tight">{diariesCount.toLocaleString()}</span>
             </div>
           </div>
        </div>

        {/* Total Customers */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container flex flex-col justify-between shadow-sm">
           <div className="flex items-center gap-2 mb-4 text-surface-tint">
             <Users size={20} />
             <h2 className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">Total Customers</h2>
           </div>
           <div>
             <div className="text-on-surface">
               <span className="text-3xl font-label-numeric font-bold tracking-tight">{activeCustomersCount.toLocaleString()}</span>
             </div>
           </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recovery Target */}
        <div className="bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm flex flex-col cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigateTo('recovery-dashboard')}>
          <h3 className="text-xl font-semibold text-on-surface mb-6">Recovery Target</h3>
          <div className="flex-grow flex flex-col items-center justify-center">
             <div className="relative w-48 h-48 rounded-full flex items-center justify-center shadow-sm" style={{ background: `conic-gradient(#000000 ${recoveryPercentage}%, #e0e3e5 0)` }}>
                <div className="absolute inset-2 bg-surface-container-lowest rounded-full flex flex-col items-center justify-center shadow-inner">
                   <span className="text-3xl font-label-numeric font-bold text-primary">{recoveryPercentage}%</span>
                   <span className="text-xs text-on-surface-variant mt-1 font-medium">Recovered</span>
                </div>
             </div>
             <div className="mt-8 w-full flex justify-between px-4">
                <div className="flex flex-col items-center">
                  <span className="text-on-surface-variant text-xs font-medium uppercase tracking-wider">Target</span>
                  <span className="font-label-numeric font-bold text-on-surface mt-1 text-base">₹{(recoveryTarget/100000).toFixed(1)}L</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-on-surface-variant text-xs font-medium uppercase tracking-wider">Achieved</span>
                  <span className="font-label-numeric font-bold text-secondary mt-1 text-base">₹{(recoveredAmount/100000).toFixed(1)}L</span>
                </div>
             </div>
          </div>
        </div>

        {/* Upcoming Payments Notification */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-surface-container shadow-sm overflow-hidden flex flex-col relative h-full">
          <div className="p-6 border-b border-surface-variant flex justify-between items-center bg-surface-container-low/50">
             <div className="flex items-center gap-2">
                 <h3 className="text-xl font-semibold text-on-surface">Upcoming Payments</h3>
                 {upcomingPayments.length > 0 && (
                     <div className="bg-error text-on-error text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center justify-center">
                         {upcomingPayments.length}
                     </div>
                 )}
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-0">
             {upcomingPayments.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-on-surface-variant opacity-70 p-8">
                     <AlertTriangle size={32} className="mb-2 opacity-50 text-secondary" />
                     <p className="text-sm">No payments due in the next 7 days</p>
                 </div>
             ) : (
                 <ul className="divide-y divide-surface-variant/50">
                     {upcomingPayments.map((payment, i) => {
                         const daysUntil = Math.ceil((new Date(payment.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                         return (
                             <li key={i} className="p-4 flex items-center justify-between hover:bg-surface-container-lowest transition-colors cursor-pointer" onClick={() => payment.customerId && navigateTo('customer-ledger', { customerId: payment.customerId })}>
                                 <div>
                                     <p className="text-sm font-bold text-on-surface">{payment.customerName}</p>
                                     <p className="text-xs text-on-surface-variant font-medium mt-0.5">
                                         {daysUntil === 0 ? 'Due Today' : `Due in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`} • {payment.dueDate.split('-').reverse().join('/')}
                                     </p>
                                 </div>
                                 <div className="text-right">
                                     <p className="font-label-numeric font-bold text-secondary">₹{Number(payment.amount).toLocaleString()}</p>
                                 </div>
                             </li>
                         );
                     })}
                 </ul>
             )}
          </div>
        </div>
      </section>
    </div>
  )
}
