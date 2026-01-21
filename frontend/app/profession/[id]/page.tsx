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
  getCurrentTaskStream,
  submitTaskAnswerStream,
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

const MAX_ATTEMPTS = 3 // Максимальное количество попыток

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
  const [viewingAttemptNumber, setViewingAttemptNumber] = useState<number | null>(null)

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
      
      // Устанавливаем просматриваемую попытку на последнюю
      if (historyData && historyData.total_attempts > 0) {
        setViewingAttemptNumber(historyData.total_attempts)
      }

      if (professionProgress.status === 'completed') {
        // Показываем финальный отчёт
        setLoadingStage('finalizing')
        const report = await getFinalReport(professionId)
        setFinalReport(report.final_report)
        setShowFinalReport(true)
        setIsLoading(false)
        return
      }

      // Загружаем текущее задание (streaming для моментального отклика)
      setLoadingStage('generating')
      
      let taskMetadata: any = null
      let fullQuestion = ''
      let firstTokenReceived = false
      
      await getCurrentTaskStream(
        professionId,
        // onToken - получаем токены по мере генерации
        (token) => {
          // При первом токене СРАЗУ скрываем прогресс-бар и показываем UI!
          if (!firstTokenReceived) {
            firstTokenReceived = true
            console.log('[LOAD] First token received! Hiding loading indicator.')
            setIsLoading(false) // ← Убираем прогресс-бар сразу!
          }
          
          fullQuestion += token
          // Обновляем задание с частичным текстом для плавного отображения (как ChatGPT)
          if (taskMetadata) {
            setTask({
              ...taskMetadata,
              question: fullQuestion
            })
          }
        },
        // onMetadata - получаем метаданные задания
        (metadata) => {
          console.log('[LOAD] Metadata received:', metadata)
          taskMetadata = {
            id: metadata.id,
            order: metadata.order,
            type: metadata.task_type,
            time_limit_minutes: metadata.time_limit_minutes,
            question: ''
          }
          setTask(taskMetadata)
          setTimeLeft(metadata.time_limit_minutes * 60)
          
          // НЕ скрываем прогресс-бар здесь!
          // Будет скрыт при первом токене (onToken)
          // Или при done (для кешированных вопросов)
          console.log('[LOAD] Metadata processed, waiting for tokens...')
        },
        // onDone - генерация завершена
        (fullText, taskId) => {
          console.log('[LOAD] Done received, hiding loading indicator')
          setIsLoading(false) // Скрываем прогресс-бар (для кешированных вопросов)
          
          if (taskMetadata) {
            setTask({
              ...taskMetadata,
              question: fullText
            })
          }
          toast.success('Задание загружено!')
        },
        // onError
        (error) => {
          toast.error(`Ошибка: ${error}`)
          setIsLoading(false)
        }
      )
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.error('Задания не найдены или профессия не куплена')
        router.push('/dashboard')
      } else {
        toast.error('Ошибка при загрузке задания')
      }
      setIsLoading(false)
    }
  }

  const handleRestart = async () => {
    try {
      await restartProfession(professionId)
      toast.success('Начинаем новую попытку!')
      setShowFinalReport(false)
      setFinalReport('')
      setIsLoading(true)
      setLoadingStage('connecting')
      await loadData()
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Ошибка при начале новой попытки'
      toast.error(message)
      // При ошибке перезагружаем данные для обновления UI
      await loadData()
    }
  }

  const handleViewAttempt = async (attemptNumber: number) => {
    try {
      const report = await getFinalReport(professionId, attemptNumber)
      setFinalReport(report.final_report)
      setViewingAttemptNumber(attemptNumber)
      toast.success(`Загружен отчет попытки ${attemptNumber}`)
    } catch (error) {
      toast.error('Ошибка загрузки отчета')
    }
  }

  const handleBackToLatest = async () => {
    if (history && history.total_attempts > 0) {
      await handleViewAttempt(history.total_attempts)
    }
  }

  const handleSubmit = async () => {
    if (!answer.trim() || !task) return

    setIsSubmitting(true)
    try {
      setSubmitStage('submitting')
      
      let nextTaskMetadata: any = null
      let fullNextQuestion = ''
      let tokenCount = 0
      
      await submitTaskAnswerStream(
        task.id,
        answer,
        // onToken - получаем токены следующего задания
        (token) => {
          tokenCount++
          
          // При первом токене СКРЫВАЕМ прогресс-бар!
          if (tokenCount === 1) {
            console.log('[SUBMIT] First token received - hiding progress bar!')
            setIsSubmitting(false)
          }
          
          fullNextQuestion += token
          console.log(`[STREAMING] Token #${tokenCount}: "${token}", total length: ${fullNextQuestion.length}`)
          
          // Обновляем задание с частичным текстом (как ChatGPT)
          if (nextTaskMetadata) {
            console.log(`[STREAMING] Updating task with question: "${fullNextQuestion.substring(0, 50)}..."`)
            setTask({
              ...nextTaskMetadata,
              question: fullNextQuestion
            })
          } else {
            console.log('[STREAMING] Token received but metadata not ready yet')
          }
        },
        // onMetadata - получаем метаданные следующего задания или отчета
        (metadata) => {
          console.log('[SUBMIT] Metadata received:', metadata)
          
          if (metadata.completed === true && metadata.generating_report) {
            // Генерируем финальный отчет - скрываем прогресс-бар!
            console.log('[SUBMIT] Generating final report - hiding progress bar!')
            setIsSubmitting(false)
            setSubmitStage('processing')
            toast('Генерируем ваш финальный отчет...', { duration: 20000, icon: '📝' })
          } else if (metadata.completed === false) {
            console.log('[SUBMIT] Next task metadata - keeping progress bar until first token!')
            // НЕ скрываем прогресс-бар сразу! Подождем первого токена
            
            setSubmitStage('processing')
            nextTaskMetadata = {
              id: metadata.id,
              order: metadata.order,
              type: metadata.task_type,
              time_limit_minutes: metadata.time_limit_minutes,
              question: '' // Пустой вопрос - будет заполняться токенами
            }
            console.log('[STREAMING] Setting initial task with empty question')
            setTask(nextTaskMetadata)
            setAnswer('')
            setTimeLeft(metadata.time_limit_minutes * 60)
          }
        },
        // onDone - генерация следующего задания завершена
        (data) => {
          if (data.completed === false && data.full_text) {
            // Есть следующее задание
            if (nextTaskMetadata) {
              setTask({
                ...nextTaskMetadata,
                question: data.full_text
              })
            }
            toast.success('Ответ принят! Следующее задание готово')
          } else if (data.message) {
            setIsSubmitting(false)
            toast.success(data.message)
            loadData()
          }
        },
        // onCompleted - симуляция завершена
        (finalReportText) => {
          setIsSubmitting(false)
          setFinalReport(finalReportText)
          setShowFinalReport(true)
          toast.success('Симуляция завершена!')
        },
        // onError
        (error) => {
          toast.error(`Ошибка: ${error}`)
        }
      )
    } catch (error: any) {
      toast.error(error.response?.data?.detail || error.message || 'Ошибка при отправке ответа')
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
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Финальный отчёт</h2>
                {history && viewingAttemptNumber && (
                  <span className="text-sm text-gray-600">
                    Попытка {viewingAttemptNumber} из {MAX_ATTEMPTS}
                  </span>
                )}
              </div>
              {history && viewingAttemptNumber && viewingAttemptNumber !== history.total_attempts && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800 mb-2">
                    Вы просматриваете отчет попытки {viewingAttemptNumber}
                  </p>
                  <button
                    onClick={handleBackToLatest}
                    className="text-sm text-blue-600 hover:text-blue-700 underline"
                  >
                    Вернуться к последней попытке ({history.total_attempts})
                  </button>
                </div>
              )}
            </div>
            
            <MarkdownRenderer content={finalReport} />
            
            <div className="mt-8 space-y-4">
              {history && history.total_attempts >= MAX_ATTEMPTS ? (
                <div className="text-center">
                  <p className="text-gray-600 mb-4">
                    Вы достигли максимального количества попыток ({MAX_ATTEMPTS})
                  </p>
                  <Link
                    href="/dashboard"
                    className="inline-block rounded-md bg-primary-600 px-6 py-3 text-white hover:bg-primary-700"
                  >
                    Вернуться к профессиям
                  </Link>
                </div>
              ) : (
                <div className="flex justify-center gap-4">
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
              )}
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
                        {attempt.status === 'completed' && (
                          <>
                            {viewingAttemptNumber === attempt.attempt_number ? (
                              <span className="text-sm text-green-600 font-medium">⭐ Просматриваете</span>
                            ) : (
                              <button
                                onClick={() => handleViewAttempt(attempt.attempt_number)}
                                className="text-sm text-primary-600 hover:text-primary-700 underline"
                              >
                                Смотреть отчет
                              </button>
                            )}
                          </>
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
