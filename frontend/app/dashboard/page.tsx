'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { getProfessions, getUserProgress } from '@/lib/api'
import toast from 'react-hot-toast'

const MAX_ATTEMPTS = 3 // Максимальное количество попыток
const ALL_CATEGORIES_VALUE = 'all'

interface Profession {
  id: number
  name: string
  description: string
  category?: string | null
  price: number
}

interface Progress {
  profession_id: number
  status: string
  current_task_order: number
  attempt_number: number
}

export default function DashboardPage() {
  const router = useRouter()
  const { isAuthenticated, token, logout, initAuth } = useAuthStore()
  const [professions, setProfessions] = useState<Profession[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES_VALUE)

  // Инициализируем токен из storage при загрузке страницы
  useEffect(() => {
    initAuth()
  }, [initAuth])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    
    if (process.env.NODE_ENV === 'development') {
    }
    loadData()
  }, [isAuthenticated, router, token])

  const loadData = async () => {
    try {
      const [professionsData, progressData] = await Promise.all([
        getProfessions(),
        getUserProgress(),
      ])
      setProfessions(professionsData)
      setProgress(progressData)
    } catch (error: any) {
      toast.error('Ошибка при загрузке данных')
      if (error.response?.status === 401) {
        logout()
        router.push('/login')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const splitCategories = (category: string | null | undefined): string[] => {
    if (!category) return []
    return category
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
  }

  const categoriesSet = new Set<string>()
  professions.forEach((p: Profession) => {
    splitCategories(p.category).forEach((c) => categoriesSet.add(c))
  })

  const categories: string[] = Array.from(categoriesSet).sort((a, b) =>
    a.localeCompare(b, 'ru')
  )

  const filteredProfessions =
    selectedCategory === ALL_CATEGORIES_VALUE
      ? professions
      : professions.filter(
          (p: Profession) => splitCategories(p.category).includes(selectedCategory)
        )

  const getProgressStatus = (professionId: number) => {
    // Находим ВСЕ попытки этой профессии
    const attempts = progress.filter((p: Progress) => p.profession_id === professionId)
    if (attempts.length === 0) return 'not_started'
    
    // Находим последнюю попытку (с максимальным attempt_number)
    const lastAttempt = attempts.reduce((max: Progress, curr: Progress) => 
      curr.attempt_number > max.attempt_number ? curr : max
    )
    
    return lastAttempt.status
  }

  const getAttemptNumber = (professionId: number) => {
    // Находим ВСЕ попытки этой профессии
    const attempts = progress.filter((p: Progress) => p.profession_id === professionId)
    if (attempts.length === 0) return 0
    
    // Возвращаем максимальный attempt_number (последняя попытка)
    return Math.max(...attempts.map((a: Progress) => a.attempt_number))
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'not_started':
        return 'Не начато'
      case 'in_progress':
        return 'В процессе'
      case 'completed':
        return 'Завершено'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'not_started':
        return 'bg-gray-100 text-gray-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Симулятор профессий</h1>
            <button
              onClick={() => {
                logout()
                router.push('/login')
              }}
              className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Выйти
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Доступные профессии</h2>
          <p className="mt-2 text-gray-600">
            Выберите профессию для прохождения симуляции
          </p>

          {categories.length > 0 && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <label
                htmlFor="categoryFilter"
                className="text-sm font-medium text-gray-700"
              >
                Категория
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  id="categoryFilter"
                  value={selectedCategory}
                  onChange={(e: any) => setSelectedCategory(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:w-80"
                >
                  <option value={ALL_CATEGORIES_VALUE}>Все категории</option>
                  {categories.map((category: string) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                {selectedCategory !== ALL_CATEGORIES_VALUE && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(ALL_CATEGORIES_VALUE)}
                    className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Сбросить
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProfessions.map((profession: Profession) => {
            const status = getProgressStatus(profession.id)
            const attemptNum = getAttemptNumber(profession.id)
            return (
              <div
                key={profession.id}
                className="rounded-lg bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="text-xl font-semibold text-gray-900">
                  {profession.name}
                </h3>
                <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                  {profession.description}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(status)}`}
                    >
                      {getStatusText(status)}
                    </span>
                    {attemptNum > 0 && (
                      <span className="text-xs text-gray-500">
                        {attemptNum} из {MAX_ATTEMPTS}
                      </span>
                    )}
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {profession.price} ₽
                  </span>
                </div>
                <Link
                  href={`/profession/${profession.id}`}
                  className="mt-4 block w-full rounded-md bg-primary-600 px-4 py-2 text-center text-white hover:bg-primary-700"
                >
                  {status === 'completed'
                    ? 'Посмотреть отчёт'
                    : status === 'in_progress'
                    ? 'Продолжить'
                    : 'Начать'}
                </Link>
              </div>
            )
          })}
        </div>

        {filteredProfessions.length === 0 && (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">
              {selectedCategory === ALL_CATEGORIES_VALUE
                ? 'Профессии пока не доступны'
                : 'По выбранной категории профессий не найдено'}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
