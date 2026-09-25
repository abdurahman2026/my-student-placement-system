import { useState } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Login from '@/components/Login'
import Dashboard from '@/components/Dashboard'
import PreferenceForm from '@/components/PreferenceForm'
import AdminPanel from '@/components/AdminPanel'
import { GraduationCap, LogOut } from 'lucide-react'

function AppContent() {
  const { user, profile, adminProfile, loading, isAdmin, signOut } = useAuth()
  const [view, setView] = useState<'dashboard' | 'preferences'>('dashboard')
  const [adminView, setAdminView] = useState<'students' | 'placement' | 'admin-mgmt' | 'audit-logs'>('students')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-700" />
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  if (isAdmin && adminProfile) {
    return (
      <AdminPanel
        adminProfile={adminProfile}
        view={adminView}
        onViewChange={setAdminView}
        onSignOut={signOut}
      />
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="font-heading font-bold text-xl text-slate-900 mb-2">
            Profile Not Found
          </h2>
          <p className="text-slate-600 mb-6">
            Your student profile could not be found. Please contact the registrar's office for assistance.
          </p>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-700 text-white font-semibold hover:bg-brand-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return view === 'dashboard' ? (
    <Dashboard onEditPreferences={() => setView('preferences')} />
  ) : (
    <PreferenceForm onBack={() => setView('dashboard')} />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
