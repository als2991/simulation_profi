import { create } from 'zustand'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  setAuth: (token: string) => void
  logout: () => void
  initAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  isAuthenticated: false,
  
  initAuth: () => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('auth_token')
      if (storedToken) {
        set({ token: storedToken, isAuthenticated: true })
      }
    }
  },
  
  setAuth: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token)
      console.log('Token saved:', token)
    }
    set({ token, isAuthenticated: true })
  },
  
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
    }
    set({ token: null, isAuthenticated: false })
  },
}))
