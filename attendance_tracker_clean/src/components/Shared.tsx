import { type ReactNode, createContext, useCallback, useContext, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { logOut } from '../services/authService'
import type { Role } from '../types'

/* ---------- Navbar ---------- */
export function Navbar() {
  const { user, setUser } = useAuth()
  const { dark, toggle } = useTheme()
  const home = user?.role === 'teacher' ? '/teacher' : '/student'

  return (
    <div className="px-3 sm:px-4 pt-3 bg-cream dark:bg-ink">
      <nav className="max-w-6xl mx-auto flex items-center justify-between gap-3 bg-ink/95 text-cream-soft
        rounded-full px-3 sm:px-5 py-2.5 shadow-pop border-2 border-ink backdrop-blur-sm">
        <Link to={user ? home : '/'} className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="w-8 h-8 rounded-full bg-butter flex items-center justify-center text-ink text-sm">
            ✓
          </span>
          <span className="hidden sm:inline">Smart Attendance</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            className="w-9 h-9 rounded-full border-2 border-cream-soft/50 flex items-center justify-center
              hover:bg-cream-soft/10 transition-colors text-sm"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {dark ? '☀️' : '🌙'}
          </button>
          {user && (
            <>
              <span className="text-sm hidden sm:inline px-3 py-1.5 rounded-full bg-cream-soft/10">
                {user.name} · {user.role}
              </span>
              <button
                className="text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-full bg-butter text-ink
                  border-2 border-butter hover:bg-butter-deep transition-colors"
                onClick={async () => {
                  await logOut()
                  setUser(null)
                }}
              >
                Log out
              </button>
            </>
          )}
        </div>
      </nav>
    </div>
  )
}

/* ---------- Protected route ---------- */
export function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-8 text-center text-ink-muted">Loading…</div>
  if (!user) return <Navigate to="/" replace />
  if (user.role !== role) return <Navigate to="/" replace />
  return <>{children}</>
}

/* ---------- Toast (simple confirmation/error messages) ---------- */
interface Toast { id: number; text: string; kind: 'success' | 'error' | 'info' }
const ToastCtx = createContext<{ push: (text: string, kind?: Toast['kind']) => void }>({
  push: () => { },
})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now()
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-full shadow-pop border-2 border-ink text-ink text-sm font-semibold ${t.kind === 'success' ? 'bg-sage' : t.kind === 'error' ? 'bg-blush' : 'bg-butter'
              }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}

/* ---------- Empty state ---------- */
export function EmptyState({ text }: { text: string }) {
  return <div className="text-center text-sm text-ink-muted py-10">{text}</div>
}