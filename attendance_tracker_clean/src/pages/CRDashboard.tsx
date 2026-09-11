import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { create, getAll, getWhere, remove, update } from '../services/store'
import { getProgramCourses, parseCourseKey } from '../data/scheduleData'
import type {
  Announcement,
  AnnouncementCategory,
  AttendanceRecord,
  Course,
  UserProfile,
} from '../types'
import Overview from '../components/student/Overview'
import MarkPresence from '../components/student/MarkPresence'
import History from '../components/student/History'
import { AnnouncementList } from '../components/Announcements'
import { useToast } from '../components/Shared'

const CATEGORIES: AnnouncementCategory[] = ['Academic', 'Event', 'Exam', 'Holiday', 'Urgent']
const empty = {
  title: '',
  message: '',
  category: 'Academic' as AnnouncementCategory,
  isUrgent: false,
  expiresAt: '',
}

type Tab = 'overview' | 'mark' | 'history' | 'class' | 'announcements'

const norm = (value?: string | null) => (value ?? '').trim().toLowerCase()

function programOf(student: UserProfile) {
  const raw = student.enrolledCourseIds?.[0] ?? ''
  if (raw.includes('::')) return parseCourseKey(raw).programName
  return raw
}

export default function CRDashboard() {
  const { user } = useAuth()
  const { push } = useToast()
  const [tab, setTab] = useState<Tab>('overview')
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [classRecords, setClassRecords] = useState<AttendanceRecord[]>([])
  const [students, setStudents] = useState<UserProfile[]>([])
  const [items, setItems] = useState<Announcement[]>([])
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const programName = user?.enrolledCourseIds?.[0]
  const parsedProgram = programName?.includes('::') ? parseCourseKey(programName).programName : programName
  const year = user?.year

  const courses: Course[] = getProgramCourses(programName, year).map((c) => ({
    id: c.id,
    name: c.name,
    code: '',
    category: 'GE_5',
    maxAttendanceMarks: 5,
  }))

  async function refreshRecords() {
    if (!user) return
    setRecords(await getWhere<AttendanceRecord>('attendanceRecords', 'studentId', user.uid))
    setClassRecords(await getAll<AttendanceRecord>('attendanceRecords'))
  }

  async function refreshAnnouncements() {
    if (!user) return
    const mine = await getWhere<Announcement>('announcements', 'authorId', user.uid)
    setItems(mine.sort((a, b) => b.createdAt - a.createdAt))
  }

  async function refreshClass() {
    if (!user) return
    const allUsers = await getAll<UserProfile>('users')
    setStudents(
      allUsers.filter(
        (student) =>
          student.role === 'student' &&
          norm(programOf(student)) === norm(parsedProgram) &&
          norm(student.year) === norm(year)
      )
    )
  }

  useEffect(() => {
    refreshRecords()
    refreshAnnouncements()
    refreshClass()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const classRows = useMemo(() => {
    return students
      .map((student) => {
        const ownRecords = classRecords.filter((record) => record.studentId === student.uid)
        const present = ownRecords.filter((record) => record.status === 'present').length
        const total = ownRecords.length
        const percentage = total > 0 ? (present / total) * 100 : 0
        return { student, present, total, percentage }
      })
      .sort((a, b) => a.student.name.localeCompare(b.student.name))
  }, [students, classRecords])

  function draft(): Announcement {
    return {
      id: editingId ?? '',
      title: form.title,
      message: form.message,
      category: form.category,
      isUrgent: form.isUrgent,
      authorId: user!.uid,
      authorName: user!.name,
      createdAt: Date.now(),
      expiresAt: form.expiresAt ? new Date(form.expiresAt).getTime() : undefined,
      isActive: true,
    }
  }

  async function submitAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (editingId) {
      await update('announcements', editingId, draft())
      push('Announcement updated', 'success')
    } else {
      await create('announcements', draft())
      push('Announcement published', 'success')
    }
    setForm(empty)
    setEditingId(null)
    setPreview(false)
    refreshAnnouncements()
  }

  function editItem(a: Announcement) {
    setEditingId(a.id)
    setForm({
      title: a.title,
      message: a.message,
      category: a.category,
      isUrgent: a.isUrgent,
      expiresAt: a.expiresAt ? new Date(a.expiresAt).toISOString().slice(0, 10) : '',
    })
  }

  async function deleteAnnouncement(id: string) {
    await remove('announcements', id)
    push('Announcement deleted', 'success')
    refreshAnnouncements()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'mark', label: 'Mark My Presence' },
    { key: 'history', label: 'History' },
    { key: 'class', label: 'Class List' },
    { key: 'announcements', label: 'Announcements' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold mb-1">Hi {user?.name} 👋</h1>
      {programName && (
        <p className="text-sm text-slate-500 mb-4">
          Enrolled in: <b>{parsedProgram}</b>{year ? <> · <b>{year}</b></> : null}
        </p>
      )}

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`btn-outline whitespace-nowrap ${tab === t.key ? 'bg-brand-blue text-white' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <Overview courses={courses} records={records} programName={programName} year={year} />
      )}

      {tab === 'mark' && <MarkPresence courses={courses} onSaved={refreshRecords} />}

      {tab === 'history' && <History records={records} courses={courses} />}

      {tab === 'class' && (
        <div>
          <div className="mb-5">
            <h2 className="text-2xl font-extrabold">Class List</h2>
            <p className="text-sm text-ink/60 mt-1">
              Students in {parsedProgram || 'your class'}{year ? ` · ${year}` : ''}
            </p>
          </div>

          {classRows.length === 0 ? (
            <div className="card-tint tint-sky text-center py-10 text-sm text-ink-muted">
              No students found for this class.
            </div>
          ) : (
            <div className="card-tint tint-sky overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b-2 border-ink/20">
                    <th className="py-3 pr-4">#</th>
                    <th className="py-3 pr-4">Student</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Attendance</th>
                    <th className="py-3">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {classRows.map(({ student, present, total, percentage }, index) => (
                    <tr key={student.uid} className="border-b border-ink/10 last:border-0">
                      <td className="py-3 pr-4">{index + 1}</td>
                      <td className="py-3 pr-4 font-semibold">{student.name}</td>
                      <td className="py-3 pr-4 text-ink/60">{student.email}</td>
                      <td className="py-3 pr-4">
                        {total > 0 ? `${percentage.toFixed(0)}% (${present}/${total})` : 'No records'}
                      </td>
                      <td className="py-3">
                        <span className="badge bg-butter text-ink border-ink">
                          {student.isClassRepresentative ? 'CR' : 'Student'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'announcements' && (
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold">Announcements</h2>
            <p className="text-sm text-ink/60 mt-1">Publish and manage announcements for your class.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="card-tint tint-butter">
              <h3 className="font-extrabold text-lg mb-3">{editingId ? 'Edit announcement' : 'New announcement'}</h3>
              <form onSubmit={submitAnnouncement} className="space-y-3">
                <input className="input" placeholder="Title" required value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <textarea className="input" placeholder="Message" required rows={4} value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <select className="input" value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as AnnouncementCategory })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="input" type="date" value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isUrgent}
                    onChange={(e) => setForm({ ...form, isUrgent: e.target.checked })} />
                  Mark as urgent
                </label>
                <div className="flex gap-2">
                  <button type="button" className="btn-outline" onClick={() => setPreview((p) => !p)}>
                    {preview ? 'Hide preview' : 'Preview'}
                  </button>
                  <button type="submit" className="btn-primary flex-1">
                    {editingId ? 'Save changes' : 'Publish'}
                  </button>
                  {editingId && (
                    <button type="button" className="btn-outline" onClick={() => { setEditingId(null); setForm(empty) }}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
              {preview && form.title && <div className="mt-4"><AnnouncementList items={[draft()]} /></div>}
            </div>

            <div>
              <h3 className="font-extrabold text-lg mb-3">Your announcements</h3>
              <AnnouncementList
                items={items}
                actionsFor={(a) => (
                  <div className="flex gap-2 shrink-0">
                    <button className="btn-outline text-xs" onClick={() => editItem(a)}>Edit</button>
                    <button className="btn-outline text-xs" onClick={() => deleteAnnouncement(a.id)}>Delete</button>
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
