
import { supabase } from './supabase';
import { Drop, Purchase, User, UserTier, Profile, DropApprovalStatus, WaitlistEntry, DropCategory } from '../types';
import { DEFAULT_DROP_CATEGORIES } from '../constants/dropCategories';

// --- SUPABASE API IMPLEMENTATION ---

// Helper to calculate derived user stats (since they aren't in the DB yet)
const mapProfileToUser = (profile: Profile): User => {
    return {
        id: profile.id,
        username: profile.username || profile.email?.split('@')[0] || 'foodie',
        name: profile.name || 'Foodie',
        email: profile.email,
        phone: profile.phone,
        isVendor: profile.is_vendor,
        isAdmin: profile.is_admin,
        isInfluencer: true, // Default for now
        points: 100, // Placeholder
        tier: UserTier.TASTER, // Placeholder
        streak: 1, // Placeholder
        unlockedVouchers: 0 // Placeholder
    };
};

const mapSessionToUser = (sessionUser: { id: string; email?: string | null }): User => {
    return {
        id: sessionUser.id,
        username: sessionUser.email?.split('@')[0] || 'user',
        name: sessionUser.email?.split('@')[0] || 'User',
        email: sessionUser.email || '',
        phone: undefined,
        isVendor: false,
        isAdmin: false,
        isInfluencer: false,
        points: 0,
        tier: UserTier.TASTER,
        streak: 0,
        unlockedVouchers: 0
    };
};

const isActiveProfile = (profile: Profile | null): profile is Profile => {
    if (!profile) return false;
    if (profile.is_deleted) return false;
    if (profile.status === 'suspended') return false;
    return true;
};

// --- AUTH ---

export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      getProfile(session.user.id).then((profile) => {
        if (!isActiveProfile(profile)) {
          supabase.auth.signOut().catch(() => {});
          callback(null);
          return;
        }
        callback(mapProfileToUser(profile));
      }).catch((error) => {
        console.error("Profile fetch failed:", error);
        callback(null);
      });
    } else {
      callback(null);
    }
  });

  return () => subscription.unsubscribe();
};

export const getCurrentUser = async (): Promise<User | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session?.user) return null;

  const profile = await getProfile(session.user.id);
  if (!isActiveProfile(profile)) {
    await supabase.auth.signOut();
    return null;
  }
  return mapProfileToUser(profile);
};

export const loginUser = async (email: string, pass: string): Promise<User> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass
  });
  if (error) throw error;
  const requestedRole = String((data.user.user_metadata as any)?.requested_role || '').toLowerCase();
  let profile = await getProfile(data.user.id);
  if (!profile) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      email: data.user.email || email,
      username: (data.user.email || email).split('@')[0],
      name: (data.user.email || email).split('@')[0],
      is_vendor: requestedRole === 'vendor',
      is_admin: false
    });
    if (!profileError) {
      profile = await getProfile(data.user.id);
    }
  }
  // Reconcile legacy rows: if auth metadata indicates vendor, ensure profile reflects it.
  if (profile && requestedRole === 'vendor' && !profile.is_vendor) {
    const { error: vendorUpdateError } = await supabase
      .from('profiles')
      .update({ is_vendor: true })
      .eq('id', data.user.id);
    if (!vendorUpdateError) {
      profile = await getProfile(data.user.id);
    }
  }
  if (!isActiveProfile(profile)) {
    await supabase.auth.signOut();
    throw new Error('This account has been deactivated.');
  }
  return mapProfileToUser(profile);
};

export const signUpUser = async (email: string, pass: string, role: 'customer' | 'vendor' = 'customer') => {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: pass,
    options: {
      data: {
        requested_role: role
      }
    }
  });
  
  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('already') && msg.includes('registered')) {
      throw new Error('This email is already registered. Please create another account.');
    }
    throw error;
  }

  // Supabase may return a user object without a created identity when the email already exists.
  if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
    throw new Error('This email is already registered. Please create another account.');
  }
  
  // Create profile entry only if session is active (RLS allows insert for auth.uid()).
  if (data.session?.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.session.user.id,
      email: normalizedEmail,
      username: normalizedEmail.split('@')[0],
      name: normalizedEmail.split('@')[0],
      is_vendor: role === 'vendor',
      is_admin: false
    }, { onConflict: 'id' });
    if (profileError) console.error("Error creating profile:", profileError);
  }
  
  return data.user;
};

export const logoutUser = async () => {
    await supabase.auth.signOut();
};

// --- PROFILES ---

