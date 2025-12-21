#!/usr/bin/env node
/**
 * Update nginx snippet that controls the Odoo DB used by /api proxying.
 *
 * Default target: /etc/nginx/snippets/qacc_api_db.conf
 * Default variable: $odoo_api_db
 *
 * Usage:
 *   sudo node scripts/set-api-db.js --db q01
 *   sudo node scripts/set-api-db.js --db q02 --snippet /etc/nginx/snippets/qacc_api_db.conf --reload
 *   node scripts/set-api-db.js --print --snippet /etc/nginx/snippets/qacc_api_db.conf
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
  // nginx + odoo db_name: allow alnum, _, -, .
  // (be strict to avoid config injection)
  if (!/^[A-Za-z0-9_.-]+$/.test(db)) {
    throw new Error(`Invalid db name: "${db}". Allowed: A-Z a-z 0-9 _ . -`)
  }
}

function usage() {
  return [
    'set-api-db: update nginx snippet db variable',
    '',
    'Required:',
    '  --db <name>           Database name, e.g. q01',
    '',
    'Optional:',
    '  --snippet <path>      nginx snippet path (default: /etc/nginx/snippets/qacc_api_db.conf)',
    '  --var <name>          nginx variable name (default: odoo_api_db)',
    '  --print               Print current snippet and exit',
    '  --dry-run             Print the new snippet, do not write',
    '  --reload              Run: nginx -t && systemctl reload nginx',
    '',
    'Examples:',
    '  sudo npm run set-api-db -- --db q01 --reload',
    '  sudo node scripts/set-api-db.js --db q02 --snippet /etc/nginx/snippets/qacc_api_db.conf --reload',
    '  node scripts/set-api-db.js --print',
    '',
  ].join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const snippet = args.snippet || '/etc/nginx/snippets/qacc_api_db.conf'
  const varName = args.var || 'odoo_api_db'

  if (args.help || args.h) {
    process.stdout.write(usage())
    process.exit(0)
  }

  if (args.print) {
    const text = await fs.readFile(snippet, 'utf8')
    process.stdout.write(text)
    process.exit(0)
  }

  const db = args.db
  if (!db) {
    process.stderr.write(usage())
    process.exit(2)
  }
  assertDbName(db)

  const contents = `set $${varName} ${db};\n`

  if (args['dry-run']) {
    process.stdout.write(contents)
    process.exit(0)
  }

  await fs.writeFile(snippet, contents, 'utf8')
  process.stdout.write(`OK: wrote ${snippet}: ${contents}`)

  if (args.reload) {
    execSync('nginx -t', { stdio: 'inherit' })
    execSync('systemctl reload nginx', { stdio: 'inherit' })
    process.stdout.write('OK: nginx reloaded\n')
  }
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${(err && err.message) || String(err)}\n`)
  process.exit(1)
})

