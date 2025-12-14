#!/usr/bin/env node

/**
 * Environment Validation Script
 * 
 * Validates .env configuration before build.
 * Run this in CI/CD or before deployment.
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const envPath = join(rootDir, '.env')

function loadEnv() {
  const env = {}
  if (!existsSync(envPath)) {
    return env
  }
  
  const content = readFileSync(envPath, 'utf-8')
  const lines = content.split('\n')
  
  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue
    const [key, ...valueParts] = line.split('=')
    const keyTrimmed = key.trim()
    const valueTrimmed = valueParts.join('=').trim()
    if (keyTrimmed.startsWith('VITE_')) {
      env[keyTrimmed] = valueTrimmed
    }
  }
  
  return env
}

function validateEnv(env, isProduction = false) {
  const errors = []
  const warnings = []
  
  // Required variables
  if (!env.VITE_API_BASE_URL) {
    errors.push('VITE_API_BASE_URL is required')
  } else {
    if (isProduction && env.VITE_API_BASE_URL.startsWith('/')) {
      errors.push('VITE_API_BASE_URL must be a full URL in production (e.g., https://api.example.com)')
    } else if (isProduction && !env.VITE_API_BASE_URL.startsWith('http')) {
      errors.push('VITE_API_BASE_URL must start with http:// or https:// in production')
    }
  }
  
  if (!env.VITE_API_KEY) {
    errors.push('VITE_API_KEY is required')
  } else if (env.VITE_API_KEY.length < 10) {
    warnings.push('VITE_API_KEY seems too short (should be at least 20 characters)')
  }
  
  if (!env.VITE_ODOO_DB) {
    errors.push('VITE_ODOO_DB is required')
  }
  
  if (!env.VITE_ALLOWED_SCOPES) {
    warnings.push('VITE_ALLOWED_SCOPES is not set (defaults to allow all)')
  }
  
  return { errors, warnings }
}

function main() {
  const isProduction = process.env.NODE_ENV === 'production' || 
                       process.argv.includes('--production')
  
  console.log(`🔍 Validating environment (${isProduction ? 'Production' : 'Development'})...\n`)
  
  const env = loadEnv()
  const { errors, warnings } = validateEnv(env, isProduction)
  
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:')
    warnings.forEach(w => console.log(`   ${w}`))
    console.log('')
  }
  
  if (errors.length > 0) {
    console.error('❌ Validation failed:')
    errors.forEach(e => console.error(`   ${e}`))
    console.error('\nRun: npm run setup-production')
    process.exit(1)
  }
  
  console.log('✅ Environment validation passed!\n')
  console.log('📝 Configuration:')
  console.log(`   API Base URL: ${env.VITE_API_BASE_URL}`)
  console.log(`   Database: ${env.VITE_ODOO_DB}`)
  console.log(`   Scopes: ${env.VITE_ALLOWED_SCOPES || 'all'}`)
  console.log('')
}

main()
