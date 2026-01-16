# План доработок

## 1️⃣ Ограничение максимум 3 попытки

### Backend изменения:

**`backend/app/config.py`:**
```python
MAX_PROFESSION_ATTEMPTS: int = 3
```

**`backend/app/routers/professions.py` - функция `restart_profession`:**
```python
@router.post("/{profession_id}/progress/restart")
async def restart_profession(...):
    # Находим все попытки
    all_attempts = db.query(UserProgress).filter(
        UserProgress.user_id == current_user.id,
        UserProgress.profession_id == profession_id
    ).all()
    
    # Проверяем лимит
    if len(all_attempts) >= settings.MAX_PROFESSION_ATTEMPTS:
        raise HTTPException(
            status_code=400, 
            detail=f"Достигнут лимит попыток ({settings.MAX_PROFESSION_ATTEMPTS})"
        )
    
    # Остальная логика...
```

### Frontend изменения:

**`frontend/app/profession/[id]/page.tsx`:**
- Добавить проверку `history.total_attempts >= 3`
- Если лимит - показывать сообщение вместо кнопки "Пройти заново"
- Или делать кнопку неактивной с тултипом

---

## 2️⃣ Улучшение навигации по отчетам

### Проблема:
- При просмотре предыдущего отчета нельзя вернуться к последнему
- Непонятно какой отчет сейчас просматривается

### Решение:

**`frontend/app/profession/[id]/page.tsx`:**

Добавить состояние:
```typescript
const [viewingAttemptNumber, setViewingAttemptNumber] = useState<number | null>(null)
```

Логика:
- При загрузке страницы: `viewingAttemptNumber = history.total_attempts` (последняя)
- При клике "Смотреть отчет": загружаем тот отчет и `setViewingAttemptNumber(N)`
- Звездочка "⭐ Текущая" показывается у `viewingAttemptNumber`
- Кнопка "Смотреть отчет" активна у всех, кроме просматриваемой
- Добавить кнопку "Вернуться к последней попытке" если `viewingAttemptNumber !== latestAttempt`

UI:
```
┌─────────────────────────────────────┐
│ Финальный отчёт  Попытка 2 из 3     │
│ [Вернуться к последней попытке]     │
│                                     │
│ [Отчет попытки 2...]                │
│                                     │
│ 📖 История прохождений (3) ▼        │
│ • Попытка 3  [Смотреть отчет]       │
│ • Попытка 2  ⭐ Просматриваете       │
│ • Попытка 1  [Смотреть отчет]       │
└─────────────────────────────────────┘
```

---

## 3️⃣ Фикс токена при обновлении страницы

### Проблема:
Token загружается, но состояние `isAuthenticated` не обновляется синхронно, поэтому редирект происходит до того как токен применится.

### Решение 1: Инициализация при создании store

**`frontend/store/authStore.ts`:**
```typescript
export const useAuthStore = create<AuthState>((set) => {
  // Инициализируем сразу при создании
  const initialToken = getToken()
  
  return {
    token: initialToken,
    isAuthenticated: !!initialToken,
    
    // initAuth теперь не нужен, но оставим для обратной совместимости
    initAuth: () => {
      const storedToken = getToken()
      if (storedToken && storedToken !== get().token) {
        set({ token: storedToken, isAuthenticated: true })
      }
    },
    
    setAuth: (token: string) => {
      saveToken(token)
      set({ token, isAuthenticated: true })
    },
    
    logout: () => {
      removeToken()
      set({ token: null, isAuthenticated: false })
    },
  }
})
```

### Решение 2: Использовать persist middleware

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAuthenticated: false,
      
      setAuth: (token: string) => {
        set({ token, isAuthenticated: true })
      },
      
      logout: () => {
        set({ token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```

### Решение 3: Loading state

**`frontend/app/dashboard/page.tsx` и др.:**
```typescript
const [isInitializing, setIsInitializing] = useState(true)

useEffect(() => {
  initAuth()
  setIsInitializing(false)
}, [])

if (isInitializing) {
  return <div>Loading...</div>
}

if (!isAuthenticated) {
  router.push('/login')
  return null
}
```

**Рекомендую: Решение 1** - самое простое и эффективное.

---

## 🎯 Порядок реализации

1. ✅ Фикс токена (Решение 1) - **5 мин**
2. ✅ Лимит попыток - **10 мин**
3. ✅ Навигация по отчетам - **20 мин**

**Общее время: ~35 мин**

## 📝 Файлы для изменения

### Backend:
- `backend/app/config.py` - добавить MAX_ATTEMPTS
- `backend/app/routers/professions.py` - проверка лимита

### Frontend:
- `frontend/store/authStore.ts` - фикс инициализации токена
- `frontend/app/profession/[id]/page.tsx` - навигация по отчетам, проверка лимита
