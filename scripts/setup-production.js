#!/usr/bin/env node

/**
 * Production Setup Script
 * 
 * One-command setup for production deployment.
 * Automatically detects environment and configures everything.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import readline from 'readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const envPath = join(rootDir, '.env')

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

function parseEnvFile(content) {
  const lines = content.split('\n')
  const startMarker = '# ===== Odoo bootstrap (auto-generated) START ====='
  const endMarker = '# ===== Odoo bootstrap (auto-generated) END ====='
  
  let startIdx = -1
  let endIdx = -1
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === startMarker) startIdx = i
    if (lines[i].trim() === endMarker) {
      endIdx = i
      break
    }
  }
  
  const before = startIdx >= 0 ? lines.slice(0, startIdx) : lines
  const after = endIdx >= 0 ? lines.slice(endIdx + 1) : []
  
  return { before, after }
}

function generateEnvBlock(config) {
  const block = [
    '# ===== Odoo bootstrap (auto-generated) START =====',
    `VITE_API_BASE_URL=${config.apiBaseUrl}`,
    `VITE_API_KEY=${config.apiKey}`,
    `VITE_ODOO_DB=${config.db}`,
    `VITE_ALLOWED_SCOPES=${config.scopes}`,
  ]
  
  if (config.registerMasterKey) {
    block.push(`VITE_REGISTER_MASTER_KEY=${config.registerMasterKey}`)
  }
  
  block.push('# ===== Odoo bootstrap (auto-generated) END =====')
  return block.join('\n')
}

function validateConfig(config) {
  const errors = []
  
  if (!config.apiBaseUrl || config.apiBaseUrl.trim() === '') {
    errors.push('❌ VITE_API_BASE_URL is required')
  } else if (config.apiBaseUrl.startsWith('/') && !config.apiBaseUrl.startsWith('/api')) {
    errors.push('⚠️  VITE_API_BASE_URL should be a full URL for production (e.g., https://api.example.com)')
  }
  
  if (!config.apiKey || config.apiKey.trim() === '') {
    errors.push('❌ VITE_API_KEY is required')
  }
  
  if (!config.db || config.db.trim() === '') {
    errors.push('❌ VITE_ODOO_DB is required')
  }
  
  if (!config.scopes || config.scopes.trim() === '') {
    errors.push('❌ VITE_ALLOWED_SCOPES is required')
  }
  
  return errors
}

async function autoDetectApiBaseUrl() {
  // Try to detect from environment or common patterns
  const hostname = process.env.HOSTNAME || process.env.SERVER_NAME
  const port = process.env.PORT || '80'
  const protocol = process.env.PROTOCOL || 'https'
  
  if (hostname) {
    const url = `${protocol}://${hostname}${port !== '80' && port !== '443' ? `:${port}` : ''}/api`
    return url
  }
  
  return null
}

async function main() {
  console.log('🚀 Quickfront18 Production Setup')
  console.log('================================\n')
  
  // Auto-detect environment
  const isProduction = process.env.NODE_ENV === 'production' || 
                       !process.env.NODE_ENV || 
                       process.argv.includes('--production')
  
  console.log(`Environment: ${isProduction ? 'Production' : 'Development'}\n`)
  
  // Load existing config
  let existingConfig = {}
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    const lines = content.split('\n')
    for (const line of lines) {
      if (line.includes('=') && !line.trim().startsWith('#')) {
        const [key, ...valueParts] = line.split('=')
        const keyTrimmed = key.trim()
        const valueTrimmed = valueParts.join('=').trim()
        if (keyTrimmed.startsWith('VITE_')) {
          existingConfig[keyTrimmed] = valueTrimmed
        }
      }
    }
  }
  
  // Auto-detect API Base URL
  let suggestedApiBaseUrl = await autoDetectApiBaseUrl()
  if (!suggestedApiBaseUrl) {
    suggestedApiBaseUrl = existingConfig.VITE_API_BASE_URL || (isProduction ? '' : '/api')
  }
  
  // Collect configuration
  const config = {}
  
  // API Base URL
  console.log('📡 API Configuration')
  if (isProduction && suggestedApiBaseUrl.startsWith('/')) {
    console.log('⚠️  Production mode detected but API Base URL is relative.')
    console.log('   Please provide full URL (e.g., https://api.example.com)\n')
  }
  
  const apiBaseUrlPrompt = suggestedApiBaseUrl 
    ? `API Base URL [${suggestedApiBaseUrl}]: `
    : 'API Base URL (e.g., https://api.example.com or /api for dev): '
  
  let apiBaseUrl = await askQuestion(apiBaseUrlPrompt)
  config.apiBaseUrl = (apiBaseUrl || suggestedApiBaseUrl || '/api').trim()
  
  // Validate URL format for production
  if (isProduction && config.apiBaseUrl.startsWith('/')) {
    console.log('\n⚠️  Warning: Using relative URL in production mode.')
    console.log('   This may cause connection issues. Consider using full URL.\n')
    const confirm = await askQuestion('Continue anyway? (y/N): ')
    if (confirm.toLowerCase() !== 'y') {
      console.log('Setup cancelled.')
      process.exit(0)
    }
  }
  
  // API Key
  const defaultApiKey = existingConfig.VITE_API_KEY || ''
  console.log('\n🔑 API Key')
  console.log('   Get from: Odoo → Settings → Technical → API Clients\n')
  let apiKey = await askQuestion(`API Key${defaultApiKey ? ` [${defaultApiKey.substring(0, 20)}...]` : ''}: `)
  config.apiKey = (apiKey || defaultApiKey).trim()
  
  // Database
  const defaultDb = existingConfig.VITE_ODOO_DB || ''
  console.log('\n💾 Database Name\n')
  let db = await askQuestion(`Database Name${defaultDb ? ` [${defaultDb}]` : ''}: `)
  config.db = (db || defaultDb).trim()
  
  // Scopes
  const defaultScopes = existingConfig.VITE_ALLOWED_SCOPES || 'auth,invoice,excel'
  console.log('\n📋 Allowed Scopes\n')
  let scopes = await askQuestion(`Allowed Scopes [${defaultScopes}]: `)
  config.scopes = (scopes || defaultScopes).trim()
  
  // Register Master Key (optional)
  const defaultMasterKey = existingConfig.VITE_REGISTER_MASTER_KEY || ''
  console.log('\n🔐 Register Master Key (Optional)\n')
  let registerMasterKey = await askQuestion(`Register Master Key${defaultMasterKey ? ' [***]' : ' (press Enter to skip)'}: `)
  config.registerMasterKey = registerMasterKey.trim() || undefined
  
  // Validate
  console.log('\n🔍 Validating configuration...\n')
  const errors = validateConfig(config)
  
  if (errors.length > 0) {
    console.error('Configuration errors:')
    errors.forEach(err => console.error(`  ${err}`))
    console.error('\nPlease fix the errors and try again.')
    process.exit(1)
  }
  
  // Generate .env
  const envBlock = generateEnvBlock(config)
  let envContent = ''
  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf-8')
  }
  
  const { before, after } = parseEnvFile(envContent)
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
    envBlock,
    ...afterClean,
  ].join('\n') + '\n'
  
  writeFileSync(envPath, newEnvContent, 'utf-8')
  
  // Success message
  console.log('✅ Configuration saved successfully!\n')
  console.log('📝 Configuration Summary:')
  console.log(`   API Base URL: ${config.apiBaseUrl}`)
  console.log(`   API Key: ${config.apiKey.substring(0, 20)}...`)
  console.log(`   Database: ${config.db}`)
  console.log(`   Scopes: ${config.scopes}`)
  if (config.registerMasterKey) {
    console.log(`   Register Master Key: ***`)
  }
  console.log('\n📦 Next Steps:')
  if (isProduction) {
    console.log('   1. Run: npm run build')
    console.log('   2. Deploy the dist/ folder to your server')
    console.log('   3. Configure your web server (nginx/apache) to serve the app')
  } else {
    console.log('   1. Run: npm run dev')
    console.log('   2. Open http://localhost:5173')
  }
  console.log('')
}

main().catch((error) => {
  console.error('❌ Setup failed:', error.message)
  process.exit(1)
})
