
export enum DropStatus {
  LIVE = 'LIVE',
  UPCOMING = 'UPCOMING',
  SOLD_OUT = 'SOLD_OUT'
}

export enum DropApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum DropType {
  PICKUP = 'PICKUP',
  EVENT = 'EVENT'
}

export enum UserTier {
  TASTER = 'Taster',
  REGULAR = 'Regular',
  INSIDER = 'Insider',
  TASTEMAKER = 'Tastemaker'
}

// FIX: Add missing SortOption type.
export type SortOption = 'NEWEST' | 'PRICE_LOW' | 'FASTEST' | 'DATE';

export interface Profile {
  id: string;
  username?: string;
  name: string;
  email: string;
  phone?: string;
  is_vendor: boolean;
  is_admin: boolean;
}

export interface QuantityTier {
  threshold: number;
  reward: string;
}

export interface User {
  id: string;
  username?: string;
  name: string;
  email: string;
  phone?: string;
  isInfluencer: boolean;
  isVendor: boolean;
  isAdmin: boolean;
  points: number;
  tier: UserTier;
  streak: number;
  unlockedVouchers: number;
}

export interface ModifierOption {
  id: string;
  name: string;
  additionalPrice: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id:string;
  name: string;
  basePrice: number;
  description: string;
  modifierGroups: ModifierGroup[];
}

export interface SelectedItem {
  itemId: string;
  name: string;
  basePrice: number;
  selectedModifiers: {
    groupId: string;
    groupName: string;
    options: ModifierOption[];
  }[];
}

export interface Purchase {
  id: string;
  user_id?: string;
  customer_name: string;
  customer_email: string;
  quantity: number;
  subtotal?: number;
  tax_rate?: number;
  tax_amount?: number;
  booking_fee?: number;
  timestamp: string;
  total_paid: number;
  order_notes?: string;
  is_bulk?: boolean;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
  paid_at?: string;
  unlocked_reward?: string;
  delivery_requested: boolean;
  delivery_fee: number;
  delivery_address?: string;
  selected_items: SelectedItem[];
  drop_id: string;
  drop_name: string;
  drop_image: string;
}

export interface WaitlistEntry {
  id: string;
  drop_id: string;
  user_id?: string;
  email: string;
  timestamp: string;
}

export interface Drop {
  id: string;
  creator_id: string;
  name: string;
  chef: string;
  image: string;
  location: string;
  start_date: string;
  end_date: string;
  price: number;
  tax_rate?: number;
  total_quantity: number;
  quantity_remaining: number;
  status: DropStatus;
  approval_status: DropApprovalStatus;
  type: DropType;
  category: string;
  description: string;
  hype_story: string;
  accent_color?: string;
  stripe_payment_link?: string;
  menu_items: MenuItem[];
  quantity_tiers: QuantityTier[];
  delivery_available: boolean;
  delivery_fee: number;
  coordinates?: { lat: number; lng: number };
  logistics: {
    address: string;
    instructions: string;
    allergens: string;
  };
  vendor_contact: {
    email: string;
    phone: string;
  };
  purchases?: Purchase[]; // Optional for client-side joins
}
