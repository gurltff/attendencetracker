import type { CourseCategory } from '../types'

/**
 * Minimum attendance required.
 *
 * Keep this as one central constant so the entire application
 * uses exactly the same rule.
 */
export const MINIMUM_ATTENDANCE_PERCENT = 67

export const TARGET_ATTENDANCE_PERCENT = 75

export const MAX_MARKS_BY_CATEGORY: Record<
  CourseCategory,
  6 | 5 | 2
> = {
  DSC_MAIN_6: 6,
  DSC_MAIN_5: 5,
  SEC_2: 2,
  GE_5: 5,
}

const MARKS_TABLE: Record<
  number,
  { min: number; marks: number }[]
> = {
  6: [
    { min: 85, marks: 6.0 },
    { min: 80, marks: 4.8 },
    { min: 75, marks: 3.6 },
    { min: 70, marks: 2.4 },
    { min: 67, marks: 1.2 },
  ],

  5: [
    { min: 85, marks: 5 },
    { min: 80, marks: 4 },
    { min: 75, marks: 3 },
    { min: 70, marks: 2 },
    { min: 67, marks: 1 },
  ],

  2: [
    { min: 85, marks: 2 },
    { min: 80, marks: 1.6 },
    { min: 75, marks: 1.2 },
    { min: 70, marks: 0.8 },
    { min: 67, marks: 0.4 },
  ],
}

export function calcAttendancePercent(
  present: number,
  total: number
): number {
  if (total <= 0) return 0

  return (present / total) * 100
}

export function calcAttendanceMarks(
  percent: number,
  maxMarks: 6 | 5 | 2
): number {
  if (
    percent <
    MINIMUM_ATTENDANCE_PERCENT
  ) {
    return 0
  }

  const table = MARKS_TABLE[maxMarks]

  for (const row of table) {
    if (percent >= row.min) {
      return row.marks
    }
  }

  return 0
}

export function classesNeededForTarget(
  present: number,
  total: number,
  target = TARGET_ATTENDANCE_PERCENT / 100
): number {
  if (total <= 0) return 0

  const needed = Math.ceil(
    (target * total - present) /
      (1 - target)
  )

  return Math.max(0, needed)
}

export function isShortage(
  percent: number
): boolean {
  return (
    percent <
    MINIMUM_ATTENDANCE_PERCENT
  )
}

export function isEligible(
  percent: number
): boolean {
  return (
    percent >=
    MINIMUM_ATTENDANCE_PERCENT
  )
}

export function formatMarksLabel(
  percent: number,
  marks: number,
  maxMarks: number
): string {
  return `${percent.toFixed(0)}% → ${marks} / ${maxMarks} attendance marks`
}