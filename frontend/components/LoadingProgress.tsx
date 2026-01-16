'use client'

import { useEffect, useState } from 'react'

interface LoadingProgressProps {
  stage: 'connecting' | 'generating' | 'finalizing' | 'submitting' | 'analyzing' | 'processing'
  customMessage?: string
}

const stageMessages = {
  connecting: 'Подключение к AI...',
  generating: 'Генерация вопроса...',
  finalizing: 'Почти готово...',
  submitting: 'Отправка ответа...',
  analyzing: 'Анализируем ваш ответ...',
  processing: 'Формируем следующее задание...'
}

const stageProgress = {
  connecting: 30,
  generating: 60,
  finalizing: 90,
  submitting: 25,
  analyzing: 60,
  processing: 85
}

export default function LoadingProgress({ stage, customMessage }: LoadingProgressProps) {
  const [progress, setProgress] = useState(0)
  const targetProgress = stageProgress[stage]
  const message = customMessage || stageMessages[stage]

  // Плавная анимация прогресса
  useEffect(() => {
    setProgress(0) // Сброс при смене stage
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev < targetProgress) {
          return Math.min(prev + 2, targetProgress)
        }
        return prev
      })
    }, 50)

    return () => clearInterval(interval)
  }, [targetProgress])

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      {/* Анимированная иконка */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-4 border-primary-200 rounded-full"></div>
        <div 
          className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent"
          style={{
            animation: 'spin 1s linear infinite'
          }}
        ></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg 
            className="w-10 h-10 text-primary-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
            />
          </svg>
        </div>
      </div>

      {/* Сообщение */}
      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-gray-700">
          {message}
        </p>
        <p className="text-sm text-gray-500">
          Это может занять несколько секунд
        </p>
      </div>

      {/* Прогресс бар */}
      <div className="w-full max-w-md space-y-2">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 transition-all duration-500 ease-out rounded-full"
            style={{ 
              width: `${progress}%`,
              boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
            }}
          />
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs text-gray-500">
            {stage === 'connecting' && 'Шаг 1 из 3'}
            {stage === 'generating' && 'Шаг 2 из 3'}
            {stage === 'finalizing' && 'Шаг 3 из 3'}
            {stage === 'submitting' && 'Отправка'}
            {stage === 'analyzing' && 'Анализ'}
            {stage === 'processing' && 'Обработка'}
          </p>
          <p className="text-sm font-medium text-primary-600">{progress}%</p>
        </div>
      </div>

      {/* Подсказка */}
      <div className="text-center max-w-md">
        <p className="text-sm text-gray-400">
          {stage === 'generating' || stage === 'processing' 
            ? 'AI генерирует персонализированный вопрос специально для вас'
            : stage === 'analyzing'
            ? 'Анализируем ваш ответ и готовим следующее задание'
            : 'AI обрабатывает ваш запрос...'}
        </p>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
