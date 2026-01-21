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

export const getProgressHistory = async (professionId: number) => {
  const response = await api.get(`/api/professions/${professionId}/progress/history`)
  return response.data
}

export const getSpecificAttempt = async (professionId: number, attemptNumber: number) => {
  const response = await api.get(`/api/professions/${professionId}/progress/${attemptNumber}`)
  return response.data
}

export const restartProfession = async (professionId: number) => {
  const response = await api.post(`/api/professions/${professionId}/progress/restart`, {})
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

// Streaming Tasks
export interface StreamMessage {
  type: 'metadata' | 'token' | 'report_token' | 'done' | 'error' | 'completed'
  data: any
}

export const getCurrentTaskStream = async (
  professionId: number,
  onToken: (token: string) => void,
  onMetadata?: (metadata: any) => void,
  onDone?: (fullText: string, taskId: number) => void,
  onError?: (error: string) => void
) => {
  const token = getToken()
  if (!token) {
    throw new Error('No authentication token')
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  
  const response = await fetch(
    `${API_URL}/api/tasks/profession/${professionId}/current`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const message: StreamMessage = JSON.parse(line.slice(6))
            console.log('[SSE] Received message:', message.type, message.data)
            
            switch (message.type) {
              case 'metadata':
                console.log('[SSE] Calling onMetadata with:', message.data)
                onMetadata?.(message.data)
                break
              case 'token':
                console.log('[SSE] Calling onToken with token:', message.data.token)
                onToken(message.data.token)
                break
              case 'done':
                console.log('[SSE] Calling onDone with full_text length:', message.data.full_text?.length)
                onDone?.(message.data.full_text, message.data.task_id)
                break
              case 'error':
                console.log('[SSE] Calling onError with:', message.data.message)
                onError?.(message.data.message)
                break
            }
          } catch (e) {
            console.error('Error parsing SSE message:', e, 'Line:', line)
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export const submitTaskAnswerStream = async (
  taskId: number,
  answer: string,
  onToken: (token: string) => void,
  onMetadata?: (metadata: any) => void,
  onDone?: (data: any) => void,
  onCompleted?: (finalReport: string) => void,
  onError?: (error: string) => void
) => {
  const token = getToken()
  if (!token) {
    throw new Error('No authentication token')
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const response = await fetch(
    `${API_URL}/api/tasks/${taskId}/submit`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ answer }),
    }
  )

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const message: StreamMessage = JSON.parse(line.slice(6))
            console.log('[SSE SUBMIT] Received message:', message.type, message.data)
            
            switch (message.type) {
              case 'metadata':
                console.log('[SSE SUBMIT] Calling onMetadata with:', message.data)
                onMetadata?.(message.data)
                break
              case 'token':
                console.log('[SSE SUBMIT] Calling onToken with token:', message.data.token)
                onToken(message.data.token)
                break
              case 'report_token':
                console.log('[SSE SUBMIT] Calling onToken with report token:', message.data.token)
                onToken(message.data.token)  // Используем тот же callback для токенов отчета
                break
              case 'done':
                console.log('[SSE SUBMIT] Calling onDone with:', message.data)
                onDone?.(message.data)
                break
              case 'completed':
                console.log('[SSE SUBMIT] Calling onCompleted with report length:', message.data.final_report?.length)
                onCompleted?.(message.data.final_report)
                break
              case 'error':
                console.log('[SSE SUBMIT] Calling onError with:', message.data.message)
                onError?.(message.data.message)
                break
            }
          } catch (e) {
            console.error('Error parsing SSE message:', e, 'Line:', line)
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export const getFinalReport = async (professionId: number, attemptNumber?: number) => {
  const params = attemptNumber ? { attempt_number: attemptNumber } : {}
  const response = await api.get(`/api/tasks/profession/${professionId}/report`, { params })
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
