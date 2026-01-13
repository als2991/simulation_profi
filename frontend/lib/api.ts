import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

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
export const getProfessions = async (token: string) => {
  const response = await api.get('/api/professions/', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const getProfession = async (id: number, token: string) => {
  const response = await api.get(`/api/professions/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const getProfessionProgress = async (professionId: number, token: string) => {
  const response = await api.get(`/api/professions/${professionId}/progress`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// Tasks
export const getCurrentTask = async (professionId: number, token: string) => {
  try {
    const response = await api.get(`/api/tasks/profession/${professionId}/current`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.data
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null
    }
    throw error
  }
}

export const generateTaskContent = async (taskId: number, token: string) => {
  const response = await api.post(`/api/tasks/${taskId}/generate`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const submitTaskAnswer = async (taskId: number, answer: string, token: string) => {
  const response = await api.post(
    `/api/tasks/${taskId}/submit`,
    { answer },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  return response.data
}

export const getFinalReport = async (professionId: number, token: string) => {
  const response = await api.get(`/api/tasks/profession/${professionId}/report`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// User
export const getUserProgress = async (token: string) => {
  const response = await api.get('/api/users/progress', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

// Payments
export const getPackages = async (token: string) => {
  const response = await api.get('/api/payments/packages', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const createPayment = async (
  professionId: number | null,
  packageId: number | null,
  promocode: string | null,
  token: string
) => {
  const response = await api.post(
    '/api/payments/create',
    { profession_id: professionId, package_id: packageId, promocode },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  return response.data
}

export const getPaymentHistory = async (token: string) => {
  const response = await api.get('/api/payments/history', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}
