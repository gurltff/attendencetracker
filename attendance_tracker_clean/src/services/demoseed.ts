// One-time demo data setup for hackathon presentations.
// Writes REAL accounts + data into your existing Firebase project
// (or localStorage if Firebase isn't configured) using the app's own
// signUp/logIn/put helpers — nothing about your Firebase setup changes.
import { signUp, logIn } from './authService'
import { put } from './store'
import { mockAnnouncements } from './mockData'
import { getProgramCourses, makeCourseKey, ABBREV_LEGEND } from '../data/scheduleData'
import type {
  UserProfile, AttendanceRecord, AttendanceSession, Announcement,
} from '../types'

export const DEMO_PASSWORD = 'Demo@1234'

export const DEMO_STUDENT_SEEDS = [
  { name: 'Aarav Sharma', email: 'aarav.demo@example.com' },
  { name: 'Priya Nair', email: 'priya.demo@example.com' },
  { name: 'Rohan Verma', email: 'rohan.demo@example.com' },
]

export const DEMO_TEACHER_SEEDS = [
  { name: 'Dr. Mehta', email: 'mehta.demo@example.com' },
  { name: 'Ms. Kapoor', email: 'kapoor.demo@example.com' },
]

export const DEMO_CR_SEED = { name: 'Priya Nair (CR)', email: 'priya.cr.demo@example.com' }

// Demo accounts all belong to this programme + year, whose real subjects
// (from scheduleData.ts) drive everything below — this keeps the demo data
// consistent with the actual signup/attendance flow instead of a separate
// hardcoded course list.
const DEMO_PROGRAM = 'B.Sc. (Hons) Physics'
const DEMO_YEAR = 'First Year'

function dateStr(daysAgo: number) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function courseLabel(course: string) {
  return ABBREV_LEGEND[course] ?? course
}

/** Creates the account if it doesn't exist yet, or logs in to fetch the existing profile. */
async function ensureAccount(
  name: string,
  email: string,
  role: 'student' | 'teacher',
  courseIds: string[] = [],
  year?: string
): Promise<UserProfile> {
  try {
    return await signUp(name, email, DEMO_PASSWORD, role, courseIds, year)
  } catch (err: any) {
    if (err?.code === 'auth/email-already-in-use' || /already/i.test(err?.message ?? '')) {
      const existing = await logIn(email, DEMO_PASSWORD)
      if (existing) return existing
    }
    throw err
  }
}

/** The demo promotes one student to class rep without creating a separate app role. */
async function ensureCrAccount(name: string, email: string): Promise<UserProfile> {
  const base = await ensureAccount(name, email, 'student', [DEMO_PROGRAM], DEMO_YEAR)
  const promoted: UserProfile = { ...base, isClassRepresentative: true, assignedCourseIds: base.enrolledCourseIds ?? [] }
  await put<UserProfile & { id: string }>('users', { ...promoted, id: promoted.uid })
  return promoted
}

