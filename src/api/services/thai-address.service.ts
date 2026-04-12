import { apiClient } from '@/api/client'
import { toApiError, unwrapResponse } from '@/api/response'
import { makeRpc } from '@/api/services/rpc'

export interface ThaiProvince {
  id: number
  name: string
  nameTh?: string | null
  nameEn?: string | null
  stateId?: number | null
}

export interface ThaiDistrict {
  id: number
  name: string
  nameTh?: string | null
  nameEn?: string | null
  provinceId: number
}

export interface ThaiSubDistrict {
  id: number
  name: string
  nameTh?: string | null
  nameEn?: string | null
  districtId: number
  provinceId?: number | null
  zipCode?: string | null
}

interface LocalProvinceRow {
  id: number
  code?: string | null
  name_th: string
  name_en?: string | null
  state_name?: string | null
  search_name?: string | null
  search_name_no_prefix?: string | null
}

interface LocalDistrictRow {
  id: number
  province_id: number
  name_th: string
  name_en?: string | null
  search_name?: string | null
  search_name_no_prefix?: string | null
}

interface LocalSubDistrictRow {
  id: number
  district_id: number
  province_id?: number | null
  name_th: string
  name_en?: string | null
  zip_code?: string | null
  search_name?: string | null
  search_name_no_prefix?: string | null
}

interface ResolveThaiAddressParams {
  provinceId?: number | null
  districtId?: number | null
  provinceName?: string | null
  districtName?: string | null
  subDistrictName?: string | null
  zipCode?: string | null
}

export interface ResolvedThaiAddress {
  province?: ThaiProvince | null
  district?: ThaiDistrict | null
  subDistrict?: ThaiSubDistrict | null
  zipCode?: string | null
}

const prefixPattern = /^(จังหวัด|จ\.|เขต|อำเภอ|อ\.|แขวง|ตำบล|ต\.)+/u

function normalizeThaiSearch(value?: string | null) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
}

function stripThaiPrefix(value?: string | null) {
  return normalizeThaiSearch(value).replace(prefixPattern, '')
}

function matchesSearch(targets: Array<string | null | undefined>, search?: string | null) {
  if (!search) return true
  const normalized = normalizeThaiSearch(search)
  const noPrefix = stripThaiPrefix(search)
  return targets.some((target) => {
    const current = normalizeThaiSearch(target)
    return current.includes(normalized) || stripThaiPrefix(target).includes(noPrefix)
  })
}

function shouldFallbackToLocal(error: unknown) {
  const apiError = toApiError(error)
  const status = apiError.status
  if (!status) return true
  return status >= 500 || status === 404 || status === 401 || status === 403
}

const localCache: Partial<{
  provinces: LocalProvinceRow[]
  districts: LocalDistrictRow[]
  subdistricts: LocalSubDistrictRow[]
}> = {}

async function loadLocalJson<T>(key: keyof typeof localCache, fileName: string): Promise<T[]> {
  if (localCache[key]) return localCache[key] as T[]
  const response = await fetch(`/th-address/${fileName}`, { cache: 'force-cache' })
  if (!response.ok) {
    throw new Error(`Failed to load local Thai address dataset: ${fileName}`)
  }
  const data = (await response.json()) as T[]
  localCache[key] = data as never
  return data
}

function mapProvince(item: LocalProvinceRow): ThaiProvince {
  return {
    id: item.id,
    name: item.name_th,
    nameTh: item.name_th,
    nameEn: item.name_en || null,
    stateId: null,
  }
}

function mapDistrict(item: LocalDistrictRow): ThaiDistrict {
  return {
    id: item.id,
    name: item.name_th,
    nameTh: item.name_th,
    nameEn: item.name_en || null,
    provinceId: item.province_id,
  }
}

function mapSubDistrict(item: LocalSubDistrictRow): ThaiSubDistrict {
  return {
    id: item.id,
    name: item.name_th,
    nameTh: item.name_th,
    nameEn: item.name_en || null,
    districtId: item.district_id,
    provinceId: item.province_id ?? null,
    zipCode: item.zip_code || null,
  }
}

function normalizeProvince(item: ThaiProvince): ThaiProvince {
  const nameTh = item.nameTh || item.name || item.nameEn || ''
  return {
    ...item,
    name: nameTh,
    nameTh,
    nameEn: item.nameEn || item.name || null,
  }
}

function normalizeDistrict(item: ThaiDistrict): ThaiDistrict {
  const nameTh = item.nameTh || item.name || item.nameEn || ''
  return {
    ...item,
    name: nameTh,
    nameTh,
    nameEn: item.nameEn || item.name || null,
  }
}

function normalizeSubDistrict(item: ThaiSubDistrict): ThaiSubDistrict {
  const nameTh = item.nameTh || item.name || item.nameEn || ''
  return {
    ...item,
    name: nameTh,
    nameTh,
    nameEn: item.nameEn || item.name || null,
  }
}

