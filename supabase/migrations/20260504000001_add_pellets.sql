-- Add pellets to product_category_enum
ALTER TYPE product_category_enum ADD VALUE IF NOT EXISTS 'pellets';

-- Pellet products (tonne-only, conversion factor 1.0)
INSERT INTO products (name, sku, category, conversion_factor_m3_to_t) VALUES
  ('Jeffries C-100',   'SCC100',  'pellets', 1.0),
  ('Jeffries CulChar', 'CULCHAR', 'pellets', 1.0),
  ('Jeffries Biochar', 'BIOCHAR', 'pellets', 1.0);

-- Pricing rules — standard tier only (no bulk variant for pellets)
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'distributor', 'standard', 315.00, '2026-01-01' FROM products p WHERE p.sku = 'SCC100';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'customer',    'standard', 350.00, '2026-01-01' FROM products p WHERE p.sku = 'SCC100';

INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'distributor', 'standard', 387.00, '2026-01-01' FROM products p WHERE p.sku = 'CULCHAR';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'customer',    'standard', 430.00, '2026-01-01' FROM products p WHERE p.sku = 'CULCHAR';

INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'distributor', 'standard', 900.00, '2026-01-01' FROM products p WHERE p.sku = 'BIOCHAR';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'customer',    'standard', 1000.00, '2026-01-01' FROM products p WHERE p.sku = 'BIOCHAR';

-- Pellets as blend amendments (priced at distributor rate per tonne)
INSERT INTO amendments (name, sku, type, price_per_tonne, is_internal) VALUES
  ('Jeffries C-100',   'SCC100',  'bulk', 315.00, TRUE),
  ('Jeffries CulChar', 'CULCHAR', 'bulk', 387.00, TRUE),
  ('Jeffries Biochar', 'BIOCHAR', 'bulk', 900.00, TRUE);
