import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { brandingSchema, type BrandingInput } from '@/app/core/schema/brandingSchema'
import { useBrandingStore } from '@/app/core/storage/brandingStore'
import { fetchCompanyBranding, updateCompanyBranding } from '@/api/services/branding.service'
import { toApiError } from '@/api/response'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/shell/ui/card'
import { Input } from '@/app/shell/ui/input'
import { Label } from '@/app/shell/ui/label'
import { Textarea } from '@/app/shell/ui/textarea'
import { Button } from '@/app/shell/ui/button'
import { BrandingPreviewHeader } from './BrandingPreviewHeader'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function BrandingPage() {
  const branding = useBrandingStore((s) => s.branding)
  const setBranding = useBrandingStore((s) => s.setBranding)
  const resetBranding = useBrandingStore((s) => s.resetBranding)

  // status: local autosave (Zustand/localStorage)
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  // loadStatus: initial fetch from backend
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  // saveStatus: explicit Save button -> backend
  const [isSaving, setIsSaving] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)

  const defaultValues = useMemo<BrandingInput>(() => branding, [branding])
  const form = useForm<BrandingInput>({
    resolver: zodResolver(brandingSchema),
    defaultValues,
    mode: 'onChange',
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  // Load defaults from backend (best-effort). If unavailable, keep local values.
  useEffect(() => {
    let alive = true
    setLoadStatus('loading')
    setRemoteError(null)
    fetchCompanyBranding()
      .then((dto) => {
        if (!alive) return
        const next = brandingSchema.parse({
          ...branding,
          companyName: dto.name || branding.companyName,
          headOfficeLabel: dto.head_office_label || branding.headOfficeLabel,
          addressLines: dto.address_lines || branding.addressLines,
          tel: dto.tel || branding.tel,
          fax: dto.fax || branding.fax,
          email: dto.email || branding.email,
          website: dto.website || branding.website,
          taxId: dto.tax_id || branding.taxId,
          // For now, store logo_url into logoBase64 field (img src supports URL or data URL).
          logoBase64: dto.logo_url || branding.logoBase64,
        })
        setBranding(next)
        form.reset(next)
        setLoadStatus('idle')
      })
      .catch((e) => {
        if (!alive) return
        const err = toApiError(e)
        setLoadStatus('error')
        setRemoteError(err.message)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let timer: number | undefined
    const sub = form.watch(() => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const values = form.getValues()
        const parsed = brandingSchema.safeParse(values)
        if (parsed.success) {
          setBranding(parsed.data)
          setStatus('saved')
        } else {
          // Never leave UI stuck on "saving" for local autosave; treat invalid as error.
          setStatus('error')
        }
      }, 300)
    })
    return () => {
      if (timer) window.clearTimeout(timer)
      sub.unsubscribe()
    }
  }, [form, setBranding])

  const b = brandingSchema.parse(branding)

  function toBase64Payload(maybe: string | undefined): string | undefined {
    if (!maybe) return undefined
    // data URL: data:image/png;base64,AAAA...
    if (maybe.startsWith('data:')) {
      const comma = maybe.indexOf(',')
      return (comma >= 0 ? maybe.slice(comma + 1) : maybe).replace(/\s+/g, '')
    }
    return maybe.replace(/\s+/g, '')
  }

  function looksLikeUrl(maybe: string | undefined): boolean {
    if (!maybe) return false
    // We also treat common Odoo paths without a leading slash as URLs.
    return /^(https?:\/\/|\/|web\/image|\/web\/image)/i.test(maybe)
  }

  function looksLikeBase64Payload(maybe: string | undefined): boolean {
    if (!maybe) return false
    // Quick heuristic: base64 is typically long and only contains these chars.
    // (We already stripped whitespace above.)
    if (maybe.length < 32) return false
    return /^[A-Za-z0-9+/]+={0,2}$/.test(maybe)
  }

  async function save() {
    try {
      setStatus('saving')
      setIsSaving(true)
      setRemoteError(null)
      const values = brandingSchema.parse(form.getValues())
      const normalizedLogo = toBase64Payload(values.logoBase64)
      const logoPayload =
        looksLikeUrl(values.logoBase64) || !looksLikeBase64Payload(normalizedLogo) ? undefined : normalizedLogo
      await updateCompanyBranding({
        companyName: values.companyName,
        headOfficeLabel: values.headOfficeLabel,
        addressLines: values.addressLines,
        tel: values.tel,
        fax: values.fax,
        email: values.email,
        website: values.website,
        taxId: values.taxId,
        logoBase64: logoPayload,
      })
      setStatus('saved')
      setRemoteError(null)
    } catch (e) {
      const err = toApiError(e)
      setRemoteError(err.message)
      setStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-slate-900">Company Branding</div>
          <div className="text-sm text-slate-500">
            Defaults load from the system. Use “Save” to persist changes.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">
            {isSaving
              ? 'Saving…'
              : loadStatus === 'loading'
                ? 'Loading…'
                : remoteError
                  ? 'Save failed'
                  : form.formState.isDirty
                    ? 'Unsaved changes'
                    : status === 'error'
                      ? 'Check fields'
                      : 'Saved'}
          </div>
          <Button variant="secondary" onClick={save} disabled={isSaving}>
            Save
          </Button>
          <Button variant="outline" onClick={() => resetBranding()}>
            Reset
          </Button>
        </div>
      </div>

      {loadStatus === 'loading' ? (
        <div className="mt-3 alert alert-secondary mb-0">Loading branding…</div>
      ) : null}
      {(loadStatus === 'error' || status === 'error') && remoteError ? (
        <div className="mt-3 alert alert-danger mb-0">
          Failed to load/save branding: {remoteError}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Branding details</CardTitle>
            <CardDescription>Only the essentials: logo, font, colors, contact lines.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4">
              <div className="grid gap-2">
                <Label>Company name *</Label>
                <Input {...form.register('companyName')} placeholder="Company name" />
              </div>

              <div className="grid gap-2">
                <Label>Head office label</Label>
                <Input {...form.register('headOfficeLabel')} placeholder="(Head Office)" />
              </div>

              <div className="grid gap-2">
                <Label>Logo</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e: any) => {
                    const file = (e.target as HTMLInputElement | null)?.files?.[0]
                    if (!file) return
                    const base64 = await fileToBase64(file)
                    form.setValue('logoBase64', base64, { shouldDirty: true, shouldValidate: true })
                    form.setValue('logoFileName', file.name, { shouldDirty: true, shouldValidate: true })
                  }}
                />
                {b.logoBase64 ? (
                  <div className="text-xs text-slate-500">Uploaded: {b.logoFileName || 'logo'}</div>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>Address lines</Label>
                <Textarea
                  value={(form.watch('addressLines') || []).join('\n')}
                  onChange={(e) =>
                    form.setValue(
                      'addressLines',
                      e.target.value.split('\n').map((x) => x.trim()).filter(Boolean),
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                  placeholder="One line per row"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Tel</Label>
                  <Input {...form.register('tel')} />
                </div>
                <div className="grid gap-2">
                  <Label>Fax</Label>
                  <Input {...form.register('fax')} />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input {...form.register('email')} />
                </div>
                <div className="grid gap-2">
                  <Label>Website</Label>
                  <Input {...form.register('website')} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Tax ID</Label>
                <Input {...form.register('taxId')} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Default primary color</Label>
                  <div className="flex items-center gap-2">
                    <Input type="color" className="h-9 w-14 p-1" {...form.register('defaultPrimaryColor')} />
                    <Input {...form.register('defaultPrimaryColor')} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Default accent color</Label>
                  <div className="flex items-center gap-2">
                    <Input type="color" className="h-9 w-14 p-1" {...form.register('defaultAccentColor')} />
                    <Input {...form.register('defaultAccentColor')} />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Default font (CSS font-family)</Label>
                <Input {...form.register('defaultFont')} />
              </div>

              <div className="grid gap-2">
                <Label>Stamp (optional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e: any) => {
                    const file = (e.target as HTMLInputElement | null)?.files?.[0]
                    if (!file) return
                    const base64 = await fileToBase64(file)
                    form.setValue('stampBase64', base64, { shouldDirty: true, shouldValidate: true })
                    form.setValue('stampFileName', file.name, { shouldDirty: true, shouldValidate: true })
                  }}
                />
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>How your header will appear on documents.</CardDescription>
            </CardHeader>
            <CardContent>
              <BrandingPreviewHeader branding={b} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tip</CardTitle>
              <CardDescription>Keep it simple for production safety.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-700">
                Template editing only allows colors/fonts/spacing/toggles — no custom CSS — so print layouts stay stable.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}


