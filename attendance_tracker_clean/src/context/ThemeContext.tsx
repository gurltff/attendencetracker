import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const Ctx = createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => { } })

function readStoredTheme(): boolean {
  try {
    return localStorage.getItem('sat_theme') === 'dark'
  } catch {
    return false
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState<boolean>(readStoredTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('sat_theme', dark ? 'dark' : 'light')
    } catch {
      // ignore storage access errors in restricted browser contexts
    }
  }, [dark])

  return <Ctx.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>{children}</Ctx.Provider>
}

export function useTheme() {
  return useContext(Ctx)
}
