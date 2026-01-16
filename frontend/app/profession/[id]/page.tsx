'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import {
  getProfession,
  getProfessionProgress,
  getCurrentTask,
  submitTaskAnswer,
  getFinalReport,
  restartProfession,
  getProgressHistory,
} from '@/lib/api'
import toast from 'react-hot-toast'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import LoadingProgress from '@/components/LoadingProgress'

interface Task {
  id: number
  order: number
  type: string
  time_limit_minutes: number
  question: string
}

export default function ProfessionPage() {
  const router = useRouter()
  const params = useParams()
  const professionId = parseInt(params.id as string)
  const { isAuthenticated, token, initAuth } = useAuthStore()
  const [task, setTask] = useState<Task | null>(null)
  const [answer, setAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [showFinalReport, setShowFinalReport] = useState(false)
  const [finalReport, setFinalReport] = useState<string>('')
  const [history, setHistory] = useState<any>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [loadingStage, setLoadingStage] = useState<'connecting' | 'generating' | 'finalizing'>('connecting')
  const [submitStage, setSubmitStage] = useState<'submitting' | 'analyzing' | 'processing'>('submitting')

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
      setLoadingStage('connecting')
      
      // Загружаем прогресс и историю
      const [professionProgress, historyData] = await Promise.all([
        getProfessionProgress(professionId),
        getProgressHistory(professionId),
      ])

      setProgress(professionProgress)
      setHistory(historyData)

      if (professionProgress.status === 'completed') {
        // Показываем финальный отчёт
        setLoadingStage('finalizing')
        const report = await getFinalReport(professionId)
        setFinalReport(report.final_report)
        setShowFinalReport(true)
        setIsLoading(false)
        return
      }

      // Загружаем текущее задание (самая долгая операция)
      setLoadingStage('generating')
      const currentTaskData = await getCurrentTask(professionId)

      setLoadingStage('finalizing')
      
      if (currentTaskData) {
        setTask(currentTaskData)
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

  const handleRestart = async () => {
    try {
      await restartProfession(professionId)
      toast.success('Начинаем новую попытку!')
      setShowFinalReport(false)
      setFinalReport('')
      await loadData()
    } catch (error: any) {
      toast.error('Ошибка при начале новой попытки')
    }
  }

  const handleSubmit = async () => {
    if (!answer.trim() || !task) return

    setIsSubmitting(true)
    try {
      setSubmitStage('submitting')
      
      // Небольшая задержка для показа первого этапа
      await new Promise(resolve => setTimeout(resolve, 300))
      
      setSubmitStage('analyzing')
      const result = await submitTaskAnswer(task.id, answer)
      
      setSubmitStage('processing')
      
      if (result.completed) {
        // Симуляция завершена - показываем финальный отчёт
        setFinalReport(result.final_report)
        setShowFinalReport(true)
        toast.success('Симуляция завершена!')
      } else if (result.next_task) {
        // Есть следующее задание
        setTask(result.next_task)
        setAnswer('')
        setTimeLeft(result.next_task.time_limit_minutes * 60)
        toast.success('Ответ принят! Следующее задание готово')
      } else {
        toast.success('Ответ отправлен!')
        loadData()
      }
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
          <div className="rounded-lg bg-white p-8 shadow-sm">
            <LoadingProgress stage={loadingStage} />
          </div>
        </main>
      </div>
    )
  }

  if (showFinalReport) {
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
          <div className="rounded-lg bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Финальный отчёт</h2>
              {history && history.total_attempts > 0 && (
                <span className="text-sm text-gray-600">
                  Попытка {history.total_attempts}
                </span>
              )}
            </div>
            
            <MarkdownRenderer content={finalReport} />
            
            <div className="mt-8 flex justify-center gap-4">
              <button
                onClick={handleRestart}
                className="rounded-md bg-primary-600 px-6 py-3 text-white hover:bg-primary-700"
              >
                Пройти заново
              </button>
              <Link
                href="/dashboard"
                className="rounded-md bg-gray-200 px-6 py-3 text-gray-700 hover:bg-gray-300"
              >
                Вернуться к профессиям
              </Link>
            </div>

            {history && history.total_attempts > 1 && (
              <div className="mt-8 border-t pt-8">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 text-gray-700 hover:text-primary-600"
                >
                  <span className="font-medium">История прохождений ({history.total_attempts})</span>
                  <svg
                    className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showHistory && (
                  <div className="mt-4 space-y-2">
                    {history.attempts.map((attempt: any) => (
                      <div
                        key={attempt.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <span className="font-medium">Попытка {attempt.attempt_number}</span>
                          {attempt.completed_at && (
                            <span className="ml-2 text-sm text-gray-500">
                              {new Date(attempt.completed_at).toLocaleDateString('ru-RU')}
                            </span>
                          )}
                        </div>
                        {attempt.status === 'completed' && attempt.attempt_number !== history.total_attempts && (
                          <button
                            onClick={async () => {
                              try {
                                const report = await getFinalReport(professionId, attempt.attempt_number)
                                setFinalReport(report.final_report)
                                toast.success(`Загружен отчет попытки ${attempt.attempt_number}`)
                              } catch (error) {
                                toast.error('Ошибка загрузки отчета')
                              }
                            }}
                            className="text-sm text-primary-600 hover:text-primary-700"
                          >
                            Смотреть отчет
                          </button>
                        )}
                        {attempt.attempt_number === history.total_attempts && (
                          <span className="text-sm text-green-600 font-medium">⭐ Текущая</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    )
  }

  if (!task) {
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
          <div className="rounded-lg bg-white p-8 shadow-sm text-center">
            <p className="text-gray-600">Задания не найдены</p>
          </div>
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
              <div className="text-sm font-medium text-gray-700">
                Время: {formatTime(timeLeft)}
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          {isSubmitting ? (
            <LoadingProgress stage={submitStage} />
          ) : (
            <div className="fade-in">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Задание №{task.order}
                  </h2>
                  <span className="rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-800">
                    {task.type}
                  </span>
                </div>
                <MarkdownRenderer content={task.question} />
              </div>

              <div className="mt-6">
                <label htmlFor="answer" className="block text-sm font-medium text-gray-700 mb-2">
                  Ваш ответ
                </label>
                <textarea
                  id="answer"
                  rows={10}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  placeholder="Введите ваш ответ..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSubmit}
                  disabled={!answer.trim()}
                  className="rounded-md bg-primary-600 px-6 py-3 text-white hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Отправить ответ
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