async function fetchThaiAddressApi<T>(paths: string[], payload: Record<string, unknown>) {
  let lastError: unknown = null
  for (const path of paths) {
    try {
      const response = await apiClient.post(path, makeRpc(payload))
      return unwrapResponse<T>(response)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Thai address API failed')
}

export async function listThaiProvinces(params?: { search?: string }) {
  const payload = {
    ...(params?.search ? { search: params.search } : {}),
  }
  try {
    const items = await fetchThaiAddressApi<ThaiProvince[]>(
      ['/th/v1/address/provinces', '/web/adt/th/v1/address/provinces'],
      payload,
    )
    if (items.length > 0) return items.map(normalizeProvince)
  } catch (error) {
    if (!shouldFallbackToLocal(error)) throw error
  }
  const items = await loadLocalJson<LocalProvinceRow>('provinces', 'provinces.json')
  return items
    .filter((item) =>
      matchesSearch(
        [item.name_th, item.name_en, item.search_name, item.search_name_no_prefix],
        params?.search,
      ),
    )
    .map(mapProvince)
}

export async function listThaiDistricts(params: { provinceId?: number | null; search?: string }) {
  const payload = {
    ...(params.provinceId ? { provinceId: params.provinceId } : {}),
    ...(params.search ? { search: params.search } : {}),
  }
  try {
    const items = await fetchThaiAddressApi<ThaiDistrict[]>(
      ['/th/v1/address/districts', '/web/adt/th/v1/address/districts'],
      payload,
    )
    if (items.length > 0 || !params.provinceId) return items.map(normalizeDistrict)
  } catch (error) {
    if (!shouldFallbackToLocal(error)) throw error
  }
  const items = await loadLocalJson<LocalDistrictRow>('districts', 'districts.json')
  return items
    .filter((item) => (params.provinceId ? item.province_id === params.provinceId : true))
    .filter((item) =>
      matchesSearch(
        [item.name_th, item.name_en, item.search_name, item.search_name_no_prefix],
        params.search,
      ),
    )
    .map(mapDistrict)
}

export async function listThaiSubDistricts(params: { districtId?: number | null; provinceId?: number | null; search?: string }) {
  const payload = {
    ...(params.districtId ? { districtId: params.districtId } : {}),
    ...(params.provinceId ? { provinceId: params.provinceId } : {}),
    ...(params.search ? { search: params.search } : {}),
  }
  try {
    const items = await fetchThaiAddressApi<ThaiSubDistrict[]>(
      ['/th/v1/address/subdistricts', '/web/adt/th/v1/address/subdistricts'],
      payload,
    )
    if (items.length > 0 || (!params.districtId && !params.provinceId)) return items.map(normalizeSubDistrict)
  } catch (error) {
    if (!shouldFallbackToLocal(error)) throw error
  }
  const items = await loadLocalJson<LocalSubDistrictRow>('subdistricts', 'subdistricts.json')
  return items
    .filter((item) => (params.districtId ? item.district_id === params.districtId : true))
    .filter((item) => (params.provinceId ? item.province_id === params.provinceId : true))
    .filter((item) =>
      matchesSearch(
        [item.name_th, item.name_en, item.search_name, item.search_name_no_prefix, item.zip_code],
        params.search,
      ),
    )
    .map(mapSubDistrict)
}

export async function resolveThaiAddress(params: ResolveThaiAddressParams): Promise<ResolvedThaiAddress> {
  try {
    const resolved = await fetchThaiAddressApi<ResolvedThaiAddress>(
      ['/th/v1/address/resolve', '/web/adt/th/v1/address/resolve'],
      {
        provinceId: params.provinceId || undefined,
        provinceName: params.provinceName || undefined,
        districtId: params.districtId || undefined,
        districtName: params.districtName || undefined,
        subDistrictName: params.subDistrictName || undefined,
        zipCode: params.zipCode || undefined,
      },
    )
    return {
      province: resolved.province ? normalizeProvince(resolved.province) : null,
      district: resolved.district ? normalizeDistrict(resolved.district) : null,
      subDistrict: resolved.subDistrict ? normalizeSubDistrict(resolved.subDistrict) : null,
      zipCode: resolved.zipCode || null,
    }
  } catch (error) {
    if (!shouldFallbackToLocal(error)) throw error
  }

  const [provinces, districts, subDistricts] = await Promise.all([
    listThaiProvinces(),
    listThaiDistricts({}),
    listThaiSubDistricts({}),
  ])

  const province =
    provinces.find((item) => item.id === params.provinceId) ||
    provinces.find((item) => matchesSearch([item.name, item.nameTh, item.nameEn], params.provinceName)) ||
    null
  const district =
    districts.find(
      (item) =>
        (!params.districtId || item.id === params.districtId) &&
        (!province || item.provinceId === province.id) &&
        matchesSearch([item.name, item.nameTh, item.nameEn], params.districtName),
    ) || null
  const subDistrict =
    subDistricts.find(
      (item) =>
        (!district || item.districtId === district.id) &&
        (!province || item.provinceId === province.id) &&
        (!params.zipCode || item.zipCode === params.zipCode) &&
        matchesSearch([item.name, item.nameTh, item.nameEn], params.subDistrictName),
    ) || null

  return {
    province,
    district,
    subDistrict,
    zipCode: subDistrict?.zipCode || params.zipCode || null,
  }
}
