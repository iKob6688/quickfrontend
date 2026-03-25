import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { z } from 'zod'

const defaultTemplateIdByDocTypeSchema = z
  .object({
    quotation: z.string().trim().default('quotation_default_v1'),
    invoice: z.string().trim().default('invoice_default_v1'),
    sales_credit_note: z.string().trim().default('sales_credit_note_default_v1'),
    sales_debit_note: z.string().trim().default('sales_debit_note_default_v1'),
    purchase_credit_note: z.string().trim().default('purchase_credit_note_default_v1'),
    purchase_debit_note: z.string().trim().default('purchase_debit_note_default_v1'),
    receipt_full: z.string().trim().default('receipt_full_default_v1'),
    receipt_short: z.string().trim().default('receipt_short_default_v1'),
  })
  .default({
    quotation: 'quotation_default_v1',
    invoice: 'invoice_default_v1',
    sales_credit_note: 'sales_credit_note_default_v1',
    sales_debit_note: 'sales_debit_note_default_v1',
    purchase_credit_note: 'purchase_credit_note_default_v1',
    purchase_debit_note: 'purchase_debit_note_default_v1',
    receipt_full: 'receipt_full_default_v1',
    receipt_short: 'receipt_short_default_v1',
  })

const settingsSchema = z.object({
  odooBaseUrl: z.string().trim().default(''),
  apiToken: z.string().trim().default(''),
  pdfServiceUrl: z.string().trim().default('/api/print/pdf'),
  defaultTemplateIdByDocType: defaultTemplateIdByDocTypeSchema,
  dateDisplayFormat: z.enum(['DD/MM/YYYY', 'D MMMM YYYY']).default('DD/MM/YYYY'),
  dateCalendar: z.enum(['gregorian', 'buddhist']).default('buddhist'),
})

export type StudioSettings = z.output<typeof settingsSchema>

type SettingsState = {
  settings: StudioSettings
  setSettings: (next: StudioSettings) => void
  patchSettings: (patch: Partial<StudioSettings>) => void
  resetSettings: () => void
}

const STORAGE_KEY = 'rs:settings:v1'

const defaultSettings: StudioSettings = settingsSchema.parse({})

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      setSettings: (next) => set({ settings: settingsSchema.parse(next) }),
      patchSettings: (patch) => set({ settings: settingsSchema.parse({ ...get().settings, ...patch }) }),
      resetSettings: () => set({ settings: defaultSettings }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (s) => ({ settings: s.settings }),
      merge: (persisted, current) => {
        const maybe = (persisted as any)?.settings
        const parsed = settingsSchema.safeParse(maybe)
        return { ...current, settings: parsed.success ? parsed.data : current.settings }
      },
    },
  ),
)
