import { supabase } from './supabase';

export interface PendingOp {
  id: string;
  type: 'transaction' | 'payment' | 'customer';
  action: 'insert' | 'update';
  payload: any;
  timestamp: number;
  customerName?: string; // Context for user readability
  error?: string;
}

const STORAGE_KEY = 'erp_pending_offline_operations';

class OfflineSyncEngine {
  private listeners: Set<() => void> = new Set();
  private syncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[OfflineSync] Network status: ONLINE. Triggering sync...');
        this.sync();
      });
      window.addEventListener('offline', () => {
        console.log('[OfflineSync] Network status: OFFLINE.');
        this.notify();
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.getPendingOps().length && navigator.onLine) {
          this.sync().catch(error => console.error('[OfflineSync] Resume sync failed:', error));
        }
      });
    }
  }

  get isOnline(): boolean {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline-sync-updated'));
    }
  }

  getPendingOps(): PendingOp[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('[OfflineSync] Error reading from localStorage:', e);
      return [];
    }
  }

  private savePendingOps(ops: PendingOp[]) {
    // A failed storage write must NEVER be reported as a successful offline save.
    // The caller must remain on the form and show a visible error.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
    } catch (error) {
      console.error('[OfflineSync] Failed to persist offline records:', error);
      throw new Error('Unable to save offline. Free some device storage and try again. Your entry was NOT saved.');
    }
    this.notify();
  }

  addPendingOp(type: PendingOp['type'], action: PendingOp['action'], payload: any, customerName?: string): PendingOp {
    return this.addPendingBatch([{ type, action, payload, customerName }])[0];
  }

  /** Persist all parts of a sale/payment in ONE atomic storage write. */
  addPendingBatch(entries: Array<Pick<PendingOp, 'type' | 'action' | 'payload' | 'customerName'>>): PendingOp[] {
    const timestamp = Date.now();
    const newOps: PendingOp[] = entries.map((entry, index) => ({
      ...entry,
      id: `${entry.type}-${timestamp}-${index}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: timestamp + index
    }));
    if (!newOps.length) return [];
    const pending = this.getPendingOps();
    this.savePendingOps([...pending, ...newOps]);
    if (this.isOnline) this.sync().catch(error => console.error('[OfflineSync] Background sync failed:', error));
    return newOps;
  }

  removePendingOp(id: string) {
    const ops = this.getPendingOps().filter(op => op.id !== id);
    this.savePendingOps(ops);
  }

  isSyncing(): boolean {
    return this.syncing;
  }

  async sync(): Promise<{ successCount: number; failCount: number }> {
    if (this.syncing) return { successCount: 0, failCount: 0 };
    if (!this.isOnline) return { successCount: 0, failCount: 0 };

    const ops = this.getPendingOps();
    if (ops.length === 0) return { successCount: 0, failCount: 0 };

    this.syncing = true;
    this.notify();

    console.log(`[OfflineSync] Started syncing ${ops.length} operations...`);
    let successCount = 0;
    let failCount = 0;

    // We'll process operations sequentially in chronological order to protect dependencies.
    // We keep a mapping of temporary customer IDs to real verified Supabase customer IDs
    const idMap: Record<string, string> = {};

    const opsCopy = [...ops].sort((a, b) => a.timestamp - b.timestamp);

    for (const op of opsCopy) {
      try {
        let authUser;
        try {
          const userRes = await supabase.auth.getUser();
          authUser = userRes.data.user;
        } catch {
          // Fallback if auth is not ready
        }

        if (op.type === 'customer') {
          const payload = { ...op.payload };
          // Remove any temporary ID from payload before insertion
          const tempCustId = payload.id;
          if (op.action === 'insert') {
            delete payload.id;
            
            const { data, error } = await supabase
              .from('customers')
              .insert([payload])
              .select('id')
              .single();

            if (error) throw error;
            if (data?.id && tempCustId) {
              idMap[tempCustId] = data.id;
              // Remap still-queued entries durably, across app restarts.
              const remaining = this.getPendingOps().map(p => ({
                ...p,
                payload: p.payload?.customer_id === tempCustId ? { ...p.payload, customer_id: data.id } : p.payload
              }));
              this.savePendingOps(remaining);
              console.log(`[OfflineSync] Remapped pending customer ${tempCustId} to ${data.id}`);
            }
          } else {
            // Update
            const { error } = await supabase
              .from('customers')
              .update(payload)
              .eq('id', tempCustId);

            if (error) throw error;
          }
        } 
        else if (op.type === 'transaction') {
          const payload = { ...op.payload };
          
          // Re-map customer_id if it's a temporary ID that has been synced
          if (idMap[payload.customer_id]) {
            payload.customer_id = idMap[payload.customer_id];
          }

          // Use the latest user ID if available
          if (authUser?.id) {
            payload.recorded_by = authUser.id;
          }

          const { error } = await supabase
            .from('transactions')
            .insert([payload]);

          if (error) throw error;
        } 
        else if (op.type === 'payment') {
          const payload = { ...op.payload };

          // Re-map customer_id if it's a temporary ID that has been synced
          if (idMap[payload.customer_id]) {
            payload.customer_id = idMap[payload.customer_id];
          }

          // Use the latest user ID if available
          if (authUser?.id) {
            payload.recorded_by = authUser.id;
          }

          const { error } = await supabase
            .from('payments')
            .insert([payload]);

          if (error) throw error;
        }

        // Successfully synced! Remove it.
        this.removePendingOp(op.id);
        successCount++;
        console.log(`[OfflineSync] Synced item ${op.id} of type ${op.type} successfully.`);
      } catch (err: any) {
        console.error(`[OfflineSync] Failed to sync ${op.id} of type ${op.type}:`, err);
        failCount++;
        
        // Update the operation with the error message so the user can see what went wrong
        const currentOps = this.getPendingOps();
        const foundIdx = currentOps.findIndex(o => o.id === op.id);
        if (foundIdx !== -1) {
          currentOps[foundIdx].error = err?.message || JSON.stringify(err);
          this.savePendingOps(currentOps);
        }

        // If it's a fetch or connection/network error, stop syncing the rest of the queue
        const isNetworkErr = !navigator.onLine || 
          err?.message?.toLowerCase().includes('fetch') || 
          err?.message?.toLowerCase().includes('network') ||
          err?.status === 0;

        // Never process child payments/transactions after a failed earlier operation.
        // Keep the remaining queue intact for safe manual or reconnect retry.
        console.warn('[OfflineSync] Pausing queue to preserve chronological dependencies.');
        break;
      }
    }

    this.syncing = false;
    this.notify();
    return { successCount, failCount };
  }
}

export const offlineSync = new OfflineSyncEngine();

import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [status, setStatus] = useState({
    isOnline: offlineSync.isOnline,
    pendingCount: offlineSync.getPendingOps().length,
    pendingOps: offlineSync.getPendingOps(),
    isSyncing: offlineSync.isSyncing()
  });

  useEffect(() => {
    const handleUpdate = () => {
      setStatus({
        isOnline: offlineSync.isOnline,
        pendingCount: offlineSync.getPendingOps().length,
        pendingOps: offlineSync.getPendingOps(),
        isSyncing: offlineSync.isSyncing()
      });
    };

    const unsubscribe = offlineSync.subscribe(handleUpdate);
    window.addEventListener('online', handleUpdate);
    window.addEventListener('offline', handleUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleUpdate);
      window.removeEventListener('offline', handleUpdate);
    };
  }, []);

  return status;
}
