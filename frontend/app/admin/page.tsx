'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const router = useRouter()
  const { isAuthenticated, token } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    // Здесь должна быть проверка прав администратора
    setIsLoading(false)
  }, [isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Админ-панель</h1>
            <button
              onClick={() => router.push('/dashboard')}
              className="rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Назад
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Управление платформой</h2>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-2">Профессии</h3>
              <p className="text-sm text-gray-600 mb-4">
                Управление профессиями и их настройками
              </p>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Управлять →
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-2">Сценарии</h3>
              <p className="text-sm text-gray-600 mb-4">
                Редактирование system prompts и заданий
              </p>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Управлять →
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-2">Пакеты</h3>
              <p className="text-sm text-gray-600 mb-4">
                Настройка пакетов и цен
              </p>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Управлять →
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-2">Промокоды</h3>
              <p className="text-sm text-gray-600 mb-4">
                Создание и управление промокодами
              </p>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Управлять →
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-2">Статистика</h3>
              <p className="text-sm text-gray-600 mb-4">
                Просмотр статистики по пользователям и платежам
              </p>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Просмотреть →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
