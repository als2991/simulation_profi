import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Заголовки
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold text-gray-900 mb-4 mt-6 border-b-2 border-primary-200 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-bold text-gray-800 mb-3 mt-5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-lg font-semibold text-gray-700 mb-2 mt-3">
              {children}
            </h4>
          ),
          
          // Параграфы
          p: ({ children }) => (
            <p className="text-gray-700 mb-4 leading-relaxed">
              {children}
            </p>
          ),
          
          // Жирный текст
          strong: ({ children }) => (
            <strong className="font-bold text-gray-900">
              {children}
            </strong>
          ),
          
          // Курсив
          em: ({ children }) => (
            <em className="italic text-gray-700">
              {children}
            </em>
          ),
          
          // Списки
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-4 space-y-2 ml-4">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-gray-700 leading-relaxed">
              {children}
            </li>
          ),
          
          // Цитаты
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary-400 pl-4 py-2 mb-4 italic bg-gray-50 rounded-r">
              {children}
            </blockquote>
          ),
          
          // Код
          code: ({ inline, children, ...props }: any) => {
            return inline ? (
              <code className="bg-gray-100 text-primary-600 px-2 py-1 rounded text-sm font-mono">
                {children}
              </code>
            ) : (
              <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg mb-4 overflow-x-auto text-sm font-mono">
                {children}
              </code>
            )
          },
          
          // Горизонтальная линия
          hr: () => (
            <hr className="my-6 border-t-2 border-gray-200" />
          ),
          
          // Ссылки
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 underline"
            >
              {children}
            </a>
          ),
          
          // Таблицы
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-white divide-y divide-gray-200">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr>
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm text-gray-700">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
