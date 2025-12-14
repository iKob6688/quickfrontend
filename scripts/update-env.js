#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import readline from 'readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const envPath = join(rootDir, '.env')

// Helper to ask question in CLI
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

// Parse .env file and extract bootstrap block
function parseEnvFile(content) {
  const lines = content.split('\n')
  const startMarker = '# ===== Odoo bootstrap (auto-generated) START ====='
  const endMarker = '# ===== Odoo bootstrap (auto-generated) END ====='
  
  let startIdx = -1
  let endIdx = -1
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === startMarker) {
      startIdx = i
    }
    if (lines[i].trim() === endMarker) {
      endIdx = i
      break
    }
  }
  
  const before = startIdx >= 0 ? lines.slice(0, startIdx) : lines
  const after = endIdx >= 0 ? lines.slice(endIdx + 1) : []
  
  return { before, after }
}

// Generate bootstrap block
function generateBootstrapBlock(data) {
  const db = (data.db || '').trim()
  const apiKey = (data.api_key || '').trim()
  const apiBaseUrl = (data.api_base_url || '/api').trim()
  const scopes = Array.isArray(data.allowed_scopes) 
    ? data.allowed_scopes.join(',')
    : (data.allowed_scopes || 'auth,invoice,excel').trim()
  const registerMasterKey = (data.register_master_key || '').trim()
  
  if (!db) {
    throw new Error('db is required')
  }
  if (!apiKey) {
    throw new Error('api_key is required')
  }
  
  const block = [
    '# ===== Odoo bootstrap (auto-generated) START =====',
    `VITE_API_BASE_URL=${apiBaseUrl}`,
    `VITE_API_KEY=${apiKey}`,
    `VITE_ODOO_DB=${db}`,
    `VITE_ALLOWED_SCOPES=${scopes}`,
  ]
  
  if (registerMasterKey) {
    block.push(`VITE_REGISTER_MASTER_KEY=${registerMasterKey}`)
  }
  
  block.push('# ===== Odoo bootstrap (auto-generated) END =====')
  
  return block.join('\n')
}

