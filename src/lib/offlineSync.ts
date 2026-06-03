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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
    } catch (e) {
      console.error('[OfflineSync] Error writing to localStorage:', e);
    }
    this.notify();
  }

  addPendingOp(type: PendingOp['type'], action: PendingOp['action'], payload: any, customerName?: string): PendingOp {
    const newOp: PendingOp = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      action,
      payload,
      timestamp: Date.now(),
      customerName
    };

    const ops = this.getPendingOps();
    ops.push(newOp);
    this.savePendingOps(ops);
    
    // Attempt an immediate sync if we believe we are online
    if (this.isOnline) {
      this.sync();
    }
    
    return newOp;
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
              console.log(`[OfflineSync] Mapped temp customer ID ${tempCustId} -> real ID ${data.id}`);
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

        if (isNetworkErr) {
          console.log('[OfflineSync] Halting synchronization due to connectivity loss.');
          break;
        }
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
