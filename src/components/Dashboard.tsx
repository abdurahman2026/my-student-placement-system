import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type { StudentPreference } from '@/types'
import { DEPARTMENT_ICONS, getRankColor } from '@/types'
import UniversityHeader from '@/components/UniversityHeader'
import InfoCard from '@/components/InfoCard'
import {
  Clock, CheckCircle2, LogOut, Pencil, Sparkles, XCircle,
  User, Hash, GraduationCap, Building2, AlertCircle,
  Loader2, ArrowRight, Award, TrendingUp, FileDown,
} from 'lucide-react'
import { generatePlacementSlip } from '@/lib/pdf'

interface DashboardProps {
  onEditPreferences: () => void
}

export default function Dashboard({ onEditPreferences }: DashboardProps) {
  const { user, profile, signOut } = useAuth()
  const [preferences, setPreferences] = useState<StudentPreference | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(false)

  useEffect(() => {
    fetchPreferences()
  }, [user])

  const fetchPreferences = async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('student_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      setError('Failed to load preferences')
    } else {
      setPreferences(data as StudentPreference | null)
      setError(null)
    }
    setLoading(false)
  }

  const handleSimulatePlacement = async () => {
    if (!preferences || !user) return
    const firstChoice = preferences.ranked_departments?.[0]
    if (!firstChoice) return

    setSimulating(true)
    const { error } = await supabase
      .rpc('simulate_placement', {
        p_user_id: user.id,
        p_department: firstChoice,
      })

    if (!error) {
      await fetchPreferences()
    }
    setSimulating(false)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <UniversityHeader variant="compact" />
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-heading text-2xl font-bold text-slate-900 mb-1">
          Welcome, {profile?.full_name?.split(' ')[0] ?? 'Student'}
        </h1>
        <p className="text-slate-500 mb-6">
          View your department preferences and placement status.
        </p>

        {/* Student info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="font-heading font-bold text-lg text-slate-900 mb-4">Student Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <InfoCard icon={User} label="Full Name" value={profile?.full_name ?? '—'} />
            <InfoCard icon={Hash} label="Student ID" value={profile?.student_id ?? '—'} />
            <InfoCard icon={GraduationCap} label="GPA" value={profile ? Number(profile.gpa).toFixed(2) : '—'} />
            <InfoCard icon={Award} label="Entrance Result" value={profile ? Number(profile.entrance_result).toFixed(2) : '—'} />
            <InfoCard icon={TrendingUp} label="Composite Score" value={profile && profile.composite_score > 0 ? Number(profile.composite_score).toFixed(2) : '—'} />
            <InfoCard icon={Building2} label="Stream" value={profile?.stream ?? '—'} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-700" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <p className="text-red-700">{error}</p>
            <button onClick={fetchPreferences} className="mt-4 text-sm text-brand-700 font-medium hover:text-brand-800 transition-colors">
              Try again
            </button>
          </div>
        ) : !preferences ? (
          <div className="bg-gradient-to-br from-brand-50 to-blue-50 border border-brand-200 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-brand-700" />
            </div>
            <h3 className="font-heading font-bold text-xl text-slate-900 mb-2">
              Submit Your Department Preferences
            </h3>
            <p className="text-slate-600 mb-6 max-w-md mx-auto">
              You haven't submitted your department preferences yet. Rank all 9 departments to complete your placement process.
            </p>
            <button
              onClick={onEditPreferences}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-700 text-white font-semibold hover:bg-brand-800 transition-colors"
            >
              Start Ranking
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Placement status */}
            {preferences.is_published ? (
              <div className={`rounded-2xl p-6 mb-6 ${
                preferences.status === 'placed'
                  ? 'bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200'
                  : preferences.status === 'rejected'
                    ? 'bg-gradient-to-br from-red-50 to-rose-50 border border-red-200'
                    : 'bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    preferences.status === 'placed' ? 'bg-emerald-100'
                      : preferences.status === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
                  }`}>
                    {preferences.status === 'placed' ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    ) : preferences.status === 'rejected' ? (
                      <XCircle className="w-8 h-8 text-red-600" />
                    ) : (
                      <Clock className="w-8 h-8 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${
                      preferences.status === 'placed' ? 'text-emerald-700'
                        : preferences.status === 'rejected' ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      Placement Status
                    </p>
                    {preferences.status === 'placed' ? (
                      <>
                        <h3 className="font-heading font-bold text-xl text-slate-900">
                          Placed in {preferences.placed_department}
                        </h3>
                        <p className="text-sm text-slate-600 mt-0.5">
                          Congratulations! Your placement has been confirmed.
                        </p>
                        <button
                          onClick={() => profile && generatePlacementSlip(profile, preferences)}
                          className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                        >
                          <FileDown className="w-4 h-4" />
                          Download Placement Slip (PDF)
                        </button>
                      </>
                    ) : preferences.status === 'rejected' ? (
                      <>
                        <h3 className="font-heading font-bold text-xl text-slate-900">
                          Not Placed
                        </h3>
                        <p className="text-sm text-slate-600 mt-0.5">
                          Unfortunately, no department had capacity for your preferences. Please contact the registrar's office.
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-heading font-bold text-xl text-slate-900">
                          Pending
                        </h3>
                        <p className="text-sm text-slate-600 mt-0.5">
                          Your placement is being processed. Check back later for updates.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl p-6 mb-6 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-slate-200">
                    <Clock className="w-8 h-8 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      Placement Status
                    </p>
                    <h3 className="font-heading font-bold text-xl text-slate-700">
                      Awaiting Results
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Placement results have not been published yet. Check back later for updates.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences list */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-bold text-lg text-slate-900">
                  Your Department Preferences
                </h2>
                {preferences.status === 'pending' && !preferences.is_published && (
                  <button
                    onClick={onEditPreferences}
                    className="flex items-center gap-2 text-sm text-brand-700 font-medium hover:text-brand-800 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {preferences.ranked_departments.map((dept: string, index: number) => {
                  const Icon = DEPARTMENT_ICONS[dept]
                  const isPlaced = preferences.status === 'placed' && preferences.placed_department === dept
                  return (
                    <div
                      key={dept}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        isPlaced
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${getRankColor(index)}`}>
                        {index + 1}
                      </div>
                      {Icon && <Icon className="w-5 h-5 text-slate-500 flex-shrink-0" />}
                      <span className="flex-1 font-medium text-slate-800">{dept}</span>
                      {isPlaced && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold">
                          Placed
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <p className="mt-4 text-xs text-slate-400">
                Submitted on {new Date(preferences.submitted_at).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </p>
            </div>

            {/* Demo: Simulate placement */}
            {preferences.status === 'pending' && !preferences.is_published && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-heading font-semibold text-slate-800 text-sm">
                      Demo: Simulate Placement Result
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 mb-3">
                      See how the placement notification will look when results are announced.
                    </p>
                    <button
                      onClick={handleSimulatePlacement}
                      disabled={simulating}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors disabled:opacity-50"
                    >
                      {simulating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Simulating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Simulate Placement
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
