import { apiClient } from './apiClient'
import { AuthUser } from '../types'

export interface LoginPayload {
  email:    string
  password: string
}

export interface RegisterPayload {
  name:     string
  email:    string
  password: string
}

export interface AuthResponse {
  token: string
  user:  AuthUser
}

export const authService = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', payload)
    return data
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload)
    return data
  },

  async getMe(): Promise<AuthUser> {
    const { data } = await apiClient.get<{ user: AuthUser }>('/auth/me')
    return data.user
  },
}
