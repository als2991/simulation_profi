import { create } from 'zustand'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  setAuth: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => {
  // Загружаем токен из localStorage при инициализации
  if (typeof window !== 'undefined') {
    const storedToken = localStorage.getItem('auth_token')
    if (storedToken) {
      return {
        token: storedToken,
        isAuthenticated: true,
        setAuth: (token: string) => {
          localStorage.setItem('auth_token', token)
          set({ token, isAuthenticated: true })
        },
        logout: () => {
          localStorage.removeItem('auth_token')
          set({ token: null, isAuthenticated: false })
        },
      }
    }
  }

  return {
    token: null,
    isAuthenticated: false,
    setAuth: (token: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', token)
      }
      set({ token, isAuthenticated: true })
    },
    logout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token')
      }
      set({ token: null, isAuthenticated: false })
    },
  }
})
