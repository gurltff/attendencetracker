import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth'

import {
  auth,
  authReady,
  isFirebaseConfigured,
} from './firebase'

import {
  getById,
  put,
} from './store'

import type {
  Role,
  UserProfile,
} from '../types'

const LS_USER =
  'sat_current_user'

/*
 * SECURITY: Password storage removed from client.
 * Non-Firebase mode is for development only.
 * Passwords are NEVER stored on client—use Firebase Auth.
 */

export async function signUp(
  name: string,
  email: string,
  password: string,
  role: Role,
  courseIds: string[],
  year?: string
): Promise<UserProfile> {

  /*
   * CR accounts must NEVER be created
   * from registration.
   *
   * A teacher assigns the CR role later.
   */
  if (role === 'cr') {
    throw new Error(
      'CR accounts cannot be created during registration. A teacher must assign the CR role.'
    )
  }

  if (
    role === 'student' &&
    (
      courseIds.length !== 1 ||
      !year
    )
  ) {
    throw new Error(
      'Please select your programme and current year.'
    )
  }

  if (
    role === 'teacher' &&
    courseIds.length === 0
  ) {
    throw new Error(
      'Please select at least one subject you teach.'
    )
  }

  let uid: string

  if (
    isFirebaseConfigured &&
    auth
  ) {
    await authReady
    try {
      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        )

      uid =
        credential.user.uid

      await sendEmailVerification(
        credential.user
      )
    } catch (error: any) {
      if (
        error?.code ===
        'auth/email-already-in-use'
      ) {
        throw new Error(
          'An account with this email already exists. Please log in instead.'
        )
      }

      throw error
    }
  } else {
    /*
     * SECURITY: Non-Firebase mode is for development/demo only.
     * Signup requires Firebase Auth in production.
     */
    throw new Error(
      'Account creation requires Firebase to be configured. Configure Firebase credentials in your environment.'
    )
  }

  const profile: UserProfile = {
    uid,
    name,
    email,
    role,
    createdAt: Date.now(),

    ...(role === 'student'
      ? {
          enrolledCourseIds:
            courseIds,
          year,
        }
      : {}),

    ...(role === 'teacher'
      ? {
          assignedCourseIds:
            courseIds,
        }
      : {}),
  }

  await put<
    UserProfile & { id: string }
  >(
    'users',
    {
      ...profile,
      id: uid,
    }
  )

  return profile
}

export async function logIn(
  email: string,
  password: string
): Promise<UserProfile> {

  // Validate email and password inputs
  if (
    !email ||
    !password ||
    typeof email !== 'string' ||
    typeof password !== 'string'
  ) {
    throw new Error(
      'Email and password are required.'
    )
  }

  const emailTrimmed =
    email.trim().toLowerCase()

  if (emailTrimmed.length === 0) {
    throw new Error(
      'Email cannot be empty.'
    )
  }

  if (password.length === 0) {
    throw new Error(
      'Password cannot be empty.'
    )
  }

  if (!isFirebaseConfigured || !auth) {
    /*
     * SECURITY: Non-Firebase login is disabled.
     * Passwords are NEVER stored on client.
     * Use Firebase Auth in production.
     */
    throw new Error(
      'Firebase Auth is required for login. Please configure your Firebase credentials.'
    )
  }

  await authReady
  try {
    const credential =
      await signInWithEmailAndPassword(
        auth,
        emailTrimmed,
        password
      )

    const profile = await getById<UserProfile>(
      'users',
      credential.user.uid
    )

    if (!profile) {
      // Sign out the user since their profile doesn't exist
      await fbSignOut(auth)
      throw new Error(
        'Your Firebase account exists, but its user profile is missing. Contact your administrator.'
      )
    }

    return profile
  } catch (error: any) {
    if (
      error?.code === 'auth/user-not-found' ||
      error?.code === 'auth/invalid-email' ||
      error?.code === 'auth/wrong-password'
    ) {
      throw new Error(
        'Invalid email or password.'
      )
    }

    throw error
  }
}

export async function resetPassword(
  email: string
) {
  if (
    !isFirebaseConfigured ||
    !auth
  ) {
    throw new Error(
      'Password reset is only available when Firebase is connected.'
    )
  }

  await sendPasswordResetEmail(
    auth,
    email
  )
}

export async function logOut() {
  if (
    isFirebaseConfigured &&
    auth
  ) {
    await fbSignOut(auth)
  }

  localStorage.removeItem(
    LS_USER
  )
  // Clean up any remaining sensitive data
  localStorage.removeItem('sat_users')
  Object.keys(localStorage)
    .filter(
      (key) => key.startsWith('sat_pwd_')
    )
    .forEach((key) =>
      localStorage.removeItem(key)
    )
}

export function watchAuthState(
  callback: (
    uid: string | null
  ) => void
): () => void {

  if (
    isFirebaseConfigured &&
    auth
  ) {
    return onAuthStateChanged(
      auth,
      (firebaseUser: User | null) =>
        callback(
          firebaseUser
            ? firebaseUser.uid
            : null
        )
    )
  }

  const raw =
    localStorage.getItem(
      LS_USER
    )

  setTimeout(() => {
    callback(
      raw
        ? JSON.parse(raw).uid
        : null
    )
  }, 0)

  return () => {}
}