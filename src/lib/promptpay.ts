function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0')
  return `${id}${len}${value}`
}

function crc16CcittFalse(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function normalizePromptPayTarget(raw: string): { type: 'mobile' | 'tax_id'; value: string } | null {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('0')) {
    return { type: 'mobile', value: digits }
  }
  if (digits.length === 13) {
    return { type: 'tax_id', value: digits }
  }
  return null
}

function encodePromptPayProxy(raw: string): { subFieldId: '01' | '02'; value: string } | null {
  const parsed = normalizePromptPayTarget(raw)
  if (!parsed) return null
  if (parsed.type === 'mobile') {
    // AID promptpay mobile proxy uses country code without +
    return { subFieldId: '01', value: '0066' + parsed.value.slice(1) }
  }
  return { subFieldId: '02', value: parsed.value }
}

export function buildPromptPayPayload(input: { target: string; amount?: number | null }): string | null {
  const proxy = encodePromptPayProxy(input.target)
  if (!proxy) return null

  const merchantAccount =
    tlv('00', 'A000000677010111') +
    tlv(proxy.subFieldId, proxy.value)

  const amount =
    typeof input.amount === 'number' && Number.isFinite(input.amount) && input.amount > 0
      ? input.amount.toFixed(2)
      : null

  let payload =
    tlv('00', '01') + // payload format
    tlv('01', amount ? '12' : '11') + // static/dynamic
    tlv('29', merchantAccount) +
    tlv('58', 'TH') +
    tlv('53', '764')

  if (amount) payload += tlv('54', amount)

  payload += tlv('63', '0000')
  const crc = crc16CcittFalse(payload)
  return payload.slice(0, -4) + crc
}

export function buildPromptPayQrImageUrl(payload: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}`
}

export function validatePromptPayTarget(raw: string): string | null {
  const parsed = normalizePromptPayTarget(raw)
  if (parsed) return null
  return 'กรุณาระบุเบอร์มือถือ 10 หลัก หรือเลขผู้เสียภาษี 13 หลัก'
}
