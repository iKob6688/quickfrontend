import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Branding } from '../types/branding'
import { brandingSchema, defaultBranding } from '../schema/brandingSchema'

type BrandingState = {
  branding: Branding
  setBranding: (next: Branding) => void
  patchBranding: (patch: Partial<Branding>) => void
  resetBranding: () => void
}

const STORAGE_KEY = 'rs:branding:v1'

export const useBrandingStore = create<BrandingState>()(
  persist(
    (set, get) => ({
      branding: defaultBranding,
      setBranding: (next) => {
        const parsed = brandingSchema.parse(next)
        set({ branding: parsed })
      },
      patchBranding: (patch) => {
        const merged = { ...get().branding, ...patch }
        const parsed = brandingSchema.parse(merged)
        set({ branding: parsed })
      },
      resetBranding: () => set({ branding: defaultBranding }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (s) => ({ branding: s.branding }),
      merge: (persisted, current) => {
        const maybe = (persisted as any)?.branding
        const parsed = brandingSchema.safeParse(maybe)
        return { ...current, branding: parsed.success ? parsed.data : current.branding }
      },
    },
  ),
)


