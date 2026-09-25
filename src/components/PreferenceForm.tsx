import { useEffect, useState, type DragEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { DEPARTMENTS, DEPARTMENT_ICONS, getRankColor } from '@/types'
import UniversityHeader from '@/components/UniversityHeader'
import InfoCard from '@/components/InfoCard'
import {
  GripVertical, ChevronUp, ChevronDown, CheckCircle2,
  AlertCircle, Loader2, ArrowLeft, User, Hash,
  GraduationCap, Building2, Award,
} from 'lucide-react'

interface PreferenceFormProps {
  onBack: () => void
}

export default function PreferenceForm({ onBack }: PreferenceFormProps) {
  const { user, profile } = useAuth()
  const [departments, setDepartments] = useState<string[]>([...DEPARTMENTS])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data } = await supabase
        .from('student_preferences')
        .select('ranked_departments')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data?.ranked_departments && Array.isArray(data.ranked_departments) && data.ranked_departments.length === 9) {
        setDepartments(data.ranked_departments as string[])
      }
      setLoading(false)
    })()
  }, [user])

  const handleDragStart = (e: DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDrop = (e: DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }
    const newDepts = [...departments]
    const [dragged] = newDepts.splice(draggedIndex, 1)
    newDepts.splice(index, 0, dragged)
    setDepartments(newDepts)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const newDepts = [...departments]
    ;[newDepts[index - 1], newDepts[index]] = [newDepts[index], newDepts[index - 1]]
    setDepartments(newDepts)
  }

  const moveDown = (index: number) => {
    if (index === departments.length - 1) return
    const newDepts = [...departments]
    ;[newDepts[index], newDepts[index + 1]] = [newDepts[index + 1], newDepts[index]]
    setDepartments(newDepts)
  }

  const isValid = departments.length === 9 && new Set(departments).size === 9

  const handleSubmit = async () => {
    if (!user || !isValid) return
    setSubmitting(true)
    setSubmitError(null)

    const { error } = await supabase
      .from('student_preferences')
      .upsert({
        user_id: user.id,
        ranked_departments: departments,
        status: 'pending',
        placed_department: null,
      }, {
        onConflict: 'user_id',
      })

    setSubmitting(false)

    if (error) {
      setSubmitError('Failed to save preferences. Please try again.')
    } else {
      setSubmitSuccess(true)
      setTimeout(() => onBack(), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-700" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <UniversityHeader variant="compact" />
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Student info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="font-heading font-bold text-lg text-slate-900 mb-4">Student Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <InfoCard icon={User} label="Full Name" value={profile?.full_name ?? '—'} />
            <InfoCard icon={Hash} label="Student ID" value={profile?.student_id ?? '—'} />
            <InfoCard icon={GraduationCap} label="GPA" value={profile ? Number(profile.gpa).toFixed(2) : '—'} />
            <InfoCard icon={Award} label="Entrance Result" value={profile ? Number(profile.entrance_result).toFixed(2) : '—'} />
            <InfoCard icon={Building2} label="Stream" value={profile?.stream ?? '—'} />
          </div>
        </div>

        {/* Ranking form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
            <div>
              <h2 className="font-heading font-bold text-lg text-slate-900">
                Rank Your Department Preferences
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Drag to reorder, or use the arrows. Rank 1 is your top choice.
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0 ${
              isValid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {departments.length}/9 ranked
            </div>
          </div>

          <div className="space-y-2">
            {departments.map((dept, index) => {
              const Icon = DEPARTMENT_ICONS[dept]
              const isDragged = draggedIndex === index
              const isDragOver = dragOverIndex === index && draggedIndex !== index

              return (
                <div
                  key={dept}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                    isDragged ? 'opacity-40 scale-95' : ''
                  } ${
                    isDragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${getRankColor(index)}`}>
                    {index + 1}
                  </div>

                  {Icon && <Icon className="w-5 h-5 text-slate-500 flex-shrink-0" />}

                  <span className="flex-1 font-medium text-slate-800">{dept}</span>

                  <GripVertical className="w-5 h-5 text-slate-300 hidden sm:block" />

                  <div className="flex gap-1">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-700 hover:bg-brand-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === departments.length - 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-700 hover:bg-brand-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {!isValid && (
            <p className="mt-4 text-sm text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              All 9 departments must be ranked. Each department should appear exactly once.
            </p>
          )}

          <button
            onClick={() => { setSubmitError(null); setShowConfirmModal(true) }}
            disabled={!isValid}
            className="w-full mt-6 px-4 py-3.5 rounded-xl bg-brand-700 text-white font-semibold hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Preferences
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirmModal && !submitSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !submitting && setShowConfirmModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto scrollbar-thin animate-slide-up">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-brand-700" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-900">
                    Confirm Your Preferences
                  </h3>
                  <p className="text-sm text-slate-500">
                    Review your ranking before submitting
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <ol className="space-y-2">
                {departments.map((dept, i) => {
                  const Icon = DEPARTMENT_ICONS[dept]
                  return (
                    <li key={dept} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${getRankColor(i)}`}>
                        {i + 1}
                      </span>
                      {Icon && <Icon className="w-5 h-5 text-slate-600" />}
                      <span className="font-medium text-slate-800">{dept}</span>
                    </li>
                  )
                })}
              </ol>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl bg-brand-700 text-white font-semibold hover:bg-brand-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Confirm & Submit'
                  )}
                </button>
              </div>

              {submitError && (
                <p className="mt-4 text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {submitError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success message */}
      {submitSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-slide-up">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h3 className="font-heading font-bold text-xl text-slate-900 mb-2">
              Preferences Submitted!
            </h3>
            <p className="text-slate-600">
              Your department preferences have been saved successfully. Redirecting to your dashboard...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
