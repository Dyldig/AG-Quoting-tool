-- Jeffries Agriculture Quoting Tool - Supabase Schema
-- Run this in the Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE customer_type_enum AS ENUM ('distributor', 'customer');
CREATE TYPE volume_tier_enum AS ENUM ('standard', 'bulk');
CREATE TYPE product_category_enum AS ENUM ('compost', 'mulch');
CREATE TYPE amendment_type_enum AS ENUM ('bulk', 'liquid', 'bagged');
CREATE TYPE fulfilment_type_enum AS ENUM ('delivery', 'pickup');
CREATE TYPE gst_type_enum AS ENUM ('ex', 'inc');
CREATE TYPE quote_status_enum AS ENUM ('draft', 'sent', 'accepted', 'rejected');
CREATE TYPE blend_classification_enum AS ENUM ('simple', 'complex');
CREATE TYPE adjustment_scope_enum AS ENUM ('all', 'compost', 'mulch', 'freight');
CREATE TYPE override_status_enum AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE uom_enum AS ENUM ('m3', 't');
CREATE TYPE user_role_enum AS ENUM ('sales_rep', 'sales_manager', 'admin');

-- ============================================================
-- USER PROFILES (extends Supabase auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role user_role_enum NOT NULL DEFAULT 'sales_rep',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REGIONS
-- ============================================================

CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  zone_group TEXT,
  default_uom uom_enum NOT NULL DEFAULT 'm3',
  subregion_description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  category product_category_enum NOT NULL,
  conversion_factor_m3_to_t NUMERIC(6,4) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRICING RULES
-- ============================================================

CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_type customer_type_enum NOT NULL,
  volume_tier volume_tier_enum NOT NULL,
  bulk_threshold_t NUMERIC(8,2) NOT NULL DEFAULT 150,
  price_per_unit NUMERIC(10,2) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, customer_type, volume_tier, effective_date)
);

-- ============================================================
-- FREIGHT MATRIX
-- ============================================================

CREATE TABLE freight_matrix (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  product_category product_category_enum NOT NULL,
  price_per_unit NUMERIC(10,2) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (region_id, product_category, effective_date)
);

-- ============================================================
-- AMENDMENTS
-- ============================================================

CREATE TABLE amendments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  type amendment_type_enum NOT NULL,
  price_per_tonne NUMERIC(10,2) NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- QUOTES
-- ============================================================

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  region_id UUID REFERENCES regions(id),
  customer_type customer_type_enum NOT NULL DEFAULT 'distributor',
  fulfilment_type fulfilment_type_enum NOT NULL DEFAULT 'delivery',
  gst_type gst_type_enum NOT NULL DEFAULT 'ex',
  status quote_status_enum NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hubspot_deal_id TEXT,
  hubspot_synced_at TIMESTAMPTZ,
  email_sent_at TIMESTAMPTZ,
  override_total NUMERIC(10,2),
  override_approved_by UUID REFERENCES profiles(id),
  notes TEXT
);

-- ============================================================
-- QUOTE LINES
-- ============================================================

CREATE TABLE quote_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  volume NUMERIC(10,3) NOT NULL,
  uom uom_enum NOT NULL DEFAULT 'm3',
  volume_t NUMERIC(10,3),
  base_price NUMERIC(10,2) NOT NULL,
  freight NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(10,2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- QUOTE BLENDS
-- ============================================================

CREATE TABLE quote_blends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  classification blend_classification_enum NOT NULL DEFAULT 'simple',
  total_base_tonnes NUMERIC(10,3) NOT NULL DEFAULT 0,
  total_amendment_tonnes NUMERIC(10,3) NOT NULL DEFAULT 0,
  blend_fee_rate NUMERIC(6,2) NOT NULL,
  blend_fee_total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quote_id)
);

-- ============================================================
-- BLEND AMENDMENTS
-- ============================================================

