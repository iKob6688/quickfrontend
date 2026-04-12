import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

const rawDir = path.join(repoRoot, 'shared', 'th-address', 'raw')
const generatedDir = path.join(repoRoot, 'shared', 'th-address', 'generated')
const publicDir = path.join(repoRoot, 'public', 'th-address')
const odooDataDir =
  '/Users/ikob/Documents/iKobDoc/Active22/V18/odoo/adtv18/adt_th_localization/data/thai_address'

function normalizeThaiName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
}

function stripThaiPrefix(value) {
  return normalizeThaiName(value).replace(
    /^(จังหวัด|จ\.|เขต|อำเภอ|อ\.|แขวง|ตำบล|ต\.)+/u,
    '',
  )
}

function withSearchAliases(name) {
  return {
    search_name: normalizeThaiName(name),
    search_name_no_prefix: stripThaiPrefix(name),
  }
}

async function readJson(name) {
  const raw = await fs.readFile(path.join(rawDir, name), 'utf8')
  return JSON.parse(raw)
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true })
}

async function writeJson(target, value) {
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function main() {
  await ensureDir(generatedDir)
  await ensureDir(publicDir)

  const [provinces, districts, subDistricts] = await Promise.all([
    readJson('provinces.json'),
    readJson('districts.json'),
    readJson('sub_districts.json'),
  ])

  const normalizedProvinces = provinces.map((item) => ({
    id: item.id,
    code: String(item.id),
    name_th: item.name_th,
    name_en: item.name_en || null,
    state_name: item.name_th,
    geography_id: item.geography_id ?? null,
    ...withSearchAliases(item.name_th),
  }))

  const normalizedDistricts = districts.map((item) => ({
    id: item.id,
    province_id: item.province_id,
    code: String(item.id),
    name_th: item.name_th,
    name_en: item.name_en || null,
    ...withSearchAliases(item.name_th),
  }))

  const districtProvinceMap = new Map(normalizedDistricts.map((item) => [item.id, item.province_id]))
  const normalizedSubDistricts = subDistricts.map((item) => ({
    id: item.id,
    district_id: item.district_id,
    province_id: districtProvinceMap.get(item.district_id) ?? null,
    code: String(item.id),
    name_th: item.name_th,
    name_en: item.name_en || null,
    zip_code: item.zip_code ? String(item.zip_code) : null,
    ...withSearchAliases(item.name_th),
  }))

  const normalizedZipCodes = normalizedSubDistricts.map((item) => ({
    subdistrict_id: item.id,
    district_id: item.district_id,
    province_id: item.province_id,
    zip_code: item.zip_code,
  }))

  await writeJson(path.join(rawDir, 'zipcodes.json'), normalizedZipCodes)

  const metadata = {
    source: 'Cerberus/Thailand-Address via adt_th_localization seed',
    generated_at: new Date().toISOString(),
    counts: {
      provinces: normalizedProvinces.length,
      districts: normalizedDistricts.length,
      subdistricts: normalizedSubDistricts.length,
    },
  }

  await Promise.all([
    writeJson(path.join(generatedDir, 'provinces.json'), normalizedProvinces),
    writeJson(path.join(generatedDir, 'districts.json'), normalizedDistricts),
    writeJson(path.join(generatedDir, 'subdistricts.json'), normalizedSubDistricts),
    writeJson(path.join(generatedDir, 'zipcodes.json'), normalizedZipCodes),
    writeJson(path.join(generatedDir, 'metadata.json'), metadata),
    writeJson(path.join(publicDir, 'provinces.json'), normalizedProvinces),
    writeJson(path.join(publicDir, 'districts.json'), normalizedDistricts),
    writeJson(path.join(publicDir, 'subdistricts.json'), normalizedSubDistricts),
    writeJson(path.join(publicDir, 'zipcodes.json'), normalizedZipCodes),
    writeJson(path.join(publicDir, 'metadata.json'), metadata),
  ])

  const odooCopies = [
    ['provinces.json', path.join(rawDir, 'provinces.json')],
    ['districts.json', path.join(rawDir, 'districts.json')],
    ['sub_districts.json', path.join(rawDir, 'sub_districts.json')],
  ]

  try {
    await ensureDir(odooDataDir)
    await Promise.all(
      odooCopies.map(async ([name, sourcePath]) => {
        const raw = await fs.readFile(sourcePath, 'utf8')
        await fs.writeFile(path.join(odooDataDir, name), raw, 'utf8')
      }),
    )
  } catch (error) {
    console.warn('[sync-th-address] Skipped Odoo sync:', error instanceof Error ? error.message : String(error))
  }

  console.log(JSON.stringify(metadata, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
