/**
 * Small read-only customer snapshot for Android when mobile internet drops.
 * Source of truth remains Supabase. Financial writes never go through this cache.
 */
const CACHE_KEY = 'zual_customers_cache_v1';

type CachedCustomer = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  diary_id?: string | null;
  balance?: number;
};

export function readCachedCustomers(): CachedCustomer[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value.filter((row: any) => row?.id && typeof row?.name === 'string') : [];
  } catch (error) {
    console.warn('[CustomerCache] Unable to read cached customer names.', error);
    return [];
  }
}

export function cacheCustomers(rows: any[]): void {
  try {
    const previous = new Map(readCachedCustomers().map(c => [c.id, c]));
    const sanitized: CachedCustomer[] = rows.filter(r => r?.id && r?.name).map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone ?? null,
      address: r.address ?? null,
      diary_id: r.diary_id ?? null,
      balance: r.balance === undefined ? previous.get(r.id)?.balance : Number(r.balance) || 0
    }));
    localStorage.setItem(CACHE_KEY, JSON.stringify(sanitized));
  } catch (error) {
    // The cache is optional. Unlike transaction storage, a cache failure may be ignored.
    console.warn('[CustomerCache] Offline customer cache could not be updated.', error);
  }
}
