import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logIn, signUp } from '../services/authService'
import { getAll, seedIfEmpty } from '../services/store'
import { mockAnnouncements } from '../services/mockData'
import type { Announcement, Role } from '../types'
import { AnnouncementList, isAnnouncementLive } from '../components/Announcements'
import { useToast } from '../components/Shared'
import { setupDemoData, DEMO_PASSWORD, DEMO_LOGINS } from '../services/demoseed'
import TeacherSubjectPicker from '../components/TeacherSubjectPicker'
import StudentProgramPicker from '../components/StudentProgramPicker'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [enrolled, setEnrolled] = useState<string[]>([])
  const [studentProgram, setStudentProgram] = useState('')
  const [studentYear, setStudentYear] = useState('')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const [demoReady, setDemoReady] = useState(false)
  const [demoStatus, setDemoStatus] = useState('')
  const { setUser } = useAuth()
  const { push } = useToast()
  const nav = useNavigate()

  useEffect(() => {
    seedIfEmpty('announcements', mockAnnouncements)
    getAll<Announcement>('announcements').then((all) =>
      setAnnouncements(all.filter(isAnnouncementLive).sort((a, b) => b.createdAt - a.createdAt))
    )
    setDemoReady(localStorage.getItem('demo_data_ready') === '1')
  }, [])

  async function handleSetupDemo() {
    setBusy(true)
    try {
      await setupDemoData(setDemoStatus)
      localStorage.setItem('demo_data_ready', '1')
      setDemoReady(true)
      push('Demo data ready!', 'success')
    } catch (err: any) {
      push(err?.message ?? 'Demo setup failed.', 'error')
    } finally {
      setBusy(false)
      setDemoStatus('')
    }
  }

  async function handleDemoLogin(demoEmail: string, demoRole: Role) {
    setBusy(true)
    try {
      const profile = await logIn(demoEmail, DEMO_PASSWORD)
      if (!profile) throw new Error('Run "Set up demo data" first.')
      setUser(profile)
      push(`Demo login: ${profile.name}`, 'success')
      nav(demoRole === 'cr' ? '/cr' : demoRole === 'teacher' ? '/teacher' : '/student')
    } catch (err: any) {
      push(err?.message ?? 'Demo login failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'signup') {
        const profile =
          role === 'student'
            ? await signUp(name, email, password, role, [studentProgram], studentYear)
            : await signUp(name, email, password, role, enrolled)
        setUser(profile)
        push('Account created — welcome!', 'success')
        nav(profile.role === 'cr' ? '/cr' : profile.role === 'teacher' ? '/teacher' : '/student')
      } else {
        const profile = await logIn(email, password)
        if (!profile) throw new Error('Invalid email or password.')
        setUser(profile)
        push(`Welcome back, ${profile.name}!`, 'success')
        nav(profile.role === 'cr' ? '/cr' : profile.role === 'teacher' ? '/teacher' : '/student')
      }
    } catch (err: any) {
      push(err?.message ?? 'Something went wrong.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Good {mode === 'login' ? 'to see you again' : 'to have you here'} 👋
        </h1>
        <p className="text-ink/70 mt-1">
          Track classes, mark presence and stay on top of attendance — all in one calm place.
        </p>
      </div>

      {/* Demo panel — for hackathon presentations. Writes real accounts/data into your existing Firebase project. */}
      <div className="card-tint tint-sky mb-8">
        <h2 className="font-extrabold text-lg mb-1">⚡ Demo Mode</h2>
        {!demoReady ? (
          <>
            <p className="text-sm text-ink/70 mb-3">
              One-time setup: creates real demo accounts (students, teachers, CR) and sample attendance
              data in your Firebase project. Safe to run once before the presentation.
            </p>
            <button className="btn-primary" disabled={busy} onClick={handleSetupDemo}>
              {busy ? demoStatus || 'Setting up…' : 'Set up demo data'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink/70 mb-3">
              Demo data is ready. Tap any name below to log straight into that dashboard.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-ink/50 mb-1">STUDENTS</div>
                {DEMO_LOGINS.filter((u) => u.role === 'student' || u.role === 'cr').map((u) => (
                  <button
                    key={u.email}
                    disabled={busy}
                    className="btn-outline w-full mb-1 text-sm"
                    onClick={() => handleDemoLogin(u.email, u.role)}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
              <div>
                <div className="text-xs font-semibold text-ink/50 mb-1">TEACHERS</div>
                {DEMO_LOGINS.filter((u) => u.role === 'teacher').map((u) => (
                  <button
                    key={u.email}
                    disabled={busy}
                    className="btn-outline w-full mb-1 text-sm"
                    onClick={() => handleDemoLogin(u.email, u.role)}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="text-xs text-ink/40 underline mt-3"
              onClick={handleSetupDemo}
              disabled={busy}
            >
              Re-run setup / refresh demo data
            </button>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
      {/* Auth form */}
      <div className="card-tint tint-sky">
        <div className="flex gap-2 mb-4 bg-cream-soft/70 border-2 border-ink rounded-full p-1">
          <button
            className={`flex-1 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              mode === 'login' ? 'bg-ink text-cream-soft' : 'text-ink hover:bg-ink/5'
            }`}
            onClick={() => setMode('login')}
          >
            Log in
          </button>
          <button
            className={`flex-1 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              mode === 'signup' ? 'bg-ink text-cream-soft' : 'text-ink hover:bg-ink/5'
            }`}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="text-sm font-medium">Full name</label>
              <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {mode === 'signup' && (
            <>
              <div>
                <label className="text-sm font-medium">Role</label>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
              </div>
              {role === 'student' && (
                <StudentProgramPicker
                  program={studentProgram}
                  year={studentYear}
                  onProgramChange={setStudentProgram}
                  onYearChange={setStudentYear}
                />
              )}
              {role === 'teacher' && (
                <TeacherSubjectPicker value={enrolled} onChange={setEnrolled} />
              )}
            </>
          )}
          <button className="btn-primary w-full" disabled={busy} type="submit">
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>
      </div>

      {/* Public announcements */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-lg">📢 Campus Announcements</h2>
          {announcements.length > 3 && (
            <button className="text-sm font-semibold underline decoration-2 underline-offset-2" onClick={() => setShowAll(true)}>
              View all
            </button>
          )}
        </div>
        <AnnouncementList items={announcements.slice(0, 5)} />
      </div>
      </div>

      {showAll && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center p-4 z-40">
          <div className="card max-w-xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-extrabold text-lg">All announcements</h3>
              <button className="btn-outline text-sm" onClick={() => setShowAll(false)}>Close</button>
            </div>
            <AnnouncementList items={announcements} />
          </div>
        </div>
      )}
    </div>
  )
}