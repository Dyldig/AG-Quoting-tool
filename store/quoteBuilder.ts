import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  CustomerType,
  FulfilmentType,
  GstType,
  UOM,
  ProductLineState,
  BlendAmendmentState,
  AmendmentType,
} from '@/lib/types'

interface QuoteBuilderStore {
  // Customer info
  customerName: string
  contactName: string
  email: string
  hubspotDealId: string
  regionId: string
  customerType: CustomerType
  fulfilmentType: FulfilmentType
  gstType: GstType
  notes: string

  // Product lines (Map keyed by stable lineId)
  lines: Map<string, ProductLineState>

  // Blend section
  blendOpen: boolean
  blendAmendments: Map<string, BlendAmendmentState>

  // Override
  overrideEnabled: boolean
  overrideTotal: number | null

  // Loaded quote ID (for editing)
  loadedQuoteId: string | null

  // Actions
  setCustomerField: (field: 'customerName' | 'contactName' | 'email' | 'hubspotDealId' | 'notes', value: string) => void
  setRegionId: (id: string, defaultUom?: UOM) => void
  setCustomerType: (type: CustomerType) => void
  setFulfilmentType: (type: FulfilmentType) => void
  setGstType: (type: GstType) => void

  addLine: (productId: string) => string
  removeLine: (lineId: string) => void
  updateLine: (lineId: string, updates: Partial<ProductLineState>) => void

  toggleBlend: () => void
  addBlendAmendment: (amendmentId: string | null, name: string, type: AmendmentType, ratePerTonne: number) => string
  removeBlendAmendment: (id: string) => void
  updateBlendAmendment: (id: string, updates: Partial<BlendAmendmentState>) => void

  setOverrideEnabled: (enabled: boolean) => void
  setOverrideTotal: (total: number | null) => void

  resetQuote: () => void
  loadQuote: (quoteId: string, data: Partial<QuoteBuilderStore>) => void
}

const defaultState = {
  customerName: '',
  contactName: '',
  email: '',
  hubspotDealId: '',
  regionId: '',
  customerType: 'distributor' as CustomerType,
  fulfilmentType: 'delivery' as FulfilmentType,
  gstType: 'ex' as GstType,
  notes: '',
  lines: new Map<string, ProductLineState>(),
  blendOpen: false,
  blendAmendments: new Map<string, BlendAmendmentState>(),
  overrideEnabled: false,
  overrideTotal: null,
  loadedQuoteId: null,
}

export const useQuoteBuilder = create<QuoteBuilderStore>()(
  immer((set) => ({
    ...defaultState,

    setCustomerField: (field, value) =>
      set((state) => { state[field] = value }),

    setRegionId: (id) =>
      set((state) => { state.regionId = id }),

    setCustomerType: (type) =>
      set((state) => { state.customerType = type }),

    setFulfilmentType: (type) =>
      set((state) => { state.fulfilmentType = type }),

    setGstType: (type) =>
      set((state) => { state.gstType = type }),

    addLine: (productId) => {
      const lineId = nanoid()
      set((state) => {
        state.lines.set(lineId, {
          id: lineId,
          productId,
          volume: 0,
          uom: 'm3',
          basePrice: 0,
          freight: 0,
          lineTotal: 0,
          volumeT: 0,
          tier: 'standard',
        })
      })
      return lineId
    },

    removeLine: (lineId) =>
      set((state) => { state.lines.delete(lineId) }),

    updateLine: (lineId, updates) =>
      set((state) => {
        const existing = state.lines.get(lineId)
        if (existing) {
          state.lines.set(lineId, { ...existing, ...updates })
        }
      }),

    toggleBlend: () =>
      set((state) => { state.blendOpen = !state.blendOpen }),

    addBlendAmendment: (amendmentId, name, type, ratePerTonne) => {
      const id = nanoid()
      set((state) => {
        state.blendAmendments.set(id, {
          id,
          amendmentId,
          customName: name,
          type,
          quantityT: 0,
          ratePerTonne,
          lineTotal: 0,
        })
      })
      return id
    },

    removeBlendAmendment: (id) =>
      set((state) => { state.blendAmendments.delete(id) }),

    updateBlendAmendment: (id, updates) =>
      set((state) => {
        const existing = state.blendAmendments.get(id)
        if (existing) {
          state.blendAmendments.set(id, { ...existing, ...updates })
        }
      }),

    setOverrideEnabled: (enabled) =>
      set((state) => {
        state.overrideEnabled = enabled
        if (!enabled) state.overrideTotal = null
      }),

    setOverrideTotal: (total) =>
      set((state) => { state.overrideTotal = total }),

    resetQuote: () =>
      set(() => ({
        ...defaultState,
        lines: new Map(),
        blendAmendments: new Map(),
      })),

    loadQuote: (quoteId, data) =>
      set((state) => {
        Object.assign(state, { ...data, loadedQuoteId: quoteId })
      }),
  }))
)

// Nanoid inline (avoid extra import issues in edge cases)
function nanoid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36)
}
