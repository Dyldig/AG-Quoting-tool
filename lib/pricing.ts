import type {
  Product,
  PricingRule,
  FreightMatrix,
  CustomerType,
  FulfilmentType,
  GstType,
  UOM,
  VolumeTier,
  BlendClassification,
  BlendAmendmentState,
} from './types'

export const BULK_THRESHOLD_T = 150

export function calcVolumeTonnes(volume: number, uom: UOM, product: Product): number {
  return uom === 't' ? volume : volume * product.conversion_factor_m3_to_t
}

export function calcTier(volumeT: number): VolumeTier {
  return volumeT >= BULK_THRESHOLD_T ? 'bulk' : 'standard'
}

export function lookupBasePrice(
  rules: PricingRule[],
  productId: string,
  customerType: CustomerType,
  tier: VolumeTier
): number | null {
  const rule = rules.find(
    (r) =>
      r.product_id === productId &&
      r.customer_type === customerType &&
      r.volume_tier === tier
  )
  return rule?.price_per_unit ?? null
}

export function lookupFreight(
  matrix: FreightMatrix[],
  regionId: string,
  category: string,
  fulfilmentType: FulfilmentType
): number {
  if (fulfilmentType === 'pickup') return 0
  const row = matrix.find(
    (f) => f.region_id === regionId && f.product_category === category
  )
  return row?.price_per_unit ?? 0
}

export function classifyBlend(
  amendments: BlendAmendmentState[],
  hasJOC: boolean
): BlendClassification {
  const bulk = amendments.filter((a) => a.type === 'bulk').length
  const liquid = amendments.filter((a) => a.type === 'liquid').length
  const bagged = amendments.filter((a) => a.type === 'bagged').length

  if (hasJOC && (liquid > 0 || bagged > 0 || bulk >= 3)) return 'complex'
  if (bulk <= 2 && liquid === 0 && bagged === 0) return 'simple'
  return 'complex'
}

export function calcBlendFee(
  classification: BlendClassification,
  totalBlendTonnes: number
): { feeRate: number; feeTotal: number } {
  const feeRate = classification === 'complex' ? 11 : 7
  return { feeRate, feeTotal: feeRate * totalBlendTonnes }
}

export function calcLineTotal(
  volume: number,
  basePrice: number,
  freight: number
): number {
  return volume * (basePrice + freight)
}

export function calcGST(subtotal: number, gstType: GstType): number {
  return gstType === 'ex' ? subtotal * 0.1 : 0
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

// Regions that default to tonnes
export const TONNE_DEFAULT_REGIONS = [
  'Riverland',
  'South East',
  'Mildura Z1',
  'Mildura Z2',
  'Mildura Z3',
]
