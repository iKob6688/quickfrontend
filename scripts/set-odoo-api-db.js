#!/usr/bin/env node
/**
 * Update Odoo API instance db pinning in /etc/odoo18-api.conf (or another file).
 *
 * This is the “production-grade” way when your /api nginx proxy points to a
 * dedicated Odoo API instance: change db_name/dbfilter and restart service.
 *
 * Usage:
 *   sudo node scripts/set-odoo-api-db.js --db q01
 *   sudo node scripts/set-odoo-api-db.js --db q02 --config /etc/odoo18-api.conf --service odoo18-api
 *   node scripts/set-odoo-api-db.js --print --config /etc/odoo18-api.conf
 */

import fs from 'node:fs/promises'
import { execSync } from 'node:child_process'

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      args._.push(a)
      continue
    }
    const [k, v] = a.split('=', 2)
    const key = k.slice(2)
    if (v !== undefined) {
      args[key] = v
      continue
    }
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      args[key] = next
      i++
    } else {
      args[key] = true
    }
  }
  return args
}

function assertDbName(db) {
  if (!/^[A-Za-z0-9_.-]+$/.test(db)) {
    throw new Error(`Invalid db name: "${db}". Allowed: A-Z a-z 0-9 _ . -`)
  }
}

function usage() {
  return [
    'set-odoo-api-db: pin Odoo API instance to a DB',
    '',
    'Required:',
    '  --db <name>           Database name, e.g. q01',
    '',
    'Optional:',
    '  --config <path>       Odoo conf path (default: /etc/odoo18-api.conf)',
    '  --service <name>      systemd service to restart (default: odoo18-api)',
    '  --print               Print current db_name/dbfilter and exit',
    '  --dry-run             Print changes, do not write',
    '  --restart             Restart service after write (default: true)',
    '',
    'Examples:',
    '  sudo npm run set-odoo-api-db -- --db q01',
    '  sudo node scripts/set-odoo-api-db.js --db q02 --config /etc/odoo18-api.conf --service odoo18-api',
    '',
  ].join('\n')
}

function upsertKey(lines, key, value) {
  const re = new RegExp(`^\\s*${key}\\s*=`)
  let replaced = false
  const out = lines.map((line) => {
    if (re.test(line)) {
      replaced = true
      return `${key} = ${value}`
    }
    return line
  })
  if (!replaced) {
    // place near end of [options], before first empty line at file end
    out.push(`${key} = ${value}`)
  }
  return out
}

function readPinned(lines) {
  const get = (k) => {
    const re = new RegExp(`^\\s*${k}\\s*=\\s*(.*)\\s*$`)
    for (const line of lines) {
      const m = line.match(re)
      if (m) return m[1]
    }
    return null
  }
  return { db_name: get('db_name'), dbfilter: get('dbfilter') }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const config = args.config || '/etc/odoo18-api.conf'
  const service = args.service || 'odoo18-api'
  const shouldRestart = args.restart !== false && args.restart !== 'false'

  if (args.help || args.h) {
    process.stdout.write(usage())
    process.exit(0)
  }

  const raw = await fs.readFile(config, 'utf8')
  const lines = raw.split(/\r?\n/)

  if (args.print) {
    const pinned = readPinned(lines)
    process.stdout.write(JSON.stringify({ config, ...pinned }, null, 2) + '\n')
    process.exit(0)
  }

  const db = args.db
  if (!db) {
    process.stderr.write(usage())
    process.exit(2)
  }
  assertDbName(db)

  // Ensure configparser sees [options] once.
  const hasOptions = lines.some((l) => l.trim() === '[options]')
  if (!hasOptions) {
    lines.unshift('[options]')
    lines.unshift('')
  }

  let next = [...lines]
  next = upsertKey(next, 'db_name', db)
  next = upsertKey(next, 'dbfilter', `^${db}$`)

  const out = next.join('\n')

  if (args['dry-run']) {
    process.stdout.write(out)
    process.exit(0)
  }

  await fs.writeFile(config, out, 'utf8')
  process.stdout.write(`OK: updated ${config}: db_name=${db}, dbfilter=^${db}$\n`)

  if (shouldRestart) {
    execSync(`systemctl restart ${service}`, { stdio: 'inherit' })
    process.stdout.write(`OK: restarted ${service}\n`)
  }
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${(err && err.message) || String(err)}\n`)
  process.exit(1)
})

