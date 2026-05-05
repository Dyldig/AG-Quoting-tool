-- Add UOM column to pricing_rules
ALTER TABLE pricing_rules ADD COLUMN IF NOT EXISTS uom VARCHAR(3) DEFAULT 'm3';

-- Classify existing rows by product category
UPDATE pricing_rules SET uom = 'm3'
WHERE product_id IN (SELECT id FROM products WHERE category IN ('compost', 'mulch'));

UPDATE pricing_rules SET uom = 't'
WHERE product_id IN (SELECT id FROM products WHERE category = 'pellets');

-- JCC (SCORGCOM25) tonne pricing
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, uom, effective_date)
SELECT id, 'distributor'::customer_type_enum, 'standard'::volume_tier_enum, 29.00, 't', now() FROM products WHERE sku = 'SCORGCOM25'
UNION ALL
SELECT id, 'customer'::customer_type_enum,    'standard'::volume_tier_enum, 32.50, 't', now() FROM products WHERE sku = 'SCORGCOM25'
UNION ALL
SELECT id, 'distributor'::customer_type_enum, 'bulk'::volume_tier_enum,     29.00, 't', now() FROM products WHERE sku = 'SCORGCOM25'
UNION ALL
SELECT id, 'customer'::customer_type_enum,    'bulk'::volume_tier_enum,     32.50, 't', now() FROM products WHERE sku = 'SCORGCOM25';

-- JOC (SCORGCOM) tonne pricing
INSERT INTO pricing_rules (product_id, customer_type, volume_tier, price_per_unit, uom, effective_date)
SELECT id, 'distributor'::customer_type_enum, 'standard'::volume_tier_enum, 40.00, 't', now() FROM products WHERE sku = 'SCORGCOM'
UNION ALL
SELECT id, 'customer'::customer_type_enum,    'standard'::volume_tier_enum, 44.50, 't', now() FROM products WHERE sku = 'SCORGCOM'
UNION ALL
SELECT id, 'distributor'::customer_type_enum, 'bulk'::volume_tier_enum,     40.00, 't', now() FROM products WHERE sku = 'SCORGCOM'
UNION ALL
SELECT id, 'customer'::customer_type_enum,    'bulk'::volume_tier_enum,     44.50, 't', now() FROM products WHERE sku = 'SCORGCOM';

-- Add UOM column to freight_matrix
ALTER TABLE freight_matrix ADD COLUMN IF NOT EXISTS uom VARCHAR(3) DEFAULT 'm3';

-- Mark all existing freight rows as m3
UPDATE freight_matrix SET uom = 'm3';

-- Tonne freight rates for RSM regions
INSERT INTO freight_matrix (region_id, product_category, price_per_unit, uom, effective_date)
SELECT r.id, 'compost', 27.50, 't', now() FROM regions r WHERE r.name = 'Riverland'
UNION ALL
SELECT r.id, 'compost', 38.50, 't', now() FROM regions r WHERE r.name = 'South East'
UNION ALL
SELECT r.id, 'compost', 36.00, 't', now() FROM regions r WHERE r.name = 'Mildura Z1'
UNION ALL
SELECT r.id, 'compost', 39.00, 't', now() FROM regions r WHERE r.name = 'Mildura Z2'
UNION ALL
SELECT r.id, 'compost', 42.00, 't', now() FROM regions r WHERE r.name = 'Mildura Z3';
