import React, { useEffect, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarDays, CheckCircle2, ChevronRight,
  CircleAlert, CreditCard, IndianRupee, Loader2, Plus, ReceiptText,
  ShieldCheck, Sparkles, TrendingUp, Users, Wallet, Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getLocalDateISO } from '../lib/dates';

type UpcomingPayment = {
  id: string;
  dueDate: string;
  amount: number;
  customerName: string;
  customerId?: string;
};

type DashboardMetrics = {
  totalOutstanding: number;
  activeCustomersCount: number;
  diariesCount: number;
  todaysCollection: number;
  monthlySales: number;
  upcomingPayments: UpcomingPayment[];
  recoveryTarget: number;
  recoveredAmount: number;
};

const emptyMetrics: DashboardMetrics = {
  totalOutstanding: 0,
  activeCustomersCount: 0,
  diariesCount: 0,
  todaysCollection: 0,
  monthlySales: 0,
  upcomingPayments: [],
  recoveryTarget: 0,
  recoveredAmount: 0,
};

const money = (value: number) =>
  '₹' + Math.round(value || 0).toLocaleString('en-IN');

const compactMoney = (value: number) => {
  const abs = Math.abs(value || 0);
  const negative = value < 0 ? '-' : '';
  if (abs >= 10000000) return negative + '₹' + (abs / 10000000).toFixed(2) + ' Cr';
  if (abs >= 100000) return negative + '₹' + (abs / 100000).toFixed(2) + ' L';
  if (abs >= 10000) return negative + '₹' + (abs / 1000).toFixed(1) + ' K';
  return negative + '₹' + Math.round(abs).toLocaleString('en-IN');
};

const readableDate = (iso: string) => {
  if (!iso) return 'Date unavailable';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short',
  });
};

function SummaryCard({ label, value, note, icon: Icon, accent }: {
  label: string; value: string; note: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  accent: 'mint' | 'blue' | 'amber' | 'purple';
}) {
  return (
    <article className={'zl-summary zl-summary-' + accent}>
      <div className="zl-summary-top">
        <span className="zl-summary-icon"><Icon size={21} strokeWidth={2} /></span>
        <ArrowUpRight size={17} className="zl-summary-arrow" aria-hidden="true" />
      </div>
      <div className="zl-summary-bottom">
        <p className="zl-overline">{label}</p>
        <p className="zl-summary-value" title={value}>{value}</p>
        <p className="zl-summary-note">{note}</p>
      </div>
    </article>
  );
}

