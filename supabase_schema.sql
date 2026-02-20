
-- Supabase Schema for FoodieDrops
-- Version 9: VENDOR ACCESS & PRICING SANITY PATCH
-- Run this script in your Supabase project's SQL Editor.

-- 1. TABLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  company TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  is_vendor BOOLEAN DEFAULT false NOT NULL,
  is_admin BOOLEAN DEFAULT false NOT NULL
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'suspended'));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (username)
  WHERE username IS NOT NULL;

-- Username availability checker (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.check_username_available(p_username TEXT, p_current_user UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE username = p_username
      AND (p_current_user IS NULL OR id <> p_current_user)
  ) INTO v_exists;

  RETURN NOT v_exists;
END;
$$;

-- Email role checker (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.check_email_role(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized.';
  END IF;

  SELECT id, is_vendor, is_admin
  INTO v_profile
  FROM public.profiles
  WHERE lower(email) = lower(p_email)
    AND COALESCE(is_deleted, false) = false
  LIMIT 1;

  IF v_profile IS NULL THEN
    RETURN json_build_object('exists', false, 'is_vendor', false, 'is_admin', false);
  END IF;

  RETURN json_build_object(
    'exists', true,
    'is_vendor', COALESCE(v_profile.is_vendor, false),
    'is_admin', COALESCE(v_profile.is_admin, false)
  );
END;
$$;

-- Admin user deletion flow that preserves history while freeing original email for re-signup.
CREATE OR REPLACE FUNCTION public.admin_delete_user_release_email(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
SET row_security = off
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_tombstone_email TEXT;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF COALESCE(v_is_admin, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Unauthorized: admin required.';
  END IF;

  v_tombstone_email := 'deleted+' || replace(p_user_id::TEXT, '-', '') || '@foodiedrops.invalid';

  UPDATE public.profiles
  SET
    is_deleted = true,
    status = 'suspended',
    email = v_tombstone_email,
    username = NULL
  WHERE id = p_user_id;

  UPDATE auth.users
  SET
    email = v_tombstone_email,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'deleted_by_admin', true,
      'deleted_at', now()::text
    )
  WHERE id = p_user_id;

  -- Also tombstone identity records so Supabase auth uniqueness checks
  -- no longer hold the original email for sign-up.
  UPDATE auth.identities
  SET
    provider_id = v_tombstone_email,
    identity_data = CASE
      WHEN identity_data ? 'email'
        THEN jsonb_set(identity_data, '{email}', to_jsonb(v_tombstone_email), true)
      ELSE identity_data
    END
  WHERE user_id = p_user_id;
END;
$$;

CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  brand_description TEXT,
  website_url TEXT,
  instagram_handle TEXT
);

CREATE TABLE IF NOT EXISTS public.drops (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  chef TEXT NOT NULL,
  image TEXT NOT NULL,
  location TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  price NUMERIC NOT NULL,
  tax_rate NUMERIC DEFAULT 0,
  total_quantity INT NOT NULL,
  quantity_remaining INT NOT NULL,
  status TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  revision_requested BOOLEAN DEFAULT false,
  type TEXT NOT NULL,
  category TEXT,
  description TEXT,
  hype_story TEXT,
  accent_color TEXT,
  stripe_payment_link TEXT,
  menu_items JSONB,
  quantity_tiers JSONB,
  delivery_available BOOLEAN DEFAULT false,
  delivery_fee NUMERIC,
  pass_stripe_fee BOOLEAN DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  coordinates JSONB,
  logistics JSONB,
  vendor_contact JSONB,
  purchases JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Migration-safe patch for existing projects
ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.drops
  DROP CONSTRAINT IF EXISTS drops_approval_status_check;

ALTER TABLE public.drops
  ADD CONSTRAINT drops_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  drop_id uuid NOT NULL REFERENCES public.drops(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  quantity INT NOT NULL,
  subtotal NUMERIC,
  tax_rate NUMERIC,
  tax_amount NUMERIC,
  booking_fee NUMERIC,
  stripe_fee_amount NUMERIC,
  pass_stripe_fee BOOLEAN DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  total_paid NUMERIC NOT NULL,
  order_notes TEXT,
  is_bulk BOOLEAN DEFAULT false,
  unlocked_reward TEXT,
  delivery_requested BOOLEAN,
  delivery_fee NUMERIC,
  delivery_address TEXT,
  selected_items JSONB,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  checkout_token TEXT,
  paid_at TIMESTAMPTZ,
  drop_name TEXT,
  drop_image TEXT,
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Migration-safe payment columns
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.purchases
  DROP CONSTRAINT IF EXISTS purchases_payment_status_check;

ALTER TABLE public.purchases
  ADD CONSTRAINT purchases_payment_status_check CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS checkout_token TEXT;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS order_notes TEXT;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS is_bulk BOOLEAN DEFAULT false;

ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0;

ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS pass_stripe_fee BOOLEAN DEFAULT false;

ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS booking_fee NUMERIC;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS stripe_fee_amount NUMERIC;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS pass_stripe_fee BOOLEAN DEFAULT false;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE public.drops
  ADD COLUMN IF NOT EXISTS revision_requested BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id INT PRIMARY KEY,
  booking_fee_per_package NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

INSERT INTO public.app_settings (id, booking_fee_per_package)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_stripe_checkout_session_id_idx
  ON public.purchases (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_checkout_token_idx
  ON public.purchases (checkout_token)
  WHERE checkout_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id uuid NOT NULL REFERENCES public.drops(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.drop_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  reviewed_at TIMESTAMPTZ
);

INSERT INTO public.drop_categories (name, normalized_name, status)
VALUES
  ('American (Classic / New American)', 'american (classic / new american)', 'approved'),
  ('BBQ / Smokehouse', 'bbq / smokehouse', 'approved'),
  ('Mexican', 'mexican', 'approved'),
  ('Latin American', 'latin american', 'approved'),
  ('Caribbean', 'caribbean', 'approved'),
  ('Italian', 'italian', 'approved'),
  ('Mediterranean', 'mediterranean', 'approved'),
  ('Greek', 'greek', 'approved'),
  ('Middle Eastern', 'middle eastern', 'approved'),
  ('Indian', 'indian', 'approved'),
  ('Chinese', 'chinese', 'approved'),
  ('Japanese', 'japanese', 'approved'),
  ('Sushi', 'sushi', 'approved'),
  ('Korean', 'korean', 'approved'),
  ('Thai', 'thai', 'approved'),
  ('Vietnamese', 'vietnamese', 'approved'),
  ('Filipino', 'filipino', 'approved'),
  ('Hawaiian / Poke', 'hawaiian / poke', 'approved'),
  ('African', 'african', 'approved'),
  ('Cajun / Creole', 'cajun / creole', 'approved'),
  ('Southern', 'southern', 'approved'),
  ('German', 'german', 'approved'),
  ('French', 'french', 'approved'),
  ('Spanish (Tapas)', 'spanish (tapas)', 'approved'),
  ('Pizza', 'pizza', 'approved'),
  ('Vegan / Plant-Based', 'vegan / plant-based', 'approved'),
  ('Fusion', 'fusion', 'approved'),
  ('Desserts / Sweets', 'desserts / sweets', 'approved'),
  ('Breakfast / Brunch', 'breakfast / brunch', 'approved'),
  ('Beverages', 'beverages', 'approved'),
  ('Merch', 'merch', 'approved'),
  ('Tickets', 'tickets', 'approved'),
  ('Events', 'events', 'approved')
ON CONFLICT (normalized_name) DO NOTHING;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can insert analytics" ON public.analytics_events;
CREATE POLICY "Authenticated can insert analytics" ON public.analytics_events FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

ALTER TABLE public.drop_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drop categories public approved select" ON public.drop_categories;
CREATE POLICY "Drop categories public approved select" ON public.drop_categories FOR SELECT USING (
  status = 'approved' OR
  requested_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
  )
);

DROP POLICY IF EXISTS "Vendor or admin can request category" ON public.drop_categories;
CREATE POLICY "Vendor or admin can request category" ON public.drop_categories FOR INSERT WITH CHECK (
  auth.uid() = requested_by AND
  status = 'pending' AND
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (COALESCE(p.is_vendor, false) = true OR COALESCE(p.is_admin, false) = true)
  )
);

DROP POLICY IF EXISTS "Admin can review categories" ON public.drop_categories;
CREATE POLICY "Admin can review categories" ON public.drop_categories FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
  )
);

DROP POLICY IF EXISTS "Admin can read analytics" ON public.analytics_events;
CREATE POLICY "Admin can read analytics" ON public.analytics_events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND COALESCE(p.is_admin, false) = true
  )
);

