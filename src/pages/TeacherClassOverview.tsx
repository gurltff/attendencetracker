import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getAll, put } from '../services/store'
import { useToast } from '../components/Shared'
import TeacherSubjectManager from '../components/TeacherSubjectManager'
import { parseCourseKey } from '../data/scheduleData'
import type {
  AttendanceRecord,
  UserProfile,
} from '../types'

const MIN_ATTENDANCE = 67

const norm = (value?: string | null) =>
  (value ?? '').trim().toLowerCase()

function programOf(student: UserProfile) {
  const raw =
    student.enrolledCourseIds?.[0] ?? ''

  if (raw.includes('::')) {
    return parseCourseKey(raw).programName
  }

  return raw
}

function classKey(
  programName: string,
  year: string
) {
  return `${norm(programName)}::${norm(year)}`
}

export default function TeacherClassOverview() {
  const { user, setUser } = useAuth()
  const { push } = useToast()

  const [students, setStudents] =
    useState<UserProfile[]>([])

  const [records, setRecords] =
    useState<AttendanceRecord[]>([])

  const [selectedClass, setSelectedClass] =
    useState('')

  const [editingSubjects, setEditingSubjects] =
    useState(false)

  const classes = useMemo(() => {
    const map = new Map<
      string,
      {
        programName: string
        year: string
      }
    >()

    for (
      const assignedKey of
        user?.assignedCourseIds ?? []
    ) {
      const parsed =
        parseCourseKey(assignedKey)

      if (
        !parsed.programName ||
        !parsed.year
      ) {
        continue
      }

      const key = classKey(
        parsed.programName,
        parsed.year
      )

      map.set(key, {
        programName:
          parsed.programName,
        year: parsed.year,
      })
    }

    return [...map.values()]
  }, [user?.assignedCourseIds])

  useEffect(() => {
    if (
      !selectedClass &&
      classes.length > 0
    ) {
      setSelectedClass(
        classKey(
          classes[0].programName,
          classes[0].year
        )
      )

      return
    }

    if (
      selectedClass &&
      !classes.some(
        (item) =>
          classKey(
            item.programName,
            item.year
          ) === selectedClass
      )
    ) {
      setSelectedClass(
        classes.length > 0
          ? classKey(
              classes[0].programName,
              classes[0].year
            )
          : ''
      )
    }
  }, [classes, selectedClass])

  useEffect(() => {
    async function load() {
      try {
        const [
          allUsers,
          allAttendance,
        ] = await Promise.all([
          getAll<UserProfile>('users'),
          getAll<AttendanceRecord>(
            'attendanceRecords'
          ),
        ])

        setStudents(
          allUsers.filter(
            (student) =>
              student.role === 'student' ||
              student.role === 'cr'
          )
        )

        setRecords(allAttendance)
      } catch (error) {
        console.error(error)

        push(
          'Could not load class information.',
          'error'
        )
      }
    }

    load()
  }, [push])

  const selected = classes.find(
    (item) =>
      classKey(
        item.programName,
        item.year
      ) === selectedClass
  )

  const classStudents = useMemo(() => {
    if (!selected) return []

    return students.filter(
      (student) =>
        norm(programOf(student)) ===
          norm(selected.programName) &&
        norm(student.year) ===
          norm(selected.year)
    )
  }, [students, selected])

  const rows = useMemo(() => {
    return classStudents.map(
      (student) => {
        const ownRecords =
          records.filter(
            (record) =>
              record.studentId ===
              student.uid
          )

        const present =
          ownRecords.filter(
            (record) =>
              record.status ===
              'present'
          ).length

        const total =
          ownRecords.length

        const percentage =
          total > 0
            ? (present / total) * 100
            : 0

        return {
          student,
          present,
          total,
          percentage,
        }
      }
    )
  }, [classStudents, records])

  async function makeCR(
    student: UserProfile
  ) {
    const existingCR =
      classStudents.find(
        (item) =>
          item.role === 'cr' &&
          item.uid !== student.uid
      )

    if (existingCR) {
      push(
        `${existingCR.name} is already the CR for this class. Remove them first.`,
        'error'
      )

      return
    }

    try {
      const updated: UserProfile = {
        ...student,
        role: 'cr',
        assignedCourseIds:
          student.enrolledCourseIds ?? [],
      }

      await put<UserProfile & { id: string }>(
        'users',
        {
          ...updated,
          id: student.uid,
        }
      )

      setStudents((previous) =>
        previous.map((item) =>
          item.uid === student.uid
            ? updated
            : item
        )
      )

      push(
        `${student.name} is now the CR.`,
        'success'
      )
    } catch (error) {
      console.error(error)

      push(
        'Could not make this student CR.',
        'error'
      )
    }
  }

  async function removeCR(
    student: UserProfile
  ) {
    try {
      const updated: UserProfile = {
        ...student,
        role: 'student',
      }

      delete updated.assignedCourseIds

      await put<UserProfile & { id: string }>(
        'users',
        {
          ...updated,
          id: student.uid,
        }
      )

      setStudents((previous) =>
        previous.map((item) =>
          item.uid === student.uid
            ? updated
            : item
        )
      )

      push(
        `${student.name} is no longer CR.`,
        'success'
      )
    } catch (error) {
      console.error(error)

      push(
        'Could not remove the CR role.',
        'error'
      )
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">

      {/* HEADER */}

      <div className="flex items-center justify-between flex-wrap gap-3">

        <div>
          <h1 className="text-xl font-bold">
            Teacher · Class overview
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Check overall attendance and manage
            the CR for each class.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">

          <Link
            className="btn-outline text-sm"
            to="/teacher"
          >
            📝 Attendance
          </Link>

          <Link
            className="btn-outline text-sm bg-brand-blue text-white"
            to="/teacher/classes"
          >
            📊 Manage classes
          </Link>

          <button
            type="button"
            className="btn-outline text-sm"
            onClick={() =>
              setEditingSubjects(true)
            }
          >
            ✏️ Manage my subjects
          </button>

        </div>

      </div>

      {/* CLASS SELECTOR */}

      <div className="card">

        <label className="text-sm font-medium">
          Select class
        </label>

        <select
          className="input mt-1 max-w-xl"
          value={selectedClass}
          onChange={(event) =>
            setSelectedClass(
              event.target.value
            )
          }
        >

          {classes.map((item) => (
            <option
              key={classKey(
                item.programName,
                item.year
              )}
              value={classKey(
                item.programName,
                item.year
              )}
            >
              {item.programName} · {item.year}
            </option>
          ))}

        </select>

        {!classes.length && (
          <p className="text-sm text-slate-500 mt-3">
            You have not selected any classes or
            subjects yet. Use “Manage my subjects”.
          </p>
        )}

      </div>

      {/* CLASS TABLE */}

      {selected && (
        <div className="card">

          <div className="flex items-center justify-between gap-3 mb-4">

            <div>

              <h2 className="font-semibold">
                {selected.programName} ·{' '}
                {selected.year}
              </h2>

              <p className="text-xs text-slate-500">
                {rows.length} students
              </p>

            </div>

            {rows.some(
              (row) =>
                row.student.role === 'cr'
            ) && (
              <span className="badge bg-brand-blue/10 text-brand-blue">
                CR:{' '}
                {
                  rows.find(
                    (row) =>
                      row.student.role ===
                      'cr'
                  )?.student.name
                }
              </span>
            )}

          </div>

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead>

                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">

                  <th className="py-2 pr-2">
                    Student
                  </th>

                  <th className="pr-2">
                    Present
                  </th>

                  <th className="pr-2">
                    Total
                  </th>

                  <th className="pr-2">
                    Overall attendance
                  </th>

                  <th>
                    CR
                  </th>

                </tr>

              </thead>

              <tbody>

                {rows.map((row) => (
                  <tr
                    key={row.student.uid}
                    className="border-b border-slate-100 dark:border-slate-800"
                  >

                    <td className="py-3 pr-2">

                      {row.student.name}

                      {row.student.role ===
                        'cr' && (
                        <span className="ml-2 badge bg-brand-blue/10 text-brand-blue">
                          CR
                        </span>
                      )}

                    </td>

                    <td className="pr-2">
                      {row.present}
                    </td>

                    <td className="pr-2">
                      {row.total}
                    </td>

                    <td
                      className={`pr-2 font-semibold ${
                        row.percentage <
                        MIN_ATTENDANCE
                          ? 'text-red-500'
                          : 'text-brand-green'
                      }`}
                    >
                      {row.percentage.toFixed(
                        0
                      )}
                      %
                    </td>

                    <td>

                      {row.student.role ===
                      'cr' ? (
                        <button
                          type="button"
                          className="btn-outline text-xs"
                          onClick={() =>
                            removeCR(
                              row.student
                            )
                          }
                        >
                          Remove CR
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-outline text-xs"
                          onClick={() =>
                            makeCR(
                              row.student
                            )
                          }
                        >
                          Make CR
                        </button>
                      )}

                    </td>

                  </tr>
                ))}

                {!rows.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-slate-500"
                    >
                      No students have registered
                      for this class yet.
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>

        </div>
      )}

      {editingSubjects && user && (
        <TeacherSubjectManager
          user={user}
          setUser={setUser}
          onClose={() =>
            setEditingSubjects(false)
          }
        />
      )}

    </div>
  )
}