export default function DashboardView({ navigateTo }: { navigateTo: any }) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const welcomeDate = today.toLocaleDateString('en-IN', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  useEffect(() => {
    let mounted = true;
    const fetchDashboardData = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const now = new Date();
        const todayStr = getLocalDateISO(now);
        const currentMonth = todayStr.slice(0, 7);
        const firstDayOfMonth = currentMonth + '-01';
        const lastDayOfMonth = getLocalDateISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
        const targetDateStr = getLocalDateISO(targetDate);

        const [balancesRes, customersRes, diariesRes, todaysCollectionRes, monthlySalesRes, upcomingRes, monthlyPaymentsRes] =
          await Promise.all([
            supabase.from('view_customer_balances').select('outstanding_balance'),
            supabase.from('customers').select('id', { count: 'exact', head: true }),
            supabase.from('diaries').select('id', { count: 'exact', head: true }),
            supabase.from('payments').select('amount').eq('date', todayStr),
            supabase.from('transactions').select('total_amount').gte('date', firstDayOfMonth).lte('date', lastDayOfMonth),
            supabase.from('transactions').select('id, due_date, total_amount, customers(id, name)')
              .not('due_date', 'is', null)
              .gte('due_date', todayStr).lte('due_date', targetDateStr)
              .order('due_date', { ascending: true }).limit(5),
            supabase.from('payments').select('amount').gte('date', firstDayOfMonth).lte('date', lastDayOfMonth),
          ]);

        const error = [
          balancesRes.error, customersRes.error, diariesRes.error,
          todaysCollectionRes.error, monthlySalesRes.error,
          upcomingRes.error, monthlyPaymentsRes.error,
        ].find(Boolean);
        if (error) throw error;

        const sum = (rows: any[] | null, field: string) =>
          (rows || []).reduce((amount: number, row: any) => amount + (Number(row[field]) || 0), 0);

        const totalOutstanding = sum(balancesRes.data, 'outstanding_balance');
        const recoveredAmount = sum(monthlyPaymentsRes.data, 'amount');
        const upcomingPayments = (upcomingRes.data || []).map((tx: any) => ({
          id: tx.id,
          dueDate: tx.due_date,
          amount: Number(tx.total_amount) || 0,
          customerName: tx.customers?.name || 'Customer',
          customerId: tx.customers?.id,
        }));

        if (mounted) setMetrics({
          totalOutstanding,
          activeCustomersCount: customersRes.count || 0,
          diariesCount: diariesRes.count || 0,
          todaysCollection: sum(todaysCollectionRes.data, 'amount'),
          monthlySales: sum(monthlySalesRes.data, 'total_amount'),
          upcomingPayments,
          recoveryTarget: totalOutstanding + recoveredAmount,
          recoveredAmount,
        });
      } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        if (mounted) setErrorMsg(error.message || 'Unable to load your business overview.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => { mounted = false; };
  }, []);

  const { totalOutstanding, activeCustomersCount, diariesCount, todaysCollection, monthlySales, upcomingPayments, recoveryTarget, recoveredAmount } = metrics;
  const recoveredPercent = recoveryTarget > 0
    ? Math.min(100, Math.max(0, Math.round((recoveredAmount / recoveryTarget) * 100)))
    : 0;
  const dueCount = upcomingPayments.length;

  return (
    <div className="zl-dashboard">
      <div className="zl-page-intro">
        <div>
          <div className="zl-kicker"><span className="zl-kicker-line" /> YOUR BUSINESS, AT A GLANCE</div>
          <h1 className="zl-page-title">{greeting}<span className="zl-title-accent">.</span></h1>
          <p className="zl-page-subtitle">Here is what's happening at Zual Hardware today.</p>
        </div>
        <div className="zl-intro-actions">
          <div className="zl-date-chip"><CalendarDays size={16} /><span>{welcomeDate}</span></div>
          <button className="zl-button zl-button-dark" type="button" onClick={() => navigateTo('new-entry')}>
            <Plus size={19} /> New sale
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="zl-error" role="alert">
          <CircleAlert size={20} />
          <span>Some figures could not load: {errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="zl-dashboard-loading" role="status"><Loader2 className="animate-spin" size={24} /> Loading your business overview...</div>
      ) : (
        <>
          <section className="zl-overview" aria-label="Business overview">
            <article className="zl-hero">
              <div className="zl-hero-glow" aria-hidden="true" />
              <div className="zl-hero-top">
                <div className="zl-hero-label"><span className="zl-live-dot" /> TOTAL RECEIVABLES</div>
                <span className="zl-hero-icon"><Wallet size={20} /></span>
              </div>
              <div className="zl-hero-center">
                <p className="zl-hero-eyebrow">Outstanding balance</p>
                <p className="zl-hero-amount" title={money(totalOutstanding)}>{compactMoney(totalOutstanding)}</p>
                <p className="zl-hero-full">Exact balance: {money(totalOutstanding)}</p>
              </div>
              <div className="zl-hero-bottom">
                <div className="zl-hero-context">
                  <span className="zl-hero-avatar"><Users size={17} /></span>
                  <span><strong>{activeCustomersCount.toLocaleString('en-IN')}</strong> customers across <strong>{diariesCount.toLocaleString('en-IN')}</strong> diaries</span>
                </div>
                <button type="button" onClick={() => navigateTo('recovery-dashboard')} className="zl-hero-link" aria-label="View recovery dashboard">
                  <ArrowUpRight size={21} />
                </button>
              </div>
            </article>

            <div className="zl-summary-grid">
              <SummaryCard label="TODAY'S COLLECTION" value={compactMoney(todaysCollection)} note="Received today" icon={IndianRupee} accent="mint" />
              <SummaryCard label="MONTHLY SALES" value={compactMoney(monthlySales)} note="This calendar month" icon={TrendingUp} accent="blue" />
              <SummaryCard label="TOTAL CUSTOMERS" value={activeCustomersCount.toLocaleString('en-IN')} note="Registered accounts" icon={Users} accent="amber" />
              <SummaryCard label="ACTIVE DIARIES" value={diariesCount.toLocaleString('en-IN')} note="Business ledgers" icon={BookOpen} accent="purple" />
            </div>
          </section>

          <section className="zl-bottom-grid" aria-label="Collections and upcoming activity">
            <article className="zl-panel zl-recovery-panel">
              <div className="zl-panel-heading">
                <div>
                  <div className="zl-panel-eyebrow">FINANCIAL HEALTH</div>
                  <h2>Recovery progress</h2>
                </div>
                <span className="zl-panel-icon"><TrendingUp size={20} /></span>
              </div>
              <div className="zl-recovery-main">
                <div className="zl-ring" style={{ background: 'conic-gradient(#2563eb ' + recoveredPercent + '%, #e9eef5 0)' }} role="img" aria-label={recoveredPercent + '% of current recovery target collected'}>
                  <div className="zl-ring-inner">
                    <div className="zl-ring-percent">{recoveredPercent}<span>%</span></div>
                    <p>Recovered</p>
                  </div>
                </div>
                <div className="zl-recovery-text">
                  <span className="zl-recovery-pill"><span /> Collection tracking</span>
                  <h3>{compactMoney(recoveredAmount)}</h3>
                  <p>Received this month</p>
                  <button type="button" onClick={() => navigateTo('recovery-dashboard')} className="zl-text-link">
                    View recovery dashboard <ArrowRight size={16} />
                  </button>
                </div>
              </div>
              <div className="zl-recovery-footer">
                <div><span>RECOVERY TARGET</span><strong title={money(recoveryTarget)}>{compactMoney(recoveryTarget)}</strong></div>
                <div><span>MONTHLY COLLECTION</span><strong title={money(recoveredAmount)}>{compactMoney(recoveredAmount)}</strong></div>
              </div>
            </article>

            <article className="zl-panel zl-upcoming-panel">
              <div className="zl-panel-heading zl-upcoming-heading">
                <div>
                  <div className="zl-panel-eyebrow">NEXT 7 DAYS</div>
                  <h2>Upcoming payments</h2>
                </div>
                <button type="button" onClick={() => navigateTo('recovery-dashboard')} className="zl-icon-button" aria-label="Open recovery dashboard">
                  <ArrowUpRight size={21} />
                </button>
              </div>
              {dueCount === 0 ? (
                <div className="zl-empty-state">
                  <div className="zl-empty-art">
                    <div className="zl-empty-halo" />
                    <CheckCircle2 size={38} strokeWidth={1.65} />
                  </div>
                  <strong>All clear for the next 7 days</strong>
                  <p>No scheduled payments are due this week. Explore your customer balances or record a collection.</p>
                  <button className="zl-button zl-button-soft" type="button" onClick={() => navigateTo('record-payment')}>
                    <CreditCard size={17} /> Record a payment <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="zl-due-list">
                  {upcomingPayments.map(payment => {
                    const days = Math.round(
                      (new Date(payment.dueDate + 'T00:00:00').getTime() -
                        new Date(getLocalDateISO() + 'T00:00:00').getTime()) / 86400000
                    );
                    return (
                      <button className="zl-due-row" type="button" key={payment.id}
                        onClick={() => payment.customerId && navigateTo('customer-ledger', { customerId: payment.customerId })}>
                        <span className="zl-due-avatar">{payment.customerName.trim().charAt(0).toUpperCase() || 'C'}</span>
                        <span className="zl-due-person">
                          <strong>{payment.customerName}</strong>
                          <small>{days === 0 ? 'Due today' : 'Due in ' + days + (days === 1 ? ' day' : ' days')} · {readableDate(payment.dueDate)}</small>
                        </span>
                        <span className="zl-due-value">{compactMoney(payment.amount)}</span>
                        <ChevronRight size={17} className="zl-due-chevron" />
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="zl-upcoming-footer">
                <span><span className="zl-status-dot" /> {dueCount === 0 ? 'No upcoming entries' : dueCount + ' upcoming entries'}</span>
                <button type="button" onClick={() => navigateTo('recovery-dashboard')}>View all <ArrowRight size={15} /></button>
              </div>
            </article>
          </section>

          <section className="zl-quick-panel" aria-label="Quick actions">
            <div className="zl-quick-heading">
              <div>
                <span className="zl-panel-eyebrow">WORK FASTER</span>
                <h2>Quick actions</h2>
              </div>
              <span className="zl-quick-hint"><Zap size={15} /> Your daily workspace</span>
            </div>
            <div className="zl-quick-grid">
              <button type="button" onClick={() => navigateTo('new-entry')}><span className="zl-quick-icon q-blue"><Plus size={21} /></span><span><strong>Create a sale</strong><small>Add a new transaction</small></span><ArrowUpRight size={17} /></button>
              <button type="button" onClick={() => navigateTo('record-payment')}><span className="zl-quick-icon q-green"><CreditCard size={20} /></span><span><strong>Record payment</strong><small>Update customer balances</small></span><ArrowUpRight size={17} /></button>
              <button type="button" onClick={() => navigateTo('customers')}><span className="zl-quick-icon q-purple"><Users size={20} /></span><span><strong>Customers</strong><small>Browse all accounts</small></span><ArrowUpRight size={17} /></button>
              <button type="button" onClick={() => navigateTo('payment-history')}><span className="zl-quick-icon q-amber"><ReceiptText size={20} /></span><span><strong>Payment history</strong><small>Review past collections</small></span><ArrowUpRight size={17} /></button>
            </div>
          </section>
          <div className="zl-dashboard-footer"><ShieldCheck size={15} /> Secure workspace <span /> <Sparkles size={15} /> Built for Zual Hardware</div>
        </>
      )}
    </div>
  );
}
