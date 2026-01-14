import { create } from 'zustand'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  setAuth: (token: string) => void
  logout: () => void
  initAuth: () => void
}

// Вспомогательные функции для работы с токеном
const saveToken = (token: string) => {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('auth_token', token)
    sessionStorage.setItem('auth_token', token)
    // Также сохраняем в cookie как fallback
    document.cookie = `auth_token=${token}; path=/; max-age=${30 * 60}; SameSite=Lax`
    if (process.env.NODE_ENV === 'development') {
      console.log('Token saved successfully')
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to save token:', error)
    }
  }
}

const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  
  try {
    // Пробуем получить из localStorage
    let token = localStorage.getItem('auth_token')
    if (token) return token
    
    // Если не нашли, пробуем sessionStorage
    token = sessionStorage.getItem('auth_token')
    if (token) return token
    
    // Если и там нет, пробуем cookie
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === 'auth_token') return value
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to get token:', error)
    }
  }
  
  return null
}

const removeToken = () => {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem('auth_token')
    sessionStorage.removeItem('auth_token')
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to remove token:', error)
    }
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  isAuthenticated: false,
  
  initAuth: () => {
    const storedToken = getToken()
    if (storedToken) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Token loaded from storage')
      }
      set({ token: storedToken, isAuthenticated: true })
    }
  },
  
  setAuth: (token: string) => {
    saveToken(token)
    set({ token, isAuthenticated: true })
  },
  
  logout: () => {
    removeToken()
    set({ token: null, isAuthenticated: false })
  },
}))