export const getProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) return null;
    return data as Profile;
};

export const getAllProfiles = async (): Promise<Profile[]> => {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return data as Profile[];
};

export const getProfilesPaged = async (params: {
    page: number;
    pageSize: number;
    search?: string;
    role?: 'vendor' | 'customer' | 'admin';
    status?: 'active' | 'suspended';
    includeDeleted?: boolean;
}): Promise<{ data: Profile[]; total: number }> => {
    const { page, pageSize, search, role, status, includeDeleted } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('profiles').select('*', { count: 'exact' });
    if (!includeDeleted) query = query.eq('is_deleted', false);
    if (status) query = query.eq('status', status);
    if (role === 'vendor') query = query.eq('is_vendor', true);
    if (role === 'admin') query = query.eq('is_admin', true);
    if (role === 'customer') query = query.eq('is_vendor', false).eq('is_admin', false);
    if (search) {
        const q = `%${search}%`;
        query = query.or(`name.ilike.${q},email.ilike.${q},phone.ilike.${q},company.ilike.${q}`);
    }

    const { data, error, count } = await query.order('name', { ascending: true }).range(from, to);
    if (error) throw error;
    return { data: (data as Profile[]) || [], total: count || 0 };
};

// --- DROP CATEGORIES ---

export const getApprovedDropCategories = async (): Promise<string[]> => {
    const { data, error } = await supabase
        .from('drop_categories')
        .select('name')
        .eq('status', 'approved')
        .order('name', { ascending: true });
    if (error) {
        console.error('Failed to load approved categories:', error);
        return DEFAULT_DROP_CATEGORIES;
    }
    const fromDb = (data || []).map((row: { name: string }) => row.name).filter(Boolean);
    const merged = Array.from(new Set([...DEFAULT_DROP_CATEGORIES, ...fromDb]));
    return merged;
};

export const requestDropCategory = async (name: string): Promise<DropCategory> => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name is required.');
    const normalized = trimmed.toLowerCase();

    // If already exists (approved or pending), return it as-is.
    const { data: existing } = await supabase
        .from('drop_categories')
        .select('*')
        .eq('normalized_name', normalized)
        .maybeSingle();
    if (existing) return existing as DropCategory;

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user?.id) throw new Error('Authentication required.');

    const { data, error } = await supabase
        .from('drop_categories')
        .insert({
            name: trimmed,
            normalized_name: normalized,
            status: 'pending',
            requested_by: userData.user.id
        })
        .select()
        .single();
    if (error) throw error;
    return data as DropCategory;
};

export const getPendingDropCategories = async (): Promise<DropCategory[]> => {
    const { data, error } = await supabase
        .from('drop_categories')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as DropCategory[];
};

export const reviewDropCategory = async (id: string, approve: boolean): Promise<DropCategory> => {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user?.id) throw new Error('Authentication required.');

    const { data, error } = await supabase
        .from('drop_categories')
        .update({
            status: approve ? 'approved' : 'rejected',
            reviewed_by: userData.user.id,
            reviewed_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as DropCategory;
};

export const updateProfileAdmin = async (userId: string, updates: Partial<Profile>): Promise<Profile> => {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
    if (error) throw error;
    return data as Profile;
};

export const softDeleteProfile = async (userId: string): Promise<void> => {
    const { error } = await supabase
        .from('profiles')
        .update({ is_deleted: true, status: 'suspended' })
        .eq('id', userId);
    if (error) throw error;
};

export const adminDeleteUserReleaseEmail = async (userId: string): Promise<void> => {
    const { error } = await supabase.rpc('admin_delete_user_release_email', { p_user_id: userId });
    if (error) throw error;
};

export const hardDeleteProfileIfNoOrders = async (userId: string): Promise<{ deleted: boolean }> => {
    const { count, error: countError } = await supabase
        .from('purchases')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
    if (countError) throw countError;
    if ((count || 0) > 0) return { deleted: false };
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
    return { deleted: true };
};

export const insertAuditLog = async (entry: {
    action: string;
    entity_type: string;
    entity_id?: string;
    payload?: any;
}): Promise<void> => {
    const { error } = await supabase.from('audit_log').insert({
        action: entry.action,
        entity_type: entry.entity_type,
        entity_id: entry.entity_id || null,
        payload: entry.payload || null
    });
    if (error) throw error;
};

export const logEvent = async (event: { name: string; payload?: any }): Promise<void> => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || null;
    if (!userId) return;
    const { error } = await supabase.from('analytics_events').insert({
        event_name: event.name,
        user_id: userId,
        payload: event.payload || null
    });
    if (error) throw error;
};

