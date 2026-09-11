import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { create, getAll, getWhere } from '../services/store'
import { useToast } from '../components/Shared'
import { ABBREV_LEGEND, parseCourseKey } from '../data/scheduleData'
import type { AttendanceRecord, AttendanceSession, UserProfile } from '../types'

const norm = (value?: string | null) => (value ?? '').trim().toLowerCase()

// A student's programme may be stored as a plain name, or (for older accounts)
// as a composite "programme::year::course" key — handle both.
function programOf(student: UserProfile) {
  const raw = student.enrolledCourseIds?.[0] ?? ''
  if (raw.includes('::')) return parseCourseKey(raw).programName
  return raw
}

function courseLabel(course: string) {
  return ABBREV_LEGEND[course] ?? course
}

export default function TeacherDashboard() {
  const { user } = useAuth()
  const { push } = useToast()
  const [students, setStudents] = useState<UserProfile[]>([])
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [assignedKey, setAssignedKey] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [marks, setMarks] = useState<Record<string, 'present' | 'absent'>>({})

  // The subjects this teacher actually teaches, e.g.
  // "B.Sc. (Hons) Physics::First Year::MP-I"
  const assignedSubjects = useMemo(() => {
    return (user?.assignedCourseIds ?? [])
      .map((key) => ({ key, ...parseCourseKey(key) }))
      .filter((s) => s.programName && s.year && s.course)
  }, [user?.assignedCourseIds])

  useEffect(() => {
    if (!user) return
    getAll<UserProfile>('users').then((all) => setStudents(all.filter((u) => u.role === 'student' || u.role === 'cr')))
    getWhere<AttendanceSession>('attendanceSessions', 'teacherId', user.uid).then(setSessions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Keep the selected subject valid whenever the teacher's assigned subjects change.
  useEffect(() => {
    if (!assignedSubjects.length) {
      if (assignedKey) setAssignedKey('')
      return
    }
    if (!assignedSubjects.some((s) => s.key === assignedKey)) {
      setAssignedKey(assignedSubjects[0].key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedSubjects])

  const selected = assignedSubjects.find((s) => s.key === assignedKey)

  useEffect(() => {
    if (!selected) return
    getWhere<AttendanceRecord>('attendanceRecords', 'courseId', selected.course).then(setRecords)
  }, [selected?.course])

  const enrolledStudents = useMemo(() => {
    if (!selected) return []
    return students.filter(
      (s) => norm(programOf(s)) === norm(selected.programName) && norm(s.year) === norm(selected.year)
    )
  }, [students, selected])

  const alreadyMarkedToday = useMemo(
    () => new Set(records.filter((r) => r.date === date && r.source === 'teacher_marked').map((r) => r.studentId)),
    [records, date]
  )

  async function submitSession(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selected) return
    const dup = sessions.find((s) => s.courseId === selected.course && s.date === date)
    if (dup) return push('Attendance for this subject and date was already submitted.', 'error')

    const courseName = courseLabel(selected.course)

    for (const s of enrolledStudents) {
      if (alreadyMarkedToday.has(s.uid)) continue
      const status = marks[s.uid] ?? 'absent'
      const rec: AttendanceRecord = {
        id: '',
        studentId: s.uid,
        studentName: s.name,
        courseId: selected.course,
        courseName,
        courseKey: selected.key,
        teacherId: user.uid,
        date,
        status,
        source: 'teacher_marked',
        locationStatus: 'unavailable',
        createdAt: Date.now(),
      }
      await create('attendanceRecords', rec)
    }
    const session: AttendanceSession = {
      id: '',
      teacherId: user.uid,
      courseId: selected.course,
      courseName,
      courseKey: selected.key,
      date,
      createdAt: Date.now(),
    }
    await create('attendanceSessions', session)
    setSessions((s) => [...s, session])
    setMarks({})
    push('Attendance session submitted', 'success')
    getWhere<AttendanceRecord>('attendanceRecords', 'courseId', selected.course).then(setRecords)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Teacher dashboard</h1>
          <p className="text-ink/70 mt-1">Take attendance, review sessions and check self check-in details.</p>
        </div>
        <Link className="btn-outline text-sm" to="/teacher/classes">📊 Manage classes</Link>
      </div>

      {!assignedSubjects.length && (
        <div className="card-tint tint-blush text-ink text-sm font-medium">
          You haven't selected any subjects to teach yet. Use "Manage classes" to add your programme, year(s) and subject(s).
        </div>
      )}

      {assignedSubjects.length > 0 && (
        <div className="card-tint tint-sky">
          <h2 className="font-extrabold text-lg mb-3 text-ink">Mark today's attendance</h2>
          <form onSubmit={submitSession} className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <select className="input max-w-xs" value={assignedKey} onChange={(e) => setAssignedKey(e.target.value)}>
                {assignedSubjects.map((s) => (
                  <option key={s.key} value={s.key}>
                    {courseLabel(s.course)} — {s.programName} · {s.year}
                  </option>
                ))}
              </select>
              <input type="date" className="input max-w-xs" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="divide-y divide-ink/15 bg-cream-soft/60 rounded-2xl border-2 border-ink/20 px-3">
              {enrolledStudents.map((s) => (
                <div key={s.uid} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink">{s.name}{alreadyMarkedToday.has(s.uid) ? ' (already recorded)' : ''}</span>
                  <div className="flex gap-2">
                    <button type="button" disabled={alreadyMarkedToday.has(s.uid)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border-2 border-ink transition-colors ${
                        marks[s.uid] === 'present' ? 'bg-sage text-ink' : 'bg-transparent text-ink hover:bg-sage/40'
                      }`}
                      onClick={() => setMarks((m) => ({ ...m, [s.uid]: 'present' }))}>
                      Present
                    </button>
                    <button type="button" disabled={alreadyMarkedToday.has(s.uid)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border-2 border-ink transition-colors ${
                        marks[s.uid] === 'absent' ? 'bg-blush text-ink' : 'bg-transparent text-ink hover:bg-blush/40'
                      }`}
                      onClick={() => setMarks((m) => ({ ...m, [s.uid]: 'absent' }))}>
                      Absent
                    </button>
                  </div>
                </div>
              ))}
              {enrolledStudents.length === 0 && <p className="text-sm text-ink/60 py-3">No students enrolled in this class yet.</p>}
            </div>
            <button className="btn-primary" disabled={enrolledStudents.length === 0}>Submit attendance</button>
          </form>
        </div>
      )}

      <div className="card">
        <h2 className="font-extrabold text-lg mb-3 text-ink">Session history</h2>
        {sessions.length === 0 && <p className="text-sm text-ink-muted">No sessions submitted yet.</p>}
        <ul className="text-sm space-y-1.5">
          {sessions.sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <span className="badge bg-butter">{s.date}</span> {s.courseName}
            </li>
          ))}
        </ul>
      </div>

      {selected && (
        <div className="card">
          <h2 className="font-extrabold text-lg mb-3 text-ink">Self check-in records for this subject</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/60 border-b-2 border-ink/20">
                <th className="py-2 pr-2 font-semibold">Student</th><th className="pr-2 font-semibold">Date</th><th className="pr-2 font-semibold">Location</th><th className="font-semibold">Approx. coordinates</th>
              </tr>
            </thead>
            <tbody>
              {records.filter((r) => r.source === 'student_self_checkin').map((r) => (
                <tr key={r.id} className="border-b border-ink/10 last:border-0">
                  <td className="py-2 pr-2">{r.studentName}</td>
                  <td className="pr-2">{r.date}</td>
                  <td className="pr-2 capitalize">{r.locationStatus}</td>
                  <td>{r.geoTag ? `${r.geoTag.latitude.toFixed(3)}, ${r.geoTag.longitude.toFixed(3)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}