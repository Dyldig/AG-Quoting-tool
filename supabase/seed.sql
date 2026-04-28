-- Jeffries Agriculture Quoting Tool - Seed Data
-- Run AFTER schema.sql

-- ============================================================
-- REGIONS
-- ============================================================

INSERT INTO regions (name, zone_group, default_uom, subregion_description) VALUES
  ('Adelaide Hills', 'Adelaide Metro', 'm3', 'Adelaide Hills and surrounds'),
  ('Barossa Z1', 'Barossa', 'm3', 'Barossa Valley Zone 1 - closer areas'),
  ('Barossa Z2', 'Barossa', 'm3', 'Barossa Valley Zone 2 - outer areas'),
  ('Clare Z1', 'Clare', 'm3', 'Clare Valley Zone 1'),
  ('Langhorne Creek', 'Fleurieu', 'm3', 'Langhorne Creek wine region'),
  ('McLaren Vale', 'Fleurieu', 'm3', 'McLaren Vale wine region'),
  ('NAP Z1', 'Northern Adelaide Plains', 'm3', 'Northern Adelaide Plains Zone 1'),
  ('NAP Z2', 'Northern Adelaide Plains', 'm3', 'Northern Adelaide Plains Zone 2'),
  ('Riverland', 'Riverland', 't', 'SA Riverland - Murray River region'),
  ('South East', 'South East', 't', 'South East SA - Limestone Coast'),
  ('Mildura Z1', 'Mildura', 't', 'Mildura Zone 1 - closest'),
  ('Mildura Z2', 'Mildura', 't', 'Mildura Zone 2 - mid'),
  ('Mildura Z3', 'Mildura', 't', 'Mildura Zone 3 - furthest');

-- ============================================================
-- PRODUCTS
-- ============================================================

INSERT INTO products (name, sku, category, conversion_factor_m3_to_t) VALUES
  ('Jeffries Commercial Compost', 'SCORGCOM25', 'compost', 0.625),
  ('Jeffries Organic Compost', 'SCORGCOM', 'compost', 0.625),
  ('Jeffries Dura Mulch', 'MUDURMUL', 'mulch', 0.55),
  ('Jeffries Rustic Choice Mulch', 'SCGRCHCOM', 'mulch', 0.55);

-- ============================================================
-- PRICING RULES (effective 2026-01-01)
-- ============================================================

-- Jeffries Commercial Compost (JCC) - SCORGCOM25
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'distributor', 'standard', 19.50, '2026-01-01' FROM products p WHERE p.sku = 'SCORGCOM25';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'distributor', 'bulk', 17.50, '2026-01-01' FROM products p WHERE p.sku = 'SCORGCOM25';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'customer', 'standard', 22.00, '2026-01-01' FROM products p WHERE p.sku = 'SCORGCOM25';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'customer', 'bulk', 20.00, '2026-01-01' FROM products p WHERE p.sku = 'SCORGCOM25';

-- Jeffries Organic Compost (JOC) - SCORGCOM
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'distributor', 'standard', 26.00, '2026-01-01' FROM products p WHERE p.sku = 'SCORGCOM';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'distributor', 'bulk', 24.50, '2026-01-01' FROM products p WHERE p.sku = 'SCORGCOM';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'customer', 'standard', 28.50, '2026-01-01' FROM products p WHERE p.sku = 'SCORGCOM';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'customer', 'bulk', 27.00, '2026-01-01' FROM products p WHERE p.sku = 'SCORGCOM';

-- Jeffries Dura Mulch - MUDURMUL
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'distributor', 'standard', 25.00, '2026-01-01' FROM products p WHERE p.sku = 'MUDURMUL';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'distributor', 'bulk', 23.00, '2026-01-01' FROM products p WHERE p.sku = 'MUDURMUL';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'customer', 'standard', 27.50, '2026-01-01' FROM products p WHERE p.sku = 'MUDURMUL';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'customer', 'bulk', 25.50, '2026-01-01' FROM products p WHERE p.sku = 'MUDURMUL';

-- Jeffries Rustic Choice Mulch - SCGRCHCOM
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'distributor', 'standard', 20.50, '2026-01-01' FROM products p WHERE p.sku = 'SCGRCHCOM';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'distributor', 'bulk', 18.50, '2026-01-01' FROM products p WHERE p.sku = 'SCGRCHCOM';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'customer', 'standard', 23.00, '2026-01-01' FROM products p WHERE p.sku = 'SCGRCHCOM';
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, effective_date)
SELECT p.id, 'customer', 'bulk', 21.00, '2026-01-01' FROM products p WHERE p.sku = 'SCGRCHCOM';

-- ============================================================
-- FREIGHT MATRIX
-- Compost price / Mulch price per region
-- ============================================================

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 14.00, '2026-01-01' FROM regions r WHERE r.name = 'Adelaide Hills';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 12.50, '2026-01-01' FROM regions r WHERE r.name = 'Adelaide Hills';

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 11.00, '2026-01-01' FROM regions r WHERE r.name = 'Barossa Z1';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 9.50, '2026-01-01' FROM regions r WHERE r.name = 'Barossa Z1';

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 12.00, '2026-01-01' FROM regions r WHERE r.name = 'Barossa Z2';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 11.00, '2026-01-01' FROM regions r WHERE r.name = 'Barossa Z2';

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 14.00, '2026-01-01' FROM regions r WHERE r.name = 'Clare Z1';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 12.00, '2026-01-01' FROM regions r WHERE r.name = 'Clare Z1';

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 18.00, '2026-01-01' FROM regions r WHERE r.name = 'Langhorne Creek';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 18.00, '2026-01-01' FROM regions r WHERE r.name = 'Langhorne Creek';

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 15.50, '2026-01-01' FROM regions r WHERE r.name = 'McLaren Vale';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 13.50, '2026-01-01' FROM regions r WHERE r.name = 'McLaren Vale';

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 5.50, '2026-01-01' FROM regions r WHERE r.name = 'NAP Z1';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 5.50, '2026-01-01' FROM regions r WHERE r.name = 'NAP Z1';

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 7.50, '2026-01-01' FROM regions r WHERE r.name = 'NAP Z2';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 7.50, '2026-01-01' FROM regions r WHERE r.name = 'NAP Z2';

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 16.50, '2026-01-01' FROM regions r WHERE r.name = 'Riverland';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 16.50, '2026-01-01' FROM regions r WHERE r.name = 'Riverland';

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 23.50, '2026-01-01' FROM regions r WHERE r.name = 'South East';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 23.50, '2026-01-01' FROM regions r WHERE r.name = 'South East';

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 36.00, '2026-01-01' FROM regions r WHERE r.name = 'Mildura Z1';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 22.00, '2026-01-01' FROM regions r WHERE r.name = 'Mildura Z1';

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 39.00, '2026-01-01' FROM regions r WHERE r.name = 'Mildura Z2';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 24.00, '2026-01-01' FROM regions r WHERE r.name = 'Mildura Z2';

INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'compost', 42.00, '2026-01-01' FROM regions r WHERE r.name = 'Mildura Z3';
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, effective_date)
SELECT r.id, 'mulch', 25.50, '2026-01-01' FROM regions r WHERE r.name = 'Mildura Z3';

-- ============================================================
-- AMENDMENTS
-- ============================================================

INSERT INTO amendments (name, sku, type, price_per_tonne, is_internal) VALUES
  ('Gypsum', 'SCGYP', 'bulk', 46.50, TRUE),
  ('Lime', 'SCLIM', 'bulk', 75.50, TRUE);
