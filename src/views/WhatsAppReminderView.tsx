import React, { useState, useEffect } from 'react';
import { MessageCircle, FileText, Send, CheckCheck, Check, Phone } from 'lucide-react';

import { AppContext } from '../types';
import { supabase } from '../lib/supabase';

export default function WhatsAppReminderView({ navigateTo, context }: { navigateTo: any, context?: AppContext }) {
  const [customer, setCustomer] = useState<any>(null);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const customerId = context?.customerId;

  useEffect(() => {
    const fetchCustomerData = async () => {
        if (!customerId) {
            setLoading(false);
            return;
        }

        try {
            const [custRes, balRes] = await Promise.all([
                supabase.from('customers').select('*').eq('id', customerId).single(),
                supabase.from('view_customer_balances').select('outstanding_balance').eq('customer_id', customerId).single()
            ]);

            if (custRes.data) setCustomer(custRes.data);
            if (balRes.data) setOutstandingBalance(Number(balRes.data.outstanding_balance) || 0);

        } catch (error: any) {
            console.error("Error fetching customer for reminder:", error);
            setErrorMsg(error.message || error.details || error.hint || JSON.stringify(error) || 'Failed to fetch customer data');
        } finally {
            setLoading(false);
        }
    };
    
    fetchCustomerData();
  }, [customerId]);

  const todayStr = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY

  if (loading) {
      return <div className="flex-1 flex items-center justify-center pt-20 text-on-surface-variant font-medium">Loading details...</div>;
  }

  if (errorMsg) {
      return (
          <div className="flex-1 flex items-center justify-center pt-20 px-4">
            <div className="p-4 bg-error-container text-on-error-container text-sm font-medium rounded-xl border border-error/20 max-w-lg w-full">
              <p className="font-bold mb-1">Error:</p>
              <p>{errorMsg}</p>
            </div>
          </div>
      );
  }

  if (!customer) {
      return <div className="flex-1 flex items-center justify-center pt-20 text-on-surface-variant font-medium">Customer not found or not selected.</div>;
  }

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:p-12 mb-12">
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 flex flex-col gap-8">
             <section className="bg-surface-container-lowest rounded-xl shadow-sm p-6 md:p-8 border border-outline-variant/30 flex flex-col gap-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-secondary to-primary-fixed"></div>
                
                <div className="flex items-center justify-between border-b border-surface-variant pb-5">
                   <h2 className="text-[22px] font-bold text-primary flex items-center gap-2.5 tracking-tight">
                      <MessageCircle className="text-secondary" fill="currentColor" size={26} />
                      Draft Reminder
                   </h2>
                   <span className="bg-secondary-fixed text-on-secondary-fixed-variant px-4 py-1.5 rounded-full text-xs font-bold tracking-wider">
                      WhatsApp
                   </span>
                </div>

                 <div className="flex flex-col gap-3">
                   <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Message Preview</label>
                   <div className="bg-surface-container-low border border-outline-variant/50 rounded-xl p-6 group relative shadow-sm">
                      <p className="text-[15px] text-on-surface whitespace-pre-wrap leading-relaxed font-medium">Dear <span className="font-bold text-primary">{customer.name}</span>,

Your current outstanding balance with <span className="font-bold">Our Store</span> is <span className="font-label-numeric font-bold text-error">₹ {outstandingBalance.toLocaleString()}</span>.

Please settle the due by <span className="font-bold">{todayStr}</span>.

Thank you.</p>
                      <button className="absolute top-4 right-4 h-8 px-4 rounded bg-surface-container text-on-surface hover:bg-surface-variant opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-bold border border-outline-variant/30 shadow-sm uppercase tracking-wider">
                         Edit Text
                      </button>
                   </div>
                </div>

                <div className="pt-2">
                   <a 
                     href={`https://wa.me/${customer.phone}?text=${encodeURIComponent(`Dear ${customer.name},\n\nYour current outstanding balance with Our Store is ₹ ${outstandingBalance.toLocaleString()}.\n\nPlease settle the due by ${todayStr}.\n\nThank you.`)}`}
                     target="_blank"
                     rel="noreferrer"
                     className="w-full h-14 bg-secondary text-on-secondary rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all text-[17px] font-bold shadow-md"
                   >
                      <Send size={20} fill="currentColor" /> Send via WhatsApp
                   </a>
                </div>
             </section>
          </div>
          
          <div className="lg:col-span-4 flex flex-col gap-8">
             <section className="bg-surface-container-lowest rounded-xl shadow-sm p-6 border border-surface-variant flex flex-col gap-4">
                <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-surface-variant pb-2">Recipient Details</h3>
                <div className="flex items-start gap-4">
                   <div className="w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xl shrink-0">{customer.name.charAt(0).toUpperCase()}</div>
                   <div className="flex flex-col">
                      <span className="text-[18px] font-bold text-on-surface tracking-tight">{customer.name}</span>
                      <span className="text-[13px] text-on-surface-variant font-medium mt-0.5">{customer.address}</span>
                      <span className="text-[13px] text-secondary font-label-numeric font-bold mt-1.5 flex items-center gap-1.5"><Phone size={14} /> {customer.phone}</span>
                   </div>
                </div>
                <div className="mt-2 bg-error-container/20 rounded-xl p-4 flex justify-between items-center border border-error-container/50">
                   <span className="text-[13px] font-bold text-on-surface uppercase tracking-wider">Total Due</span>
                   <span className="font-label-numeric font-bold text-error text-[22px] tracking-tight">₹ {outstandingBalance.toLocaleString()}</span>
                </div>
             </section>

             <section className="bg-surface-container-lowest rounded-xl shadow-sm p-6 border border-surface-variant flex flex-col flex-1">
                <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest border-b border-surface-variant pb-2 mb-6">Recent Reminders</h3>
                <div className="flex flex-col gap-0 relative ml-2">
                   <div className="absolute left-[11px] top-2 bottom-4 w-0.5 bg-surface-variant/70 z-0"></div>
                   
                   <div className="flex gap-5 relative z-10 pb-8">
                      <div className="w-6 h-6 rounded-full bg-surface-container-lowest border-[3px] border-secondary flex items-center justify-center shrink-0">
                         <div className="w-2 h-2 rounded-full bg-secondary"></div>
                      </div>
                      <div className="flex flex-col gap-1 w-full">
                         <div className="flex items-center justify-between w-full">
                            <span className="text-[14px] font-bold text-on-surface">WhatsApp Message</span>
                            <span className="text-[10px] font-bold text-on-surface-variant">Yesterday</span>
                         </div>
                         <span className="text-[12px] text-on-surface-variant flex items-center gap-1.5 font-medium">
                            <CheckCheck size={16} className="text-secondary" /> Read by recipient
                         </span>
                      </div>
                   </div>

                   <div className="flex gap-5 relative z-10 pb-8">
                      <div className="w-6 h-6 rounded-full bg-surface-container-lowest border-2 border-outline-variant flex items-center justify-center shrink-0"></div>
                      <div className="flex flex-col gap-1 w-full">
                         <div className="flex items-center justify-between w-full">
                            <span className="text-[14px] font-bold text-on-surface">SMS Alert</span>
                            <span className="text-[10px] font-bold text-on-surface-variant">10 May 2026</span>
                         </div>
                         <span className="text-[12px] text-on-surface-variant flex items-center gap-1.5 font-medium">
                            <Check size={16} /> Delivered
                         </span>
                      </div>
                   </div>

                   <div className="flex gap-5 relative z-10">
                      <div className="w-6 h-6 rounded-full bg-surface-container-lowest border-2 border-outline-variant flex items-center justify-center shrink-0"></div>
                      <div className="flex flex-col gap-1 w-full">
                         <div className="flex items-center justify-between w-full">
                            <span className="text-[14px] font-bold text-on-surface">Account Statement</span>
                            <span className="text-[10px] font-bold text-on-surface-variant">01 May 2026</span>
                         </div>
                         <span className="text-[12px] text-on-surface-variant flex items-center gap-1.5 font-medium">
                            <FileText size={16} /> Generated internally
                         </span>
                      </div>
                   </div>
                </div>
             </section>
          </div>
       </div>
    </div>
  )
}