// Main function
async function updateEnv() {
  console.log('🔧 Quickfront18 - Update .env for Server Deployment')
  console.log('==================================================\n')
  
  // Read existing .env to get current values as defaults
  let currentValues = {}
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    const lines = content.split('\n')
    for (const line of lines) {
      if (line.includes('=') && !line.trim().startsWith('#')) {
        const [key, ...valueParts] = line.split('=')
        const keyTrimmed = key.trim()
        const valueTrimmed = valueParts.join('=').trim()
        if (keyTrimmed.startsWith('VITE_')) {
          currentValues[keyTrimmed] = valueTrimmed
        }
      }
    }
  }
  
  // Ask for API Base URL
  const defaultApiBaseUrl = currentValues.VITE_API_BASE_URL || '/api'
  console.log('📡 API Base URL')
  console.log('   สำหรับ server deployment ควรเป็น full URL เช่น:')
  console.log('   - https://api.example.com')
  console.log('   - https://middleware.example.com/api')
  console.log('   - http://your-server-ip:8069/api')
  console.log('   สำหรับ development ใช้ /api (Vite proxy)\n')
  
  let apiBaseUrl = await askQuestion(`API Base URL [${defaultApiBaseUrl}]: `)
  apiBaseUrl = (apiBaseUrl || defaultApiBaseUrl).trim()
  
  // Validate URL format if it's a full URL
  if (apiBaseUrl.startsWith('http://') || apiBaseUrl.startsWith('https://')) {
    try {
      new URL(apiBaseUrl)
    } catch {
      console.error('❌ Invalid URL format')
      process.exit(1)
    }
  }
  
  // Ask for API Key
  const defaultApiKey = currentValues.VITE_API_KEY || ''
  console.log('\n🔑 API Key')
  console.log('   รับจาก Odoo: Settings → Technical → API Clients')
  console.log('   หรือใช้ Registration Token จาก bootstrap\n')
  
  let apiKey = await askQuestion(`API Key${defaultApiKey ? ` [${defaultApiKey.substring(0, 20)}...]` : ''}: `)
  apiKey = (apiKey || defaultApiKey).trim()
  
  if (!apiKey) {
    console.error('❌ API Key is required')
    process.exit(1)
  }
  
  // Ask for Odoo Database Name
  const defaultDb = currentValues.VITE_ODOO_DB || ''
  console.log('\n💾 Odoo Database Name')
  console.log('   ชื่อ database ใน Odoo (เช่น: qacc, production, etc.)\n')
  
  let db = await askQuestion(`Database Name${defaultDb ? ` [${defaultDb}]` : ''}: `)
  db = (db || defaultDb).trim()
  
  if (!db) {
    console.error('❌ Database name is required')
    process.exit(1)
  }
  
  // Ask for Allowed Scopes
  const defaultScopes = currentValues.VITE_ALLOWED_SCOPES || 'auth,invoice,excel'
  console.log('\n📋 Allowed Scopes')
  console.log('   Scopes ที่อนุญาต (คั่นด้วย comma) เช่น: auth,invoice,excel')
  console.log('   หรือใช้ * สำหรับทั้งหมด\n')
  
  let scopes = await askQuestion(`Allowed Scopes [${defaultScopes}]: `)
  scopes = (scopes || defaultScopes).trim()
  
  // Ask for Register Master Key (optional)
  const defaultMasterKey = currentValues.VITE_REGISTER_MASTER_KEY || ''
  console.log('\n🔐 Register Master Key (Optional)')
  console.log('   สำหรับสร้างบริษัทใหม่ผ่าน UI')
  console.log('   ถ้าไม่ต้องการสร้างบริษัทใหม่ผ่าน UI สามารถข้ามได้\n')
  
  let registerMasterKey = await askQuestion(`Register Master Key${defaultMasterKey ? ' [***]' : ' (press Enter to skip)'}: `)
  registerMasterKey = registerMasterKey.trim()
  
  // Generate bootstrap block
  const data = {
    api_base_url: apiBaseUrl,
    api_key: apiKey,
    db: db,
    allowed_scopes: scopes,
    register_master_key: registerMasterKey || undefined,
  }
  
  const bootstrapBlock = generateBootstrapBlock(data)
  
  // Read existing .env or create new
  let envContent = ''
  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf-8')
  }
  
  // Parse and update .env
  const { before, after } = parseEnvFile(envContent)
  
  // Combine: keep existing content, add/update bootstrap block
  const beforeClean = before.filter(line => {
    const trimmed = line.trim()
    return trimmed === '' || 
           (!trimmed.startsWith('VITE_API_BASE_URL') && 
            !trimmed.startsWith('VITE_API_KEY') && 
            !trimmed.startsWith('VITE_ODOO_DB') && 
            !trimmed.startsWith('VITE_ALLOWED_SCOPES') &&
            !trimmed.startsWith('VITE_REGISTER_MASTER_KEY'))
  })
  
  const afterClean = after.filter(line => {
    const trimmed = line.trim()
    return trimmed === '' || 
           (!trimmed.startsWith('VITE_API_BASE_URL') && 
            !trimmed.startsWith('VITE_API_KEY') && 
            !trimmed.startsWith('VITE_ODOO_DB') && 
            !trimmed.startsWith('VITE_ALLOWED_SCOPES') &&
            !trimmed.startsWith('VITE_REGISTER_MASTER_KEY'))
  })
  
  const newEnvContent = [
    ...beforeClean,
    '',
    bootstrapBlock,
    ...afterClean,
  ].join('\n') + '\n'
  
  // Write .env
  writeFileSync(envPath, newEnvContent, 'utf-8')
  
  console.log('\n✅ Updated .env file successfully!')
  console.log(`   Location: ${envPath}\n`)
  console.log('--- Updated .env bootstrap block ---\n')
  console.log(bootstrapBlock)
  console.log('\n-----------------------------------\n')
  
  // Show important notes
  console.log('📝 Important Notes:')
  console.log('   1. สำหรับ server deployment:')
  console.log(`      - VITE_API_BASE_URL ควรเป็น full URL: ${apiBaseUrl.startsWith('http') ? apiBaseUrl : 'https://your-server.com/api'}`)
  console.log('   2. ตรวจสอบว่า API Key ถูกต้องและ active ใน Odoo')
  console.log('   3. ตรวจสอบว่า Database name ถูกต้อง')
  console.log('   4. หลังจากอัพเดท .env:')
  console.log('      - Development: restart dev server (npm run dev)')
  console.log('      - Production: rebuild และ restart application\n')
}

// Run update
updateEnv().catch((error) => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})