export async function setupDemoData(onProgress?: (msg: string) => void) {
  const log = (m: string) => onProgress?.(m)

  const allCourses = getProgramCourses(DEMO_PROGRAM, DEMO_YEAR).map((c) => c.name)
  if (!allCourses.length) {
    throw new Error(`No timetable data found for ${DEMO_PROGRAM} · ${DEMO_YEAR}.`)
  }
  const mid = Math.ceil(allCourses.length / 2)
  const mehtaCourses = allCourses.slice(0, mid)
  const kapoorCourses = allCourses.slice(mid).length ? allCourses.slice(mid) : allCourses.slice(0, mid)

  log('Creating teacher accounts…')
  const mehta = await ensureAccount(
    DEMO_TEACHER_SEEDS[0].name, DEMO_TEACHER_SEEDS[0].email, 'teacher',
    mehtaCourses.map((c) => makeCourseKey(DEMO_PROGRAM, DEMO_YEAR, c))
  )
  const kapoor = await ensureAccount(
    DEMO_TEACHER_SEEDS[1].name, DEMO_TEACHER_SEEDS[1].email, 'teacher',
    kapoorCourses.map((c) => makeCourseKey(DEMO_PROGRAM, DEMO_YEAR, c))
  )
  // Re-affirm assigned subjects in case these accounts already existed from a prior run.
  await put('users', { ...mehta, id: mehta.uid, assignedCourseIds: mehtaCourses.map((c) => makeCourseKey(DEMO_PROGRAM, DEMO_YEAR, c)) })
  await put('users', { ...kapoor, id: kapoor.uid, assignedCourseIds: kapoorCourses.map((c) => makeCourseKey(DEMO_PROGRAM, DEMO_YEAR, c)) })

  const courseOwner: Record<string, { uid: string; name: string }> = {}
  for (const c of mehtaCourses) courseOwner[c] = { uid: mehta.uid, name: mehta.name }
  for (const c of kapoorCourses) courseOwner[c] = { uid: kapoor.uid, name: kapoor.name }

  log('Creating student accounts…')
  const students: UserProfile[] = []
  for (const s of DEMO_STUDENT_SEEDS) {
    students.push(await ensureAccount(s.name, s.email, 'student', [DEMO_PROGRAM], DEMO_YEAR))
  }

  log('Creating class rep account…')
  const cr = await ensureCrAccount(DEMO_CR_SEED.name, DEMO_CR_SEED.email)

  log('Writing attendance history…')
  let idCounter = 0
  for (let day = 12; day >= 1; day--) {
    for (let si = 0; si < students.length; si++) {
      const s = students[si]
      for (const course of allCourses) {
        const skip = (si === 1 && day % 4 === 0) || (si === 2 && day % 3 === 0)
        idCounter++
        const record: AttendanceRecord = {
          id: `demo_att_${idCounter}`,
          studentId: s.uid,
          studentName: s.name,
          courseId: course,
          courseName: courseLabel(course),
          courseKey: makeCourseKey(DEMO_PROGRAM, DEMO_YEAR, course),
          teacherId: courseOwner[course]?.uid,
          date: dateStr(day),
          status: skip ? 'absent' : 'present',
          source: day % 2 === 0 ? 'teacher_marked' : 'student_self_checkin',
          locationStatus: 'captured',
          geoTag: { latitude: 28.4089, longitude: 77.3178, accuracy: 15 },
          createdAt: Date.now() - day * 86400000,
        }
        await put('attendanceRecords', record)
      }
    }
  }

  log('Writing teacher sessions…')
  let si2 = 0
  for (const course of allCourses) {
    const owner = courseOwner[course]
    if (!owner) continue
    for (let day = 5; day >= 1; day--) {
      si2++
      const session: AttendanceSession = {
        id: `demo_sess_${si2}`,
        teacherId: owner.uid,
        courseId: course,
        courseName: courseLabel(course),
        courseKey: makeCourseKey(DEMO_PROGRAM, DEMO_YEAR, course),
        date: dateStr(day),
        createdAt: Date.now() - day * 86400000,
      }
      await put('attendanceSessions', session)
    }
  }

  log('Writing announcements…')
  for (const a of mockAnnouncements) {
    const announcement: Announcement = { ...a, id: `demo_${a.id}`, authorId: cr.uid, authorName: cr.name }
    await put('announcements', announcement)
  }

  log('Done!')
  return { students, teachers: [mehta, kapoor], cr }
}

export const DEMO_LOGINS = [
  ...DEMO_STUDENT_SEEDS.map((s) => ({ ...s, role: 'student' as const, isClassRepresentative: false })),
  { ...DEMO_CR_SEED, role: 'student' as const, isClassRepresentative: true },
  ...DEMO_TEACHER_SEEDS.map((t) => ({ ...t, role: 'teacher' as const, isClassRepresentative: false })),
]