import { z } from 'zod'

const color = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid color')

export const docTypeSchema = z.enum([
  'quotation',
  'receipt_full',
  'receipt_short',
  'trf_receipt',
])

export const blockStyleSchema = z
  .object({
    paddingPx: z.number().int().min(0).default(8),
    marginPx: z.number().int().min(0).default(8),
    border: z
      .object({
        enabled: z.boolean().default(false),
        widthPx: z.number().int().min(0).default(1),
        color: color.default('#CBD5E1'),
      })
      .default({ enabled: false, widthPx: 1, color: '#CBD5E1' }),
    backgroundColor: color.optional(),
    textColor: color.optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
    fontFamily: z.string().trim().min(1).optional(),
    fontSizePx: z.number().int().min(8).max(72).optional(),
    fontWeight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
    borderRadiusPx: z.number().int().min(0).max(48).optional(),
  })
  .partial()

export const baseBlockSchema = z.object({
  id: z.string().min(1),
  locked: z.boolean().optional(),
  style: blockStyleSchema.optional(),
  visibility: z.record(z.string(), z.boolean()).optional(),
})

const headerBlockSchema = baseBlockSchema.extend({
  type: z.literal('header'),
  props: z.object({
    showLogo: z.boolean().default(true),
    showTaxId: z.boolean().default(true),
    showContactLines: z.boolean().default(true),
  }),
})

const titleBlockSchema = baseBlockSchema.extend({
  type: z.literal('title'),
  props: z.object({
    titleEn: z.string().min(1),
    titleTh: z.string().optional(),
    subtitleRight: z.string().optional(),
    showOriginalBadge: z.boolean().optional(),
  }),
})

const customerInfoBlockSchema = baseBlockSchema.extend({
  type: z.literal('customerInfo'),
  props: z.object({
    showAddress: z.boolean().default(true),
    showTaxId: z.boolean().default(false),
    showTel: z.boolean().default(false),
    label: z.string().optional(),
  }),
})

const docMetaBlockSchema = baseBlockSchema.extend({
  type: z.literal('docMeta'),
  props: z.object({
    fields: z.array(
      z.enum([
        'number',
        'date',
        'reference',
        'salesperson',
        'creditTerm',
        'contact',
        'project',
      ]),
    ),
  }),
})

const itemsTableBlockSchema = baseBlockSchema.extend({
  type: z.literal('itemsTable'),
  props: z.object({
    compact: z.boolean().optional(),
    showUnit: z.boolean().optional(),
    showDiscount: z.boolean().optional(),
    currency: z.string().optional(),
  }),
})

const summaryTotalsBlockSchema = baseBlockSchema.extend({
  type: z.literal('summaryTotals'),
  props: z.object({
    showVat: z.boolean().optional(),
    showDiscount: z.boolean().optional(),
  }),
})

const amountInWordsBlockSchema = baseBlockSchema.extend({
  type: z.literal('amountInWords'),
  props: z.object({
    label: z.string().optional(),
  }),
})

const notesBlockSchema = baseBlockSchema.extend({
  type: z.literal('notes'),
  props: z.object({
    text: z.string().default(''),
  }),
})

const signatureBlockSchema = baseBlockSchema.extend({
  type: z.literal('signature'),
  props: z.object({
    leftLabel: z.string().min(1),
    rightLabel: z.string().min(1),
    bottomBarEnabled: z.boolean().optional(),
    bottomBarColor: color.optional(),
    bottomBarHeightPx: z.number().int().min(0).max(40).optional(),
  }),
})

const stampBlockSchema = baseBlockSchema.extend({
  type: z.literal('stamp'),
  props: z.object({
    enabled: z.boolean().default(true),
    label: z.string().optional(),
  }),
})

const paymentMethodBlockSchema = baseBlockSchema.extend({
  type: z.literal('paymentMethod'),
  props: z.object({
    style: z.enum(['checkboxes', 'simple']).default('checkboxes'),
    showBank: z.boolean().default(true),
    showDate: z.boolean().default(true),
    showChequeNo: z.boolean().default(true),
  }),
})

const journalItemsBlockSchema = baseBlockSchema.extend({
  type: z.literal('journalItems'),
  props: z.object({
    title: z.string().optional(),
  }),
})

export const anyBlockSchema = z.discriminatedUnion('type', [
  headerBlockSchema,
  titleBlockSchema,
  customerInfoBlockSchema,
  docMetaBlockSchema,
  itemsTableBlockSchema,
  summaryTotalsBlockSchema,
  amountInWordsBlockSchema,
  notesBlockSchema,
  signatureBlockSchema,
  stampBlockSchema,
  paymentMethodBlockSchema,
  journalItemsBlockSchema,
])

export const templateV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  docType: docTypeSchema,
  published: z.boolean().default(false),
  isDefault: z.boolean().optional(),
  theme: z.object({
    primaryColor: color,
    accentColor: color,
    headerBarColor: color,
    tableHeaderBgColor: color,
    totalsBarBgColor: color.default('#111111'),
    totalsBarTextColor: color.default('#ffffff'),
    fontFamily: z.string().min(1),
  }),
  page: z.object({
    mode: z.enum(['A4', 'THERMAL']).optional(),
    size: z.literal('A4'),
    marginMm: z.number().min(0).default(10),
    gridPx: z.number().int().min(4).max(32).default(8),
    canvasPx: z.object({
      width: z.number().int().min(1).default(794),
      height: z.number().int().min(1).default(1123),
    }),
    thermalMm: z
      .object({
        widthMm: z.number().min(30).max(120).default(80),
        marginMm: z.number().min(0).max(10).default(3),
      })
      .optional(),
  }),
  blocks: z.array(anyBlockSchema).default([]),
  updatedAt: z.string().min(1),
})

export type TemplateV1Input = z.input<typeof templateV1Schema>
export type TemplateV1Parsed = z.output<typeof templateV1Schema>