CREATE TABLE blend_amendments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_blend_id UUID NOT NULL REFERENCES quote_blends(id) ON DELETE CASCADE,
  amendment_id UUID REFERENCES amendments(id),
  custom_name TEXT,
  quantity_tonnes NUMERIC(10,3) NOT NULL,
  rate_per_tonne NUMERIC(10,2) NOT NULL,
  line_total NUMERIC(10,2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRICE ADJUSTMENTS (global % adjustments)
-- ============================================================

CREATE TABLE price_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope adjustment_scope_enum NOT NULL,
  adjustment_pct NUMERIC(6,2) NOT NULL,
  applied_by UUID REFERENCES profiles(id),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- ============================================================
-- OVERRIDE LOG
-- ============================================================

CREATE TABLE override_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  original_total NUMERIC(10,2) NOT NULL,
  override_total NUMERIC(10,2) NOT NULL,
  variance_pct NUMERIC(6,2) NOT NULL,
  requested_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  status override_status_enum NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_quotes_created_by ON quotes(created_by);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_customer_type ON quotes(customer_type);
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX idx_quote_lines_quote_id ON quote_lines(quote_id);
CREATE INDEX idx_quote_blends_quote_id ON quote_blends(quote_id);
CREATE INDEX idx_blend_amendments_blend_id ON blend_amendments(quote_blend_id);
CREATE INDEX idx_pricing_rules_product ON pricing_rules(product_id, customer_type, volume_tier);
CREATE INDEX idx_freight_matrix_region ON freight_matrix(region_id, product_category);
CREATE INDEX idx_override_log_quote ON override_log(quote_id);
CREATE INDEX idx_override_log_status ON override_log(status);

-- ============================================================
-- QUOTE NUMBER SEQUENCE
-- ============================================================

CREATE SEQUENCE quote_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.quote_number := 'QT-' || LPAD(nextval('quote_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW
  WHEN (NEW.quote_number IS NULL OR NEW.quote_number = '')
  EXECUTE FUNCTION generate_quote_number();

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PROFILE AUTO-CREATE ON AUTH SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'sales_rep');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_blends ENABLE ROW LEVEL SECURITY;
ALTER TABLE blend_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE override_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_adjustments ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role_enum AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- PROFILES
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins can manage profiles" ON profiles
  FOR ALL USING (get_user_role() = 'admin');

-- PRODUCTS (all authenticated users can read; admin can write)
CREATE POLICY "Authenticated users can read products" ON products
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage products" ON products
  FOR ALL USING (get_user_role() = 'admin');

-- PRICING RULES (all auth users read; manager+ can write)
CREATE POLICY "Authenticated users can read pricing rules" ON pricing_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage pricing rules" ON pricing_rules
  FOR ALL USING (get_user_role() IN ('sales_manager', 'admin'));

-- REGIONS
CREATE POLICY "Authenticated users can read regions" ON regions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage regions" ON regions
  FOR ALL USING (get_user_role() = 'admin');

-- FREIGHT MATRIX
CREATE POLICY "Authenticated users can read freight matrix" ON freight_matrix
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage freight matrix" ON freight_matrix
  FOR ALL USING (get_user_role() = 'admin');

-- AMENDMENTS
CREATE POLICY "Authenticated users can read amendments" ON amendments
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage amendments" ON amendments
  FOR ALL USING (get_user_role() = 'admin');

-- QUOTES
CREATE POLICY "Sales reps can read own quotes" ON quotes
  FOR SELECT USING (
    created_by = auth.uid() OR
    get_user_role() IN ('sales_manager', 'admin')
  );
CREATE POLICY "Sales reps can create quotes" ON quotes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Sales reps can update own quotes" ON quotes
  FOR UPDATE USING (
    created_by = auth.uid() OR
    get_user_role() IN ('sales_manager', 'admin')
  );
CREATE POLICY "Admins can delete quotes" ON quotes
  FOR DELETE USING (get_user_role() = 'admin');

-- QUOTE LINES
CREATE POLICY "Access quote lines with quote access" ON quote_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_lines.quote_id
        AND (q.created_by = auth.uid() OR get_user_role() IN ('sales_manager', 'admin'))
    )
  );

-- QUOTE BLENDS
CREATE POLICY "Access quote blends with quote access" ON quote_blends
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_blends.quote_id
        AND (q.created_by = auth.uid() OR get_user_role() IN ('sales_manager', 'admin'))
    )
  );

-- BLEND AMENDMENTS
CREATE POLICY "Access blend amendments with blend access" ON blend_amendments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quote_blends qb
      JOIN quotes q ON q.id = qb.quote_id
      WHERE qb.id = blend_amendments.quote_blend_id
        AND (q.created_by = auth.uid() OR get_user_role() IN ('sales_manager', 'admin'))
    )
  );

-- OVERRIDE LOG
CREATE POLICY "Read own override log" ON override_log
  FOR SELECT USING (
    requested_by = auth.uid() OR
    get_user_role() IN ('sales_manager', 'admin')
  );
CREATE POLICY "Create override requests" ON override_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can update overrides" ON override_log
  FOR UPDATE USING (get_user_role() IN ('sales_manager', 'admin'));

-- PRICE ADJUSTMENTS
CREATE POLICY "Authenticated users can read adjustments" ON price_adjustments
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can create adjustments" ON price_adjustments
  FOR INSERT WITH CHECK (get_user_role() IN ('sales_manager', 'admin'));
