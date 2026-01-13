import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Симулятор профессий',
  description: 'Интерактивная платформа для симуляции профессий с оценкой AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}
