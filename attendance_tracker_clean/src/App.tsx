import { Route, Routes } from 'react-router-dom'
import {
  Navbar,
  ProtectedRoute,
  ToastProvider,
} from './components/Shared'

import AuthPage from './pages/AuthPage'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import TeacherClassOverview from './pages/TeacherClassOverview'
import TimetablePage from './pages/TimetablePage'

export default function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen">
        <Navbar />

        <div>
          <Routes>

            {/* Login / Registration */}
            <Route
              path="/"
              element={<AuthPage />}
            />

            {/* Student */}
            <Route
              path="/student"
              element={
                <ProtectedRoute role="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />

            {/* Teacher - Attendance */}
            <Route
              path="/teacher"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />

            {/* Teacher - Manage Classes */}
            <Route
              path="/teacher/classes"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherClassOverview />
                </ProtectedRoute>
              }
            />

            {/* Timetable */}
            <Route
              path="/timetable"
              element={<TimetablePage />}
            />

          </Routes>
        </div>
      </div>
    </ToastProvider>
  )
}