
import { supabase } from './supabase';
import { Drop, Purchase, User, UserTier, Profile, DropApprovalStatus, WaitlistEntry } from '../types';

// --- SUPABASE API IMPLEMENTATION ---

// Helper to calculate derived user stats (since they aren't in the DB yet)
const mapProfileToUser = (profile: Profile): User => {
    return {
        id: profile.id,
        name: profile.name || 'Foodie',
        email: profile.email,
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
        name: sessionUser.email?.split('@')[0] || 'User',
        email: sessionUser.email || '',
        isVendor: false,
        isAdmin: false,
        isInfluencer: false,
        points: 0,
        tier: UserTier.TASTER,
        streak: 0,
        unlockedVouchers: 0
    };
};

// --- AUTH ---

export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      // Fast path: set a basic user immediately to avoid UI lag.
      callback(mapSessionToUser(session.user));
      // Hydrate profile in background.
      getProfile(session.user.id).then((profile) => {
        if (profile) callback(mapProfileToUser(profile));
      }).catch((error) => {
        console.error("Profile fetch failed:", error);
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
  if (profile) return mapProfileToUser(profile);

  return mapSessionToUser(session.user);
};

export const loginUser = async (email: string, pass: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass
  });
  if (error) throw error;
  return data.user;
};

export const signUpUser = async (email: string, pass: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
  });
  
  if (error) throw error;
  
  if (data.user) {
    // Create profile entry
    const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email: email,
        name: email.split('@')[0],
        is_vendor: false,
        is_admin: false
    });
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

export const updateProfile = async (userId: string, updates: Partial<Profile>): Promise<Profile> => {
    const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...updates }, { onConflict: 'id' })
        .select()
        .single();
        
    if (error) throw error;
    return data as Profile;
};

// --- DROPS ---

export const getApprovedDrops = async (): Promise<Drop[]> => {
    const { data, error } = await supabase
        .from('drops')
        .select('*')
        .eq('approval_status', DropApprovalStatus.APPROVED)
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
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Drop[];
};

export const getAllDrops = async (): Promise<Drop[]> => {
    const { data, error } = await supabase
        .from('drops')
        .select('*')
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

// ATOMIC PURCHASE TRANSACTION via RPC
export const savePurchase = async (drop: Drop, payload: any): Promise<Purchase> => {
    if (drop.approval_status !== DropApprovalStatus.APPROVED) {
      throw new Error("This package is not approved for booking yet.");
    }
    // Calculate Total Paid for validation
    let total = drop.price * payload.quantity;
    if (payload.deliveryRequested) total += (drop.delivery_fee || 0);
    
    // Add modifier costs
    if (payload.selectedItems) {
        let modifiersCost = 0;
        payload.selectedItems.forEach((item: any) => {
             item.selectedModifiers.forEach((group: any) => {
                 group.options.forEach((opt: any) => modifiersCost += opt.additionalPrice);
             });
        });
        total += (modifiersCost * payload.quantity);
    }

    const rpcParams = {
        p_drop_id: drop.id,
        p_user_id: payload.userId || null,
        p_customer_name: payload.customerName,
        p_customer_email: payload.customerEmail,
        p_quantity: payload.quantity,
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

export const createCheckoutSession = async (purchaseId: string, returnUrl?: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { purchaseId, returnUrl }
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
