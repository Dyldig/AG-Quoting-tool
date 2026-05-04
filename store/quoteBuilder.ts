import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'
import type {
  CustomerType,
  FulfilmentType,
  GstType,
  UOM,
  ProductLineState,
  BlendAmendmentState,
  AmendmentType,
} from '@/lib/types'

// REQUIRED: do not remove — enables Map/Set support in Immer
enableMapSet()

interface QuoteBuilderStore {
  // Customer info
  quoteName: string
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

  // Disclaimer
  disclaimerAcknowledged: boolean

  // Loaded quote ID (for editing)
  loadedQuoteId: string | null

  // Actions
  setCustomerField: (field: 'quoteName' | 'customerName' | 'contactName' | 'email' | 'hubspotDealId' | 'notes', value: string) => void
  setRegionId: (id: string, defaultUom?: UOM) => void
  setCustomerType: (type: CustomerType) => void
  setFulfilmentType: (type: FulfilmentType) => void
  setGstType: (type: GstType) => void

  addLine: (productId: string, uom?: UOM) => string
  removeLine: (lineId: string) => void
  updateLine: (lineId: string, updates: Partial<ProductLineState>) => void
  setAllLinesUom: (uom: UOM) => void

  toggleBlend: () => void
  addBlendAmendment: (amendmentId: string | null, name: string, type: AmendmentType, ratePerTonne: number) => string
  removeBlendAmendment: (id: string) => void
  updateBlendAmendment: (id: string, updates: Partial<BlendAmendmentState>) => void

  setOverrideEnabled: (enabled: boolean) => void
  setOverrideTotal: (total: number | null) => void

  setDisclaimerAcknowledged: (value: boolean) => void

  resetQuote: () => void
  loadQuote: (quoteId: string, data: Partial<QuoteBuilderStore>) => void
}

const defaultState = {
  quoteName: '',
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
  disclaimerAcknowledged: false,
  loadedQuoteId: null,
}

export const useQuoteBuilder = create<QuoteBuilderStore>()(
  immer((set) => ({
    ...defaultState,

    setCustomerField: (field, value) =>
      set((state) => { (state as Record<string, unknown>)[field] = value }),

    setRegionId: (id) =>
      set((state) => { state.regionId = id }),

    setCustomerType: (type) =>
      set((state) => { state.customerType = type }),

    setFulfilmentType: (type) =>
      set((state) => { state.fulfilmentType = type }),

    setGstType: (type) =>
      set((state) => { state.gstType = type }),

    addLine: (productId, uom = 'm3') => {
      const lineId = nanoid()
      set((state) => {
        state.lines.set(lineId, {
          id: lineId,
          productId,
          productCategory: 'compost',  // updated by ProductLine on first recalc
          volume: 0,
          uom,
          basePrice: 0,
          freight: 0,
          freightOverride: 0,
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

    setAllLinesUom: (uom) =>
      set((state) => {
        state.lines.forEach((line, id) => {
          state.lines.set(id, { ...line, uom })
        })
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

    setDisclaimerAcknowledged: (value) =>
      set((state) => { state.disclaimerAcknowledged = value }),

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
