import { apiClient } from '@/api/client'
import { unwrapResponse } from '@/api/response'
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

export async function listThaiProvinces(params?: { search?: string }) {
  const response = await apiClient.post(
    '/th/v1/address/provinces',
    makeRpc({
      ...(params?.search ? { search: params.search } : {}),
    }),
  )
  return unwrapResponse<ThaiProvince[]>(response)
}

export async function listThaiDistricts(params: { provinceId?: number | null; search?: string }) {
  const response = await apiClient.post(
    '/th/v1/address/districts',
    makeRpc({
      ...(params.provinceId ? { provinceId: params.provinceId } : {}),
      ...(params.search ? { search: params.search } : {}),
    }),
  )
  return unwrapResponse<ThaiDistrict[]>(response)
}

export async function listThaiSubDistricts(params: { districtId?: number | null; search?: string }) {
  const response = await apiClient.post(
    '/th/v1/address/subdistricts',
    makeRpc({
      ...(params.districtId ? { districtId: params.districtId } : {}),
      ...(params.search ? { search: params.search } : {}),
    }),
  )
  return unwrapResponse<ThaiSubDistrict[]>(response)
}