export const getEventLogPaged = async (params: {
    page: number;
    pageSize: number;
    eventName?: string;
    sortBy?: 'created_at' | 'user_id';
    sortDir?: 'asc' | 'desc';
}): Promise<{ data: any[]; total: number }> => {
    const { page, pageSize, eventName, sortBy, sortDir } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from('analytics_events').select('*', { count: 'exact' });
    if (eventName) query = query.eq('event_name', eventName);
    const { data, error, count } = await query.order(sortBy || 'created_at', { ascending: (sortDir || 'desc') === 'asc' }).range(from, to);
    if (error) throw error;
    return { data: data || [], total: count || 0 };
};

export const getProfilesByIds = async (ids: string[]): Promise<Profile[]> => {
    if (!ids.length) return [];
    const { data, error } = await supabase
        .from('profiles')
        .select('id,name,email')
        .in('id', ids);
    if (error) throw error;
    return (data as Profile[]) || [];
};

export const updateProfile = async (userId: string, updates: Partial<Profile>): Promise<Profile> => {
    const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...updates }, { onConflict: 'id' })
        .select()
        .single();
        
    if (error) throw error;
    return data as Profile;
};

export const checkUsernameAvailable = async (username: string, currentUserId?: string): Promise<{ available: boolean; checked: boolean }> => {
    if (!username) return { available: true, checked: false };
    const { data: rpcData, error: rpcError } = await supabase
        .rpc('check_username_available', { p_username: username, p_current_user: currentUserId || null });

    if (!rpcError && typeof rpcData === 'boolean') {
        return { available: rpcData, checked: true };
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username);

    if (error) {
        return { available: true, checked: false };
    }
    const conflict = (data || []).some((row: { id: string }) => row.id !== currentUserId);
    return { available: !conflict, checked: true };
};

// --- DROPS ---

export const getApprovedDrops = async (): Promise<Drop[]> => {
    const { data, error } = await supabase
        .from('drops')
        .select('*')
        .eq('approval_status', DropApprovalStatus.APPROVED)
        .eq('is_deleted', false)
        .order('start_date', { ascending: true });
        
    if (error) {
        console.error("Error fetching drops:", error);
        return [];
    }
    
    return data as Drop[];
};

export const getVendorDrops = async (vendorId: string): Promise<Drop[]> => {
    const { data, error } = await supabase
        .from('drops')
        .select('*')
        .eq('creator_id', vendorId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Drop[];
};

export const getAllDrops = async (): Promise<Drop[]> => {
    const { data, error } = await supabase
        .from('drops')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Drop[];
};

export const addDrop = async (drop: Partial<Drop>): Promise<Drop> => {
    // SECURITY/LOGIC FIX: We DO NOT strip the ID here anymore.
    // If the client (SellerStudio) provides a UUID, we must use it so image paths match the DB record.
    // Supabase allows inserting explicit IDs.
    
    const payload = {
        ...drop,
        approval_status: DropApprovalStatus.PENDING
    };

    const { data, error } = await supabase
        .from('drops')
        .insert(payload)
        .select()
        .single();
        
    if (error) throw error;
    return data as Drop;
};

export const updateDrop = async (dropId: string, updates: Partial<Drop>): Promise<Drop> => {
    const { approval_status, ...safeUpdates } = updates;
    const { data, error } = await supabase
        .from('drops')
        .update(safeUpdates)
        .eq('id', dropId)
        .select()
        .single();
        
    if (error) throw error;
    return data as Drop;
};

export const adminUpdateDrop = async (dropId: string, updates: Partial<Drop>): Promise<Drop> => {
    const { data, error } = await supabase
        .from('drops')
        .update(updates)
        .eq('id', dropId)
        .select()
        .single();
    if (error) throw error;
    return data as Drop;
};

export const adminDeleteDrop = async (dropId: string): Promise<void> => {
    const { error } = await supabase
        .from('drops')
        .update({ is_deleted: true, approval_status: DropApprovalStatus.REJECTED })
        .eq('id', dropId);
    if (error) throw error;
};

export const updateDropApprovalStatus = async (dropId: string, approvalStatus: DropApprovalStatus): Promise<Drop> => {
    const { data, error } = await supabase
        .from('drops')
        .update({ approval_status: approvalStatus })
        .eq('id', dropId)
        .select()
        .single();

    if (error) throw error;
    return data as Drop;
};

// --- PURCHASES ---

export const getPurchasesByUser = async (userId: string): Promise<Purchase[]> => {
    const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });
        
    if (error) throw error;
    return data as Purchase[];
};

