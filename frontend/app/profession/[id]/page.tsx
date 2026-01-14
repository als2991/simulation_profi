'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import {
  getProfession,
  getProfessionProgress,
  getCurrentTask,
  generateTaskContent,
  submitTaskAnswer,
  getFinalReport,
} from '@/lib/api'
import toast from 'react-hot-toast'

interface Task {
  id: number
  description_template: string
  order: number
  type: string
  time_limit_minutes: number
}

export default function ProfessionPage() {
  const router = useRouter()
  const params = useParams()
  const professionId = parseInt(params.id as string)
  const { isAuthenticated, token, initAuth } = useAuthStore()
  const [task, setTask] = useState<Task | null>(null)
  const [taskDescription, setTaskDescription] = useState<string>('')
  const [answer, setAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Инициализируем токен из storage при загрузке страницы
  useEffect(() => {
    initAuth()
  }, [initAuth])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    loadData()
  }, [isAuthenticated, router, professionId])

  useEffect(() => {
    if (timeLeft !== null && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [timeLeft])

  const loadData = async () => {
    try {
      const [professionProgress, currentTaskData] = await Promise.all([
        getProfessionProgress(professionId),
        getCurrentTask(professionId),
      ])

      setProgress(professionProgress)

      if (professionProgress.status === 'completed') {
        // Показываем финальный отчёт
        const report = await getFinalReport(professionId)
        setResult(report)
        setShowResult(true)
        setIsLoading(false)
        return
      }

      if (currentTaskData) {
        setTask(currentTaskData)
        // Генерируем конкретное задание
        const generated = await generateTaskContent(currentTaskData.id)
        setTaskDescription(generated.task_description)
        setTimeLeft(currentTaskData.time_limit_minutes * 60)
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.error('Задания не найдены или профессия не куплена')
        router.push('/dashboard')
      } else {
        toast.error('Ошибка при загрузке задания')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!answer.trim() || !task) return

    setIsSubmitting(true)
    try {
      const result = await submitTaskAnswer(task.id, answer)
      setResult(result)
      setShowResult(true)
      toast.success('Ответ отправлен!')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Ошибка при отправке ответа')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Загрузка...</p>
      </div>
    )
  }

  if (showResult && result) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <Link href="/dashboard" className="text-primary-600 hover:text-primary-700">
                ← Назад к профессиям
              </Link>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {progress?.status === 'completed' ? (
            <div className="rounded-lg bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Финальный отчёт</h2>
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap text-gray-700">
                  {result.final_report}
                </p>
              </div>
              {result.overall_metrics && (
                <div className="mt-8">
                  <h3 className="text-xl font-semibold mb-4">Общие метрики</h3>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    {Object.entries(result.overall_metrics).map(([key, value]: [string, any]) => (
                      <div key={key} className="rounded-lg bg-gray-50 p-4">
                        <div className="text-sm text-gray-600 capitalize">{key}</div>
                        <div className="text-2xl font-bold text-primary-600">
                          {value.toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Результат задания</h2>
              {result.ai_feedback && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-2">Обратная связь</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{result.ai_feedback}</p>
                </div>
              )}
              {result.ai_metrics && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Метрики</h3>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    {Object.entries(result.ai_metrics).map(([key, value]: [string, any]) => (
                      <div key={key} className="rounded-lg bg-gray-50 p-4">
                        <div className="text-sm text-gray-600 capitalize">{key}</div>
                        <div className="text-2xl font-bold text-primary-600">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  setShowResult(false)
                  setResult(null)
                  setAnswer('')
                  loadData()
                }}
                className="mt-6 rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
              >
                Следующее задание
              </button>
            </div>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/dashboard" className="text-primary-600 hover:text-primary-700">
              ← Назад к профессиям
            </Link>
            {timeLeft !== null && (
              <div className="text-lg font-semibold text-gray-900">
                Осталось: {formatTime(timeLeft)}
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="mb-4">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
              Задание {task?.order}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Задание</h2>
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <p className="text-gray-700 whitespace-pre-wrap">{taskDescription}</p>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ваш ответ</h3>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
            placeholder="Введите ваш ответ здесь..."
          />
          <button
            onClick={handleSubmit}
            disabled={!answer.trim() || isSubmitting}
            className="mt-4 rounded-md bg-primary-600 px-6 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Отправка...' : 'Отправить ответ'}
          </button>
        </div>
      </main>
    </div>
  )
}
