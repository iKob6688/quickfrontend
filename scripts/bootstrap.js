#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import readline from 'readline'
import axios from 'axios'

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
  // Validate required fields
  const db = (data.db || '').trim()
  const apiKey = (data.api_key || '').trim()
  const apiBaseUrl = (data.api_base_url || '/api').trim()
  const scopes = Array.isArray(data.allowed_scopes) 
    ? data.allowed_scopes.join(',')
    : (data.allowed_scopes || '').trim()
  
  if (!db) {
    throw new Error('db is required in bootstrap response')
  }
  if (!apiKey) {
    throw new Error('api_key is required in bootstrap response')
  }
  
  return [
    '# ===== Odoo bootstrap (auto-generated) START =====',
    `VITE_API_BASE_URL=${apiBaseUrl}`,
    `VITE_API_KEY=${apiKey}`,
    `VITE_ODOO_DB=${db}`,
    `VITE_ALLOWED_SCOPES=${scopes}`,
    '# ===== Odoo bootstrap (auto-generated) END =====',
  ].join('\n')
}

// Main bootstrap function
async function bootstrap() {
  console.log('🚀 Quickfront18 Bootstrap')
  console.log('========================\n')
  
  const defaultBootstrapUrl = 'http://localhost:8069/api/th/v1/frontend/bootstrap'
  let bootstrapUrl =
    await askQuestion(`Odoo bootstrap URL [${defaultBootstrapUrl}]: `)
  bootstrapUrl = (bootstrapUrl || defaultBootstrapUrl).trim()

  // Normalize URL: fix common mistakes (http:localhost -> http://localhost)
  if (bootstrapUrl.match(/^https?:[^/]/)) {
    bootstrapUrl = bootstrapUrl.replace(/^(https?:)([^/])/, '$1//$2')
    console.warn('⚠️  Fixed URL format (added missing //)')
  }

  // Fix https to http for localhost
  if (
    bootstrapUrl.startsWith('https://localhost') ||
    bootstrapUrl.startsWith('https://127.0.0.1')
  ) {
    console.warn('⚠️  Warning: Using https:// for localhost. Changing to http://')
    bootstrapUrl = bootstrapUrl.replace('https://', 'http://')
  }

  // Validate URL format
  try {
    const url = new URL(bootstrapUrl)
    if (!['http:', 'https:'].includes(url.protocol)) {
      console.error('❌ Invalid protocol. Use http:// or https://')
      process.exit(1)
    }
  } catch {
    console.error('❌ Invalid URL format. Please provide a full URL.')
    console.error(`   Example: ${defaultBootstrapUrl}`)
    process.exit(1)
  }
  
  // Ask for registration token
  const registrationToken = await askQuestion('Registration Token (from Odoo admin): ')
  if (!registrationToken) {
    console.error('❌ Registration token is required')
    process.exit(1)
  }
  
  // Optional db (kept for future multi-db, but optional per contract)
  const dbName = await askQuestion('Database name (optional, press Enter to omit): ')
  const dbNameTrimmed = dbName.trim()

  console.log('\n📡 Calling Odoo bootstrap endpoint...')
  
  try {
    // Per docs/api_contract.md: JSON-RPC request
    const body = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        registration_token: registrationToken.trim(),
        ...(dbNameTrimmed ? { db: dbNameTrimmed } : {}),
      },
    }

    const response = await axios.post(bootstrapUrl, body, {
      headers: {
        'Content-Type': 'application/json',
        // Docs say API key required for all endpoints; during bootstrap we don't have cfg.api_key yet.
        // Best-effort: send registration token as API key header (backend may ignore).
        'X-ADT-API-Key': registrationToken.trim(),
      },
    })

    // Backend may respond as JSON-RPC wrapper or plain envelope; normalize here.
    let envelope = response.data
    if (envelope && envelope.jsonrpc === '2.0' && envelope.result) {
      envelope = envelope.result
    }
    
    if (!envelope.success) {
      const errorMsg = envelope.error?.message || 'Unknown error'
      console.error(`❌ Bootstrap failed: ${errorMsg}`)
      process.exit(1)
    }
    
    const data = envelope.data
    
    // Validate required fields
    if (!data.db || !data.db.trim()) {
      console.error('❌ Bootstrap failed: Missing db name in response')
      console.error('   Backend must return "db" field in bootstrap response')
      process.exit(1)
    }
    
    if (!data.api_key || !data.api_key.trim()) {
      console.error('❌ Bootstrap failed: Missing api_key in response')
      console.error('   Backend must return "api_key" field in bootstrap response')
      process.exit(1)
    }
    
    console.log('✅ Bootstrap successful!')
    console.log(`   Company: ${data.company_name}${data.company_id ? ` (ID: ${data.company_id})` : ''}`)
    console.log(`   Database: ${data.db}`)
    console.log(`   API Key: ${data.api_key.substring(0, 20)}...`)
    console.log(`   Scopes: ${Array.isArray(data.allowed_scopes) ? data.allowed_scopes.join(', ') : data.allowed_scopes || 'none'}`)
    
    // Read existing .env or create new
    let envContent = ''
    if (existsSync(envPath)) {
      envContent = readFileSync(envPath, 'utf-8')
    }
    
    // Parse and update .env
    const { before, after } = parseEnvFile(envContent)
    const bootstrapBlock = generateBootstrapBlock(data)
    
    // Combine: keep existing content, add/update bootstrap block
    const beforeClean = before.filter(line => line.trim() !== '' && !line.startsWith('VITE_API_BASE_URL') && !line.startsWith('VITE_API_KEY') && !line.startsWith('VITE_ODOO_DB') && !line.startsWith('VITE_ALLOWED_SCOPES'))
    const afterClean = after.filter(line => line.trim() !== '' && !line.startsWith('VITE_API_BASE_URL') && !line.startsWith('VITE_API_KEY') && !line.startsWith('VITE_ODOO_DB') && !line.startsWith('VITE_ALLOWED_SCOPES'))
    
    const newEnvContent = [
      ...beforeClean,
      '',
      bootstrapBlock,
      ...afterClean,
    ].join('\n') + '\n'
    
    // Write .env
    writeFileSync(envPath, newEnvContent, 'utf-8')
    console.log(`\n✅ Updated .env file: ${envPath}`)
    console.log('\n--- .env bootstrap block ---\n')
    console.log(bootstrapBlock)
    console.log('\n---------------------------\n')
    console.log('\n⚠️  Please restart your dev server (npm run dev) for changes to take effect.\n')
    
  } catch (error) {
    if (error.response) {
      const status = error.response.status
      const errorData = error.response.data
      const errorMsg = errorData?.error?.message || errorData?.message || 'Unknown error'
      
      if (status === 404) {
        console.error(`❌ Bootstrap endpoint not found (404)`)
        console.error(`   The endpoint does not exist on the backend.`)
        console.error(`   Check URL: ${bootstrapUrl}`)
      } else {
        console.error(`❌ Bootstrap failed: ${errorMsg}`)
        console.error(`   Status: ${status}`)
      }
    } else if (error.request) {
      console.error(`❌ Network error: Could not reach ${bootstrapUrl}`)
      console.error('   Please check:')
      console.error('   1. Is Odoo running?')
      console.error('   2. Is the URL correct? (use http:// not https:// for localhost)')
      console.error('   3. Is the port correct? (default is 8069)')
      
      // Try to suggest http if they used https
      if (bootstrapUrl.includes('https://localhost') || bootstrapUrl.includes('https://127.0.0.1')) {
        const httpUrl = bootstrapUrl.replace('https://', 'http://')
        console.error(`\n   💡 Try using: ${httpUrl}`)
      }
    } else {
      console.error(`❌ Error: ${error.message}`)
    }
    process.exit(1)
  }
}

// Run bootstrap
bootstrap().catch((error) => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})

