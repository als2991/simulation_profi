import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Функция для получения токена
const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  
  // Пробуем localStorage
  let token = localStorage.getItem('auth_token')
  if (token) return token
  
  // Пробуем sessionStorage
  token = sessionStorage.getItem('auth_token')
  if (token) return token
  
  // Пробуем cookie
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === 'auth_token') return value
  }
  
  return null
}

// Интерцептор для добавления токена к запросам
api.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      if (process.env.NODE_ENV === 'development') {
        console.log('Token added to request:', token.substring(0, 20) + '...')
      }
    } else if (process.env.NODE_ENV === 'development') {
      console.warn('No token found for request')
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Auth
export const login = async (email: string, password: string) => {
  const response = await api.post('/api/auth/login', { email, password })
  return response.data
}

export const register = async (email: string, password: string) => {
  const response = await api.post('/api/auth/register', { email, password })
  return response.data
}

// Professions
export const getProfessions = async () => {
  const response = await api.get('/api/professions/')
  return response.data
}

export const getProfession = async (id: number) => {
  const response = await api.get(`/api/professions/${id}`)
  return response.data
}

export const getProfessionProgress = async (professionId: number) => {
  const response = await api.get(`/api/professions/${professionId}/progress`)
  return response.data
}

// Tasks
export const getCurrentTask = async (professionId: number) => {
  try {
    const response = await api.get(`/api/tasks/profession/${professionId}/current`)
    return response.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null
    }
    throw error
  }
}

export const submitTaskAnswer = async (taskId: number, answer: string) => {
  const response = await api.post(`/api/tasks/${taskId}/submit`, { answer })
  return response.data
}

export const getFinalReport = async (professionId: number) => {
  const response = await api.get(`/api/tasks/profession/${professionId}/report`)
  return response.data
}

// User
export const getUserProgress = async () => {
  const response = await api.get('/api/users/progress')
  return response.data
}

// Payments
export const getPackages = async () => {
  const response = await api.get('/api/payments/packages')
  return response.data
}

export const createPayment = async (
  professionId: number | null,
  packageId: number | null,
  promocode: string | null
) => {
  const response = await api.post('/api/payments/create', {
    profession_id: professionId,
    package_id: packageId,
    promocode,
  })
  return response.data
}

export const getPaymentHistory = async () => {
  const response = await api.get('/api/payments/history')
  return response.data
}