export const getAllPurchases = async (): Promise<Purchase[]> => {
    const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .order('timestamp', { ascending: false });

    if (error) throw error;
    return data as Purchase[];
};

export const getPurchasesForVendorDrops = async (dropIds: string[]): Promise<Purchase[]> => {
    if (dropIds.length === 0) return [];
    
    const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .in('drop_id', dropIds)
        .order('timestamp', { ascending: false });
        
    if (error) throw error;
    return data as Purchase[];
};

export const getPurchasesPaged = async (params: {
    page: number;
    pageSize: number;
    search?: string;
    dropId?: string;
    paymentStatus?: Purchase['payment_status'];
    orderType?: 'bulk' | 'standard';
    dateFrom?: string;
    dateTo?: string;
    includeDeleted?: boolean;
    sortBy?: 'drop_name' | 'customer_name' | 'quantity' | 'payment_status' | 'is_bulk' | 'order_notes' | 'total_paid' | 'timestamp';
    sortDir?: 'asc' | 'desc';
}): Promise<{ data: Purchase[]; total: number }> => {
    const { page, pageSize, search, dropId, paymentStatus, orderType, dateFrom, dateTo, includeDeleted, sortBy, sortDir } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from('purchases').select('*', { count: 'exact' });
    if (!includeDeleted) query = query.eq('is_deleted', false);
    if (dropId) query = query.eq('drop_id', dropId);
    if (paymentStatus) query = query.eq('payment_status', paymentStatus);
    if (orderType === 'bulk') query = query.eq('is_bulk', true);
    if (orderType === 'standard') query = query.eq('is_bulk', false);
    if (dateFrom) query = query.gte('timestamp', dateFrom);
    if (dateTo) query = query.lte('timestamp', dateTo);
    if (search) {
        const q = `%${search}%`;
        query = query.or(`drop_name.ilike.${q},customer_name.ilike.${q},customer_email.ilike.${q},order_notes.ilike.${q}`);
    }
    const sortColumn = sortBy || 'timestamp';
    const { data, error, count } = await query.order(sortColumn, { ascending: (sortDir || 'desc') === 'asc' }).range(from, to);
    if (error) throw error;
    return { data: (data as Purchase[]) || [], total: count || 0 };
};

export const getPurchasesForExport = async (params: {
    search?: string;
    dropId?: string;
    paymentStatus?: Purchase['payment_status'];
    orderType?: 'bulk' | 'standard';
    dateFrom?: string;
    dateTo?: string;
    includeDeleted?: boolean;
}): Promise<Purchase[]> => {
    const { search, dropId, paymentStatus, orderType, dateFrom, dateTo, includeDeleted } = params;
    let query = supabase.from('purchases').select('*');
    if (!includeDeleted) query = query.eq('is_deleted', false);
    if (dropId) query = query.eq('drop_id', dropId);
    if (paymentStatus) query = query.eq('payment_status', paymentStatus);
    if (orderType === 'bulk') query = query.eq('is_bulk', true);
    if (orderType === 'standard') query = query.eq('is_bulk', false);
    if (dateFrom) query = query.gte('timestamp', dateFrom);
    if (dateTo) query = query.lte('timestamp', dateTo);
    if (search) {
        const q = `%${search}%`;
        query = query.or(`drop_name.ilike.${q},customer_name.ilike.${q},customer_email.ilike.${q},order_notes.ilike.${q}`);
    }
    const { data, error } = await query.order('timestamp', { ascending: false });
    if (error) throw error;
    return (data as Purchase[]) || [];
};

export const updatePurchaseStatusBulk = async (purchaseIds: string[], status: Purchase['payment_status']): Promise<void> => {
    if (purchaseIds.length === 0) return;
    const { error } = await supabase
        .from('purchases')
        .update({ payment_status: status })
        .in('id', purchaseIds);
    if (error) throw error;
};

export const softDeletePurchases = async (purchaseIds: string[]): Promise<void> => {
    if (purchaseIds.length === 0) return;
    const { error } = await supabase
        .from('purchases')
        .update({ is_deleted: true })
        .in('id', purchaseIds);
    if (error) throw error;
};

export const getAppSettings = async (): Promise<{ booking_fee_per_package: number }> => {
    const { data, error } = await supabase
        .from('app_settings')
        .select('booking_fee_per_package')
        .eq('id', 1)
        .single();
    if (error) throw error;
    return { booking_fee_per_package: Number(data.booking_fee_per_package || 0) };
};

