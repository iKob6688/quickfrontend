import { nanoid } from 'nanoid'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AnyBlock, TemplateV1 } from '../types/template'
import { templateV1Schema } from '../schema/templateV1'

type TemplateState = {
  templates: TemplateV1[]
  ensureDefaults: (defaults: TemplateV1[]) => void
  upsertTemplate: (tpl: TemplateV1) => void
  deleteTemplate: (id: string) => void
  renameTemplate: (id: string, name: string) => void
  duplicateTemplate: (id: string) => string | undefined
  createFromDefault: (defaultId: string) => string | undefined
  togglePublish: (id: string) => void
  addBlock: (templateId: string, block: AnyBlock) => void
  updateBlock: (templateId: string, blockId: string, patch: Partial<AnyBlock>) => void
  reorderBlocks: (templateId: string, nextBlockIds: string[]) => void
}

const STORAGE_KEY = 'rs:templates:v1'

export function cloneTemplate(tpl: TemplateV1, overrides?: Partial<TemplateV1>): TemplateV1 {
  const newId = nanoid()
  const now = new Date().toISOString()
  return templateV1Schema.parse({
    ...tpl,
    ...overrides,
    id: newId,
    isDefault: false,
    published: false,
    updatedAt: now,
    blocks: tpl.blocks.map((b) => ({ ...b, id: nanoid() })),
  })
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: [],
      ensureDefaults: (defaults) => {
        set((s) => {
          const parsedDefaults = defaults.map((d) => templateV1Schema.parse(d))
          const defaultIds = new Set(parsedDefaults.map((d) => d.id))

          // Keep:
          // - all custom templates
          // - default templates that still exist in the shipped defaults list
          // This prevents "stale" defaults from lingering forever after app updates.
          const next = s.templates.filter((t) => !t.isDefault || defaultIds.has(t.id))

          const idxById = new Map(next.map((t, idx) => [t.id, idx] as const))

          for (const d of parsedDefaults) {
            const idx = idxById.get(d.id)
            if (typeof idx !== 'number') {
              idxById.set(d.id, next.length)
              next.push(d)
              continue
            }

            const existing = next[idx]
            // Safe: defaults are read-only in UI, so we can replace them with the latest shipped definition.
            if (existing?.isDefault) {
              next[idx] = d
            }
          }

          return { templates: next }
        })
      },
      upsertTemplate: (tpl) => {
        const parsed = templateV1Schema.parse(tpl)
        set((s) => {
          const idx = s.templates.findIndex((t) => t.id === parsed.id)
          if (idx === -1) return { templates: [...s.templates, parsed] }
          const next = s.templates.slice()
          next[idx] = parsed
          return { templates: next }
        })
      },
      deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id || t.isDefault) })),
      renameTemplate: (id, name) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id && !t.isDefault ? { ...t, name, updatedAt: new Date().toISOString() } : t,
          ),
        })),
      duplicateTemplate: (id) => {
        const tpl = get().templates.find((t) => t.id === id)
        if (!tpl) return undefined
        const dup = cloneTemplate(tpl, { name: `${tpl.name} (Copy)` })
        set((s) => ({ templates: [...s.templates, dup] }))
        return dup.id
      },
      createFromDefault: (defaultId) => {
        const tpl = get().templates.find((t) => t.id === defaultId && t.isDefault)
        if (!tpl) return undefined
        const created = cloneTemplate(tpl, { name: `${tpl.name} (Custom)` })
        set((s) => ({ templates: [...s.templates, created] }))
        return created.id
      },
      togglePublish: (id) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id && !t.isDefault ? { ...t, published: !t.published, updatedAt: new Date().toISOString() } : t,
          ),
        })),
      addBlock: (templateId, block) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === templateId
              ? templateV1Schema.parse({
                  ...t,
                  blocks: [...t.blocks, block],
                  updatedAt: new Date().toISOString(),
                })
              : t,
          ),
        })),
      updateBlock: (templateId, blockId, patch) =>
        set((s) => ({
          templates: s.templates.map((t) => {
            if (t.id !== templateId) return t
            const nextBlocks = t.blocks.map((b) => (b.id === blockId ? ({ ...b, ...patch } as AnyBlock) : b))
            return templateV1Schema.parse({ ...t, blocks: nextBlocks, updatedAt: new Date().toISOString() })
          }),
        })),
      reorderBlocks: (templateId, nextBlockIds) =>
        set((s) => ({
          templates: s.templates.map((t) => {
            if (t.id !== templateId) return t
            const byId = new Map(t.blocks.map((b) => [b.id, b] as const))
            const nextBlocks: AnyBlock[] = []
            for (const id of nextBlockIds) {
              const b = byId.get(id)
              if (b) nextBlocks.push(b)
            }
            // Keep any blocks that weren't included (defensive)
            for (const b of t.blocks) {
              if (!nextBlocks.find((x) => x.id === b.id)) nextBlocks.push(b)
            }
            return templateV1Schema.parse({ ...t, blocks: nextBlocks, updatedAt: new Date().toISOString() })
          }),
        })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (s) => ({ templates: s.templates }),
      merge: (persisted, current) => {
        const maybe = (persisted as any)?.templates
        if (!Array.isArray(maybe)) return current
        const parsed: TemplateV1[] = []
        for (const t of maybe) {
          const res = templateV1Schema.safeParse(t)
          if (res.success) parsed.push(res.data)
        }
        return { ...current, templates: parsed.length ? parsed : current.templates }
      },
    },
  ),
)


