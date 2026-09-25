import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { StudentProfile, AdminProfile, SignUpData } from '@/types'

interface AuthContextType {
  user: User | null
  profile: StudentProfile | null
  adminProfile: AdminProfile | null
  loading: boolean
  isAdmin: boolean
  signIn: (studentId: string, password: string) => Promise<{ error: string | null }>
  signUp: (data: SignUpData) => Promise<{ error: string | null }>
  adminSignIn: (adminId: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = adminProfile !== null

  // When a manual sign-in (signIn/signUp/adminSignIn) sets state directly,
  // the onAuthStateChange SIGNED_IN event that follows should not re-fetch
  // and overwrite that state. This ref is set to true before the manual
  // sign-in call, and checked/cleared in the event handler.
  const skipNextAuthEvent = useRef(false)

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setAdminProfile(null)
          setLoading(false)
          return
        }

        if (event === 'INITIAL_SESSION') {
          setUser(session?.user ?? null)
          if (session?.user) {
            setLoading(true)
            ;(async () => {
              const { data: adminData } = await supabase
                .from('admin_profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle()

              if (adminData) {
                if (mounted) {
                  setAdminProfile(adminData as AdminProfile)
                  setProfile(null)
                  setLoading(false)
                }
                return
              }

              const { data: studentData } = await supabase
                .from('student_profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle()

              if (mounted) {
                setProfile(studentData as StudentProfile | null)
                setAdminProfile(null)
                setLoading(false)
              }
            })()
          } else {
            setLoading(false)
          }
          return
        }

        if (event === 'SIGNED_IN') {
          if (skipNextAuthEvent.current) {
            skipNextAuthEvent.current = false
            return
          }
          setUser(session?.user ?? null)
          if (session?.user) {
            setLoading(true)
            ;(async () => {
              const { data: adminData } = await supabase
                .from('admin_profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle()

              if (adminData) {
                if (mounted) {
                  setAdminProfile(adminData as AdminProfile)
                  setProfile(null)
                  setLoading(false)
                }
                return
              }

              const { data: studentData } = await supabase
                .from('student_profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle()

              if (mounted) {
                setProfile(studentData as StudentProfile | null)
                setAdminProfile(null)
                setLoading(false)
              }
            })()
          }
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (studentId: string, password: string) => {
    const email = `${studentId.trim().toLowerCase()}@mau.edu.et`
    skipNextAuthEvent.current = true
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      skipNextAuthEvent.current = false
      return { error: 'Invalid Student ID or password.' }
    }

    setUser(data.user)

    if (data.user) {
      setLoading(true)
      const { data: profileData } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('user_id', data.user.id)
        .maybeSingle()

      setProfile(profileData as StudentProfile | null)
      setAdminProfile(null)
      setLoading(false)
    }

    return { error: null }
  }

  const signUp = async (data: SignUpData) => {
    const email = `${data.studentId.trim().toLowerCase()}@mau.edu.et`
    const { data: authData, error } = await supabase.auth.signUp({ email, password: data.password })

    if (error) {
      if (error.message.includes('already')) return { error: 'This Student ID is already registered.' }
      return { error: error.message }
    }
    if (!authData.user) return { error: 'Registration failed. Please try again.' }

    const { error: profileError } = await supabase
      .from('student_profiles')
      .insert({
        student_id: data.studentId.trim(),
        full_name: data.fullName.trim(),
        gpa: data.gpa,
        stream: data.stream,
        entrance_result: data.entranceResult,
      })

    if (profileError) {
      await supabase.auth.signOut()
      if (profileError.code === '23505') return { error: 'This Student ID is already registered.' }
      return { error: 'Failed to create student profile.' }
    }

    setUser(authData.user)
    setLoading(true)
    const { data: profileData } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    setProfile(profileData as StudentProfile | null)
    setAdminProfile(null)
    setLoading(false)

    return { error: null }
  }

  const adminSignIn = async (adminId: string, password: string) => {
    const email = `${adminId.trim().toLowerCase()}@mau.edu.et`
    skipNextAuthEvent.current = true
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      skipNextAuthEvent.current = false
      return { error: 'Invalid Admin ID or Password. Please check your credentials and try again.' }
    }

    if (!data.user) {
      skipNextAuthEvent.current = false
      return { error: 'Sign-in failed. No user returned. Please try again.' }
    }

    setLoading(true)
    const { data: adminData, error: adminError } = await supabase
      .from('admin_profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (adminError || !adminData) {
      await supabase.auth.signOut()
      setUser(null)
      setAdminProfile(null)
      setLoading(false)
      skipNextAuthEvent.current = false
      return { error: 'This account does not have admin access. Please contact the system administrator.' }
    }

    setUser(data.user)
    setAdminProfile(adminData as AdminProfile)
    setProfile(null)
    setLoading(false)

    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setAdminProfile(null)
  }

  return (
    <AuthContext.Provider value={{
      user, profile, adminProfile, loading, isAdmin,
      signIn, signUp, adminSignIn, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