export const updateAppSettings = async (updates: { booking_fee_per_package: number }): Promise<void> => {
    const { error } = await supabase
        .from('app_settings')
        .upsert({ id: 1, booking_fee_per_package: updates.booking_fee_per_package }, { onConflict: 'id' });
    if (error) throw error;
};

// ATOMIC PURCHASE TRANSACTION via RPC
export const savePurchase = async (drop: Drop, payload: any, bookingFeePerPackage = 0): Promise<Purchase> => {
    if (drop.approval_status !== DropApprovalStatus.APPROVED) {
      throw new Error("This package is not approved for booking yet.");
    }
    // Calculate Total Paid for validation
    let subtotal = drop.price * payload.quantity;
    
    // Add modifier costs
    if (payload.selectedItems) {
        let modifiersCost = 0;
        payload.selectedItems.forEach((item: any) => {
             item.selectedModifiers.forEach((group: any) => {
                 group.options.forEach((opt: any) => modifiersCost += opt.additionalPrice);
             });
        });
        subtotal += (modifiersCost * payload.quantity);
    }
    const deliveryFee = payload.deliveryRequested ? (drop.delivery_fee || 0) : 0;
    const bookingFee = bookingFeePerPackage * payload.quantity;
    const taxRate = Number(drop.tax_rate || 0);
    const taxAmount = (subtotal + deliveryFee + bookingFee) * taxRate;
    const baseTotal = subtotal + deliveryFee + bookingFee + taxAmount;
    const stripeFeeAmount = drop.pass_stripe_fee ? (baseTotal * 0.029) + 0.20 : 0;
    const total = baseTotal + stripeFeeAmount;

    const rpcParams = {
        p_drop_id: drop.id,
        p_user_id: payload.userId || null,
        p_customer_name: payload.customerName,
        p_customer_email: payload.customerEmail,
        p_quantity: payload.quantity,
        p_subtotal: subtotal,
        p_tax_rate: taxRate,
        p_tax_amount: taxAmount,
        p_booking_fee: bookingFee,
        p_stripe_fee_amount: stripeFeeAmount,
        p_total_paid: total,
        p_delivery_requested: payload.deliveryRequested,
        p_delivery_address: payload.deliveryAddress || null,
        p_selected_items: payload.selectedItems || [],
        p_drop_name: drop.name,
        p_drop_image: drop.image,
        p_order_notes: payload.orderNotes || null,
        p_is_bulk: !!payload.isBulk
    };

    const { data, error } = await supabase.rpc('purchase_drop_item', rpcParams);

    if (error) {
        console.error("Purchase RPC Error:", error);
        throw new Error(error.message || "Purchase failed.");
    }

    // RPC returns { success: true, purchase_id: uuid }
    // We then fetch the full purchase record to return it
    const { data: purchaseData, error: fetchError } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', data.purchase_id)
        .single();
        
    if (fetchError) throw fetchError;
    return purchaseData as Purchase;
};

export const createCheckoutSession = async (purchaseId: string, returnUrl?: string, checkoutToken?: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { purchaseId, returnUrl, checkoutToken: checkoutToken || null }
    });

    if (error) {
        throw new Error(error.message || 'Unable to create checkout session.');
    }

    if (!data?.url) {
        throw new Error('Checkout session URL missing from response.');
    }

    return data.url as string;
};

// --- STORAGE ---

export const uploadImage = async (file: File, dropId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${dropId}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
        .from('drop-images')
        .upload(fileName, file);

    if (uploadError) {
        throw uploadError;
    }

    const { data } = supabase.storage.from('drop-images').getPublicUrl(fileName);
    return data.publicUrl;
};

// --- WAITLIST ---

export const joinWaitlist = async (dropId: string, email: string, userId?: string): Promise<WaitlistEntry> => {
    const { data, error } = await supabase
        .from('waitlist')
        .insert({
            drop_id: dropId,
            email: email,
            user_id: userId || null
        })
        .select()
        .single();

    if (error) throw error;
    return data as WaitlistEntry;
};

export const getWaitlist = async (dropIds: string[]): Promise<WaitlistEntry[]> => {
    if (dropIds.length === 0) return [];
    
    const { data, error } = await supabase
        .from('waitlist')
        .select('*')
        .in('drop_id', dropIds)
        .order('created_at', { ascending: false });
        
    if (error) throw error;
    return data as WaitlistEntry[];
};
