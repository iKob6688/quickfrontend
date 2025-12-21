import { z } from 'zod'

export const brandingSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required'),
  headOfficeLabel: z.string().trim().default('(Head Office)'),
  logoBase64: z.string().optional(),
  logoFileName: z.string().optional(),
  addressLines: z.array(z.string().trim()).default([]),
  tel: z.string().trim().optional(),
  fax: z.string().trim().optional(),
  email: z.string().trim().optional(),
  website: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
  defaultFont: z.string().trim().min(1).default(
    "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', 'Inter', 'Noto Sans Thai', 'Noto Sans Thai UI', Tahoma, sans-serif",
  ),
  defaultPrimaryColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid color')
    .default('#26D6F0'),
  defaultAccentColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid color')
    .default('#0B6EA6'),
  stampBase64: z.string().optional(),
  stampFileName: z.string().optional(),
})

export type BrandingInput = z.input<typeof brandingSchema>
export type BrandingParsed = z.output<typeof brandingSchema>

export const defaultBranding: BrandingParsed = brandingSchema.parse({
  companyName: 'ERPTH Co., Ltd.',
  headOfficeLabel: '(Head Office)',
  addressLines: ['123 ถนนสุขุมวิท', 'แขวง/เขต ...', 'กรุงเทพฯ 10110'],
  tel: '02-000-0000',
  email: 'info@example.com',
  website: 'www.example.com',
  taxId: '0105559999999',
  defaultPrimaryColor: '#26D6F0',
  defaultAccentColor: '#0B6EA6',
})