-- Log signup events using auth flow (avoids client-side RLS issues)
CREATE OR REPLACE FUNCTION public.log_auth_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO public.analytics_events (event_name, user_id, payload)
  VALUES ('signup_customer', NEW.id, jsonb_build_object('email', NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_auth_signup ON auth.users;
CREATE TRIGGER log_auth_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.log_auth_signup();

-- Ensure profile exists at auth signup, including requested role metadata.
CREATE OR REPLACE FUNCTION public.ensure_profile_on_auth_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  requested_role TEXT;
  requested_vendor BOOLEAN;
BEGIN
  requested_role := lower(COALESCE(NEW.raw_user_meta_data->>'requested_role', 'customer'));
  requested_vendor := (requested_role = 'vendor');

  INSERT INTO public.profiles (id, email, username, name, is_vendor, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    split_part(COALESCE(NEW.email, ''), '@', 1),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    requested_vendor,
    false
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    is_vendor = (COALESCE(public.profiles.is_vendor, false) OR EXCLUDED.is_vendor);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_profile_on_auth_signup ON auth.users;
CREATE TRIGGER ensure_profile_on_auth_signup
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_on_auth_signup();

CREATE OR REPLACE FUNCTION public.log_vendor_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.is_vendor = true AND (OLD.is_vendor IS DISTINCT FROM true) THEN
    INSERT INTO public.analytics_events (event_name, user_id, payload)
    VALUES ('signup_vendor', NEW.id, jsonb_build_object('email', NEW.email));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_vendor_signup ON public.profiles;
CREATE TRIGGER log_vendor_signup
AFTER UPDATE OF is_vendor ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_vendor_signup();

-- 2. ROW-LEVEL SECURITY (RLS)
-- Helper functions to avoid RLS recursion on profiles table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_is_admin, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_vendor()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_is_vendor BOOLEAN;
BEGIN
  SELECT is_vendor INTO v_is_vendor FROM public.profiles WHERE id = auth.uid();
  RETURN COALESCE(v_is_vendor, false);
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are private" ON public.profiles;
CREATE POLICY "Profiles are private" ON public.profiles FOR SELECT USING (
  auth.uid() = id OR 
  public.is_admin() = true
);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or Admin" ON public.profiles;
CREATE POLICY "Users can update own profile or Admin" ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR 
  public.is_admin() = true
);

DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
CREATE POLICY "Admin can delete profiles" ON public.profiles FOR DELETE USING (
  public.is_admin() = true
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can update purchases" ON public.purchases;
CREATE POLICY "Admin can update purchases" ON public.purchases FOR UPDATE USING (
  public.is_admin() = true
);

DROP POLICY IF EXISTS "Admin can select purchases" ON public.purchases;
CREATE POLICY "Admin can select purchases" ON public.purchases FOR SELECT USING (
  public.is_admin() = true
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can read audit log" ON public.audit_log;
CREATE POLICY "Admin can read audit log" ON public.audit_log FOR SELECT USING (
  public.is_admin() = true
);

DROP POLICY IF EXISTS "Admin can insert audit log" ON public.audit_log;
CREATE POLICY "Admin can insert audit log" ON public.audit_log FOR INSERT WITH CHECK (
  public.is_admin() = true
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public app settings readable" ON public.app_settings;
CREATE POLICY "Public app settings readable" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin can update app settings" ON public.app_settings;
CREATE POLICY "Admin can update app settings" ON public.app_settings FOR UPDATE USING (
  public.is_admin() = true
);

DROP POLICY IF EXISTS "Admin can insert app settings" ON public.app_settings;
CREATE POLICY "Admin can insert app settings" ON public.app_settings FOR INSERT WITH CHECK (
  public.is_admin() = true
);

-- SECURITY FIX: Allow users to become vendors (self-service), but protect Admin role.
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER AS $$
DECLARE
  current_is_admin BOOLEAN;
BEGIN
  -- Insert: Safe defaults, but we allow client to request flags if needed (usually handled by signup logic)
  IF TG_OP = 'INSERT' THEN
     NEW.is_admin := false; 
     -- We allow is_vendor to be set on insert if passed, or default to false
     RETURN NEW;
  END IF;

  SELECT is_admin INTO current_is_admin FROM public.profiles WHERE id = auth.uid();
  
  -- Admin can do anything
  IF current_is_admin = true THEN
    RETURN NEW;
  END IF;

  -- Regular User: Cannot change is_admin
  IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin) THEN
    RAISE EXCEPTION 'Unauthorized: You cannot update admin status.';
  END IF;
  
  -- NOTE: We allow is_vendor to be changed by the user to enable "Register as Vendor" flow.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_profile_change ON public.profiles;
CREATE TRIGGER check_profile_change
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privilege_escalation();

-- Secure Vendors Table
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view vendors" ON public.vendors;
CREATE POLICY "Public view vendors" ON public.vendors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Vendors update self" ON public.vendors;
CREATE POLICY "Vendors update self" ON public.vendors FOR UPDATE USING (
  auth.uid() = id OR
  public.is_admin() = true
);

DROP POLICY IF EXISTS "Vendors insert self" ON public.vendors;
CREATE POLICY "Vendors insert self" ON public.vendors FOR INSERT WITH CHECK (
  auth.uid() = id
);

-- Drops RLS
ALTER TABLE public.drops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Drops are viewable by everyone" ON public.drops;
DROP POLICY IF EXISTS "Drops visible by approval and ownership" ON public.drops;
CREATE POLICY "Drops visible by approval and ownership" ON public.drops FOR SELECT USING (
  approval_status = 'approved' OR
  auth.uid() = creator_id OR
  public.is_admin() = true
);

DROP POLICY IF EXISTS "Vendors can insert drops" ON public.drops;
DROP POLICY IF EXISTS "Vendors and Admins can insert drops" ON public.drops;
CREATE POLICY "Vendors and Admins can insert drops" ON public.drops FOR INSERT WITH CHECK (
  auth.uid() = creator_id AND 
  (
    public.is_vendor() = true OR
    public.is_admin() = true
  )
);

DROP POLICY IF EXISTS "Vendors can update own drops" ON public.drops;
DROP POLICY IF EXISTS "Vendors and Admins can update drops" ON public.drops;
CREATE POLICY "Vendors and Admins can update drops" ON public.drops FOR UPDATE USING (
  auth.uid() = creator_id OR
  public.is_admin() = true
);

-- Prevent vendors from directly approving/rejecting their own drops.
CREATE OR REPLACE FUNCTION public.enforce_drop_approval_rules()
RETURNS TRIGGER AS $$
DECLARE
  current_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO current_is_admin FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    IF current_is_admin IS DISTINCT FROM true THEN
      NEW.approval_status := 'pending';
    END IF;
    RETURN NEW;
  END IF;

  IF current_is_admin IS DISTINCT FROM true
    AND NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    RAISE EXCEPTION 'Unauthorized: only admins can change approval_status.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_drop_approval_rules_trigger ON public.drops;
CREATE TRIGGER enforce_drop_approval_rules_trigger
  BEFORE INSERT OR UPDATE ON public.drops
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_drop_approval_rules();

-- Purchases RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own purchases" ON public.purchases;
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Vendors can view purchases of their drops" ON public.purchases;
DROP POLICY IF EXISTS "Vendors and Admins can view purchases" ON public.purchases;
CREATE POLICY "Vendors and Admins can view purchases" ON public.purchases FOR SELECT USING (
  public.is_admin() = true OR
  EXISTS (SELECT 1 FROM public.drops WHERE drops.id = purchases.drop_id AND drops.creator_id = auth.uid())
);

-- Waitlist RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert waitlist" ON public.waitlist;
CREATE POLICY "Anyone can insert waitlist" ON public.waitlist FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Vendors can view waitlist for own drops" ON public.waitlist;
CREATE POLICY "Vendors can view waitlist for own drops" ON public.waitlist FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.drops WHERE drops.id = waitlist.drop_id AND drops.creator_id = auth.uid())
);

-- 3. STORAGE
INSERT INTO storage.buckets (id, name, public) VALUES ('drop-images', 'drop-images', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'drop-images');

DROP POLICY IF EXISTS "Vendor Upload" ON storage.objects;
CREATE POLICY "Vendor Upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'drop-images' AND 
  auth.role() = 'authenticated' AND
  (
    public.is_vendor() = true OR
    public.is_admin() = true
  )
);

-- 4. ATOMIC TRANSACTION FUNCTION (SECURED)
CREATE OR REPLACE FUNCTION purchase_drop_item(
  p_drop_id UUID,
  p_user_id UUID,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_quantity INT,
  p_subtotal NUMERIC,
  p_tax_rate NUMERIC,
  p_tax_amount NUMERIC,
  p_booking_fee NUMERIC,
  p_stripe_fee_amount NUMERIC,
  p_total_paid NUMERIC,
  p_delivery_requested BOOLEAN,
  p_delivery_address TEXT,
  p_selected_items JSONB,
  p_drop_name TEXT,
  p_drop_image TEXT,
  p_order_notes TEXT,
  p_is_bulk BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quantity_remaining INT;
  v_base_price NUMERIC;
  v_delivery_fee NUMERIC;
  v_drop_is_deleted BOOLEAN;
  v_drop_start TIMESTAMPTZ;
  v_drop_end TIMESTAMPTZ;
  v_tax_rate NUMERIC;
  v_pass_stripe_fee BOOLEAN;
  v_booking_fee_per_package NUMERIC;
  v_booking_fee NUMERIC;
  v_tax_amount NUMERIC;
  v_stripe_fee_amount NUMERIC;
  v_approval_status TEXT;
  v_calculated_total NUMERIC;
  v_expected_total_base NUMERIC;
  v_expected_total NUMERIC;
  v_drop_menu_items JSONB;
  v_server_subtotal NUMERIC;
  v_server_unit_subtotal NUMERIC;
  v_selected_item JSONB;
  v_menu_item JSONB;
  v_selected_mod_group JSONB;
  v_mod_group JSONB;
  v_selected_option JSONB;
  v_mod_option JSONB;
  v_new_purchase_id UUID;
  v_checkout_token TEXT;
  v_verified_user_id UUID;
BEGIN
  -- 1. SECURITY: Enforce Identity
  IF auth.uid() IS NULL THEN
     RAISE EXCEPTION 'Authentication required.';
  END IF;
  v_verified_user_id := auth.uid();

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be at least 1.';
  END IF;

  -- 2. Lock the drop row specifically for update. 
  SELECT quantity_remaining, price, delivery_fee, approval_status, COALESCE(tax_rate, 0), COALESCE(pass_stripe_fee, false), COALESCE(is_deleted, false), start_date, end_date, COALESCE(menu_items, '[]'::jsonb)
  INTO v_quantity_remaining, v_base_price, v_delivery_fee, v_approval_status, v_tax_rate, v_pass_stripe_fee, v_drop_is_deleted, v_drop_start, v_drop_end, v_drop_menu_items
  FROM public.drops
  WHERE id = p_drop_id
  FOR UPDATE;

  -- 3. Check existence
  IF v_quantity_remaining IS NULL THEN
    RAISE EXCEPTION 'Drop not found';
  END IF;

  IF v_approval_status <> 'approved' THEN
    RAISE EXCEPTION 'This drop is not approved for booking.';
  END IF;

  IF v_drop_is_deleted THEN
    RAISE EXCEPTION 'This drop is no longer available.';
  END IF;

  IF now() < v_drop_start OR now() > v_drop_end THEN
    RAISE EXCEPTION 'This drop is not currently available.';
  END IF;

  -- 4. Check inventory
  IF v_quantity_remaining < p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory. Only % items remaining.', v_quantity_remaining;
  END IF;

  -- 5. SECURITY: Server-side subtotal and total calculation.
  -- Never trust client-submitted prices.
  IF jsonb_array_length(v_drop_menu_items) > 0 THEN
    IF p_selected_items IS NULL OR jsonb_typeof(p_selected_items) <> 'array' THEN
      RAISE EXCEPTION 'Invalid selection payload.';
    END IF;

    IF jsonb_array_length(p_selected_items) <> jsonb_array_length(v_drop_menu_items) THEN
      RAISE EXCEPTION 'Selection payload does not match package items.';
    END IF;

    v_server_unit_subtotal := 0;

    FOR v_selected_item IN SELECT * FROM jsonb_array_elements(p_selected_items) LOOP
      SELECT item
      INTO v_menu_item
      FROM jsonb_array_elements(v_drop_menu_items) AS item
      WHERE item->>'id' = COALESCE(v_selected_item->>'itemId', '')
      LIMIT 1;

      IF v_menu_item IS NULL THEN
        RAISE EXCEPTION 'Invalid menu item selection.';
      END IF;

      v_server_unit_subtotal := v_server_unit_subtotal + COALESCE((v_menu_item->>'basePrice')::NUMERIC, 0);

      IF jsonb_typeof(COALESCE(v_selected_item->'selectedModifiers', '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'Invalid modifier payload.';
      END IF;

      FOR v_selected_mod_group IN
        SELECT * FROM jsonb_array_elements(COALESCE(v_selected_item->'selectedModifiers', '[]'::jsonb))
      LOOP
        SELECT grp
        INTO v_mod_group
        FROM jsonb_array_elements(COALESCE(v_menu_item->'modifierGroups', '[]'::jsonb)) AS grp
        WHERE grp->>'id' = COALESCE(v_selected_mod_group->>'groupId', '')
        LIMIT 1;

        IF v_mod_group IS NULL THEN
          RAISE EXCEPTION 'Invalid modifier group selection.';
        END IF;

        IF jsonb_typeof(COALESCE(v_selected_mod_group->'options', '[]'::jsonb)) <> 'array' THEN
          RAISE EXCEPTION 'Invalid modifier options payload.';
        END IF;

        FOR v_selected_option IN
          SELECT * FROM jsonb_array_elements(COALESCE(v_selected_mod_group->'options', '[]'::jsonb))
        LOOP
          SELECT opt
          INTO v_mod_option
          FROM jsonb_array_elements(COALESCE(v_mod_group->'options', '[]'::jsonb)) AS opt
          WHERE opt->>'id' = COALESCE(v_selected_option->>'id', '')
          LIMIT 1;

          IF v_mod_option IS NULL THEN
            RAISE EXCEPTION 'Invalid modifier option selection.';
          END IF;

          v_server_unit_subtotal := v_server_unit_subtotal + COALESCE((v_mod_option->>'additionalPrice')::NUMERIC, 0);
        END LOOP;
      END LOOP;
    END LOOP;

    v_server_subtotal := v_server_unit_subtotal * p_quantity;
  ELSE
    v_server_subtotal := v_base_price * p_quantity;
  END IF;

  v_server_subtotal := ROUND(COALESCE(v_server_subtotal, 0)::NUMERIC, 2);
  v_calculated_total := v_server_subtotal + CASE WHEN p_delivery_requested THEN COALESCE(v_delivery_fee, 0) ELSE 0 END;

  SELECT COALESCE(booking_fee_per_package, 0)
  INTO v_booking_fee_per_package
  FROM public.app_settings
  WHERE id = 1;

  v_booking_fee := COALESCE(v_booking_fee_per_package, 0) * p_quantity;
  v_tax_amount := (v_server_subtotal + v_booking_fee + (CASE WHEN p_delivery_requested THEN COALESCE(v_delivery_fee, 0) ELSE 0 END)) * v_tax_rate;
  v_tax_amount := ROUND(COALESCE(v_tax_amount, 0)::NUMERIC, 2);

  v_expected_total_base := v_server_subtotal
    + v_booking_fee
    + v_tax_amount
    + (CASE WHEN p_delivery_requested THEN COALESCE(v_delivery_fee, 0) ELSE 0 END);
  v_expected_total_base := ROUND(COALESCE(v_expected_total_base, 0)::NUMERIC, 2);

  v_stripe_fee_amount := CASE
    WHEN v_pass_stripe_fee THEN (v_expected_total_base * 0.029) + 0.20
    ELSE 0
  END;
  v_stripe_fee_amount := ROUND(COALESCE(v_stripe_fee_amount, 0)::NUMERIC, 2);

  v_expected_total := v_expected_total_base + v_stripe_fee_amount;
  v_expected_total := ROUND(COALESCE(v_expected_total, 0)::NUMERIC, 2);

  -- SECURITY PATCH: If the drop relies on Menu Items (base_price might be 0), 
  -- we must ensure the user is actually paying *something*.
  -- This prevents the 'Free Menu' exploit where users pay 0 for a menu drop.
  IF v_base_price <= 0 AND p_total_paid <= 0 AND p_quantity > 0 THEN
      RAISE EXCEPTION 'Invalid Payment: Total paid cannot be zero for this order.';
  END IF;

  -- Standard check: Ensure payment meets the base price * quantity at minimum.
  IF p_total_paid < v_calculated_total THEN
    RAISE EXCEPTION 'Payment verification failed. Calculated base % exceeds provided %', v_calculated_total, p_total_paid;
  END IF;

  IF p_total_paid < v_expected_total THEN
    RAISE EXCEPTION 'Payment verification failed. Expected % exceeds provided %', v_expected_total, p_total_paid;
  END IF;

  IF ABS(COALESCE(p_subtotal, 0) - v_server_subtotal) > 0.01 THEN
    RAISE EXCEPTION 'Subtotal verification failed.';
  END IF;

  IF ABS(COALESCE(p_total_paid, 0) - v_expected_total) > 0.01 THEN
    RAISE EXCEPTION 'Payment verification failed. Amount mismatch.';
  END IF;

  -- 6. Create Purchase Record using VERIFIED User ID
  v_checkout_token := gen_random_uuid()::text;

  INSERT INTO public.purchases (
    user_id, drop_id, customer_name, customer_email, quantity, subtotal, tax_rate, tax_amount, booking_fee, stripe_fee_amount, pass_stripe_fee, total_paid,
    delivery_requested, delivery_address, selected_items, drop_name, drop_image,
    order_notes, is_bulk, checkout_token
  ) VALUES (
    v_verified_user_id, p_drop_id, p_customer_name, p_customer_email, p_quantity, v_server_subtotal, v_tax_rate, v_tax_amount, v_booking_fee, v_stripe_fee_amount, v_pass_stripe_fee, v_expected_total,
    p_delivery_requested, p_delivery_address, p_selected_items, p_drop_name, p_drop_image,
    p_order_notes, COALESCE(p_is_bulk, false), v_checkout_token
  ) RETURNING id INTO v_new_purchase_id;

  -- 7. Decrement Inventory
  UPDATE public.drops
  SET quantity_remaining = quantity_remaining - p_quantity,
      status = CASE WHEN (quantity_remaining - p_quantity) <= 0 THEN 'SOLD_OUT' ELSE status END
  WHERE id = p_drop_id;

  -- 8. Return success object
  RETURN json_build_object('success', true, 'purchase_id', v_new_purchase_id, 'checkout_token', v_checkout_token);

END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_email_role(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_role(TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.purchase_drop_item(UUID, UUID, TEXT, TEXT, INT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, TEXT, JSONB, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_drop_item(UUID, UUID, TEXT, TEXT, INT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, TEXT, JSONB, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_delete_user_release_email(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_release_email(UUID) TO authenticated;

-- Restore reserved inventory when a pending checkout fails/expires.
CREATE OR REPLACE FUNCTION public.restore_drop_inventory(
  p_drop_id UUID,
  p_quantity INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN;
  END IF;

  IF auth.role() <> 'service_role' AND public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Unauthorized: service role or admin required.';
  END IF;

  UPDATE public.drops
  SET
    quantity_remaining = COALESCE(quantity_remaining, 0) + p_quantity,
    status = CASE
      WHEN status = 'SOLD_OUT' AND (COALESCE(quantity_remaining, 0) + p_quantity) > 0 THEN 'LIVE'
      ELSE status
    END
  WHERE id = p_drop_id
    AND COALESCE(is_deleted, false) = false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_drop_inventory(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_drop_inventory(UUID, INT) TO authenticated, service_role;
