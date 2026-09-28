import axios from 'axios'
import type { User } from './types'

export const api = axios.create({ baseURL: '/api' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('skilltree_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.message || '请求失败，请稍后重试'
  return '发生了未知错误'
}

export async function authenticate(path: 'login' | 'register', input: Record<string, string>) {
  const { data } = await api.post<{ token: string; user: User }>(`/auth/${path}`, input)
  localStorage.setItem('skilltree_token', data.token)
  return data.user
}
