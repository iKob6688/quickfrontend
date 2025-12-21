import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSettingsStore } from '@/app/core/storage/settingsStore'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/shell/ui/card'
import { Input } from '@/app/shell/ui/input'
import { Label } from '@/app/shell/ui/label'
import { Button } from '@/app/shell/ui/button'

const settingsFormSchema = z.object({
  odooBaseUrl: z.string().trim().optional(),
  apiToken: z.string().trim().optional(),
  pdfServiceUrl: z.string().trim().optional(),
})

type SettingsForm = z.infer<typeof settingsFormSchema>

export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings)
  const patchSettings = useSettingsStore((s) => s.patchSettings)
  const resetSettings = useSettingsStore((s) => s.resetSettings)
  const [status, setStatus] = useState<'saved' | 'saving'>('saved')

  const defaultValues = useMemo<SettingsForm>(() => settings, [settings])
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues,
    mode: 'onChange',
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  useEffect(() => {
    let timer: number | undefined
    const sub = form.watch(() => {
      setStatus('saving')
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const values = form.getValues()
        patchSettings({
          odooBaseUrl: values.odooBaseUrl?.trim() || '',
          apiToken: values.apiToken?.trim() || '',
          pdfServiceUrl: values.pdfServiceUrl?.trim() || '/api/print/pdf',
        })
        setStatus('saved')
      }, 300)
    })
    return () => {
      if (timer) window.clearTimeout(timer)
      sub.unsubscribe()
    }
  }, [form, patchSettings])

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold text-slate-900">Settings</div>
          <div className="text-sm text-slate-500">Connection + PDF service endpoint (frontend only).</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">{status === 'saving' ? 'Saving…' : 'Saved'}</div>
          <Button variant="outline" onClick={() => resetSettings()}>
            Reset
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Odoo API</CardTitle>
            <CardDescription>Leave blank to use mock DTOs for preview.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Odoo base URL</Label>
                <Input {...form.register('odooBaseUrl')} placeholder="https://your-odoo.example.com" />
              </div>
              <div className="grid gap-2">
                <Label>API token</Label>
                <Input {...form.register('apiToken')} placeholder="Bearer token" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PDF service</CardTitle>
            <CardDescription>POST HTML + DTO + templateId → returns {`{ pdfUrl }`}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Label>PDF endpoint</Label>
              <Input {...form.register('pdfServiceUrl')} placeholder="/api/print/pdf" />
              <div className="text-xs text-slate-500">
                Default is <span className="font-mono">/api/print/pdf</span>.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


