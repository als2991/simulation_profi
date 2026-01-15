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
} from '@/lib/api'
import toast from 'react-hot-toast'
import MarkdownRenderer from '@/components/MarkdownRenderer'

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
        setFinalReport(report.final_report)
        setShowFinalReport(true)
        setIsLoading(false)
        return
      }

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

  const handleSubmit = async () => {
    if (!answer.trim() || !task) return

    setIsSubmitting(true)
    try {
      const result = await submitTaskAnswer(task.id, answer)
      
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
        toast.success('Ответ отправлен! Следующее задание...')
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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Загрузка...</p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Финальный отчёт</h2>
            <MarkdownRenderer content={finalReport} />
            <div className="mt-8 flex justify-center">
              <Link
                href="/dashboard"
                className="rounded-md bg-primary-600 px-6 py-3 text-white hover:bg-primary-700"
              >
                Вернуться к профессиям
              </Link>
            </div>
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
              disabled={isSubmitting}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || isSubmitting}
              className="rounded-md bg-primary-600 px-6 py-3 text-white hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Отправка...' : 'Отправить ответ'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
