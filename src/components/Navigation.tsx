import React, { useState } from 'react';
import {
  ArrowRight, BadgeDollarSign, BookOpen, ChartNoAxesCombined, CreditCard, LayoutDashboard,
  MoreHorizontal, Plus, ReceiptText, Search, Settings, Users, X, CircleHelp, LogIn
} from 'lucide-react';
import { NavigationProps, ViewState } from '../types';

const mainItems = [
  { id: 'dashboard', label: 'Overview', short: 'Home', icon: LayoutDashboard },
  { id: 'diaries', label: 'Diaries', short: 'Diaries', icon: BookOpen },
  { id: 'customers', label: 'Customers', short: 'Customers', icon: Users },
  { id: 'recovery-dashboard', label: 'Recovery', short: 'Recovery', icon: BadgeDollarSign },
  { id: 'reports', label: 'Analytics', short: 'Reports', icon: ChartNoAxesCombined },
] as const;

const auxiliary = [
  { id: 'payment-history', label: 'Payment history', icon: ReceiptText },
  { id: 'search', label: 'Search records', icon: Search },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar({ currentView, navigateTo }: NavigationProps) {
  const go = (view: ViewState) => navigateTo(view);
  return (
    <aside className="zl-sidebar hidden lg:flex" aria-label="Main sidebar">
      <div className="zl-brand">
        <span className="zl-brand-symbol" aria-hidden="true">Z</span>
        <div>
          <h1>Zual Hardware</h1>
          <p>BUSINESS OPERATIONS</p>
        </div>
      </div>

      <p className="zl-sidebar-label">WORKSPACE</p>
      <nav className="zl-side-nav" aria-label="Primary">
        {mainItems.map(item => {
          const active = currentView === item.id;
          return (
            <button type="button" key={item.id} className={'zl-side-button' + (active ? ' active' : '')}
              aria-current={active ? 'page' : undefined} onClick={() => go(item.id)}>
              <item.icon size={19} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="zl-sidebar-rule" />
      <p className="zl-sidebar-label">MANAGE</p>
      <nav className="zl-side-nav" aria-label="Management">
        {auxiliary.map(item => {
          const active = currentView === item.id;
          return (
            <button key={item.id} type="button" onClick={() => go(item.id)}
              className={'zl-side-button' + (active ? ' active' : '')}
              aria-current={active ? 'page' : undefined}>
              <item.icon size={19} strokeWidth={1.8} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="zl-sidebar-rule" />
      <p className="zl-sidebar-label">QUICK CREATE</p>
      <div className="zl-sidebar-quick">
        <button type="button" className="zl-sidebar-primary" onClick={() => go('new-entry')}>
          <Plus size={19} /> New sale <ArrowRight size={17} style={{ marginLeft: 'auto' }} />
        </button>
        <button type="button" className="zl-sidebar-secondary" onClick={() => go('record-payment')}>
          <CreditCard size={18} /> Record payment
        </button>
      </div>

      <div className="zl-sidebar-footer">
        <button type="button" className="zl-sidebar-profile" onClick={() => go('settings')}>
          <span className="zl-sidebar-profile-icon"><Settings size={19} /></span>
          <span><div className="zl-sidebar-profile-name">Workspace settings</div><div className="zl-sidebar-profile-caption">Manage your business</div></span>
          <ArrowRight size={16} className="zl-sidebar-profile-arrow" />
        </button>
      </div>
    </aside>
  );
}

export function BottomNav({ currentView, navigateTo }: NavigationProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = ['reports', 'settings', 'payment-history', 'search'].includes(currentView);
  const go = (view: ViewState) => {
    setMoreOpen(false);
    navigateTo(view);
  };
  return (
    <>
      {moreOpen && (
        <>
          <button type="button" className="zl-more-overlay lg:hidden" aria-label="Close more menu"
            onClick={() => setMoreOpen(false)} />
          <div className="zl-more-sheet lg:hidden" role="dialog" aria-modal="true" aria-label="More navigation">
            <div className="zl-more-title">More from your workspace</div>
            <div className="zl-more-grid">
              <button onClick={() => go('reports')}><ChartNoAxesCombined size={19} /> Reports</button>
              <button onClick={() => go('payment-history')}><ReceiptText size={19} /> Payment history</button>
              <button onClick={() => go('record-payment')}><CreditCard size={19} /> Record payment</button>
              <button onClick={() => go('search')}><Search size={19} /> Find records</button>
              <button onClick={() => go('settings')}><Settings size={19} /> Settings</button>
              <button onClick={() => setMoreOpen(false)}><X size={19} /> Close menu</button>
            </div>
          </div>
        </>
      )}
      <nav className="zl-mobile-nav lg:hidden fixed bottom-0 left-0 right-0 z-50" aria-label="Mobile navigation">
        <div className="zl-mobile-nav-inner">
          {mainItems.slice(0, 4).map(item => {
            const active = item.id === currentView && !moreOpen;
            return (
              <button key={item.id} type="button"
                className={'zl-mobile-nav-button' + (active ? ' active' : '')}
                aria-current={active ? 'page' : undefined}
                onClick={() => go(item.id)}>
                <item.icon size={20} strokeWidth={active ? 2.4 : 1.85} aria-hidden="true" />
                <span>{item.short}</span>
              </button>
            );
          })}
          <button type="button" className={'zl-mobile-nav-button' + ((moreOpen || moreActive) ? ' active' : '')}
            aria-expanded={moreOpen} aria-label="More navigation options" onClick={() => setMoreOpen(!moreOpen)}>
            <MoreHorizontal size={22} strokeWidth={2} aria-hidden="true" /><span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
