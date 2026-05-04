// Database types for Jeffries Quoting Tool

export type UserRole = 'sales_rep' | 'sales_manager' | 'admin'
export type CustomerType = 'distributor' | 'customer'
export type VolumeTier = 'standard' | 'bulk'
export type ProductCategory = 'compost' | 'mulch' | 'pellets'
export type AmendmentType = 'bulk' | 'liquid' | 'bagged'
export type FulfilmentType = 'delivery' | 'pickup'
export type GstType = 'ex' | 'inc'
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected'
export type BlendClassification = 'simple' | 'complex'
export type AdjustmentScope = 'all' | 'compost' | 'mulch' | 'freight'
export type OverrideStatus = 'pending' | 'approved' | 'rejected'
export type UOM = 'm3' | 't'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  active: boolean
  created_at: string
}

export interface Region {
  id: string
  name: string
  zone_group: string | null
  default_uom: UOM
  subregion_description: string | null
  active: boolean
  created_at: string
}

export interface Product {
  id: string
  name: string
  sku: string
  category: ProductCategory
  conversion_factor_m3_to_t: number
  active: boolean
  created_at: string
}

export interface PricingRule {
  id: string
  product_id: string
  customer_type: CustomerType
  volume_tier: VolumeTier
  bulk_threshold_t: number
  price_per_unit: number
  effective_date: string
  created_at: string
  product?: Product
}

export interface FreightMatrix {
  id: string
  region_id: string
  product_category: ProductCategory
  price_per_unit: number
  effective_date: string
  created_at: string
  region?: Region
}

export interface Amendment {
  id: string
  name: string
  sku: string
  type: AmendmentType
  price_per_tonne: number
  is_internal: boolean
  active: boolean
  created_at: string
}

export interface Quote {
  id: string
  quote_number: string
  quote_name: string | null
  customer_name: string
  contact_name: string | null
  email: string | null
  region_id: string | null
  customer_type: CustomerType
  fulfilment_type: FulfilmentType
  gst_type: GstType
  status: QuoteStatus
  created_by: string | null
  created_at: string
  updated_at: string
  valid_until: string | null
  hubspot_deal_id: string | null
  hubspot_synced_at: string | null
  email_sent_at: string | null
  override_total: number | null
  override_approved_by: string | null
  notes: string | null
  disclaimer_acknowledged: boolean | null
  disclaimer_acknowledged_at: string | null
  region?: Region
  lines?: QuoteLine[]
  blend?: QuoteBlend
  profile?: Profile
}

export interface QuoteLine {
  id: string
  quote_id: string
  product_id: string
  volume: number
  uom: UOM
  volume_t: number | null
  base_price: number
  freight: number
  line_total: number
  sort_order: number
  created_at: string
  product?: Product
}

export interface QuoteBlend {
  id: string
  quote_id: string
  classification: BlendClassification
  total_base_tonnes: number
  total_amendment_tonnes: number
  blend_fee_rate: number
  blend_fee_total: number
  created_at: string
  amendments?: BlendAmendment[]
}

export interface BlendAmendment {
  id: string
  quote_blend_id: string
  amendment_id: string | null
  custom_name: string | null
  quantity_tonnes: number
  rate_per_tonne: number
  line_total: number
  sort_order: number
  created_at: string
  amendment?: Amendment
}

export interface PriceAdjustment {
  id: string
  scope: AdjustmentScope
  adjustment_pct: number
  applied_by: string | null
  applied_at: string
  notes: string | null
  profile?: Profile
}

export interface OverrideLog {
  id: string
  quote_id: string
  original_total: number
  override_total: number
  variance_pct: number
  requested_by: string | null
  approved_by: string | null
  status: OverrideStatus
  notes: string | null
  created_at: string
  resolved_at: string | null
  quote?: Quote
  requester?: Profile
  approver?: Profile
}

// ============================================================
// Quote builder UI state types
// ============================================================

export interface ProductLineState {
  id: string
  productId: string
  productCategory: ProductCategory
  volume: number
  uom: UOM
  basePrice: number
  freight: number
  freightOverride: number
  lineTotal: number
  volumeT: number
  tier: VolumeTier
}

export interface BlendAmendmentState {
  id: string
  amendmentId: string | null
  customName: string
  type: AmendmentType
  quantityT: number
  ratePerTonne: number
  lineTotal: number
}

export interface QuoteBuilderState {
  quoteName: string
  customerName: string
  contactName: string
  email: string
  hubspotDealId: string
  regionId: string
  customerType: CustomerType
  fulfilmentType: FulfilmentType
  gstType: GstType
  lines: Map<string, ProductLineState>
  blendOpen: boolean
  blendAmendments: Map<string, BlendAmendmentState>
  overrideEnabled: boolean
  overrideTotal: number | null
  notes: string
}

// ============================================================
// Computed pricing types
// ============================================================

export interface PricingSummary {
  lines: {
    lineId: string
    productName: string
    volume: number
    uom: UOM
    volumeT: number
    tier: VolumeTier
    basePrice: number
    freight: number
    lineTotal: number
    rrp?: number
  }[]
  blendClassification: BlendClassification | null
  blendFeeRate: number
  blendFeeTotal: number
  subtotal: number
  gstAmount: number
  grandTotal: number
  hasOverride: boolean
  overrideTotal: number | null
}
