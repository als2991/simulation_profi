'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { getProfessions, getUserProgress } from '@/lib/api'
import toast from 'react-hot-toast'

interface Profession {
  id: number
  name: string
  description: string
  price: number
}

interface Progress {
  profession_id: number
  status: string
  current_task_order: number
}

export default function DashboardPage() {
  const router = useRouter()
  const { isAuthenticated, token, logout } = useAuthStore()
  const [professions, setProfessions] = useState<Profession[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    loadData()
  }, [isAuthenticated, router])

  const loadData = async () => {
    try {
      const [professionsData, progressData] = await Promise.all([
        getProfessions(token!),
        getUserProgress(token!),
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

  const getProgressStatus = (professionId: number) => {
    const prog = progress.find((p) => p.profession_id === professionId)
    if (!prog) return 'not_started'
    return prog.status
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
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {professions.map((profession) => {
            const status = getProgressStatus(profession.id)
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
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(status)}`}
                  >
                    {getStatusText(status)}
                  </span>
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

        {professions.length === 0 && (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <p className="text-gray-600">Профессии пока не доступны</p>
          </div>
        )}
      </main>
    </div>
  )
}
