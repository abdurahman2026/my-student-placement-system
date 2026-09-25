import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { AdminProfile, StudentWithPreferences, DepartmentCapacity, PlacementSummary, AuditLog } from '@/types'
import { DEPARTMENTS, DEPARTMENT_ICONS, getRankColor } from '@/types'
import UniversityHeader from '@/components/UniversityHeader'
import {
  LogOut, Users, Settings2, Search, Download, Upload, Loader2,
  AlertCircle, CheckCircle2, XCircle, Clock, Building2, TrendingUp,
  Award, BarChart3, Table, FileSpreadsheet, Calculator, Info,
  Shield, UserPlus, Pencil, Trash2, X, Printer, ScrollText,
} from 'lucide-react'
import { generatePlacementReport } from '@/lib/pdf'

interface AdminPanelProps {
  adminProfile: AdminProfile
  view: 'students' | 'placement' | 'admin-mgmt' | 'audit-logs'
  onViewChange: (view: 'students' | 'placement' | 'admin-mgmt' | 'audit-logs') => void
  onSignOut: () => void
}

export default function AdminPanel({ adminProfile, view, onViewChange, onSignOut }: AdminPanelProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <UniversityHeader variant="compact" />
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-sm font-medium text-amber-800">{adminProfile.full_name}</span>
              <span className="text-xs text-amber-600">Admin</span>
            </div>
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex p-1 bg-slate-100 rounded-xl mb-6 max-w-2xl">
          <button
            onClick={() => onViewChange('students')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
              view === 'students' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Student Management
          </button>
          <button
            onClick={() => onViewChange('placement')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
              view === 'placement' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            Placement & Results
          </button>
          <button
            onClick={() => onViewChange('admin-mgmt')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
              view === 'admin-mgmt' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            Admin Management
          </button>
          <button
            onClick={() => onViewChange('audit-logs')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
              view === 'audit-logs' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ScrollText className="w-4 h-4" />
            Audit Logs
          </button>
        </div>

        {view === 'students' ? <StudentManagement /> : view === 'placement' ? <PlacementManagement /> : view === 'audit-logs' ? <AuditLogs /> : <AdminManagement adminProfile={adminProfile} />}
      </div>
    </div>
  )
}

interface CsvRow {
  student_id: string
  full_name: string
  grade_12_score: number
  first_year_gpa: number
  entrance_exam_score: number
  is_female: boolean
  has_disability: boolean
  is_developing_region: boolean
}

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.')

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    result.push(current)
    return result
  }

  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase())
  const required = ['student_id', 'full_name', 'grade_12_score', 'first_year_gpa', 'entrance_exam_score', 'is_female', 'has_disability', 'is_developing_region']
  const missing = required.filter((r) => !headers.includes(r))
  if (missing.length > 0) throw new Error(`Missing required columns: ${missing.join(', ')}`)

  const colIndex: Record<string, number> = {}
  headers.forEach((h, i) => { colIndex[h] = i })

  const parseBool = (val: string): boolean => {
    const v = val.trim().toLowerCase()
    return v === 'true' || v === '1' || v === 'yes' || v === 'y'
  }

  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i])
    rows.push({
      student_id: cells[colIndex['student_id']]?.trim() ?? '',
      full_name: cells[colIndex['full_name']]?.trim() ?? '',
      grade_12_score: parseFloat(cells[colIndex['grade_12_score']]) || 0,
      first_year_gpa: parseFloat(cells[colIndex['first_year_gpa']]) || 0,
      entrance_exam_score: parseFloat(cells[colIndex['entrance_exam_score']]) || 0,
      is_female: parseBool(cells[colIndex['is_female']] ?? 'false'),
      has_disability: parseBool(cells[colIndex['has_disability']] ?? 'false'),
      is_developing_region: parseBool(cells[colIndex['is_developing_region']] ?? 'false'),
    })
  }

  return rows
}

function StudentManagement() {
  const [students, setStudents] = useState<StudentWithPreferences[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [streamFilter, setStreamFilter] = useState('')
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importPreview, setImportPreview] = useState<CsvRow[] | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchStudents = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.rpc('get_all_students_with_preferences')

    if (error) {
      setError('Failed to load student data.')
    } else {
      setStudents(data as StudentWithPreferences[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch = !search ||
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        s.student_id.toLowerCase().includes(search.toLowerCase())
      const matchesStream = !streamFilter || s.stream === streamFilter
      return matchesSearch && matchesStream
    })
  }, [students, search, streamFilter])

  const streams = [...new Set(students.map((s) => s.stream))].sort()

  const handleDownloadTemplate = () => {
    const headers = ['student_id', 'full_name', 'grade_12_score', 'first_year_gpa', 'entrance_exam_score', 'is_female', 'has_disability', 'is_developing_region']
    const sampleRows = [
      ['MAU/2024/001', 'Abebe Bekele', '85.50', '3.45', '78.00', 'false', 'false', 'false'],
      ['MAU/2024/002', 'Sara Tadesse', '92.00', '3.80', '88.50', 'true', 'false', 'true'],
      ['MAU/2024/003', 'Dawit Kebede', '75.00', '3.10', '70.00', 'false', 'true', 'false'],
    ]
    const csv = [headers, ...sampleRows].map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'student_scores_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    setImportMessage(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const rows = parseCSV(text)
        if (rows.length === 0) {
          setImportError('No data rows found in the file.')
          return
        }
        setImportPreview(rows)
        setShowImportModal(true)
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to parse CSV file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleConfirmImport = async () => {
    if (!importPreview) return
    setImporting(true)
    setImportError(null)
    setImportMessage(null)

    let successCount = 0
    let notFoundCount = 0
    const notFoundIds: string[] = []

    for (const row of importPreview) {
      const { data: existing } = await supabase
        .from('student_profiles')
        .select('id')
        .eq('student_id', row.student_id)
        .maybeSingle()

      if (!existing) {
        notFoundCount++
        notFoundIds.push(row.student_id)
        continue
      }

      const { error } = await supabase
        .from('student_profiles')
        .update({
          grade_12_score: row.grade_12_score,
          first_year_gpa: row.first_year_gpa,
          entrance_result: row.entrance_exam_score,
          is_female: row.is_female,
          has_disability: row.has_disability,
          is_developing_region: row.is_developing_region,
        })
        .eq('student_id', row.student_id)

      if (!error) successCount++
    }

    if (successCount > 0) {
      const { data: calcCount } = await supabase.rpc('calculate_composite_scores')
      setImportMessage(
        `Imported scores for ${successCount} student(s).` +
        (calcCount ? ` Composite scores calculated for ${calcCount} student(s).` : '') +
        (notFoundCount > 0 ? ` ${notFoundCount} student(s) not found (they must register first).` : '')
      )
      await supabase.rpc('insert_audit_log', {
        p_action: 'score_import',
        p_description: `Imported scores for ${successCount} student(s)${notFoundCount > 0 ? `, ${notFoundCount} not found` : ''}`,
        p_metadata: { successCount, notFoundCount, totalRows: importPreview.length },
      })
      await fetchStudents()
    } else if (notFoundCount > 0) {
      setImportError(
        `No students were updated. ${notFoundCount} student(s) not found: ${notFoundIds.slice(0, 5).join(', ')}${notFoundIds.length > 5 ? '...' : ''}. Students must register before you can import their scores.`
      )
    }

    setImporting(false)
    setShowImportModal(false)
    setImportPreview(null)
  }

  const handleExportCSV = () => {
    const headers = ['Full Name', 'Student ID', 'GPA', 'Stream', 'Entrance Result', 'Grade 12 Score', 'First Year GPA', 'Female', 'Disability', 'Developing Region', 'Bonus Points', 'Composite Score', 'Status', 'Placed Department', 'Rank 1', 'Rank 2', 'Rank 3', 'Rank 4', 'Rank 5', 'Rank 6', 'Rank 7', 'Rank 8', 'Rank 9']
    const rows = filtered.map((s) => {
      const ranks = s.ranked_departments || []
      return [
        s.full_name,
        s.student_id,
        s.gpa?.toString() ?? '',
        s.stream,
        s.entrance_result?.toString() ?? '',
        s.grade_12_score?.toString() ?? '',
        s.first_year_gpa?.toString() ?? '',
        s.is_female ? 'true' : 'false',
        s.has_disability ? 'true' : 'false',
        s.is_developing_region ? 'true' : 'false',
        s.bonus_points?.toString() ?? '',
        s.composite_score?.toString() ?? '',
        s.status ?? 'No preferences',
        s.placed_department ?? '',
        ...Array.from({ length: 9 }, (_, i) => ranks[i] ?? ''),
      ]
    })
    const csv = [headers, ...rows].map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `students_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-900">Student Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {students.length} registered students, {students.filter((s) => s.ranked_departments).length} with submitted preferences
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export to CSV
        </button>
      </div>

      {/* CSV Import section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet className="w-5 h-5 text-brand-700" />
          <h2 className="font-heading font-bold text-base text-slate-900">Import Student Scores</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Upload a CSV file with student scores. The system will automatically calculate each student's Total Composite Score using:
          <span className="block mt-1 font-mono text-xs bg-slate-50 px-3 py-2 rounded-lg text-slate-700">
            Total = (Grade12 &times; 0.20) + (GPA &divide; 4.0 &times; 50) + (Entrance &times; 0.30) + Bonus
          </span>
          <span className="block mt-1.5 text-xs text-slate-400">
            Bonus: Female +2, Disability +5, Developing Region +3 (max +10)
          </span>
        </p>
        {importMessage && (
          <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{importMessage}</span>
          </div>
        )}
        {importError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{importError}</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? (<><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>) : (<><Upload className="w-4 h-4" /> Upload Student Scores</>)}
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Download Sample Template
          </button>
        </div>
      </div>

      {/* Search and filter */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or Student ID..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
          </div>
          <select
            value={streamFilter}
            onChange={(e) => setStreamFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
          >
            <option value="">All Streams</option>
            {streams.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
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
          <button onClick={fetchStudents} className="mt-4 text-sm text-brand-700 font-medium hover:text-brand-800 transition-colors">
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No students found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Full Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Student ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">GPA</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Gr12</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Entrance</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Bonus</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Composite</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Stream</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Preferences (1-9)</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.user_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{s.full_name}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-xs">{s.student_id}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s.gpa ? Number(s.gpa).toFixed(2) : '—'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s.grade_12_score ? Number(s.grade_12_score).toFixed(1) : '—'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s.entrance_result ? Number(s.entrance_result).toFixed(1) : '—'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {s.bonus_points > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                          +{Number(s.bonus_points).toFixed(0)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.composite_score > 0 ? (
                        <span className="font-bold text-brand-700">{Number(s.composite_score).toFixed(2)}</span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s.stream}</td>
                    <td className="px-4 py-3">
                      {s.ranked_departments && s.ranked_departments.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {s.ranked_departments.map((dept, i) => {
                            const Icon = DEPARTMENT_ICONS[dept]
                            const isPlaced = s.status === 'placed' && s.placed_department === dept
                            return (
                              <div
                                key={dept}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs ${
                                  isPlaced ? 'bg-emerald-100 text-emerald-700 font-semibold' : 'bg-slate-100 text-slate-600'
                                }`}
                                title={dept}
                              >
                                <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${getRankColor(i)}`}>
                                  {i + 1}
                                </span>
                                {Icon && <Icon className="w-3 h-3" />}
                                <span className="truncate max-w-[80px]">{dept}</span>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">Not submitted</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.status === 'placed' && s.placed_department ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          {s.placed_department}
                        </span>
                      ) : s.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                          <XCircle className="w-3 h-3" />
                          Rejected
                        </span>
                      ) : s.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import preview modal */}
      {showImportModal && importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !importing && setShowImportModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-brand-700" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg text-slate-900">Confirm Import</h3>
                  <p className="text-sm text-slate-500">
                    {importPreview.length} student(s) found in the file
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 font-semibold text-slate-700">Student ID</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-700">Name</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-700">Gr12</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-700">GPA</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-700">Entrance</th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-700">F</th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-700">D</th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-700">DR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-mono text-slate-600">{row.student_id}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{row.full_name}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{row.grade_12_score.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{row.first_year_gpa.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{row.entrance_exam_score.toFixed(1)}</td>
                        <td className="px-3 py-2 text-center">{row.is_female ? <span className="text-blue-600">Yes</span> : '—'}</td>
                        <td className="px-3 py-2 text-center">{row.has_disability ? <span className="text-blue-600">Yes</span> : '—'}</td>
                        <td className="px-3 py-2 text-center">{row.is_developing_region ? <span className="text-blue-600">Yes</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importPreview.length > 10 && (
                <p className="text-xs text-slate-400 mb-3">Showing first 10 of {importPreview.length} rows.</p>
              )}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2 mb-4">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Scores will be matched to existing students by Student ID. Students must already be registered.
                  Composite scores will be automatically calculated after import.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowImportModal(false); setImportPreview(null) }}
                  disabled={importing}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="flex-1 px-4 py-3 rounded-xl bg-brand-700 text-white font-semibold hover:bg-brand-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing ? (<><Loader2 className="w-5 h-5 animate-spin" /> Importing...</>) : (<><CheckCircle2 className="w-5 h-5" /> Confirm Import</>)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PlacementManagement() {
  const [capacities, setCapacities] = useState<DepartmentCapacity[]>([])
  const [placementSummary, setPlacementSummary] = useState<PlacementSummary[]>([])
  const [students, setStudents] = useState<StudentWithPreferences[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isPublished, setIsPublished] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const { data: capData } = await supabase.from('department_capacities').select('*').order('department_name')
    const { data: studentData } = await supabase.rpc('get_all_students_with_preferences')

    if (capData) setCapacities(capData as DepartmentCapacity[])
    if (studentData) {
      setStudents(studentData as StudentWithPreferences[])
      const published = (studentData as StudentWithPreferences[]).some((s) => s.is_published)
      setIsPublished(published)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCapacityChange = async (deptName: string, value: number) => {
    const { error } = await supabase
      .from('department_capacities')
      .update({ capacity: value, updated_at: new Date().toISOString() })
      .eq('department_name', deptName)

    if (!error) {
      setCapacities((prev) =>
        prev.map((c) => c.department_name === deptName ? { ...c, capacity: value } : c)
      )
      await supabase.rpc('insert_audit_log', {
        p_action: 'capacity_change',
        p_description: `Updated capacity for ${deptName} to ${value}`,
        p_metadata: { department: deptName, newCapacity: value },
      })
    }
  }

  const handleCalculateScores = async () => {
    setCalculating(true)
    setError(null)
    setMessage(null)
    const { data, error } = await supabase.rpc('calculate_composite_scores')

    if (error) {
      setError('Failed to calculate composite scores.')
    } else {
      setMessage(`Composite scores calculated for ${data} student(s).`)
      await supabase.rpc('insert_audit_log', {
        p_action: 'calculate_scores',
        p_description: `Calculated composite scores for ${data} student(s)`,
        p_metadata: { studentCount: data },
      })
      await fetchData()
    }
    setCalculating(false)
  }

  const handleRunPlacement = async () => {
    setRunning(true)
    setError(null)
    setMessage(null)
    const { data, error } = await supabase.rpc('run_placement')

    if (error) {
      setError('Failed to run placement algorithm.')
    } else {
      setPlacementSummary(data as PlacementSummary[])
      setMessage('Placement completed successfully. Review the results below.')
      const summary = data as PlacementSummary[]
      const placedTotal = summary.reduce((sum, s) => sum + Number(s.assigned_count), 0)
      await supabase.rpc('insert_audit_log', {
        p_action: 'run_placement',
        p_description: `Ran placement algorithm: ${placedTotal} student(s) placed across ${summary.length} department(s)`,
        p_metadata: { placedTotal, departments: summary.length },
      })
      await fetchData()
    }
    setRunning(false)
  }

  const handlePublish = async () => {
    setPublishing(true)
    setError(null)
    const { data, error } = await supabase.rpc('publish_placement_results')

    if (error) {
      setError('Failed to publish results.')
    } else {
      setMessage(`Results published. ${data} students can now view their placement.`)
      setIsPublished(true)
      await supabase.rpc('insert_audit_log', {
        p_action: 'publish_results',
        p_description: `Published placement results to ${data} student(s)`,
        p_metadata: { studentCount: data },
      })
      await fetchData()
    }
    setPublishing(false)
  }

  const handleExportPlacementCSV = () => {
    const headers = ['Full Name', 'Student ID', 'GPA', 'Entrance Result', 'Grade 12 Score', 'First Year GPA', 'Bonus Points', 'Composite Score', 'Stream', 'Status', 'Placed Department']
    const rows = students
      .filter((s) => s.ranked_departments)
      .map((s) => [
        s.full_name,
        s.student_id,
        s.gpa?.toString() ?? '',
        s.entrance_result?.toString() ?? '',
        s.grade_12_score?.toString() ?? '',
        s.first_year_gpa?.toString() ?? '',
        s.bonus_points?.toString() ?? '',
        s.composite_score?.toString() ?? '',
        s.stream,
        s.status ?? 'pending',
        s.placed_department ?? '',
      ])
    const csv = [headers, ...rows].map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `placement_results_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-700" />
      </div>
    )
  }

  const placedCount = students.filter((s) => s.status === 'placed').length
  const rejectedCount = students.filter((s) => s.status === 'rejected').length
  const pendingCount = students.filter((s) => s.status === 'pending' && s.ranked_departments).length
  const totalCapacity = capacities.reduce((sum, c) => sum + c.capacity, 0)
  const studentsWithScores = students.filter((s) => s.composite_score > 0).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-slate-900">Placement & Results</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Set department capacities, calculate composite scores, run the automated placement algorithm, and publish results.
        </p>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          {message}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-brand-700" />
            <span className="text-xs text-slate-500 font-medium">Total Students</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{students.filter((s) => s.ranked_departments).length}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-4 h-4 text-brand-700" />
            <span className="text-xs text-slate-500 font-medium">With Scores</span>
          </div>
          <p className="text-2xl font-bold text-brand-700">{studentsWithScores}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-slate-500 font-medium">Placed</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{placedCount}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-xs text-slate-500 font-medium">Rejected</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-slate-600" />
            <span className="text-xs text-slate-500 font-medium">Total Capacity</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalCapacity}</p>
        </div>
      </div>

      {/* Department capacities */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="font-heading font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-brand-700" />
          Department Capacities
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {capacities.map((cap) => {
            const Icon = DEPARTMENT_ICONS[cap.department_name]
            return (
              <div key={cap.department_name} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
                {Icon && (
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-brand-700" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{cap.department_name}</p>
                  <p className="text-xs text-slate-400">Max students</p>
                </div>
                <input
                  type="number"
                  min="0"
                  value={cap.capacity}
                  onChange={(e) => handleCapacityChange(cap.department_name, parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="font-heading font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-brand-700" />
          Placement Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            onClick={handleCalculateScores}
            disabled={calculating}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {calculating ? (<><Loader2 className="w-5 h-5 animate-spin" /> Calculating...</>) : (<><Calculator className="w-5 h-5" /> Calculate Scores</>)}
          </button>
          <button
            onClick={handleRunPlacement}
            disabled={running}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-700 text-white font-semibold hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? (<><Loader2 className="w-5 h-5 animate-spin" /> Running...</>) : (<><TrendingUp className="w-5 h-5" /> Run Placement</>)}
          </button>
          <button
            onClick={handleExportPlacementCSV}
            disabled={placedCount === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
          <button
            onClick={() => generatePlacementReport(students, placementSummary)}
            disabled={placedCount === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-5 h-5" />
            Print / Export PDF
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || placedCount === 0}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? (<><Loader2 className="w-5 h-5 animate-spin" /> Publishing...</>) : (<><Upload className="w-5 h-5" /> Publish Results</>)}
          </button>
        </div>
        {isPublished && (
          <p className="mt-3 text-sm text-emerald-600 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Results are published. Students can view their placement on their dashboards.
          </p>
        )}
        {pendingCount > 0 && !isPublished && (
          <p className="mt-3 text-sm text-amber-600 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {pendingCount} student(s) are pending placement. Run the algorithm to assign departments.
          </p>
        )}
        {studentsWithScores === 0 && (
          <p className="mt-3 text-sm text-blue-600 flex items-center gap-2">
            <Info className="w-4 h-4" />
            No composite scores yet. Import student scores from the Student Management tab, then click Calculate Scores.
          </p>
        )}
      </div>

      {/* Placement summary */}
      {placementSummary.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="font-heading font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-700" />
            Placement Summary
          </h2>
          <div className="space-y-2">
            {placementSummary.map((s) => {
              const Icon = DEPARTMENT_ICONS[s.department_name]
              const pct = s.capacity > 0 ? Math.round((s.assigned_count / s.capacity) * 100) : 0
              return (
                <div key={s.department_name} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
                  {Icon && (
                    <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-brand-700" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{s.department_name}</p>
                    <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-brand-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                    {s.assigned_count}/{s.capacity}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Placement results table */}
      {students.filter((s) => s.ranked_departments).length > 0 && (placedCount > 0 || rejectedCount > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-heading font-bold text-lg text-slate-900 flex items-center gap-2">
              <Table className="w-5 h-5 text-brand-700" />
              Placement Results
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Rank</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Full Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Student ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Composite</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Assigned Department</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {students
                  .filter((s) => s.ranked_departments)
                  .map((s, i) => (
                    <tr key={s.user_id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${getRankColor(i)}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{s.full_name}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap font-mono text-xs">{s.student_id}</td>
                      <td className="px-4 py-3 font-semibold text-brand-700 whitespace-nowrap">
                        {s.composite_score > 0 ? Number(s.composite_score).toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {s.placed_department ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.status === 'placed' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Placed
                          </span>
                        ) : s.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

interface AdminAccount {
  id: string
  user_id: string
  admin_id: string
  full_name: string
  created_at: string
}

function AdminManagement({ adminProfile }: { adminProfile: AdminProfile }) {
  const [admins, setAdmins] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState<AdminAccount | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [newAdminId, setNewAdminId] = useState('')
  const [newAdminName, setNewAdminName] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [editAdminId, setEditAdminId] = useState('')
  const [editAdminName, setEditAdminName] = useState('')

  const fetchAdmins = async () => {
    setLoading(true)
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Session expired. Please sign in again.')
      setLoading(false)
      return
    }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-management`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Failed to load admin accounts.')
      setLoading(false)
      return
    }

    const { admins: data } = await res.json()
    setAdmins(data as AdminAccount[])
    setLoading(false)
  }

  useEffect(() => {
    fetchAdmins()
  }, [])

  const handleCreate = async () => {
    if (!newAdminId.trim() || !newAdminName.trim() || !newAdminPassword) {
      setError('All fields are required.')
      return
    }
    if (newAdminPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Session expired.')
      setSubmitting(false)
      return
    }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-management`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        adminId: newAdminId.trim(),
        fullName: newAdminName.trim(),
        password: newAdminPassword,
      }),
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body.error || 'Failed to create admin account.')
      setSubmitting(false)
      return
    }

    setMessage(`Admin account "${newAdminId.trim()}" created successfully.`)
    setShowCreateModal(false)
    setNewAdminId('')
    setNewAdminName('')
    setNewAdminPassword('')
    setSubmitting(false)
    await fetchAdmins()
  }

  const handleEdit = async () => {
    if (!editAdminId.trim() || !editAdminName.trim()) {
      setError('Admin ID and full name are required.')
      return
    }

    setSubmitting(true)
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Session expired.')
      setSubmitting(false)
      return
    }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-management`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        adminId: editAdminId.trim(),
        fullName: editAdminName.trim(),
      }),
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body.error || 'Failed to update admin account.')
      setSubmitting(false)
      return
    }

    setMessage(`Admin "${editAdminId.trim()}" updated successfully.`)
    setShowEditModal(false)
    setEditAdminId('')
    setEditAdminName('')
    setSubmitting(false)
    await fetchAdmins()
  }

  const handleDelete = async () => {
    if (!showDeleteModal) return

    setSubmitting(true)
    setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Session expired.')
      setSubmitting(false)
      return
    }

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-management?userId=${showDeleteModal.user_id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      }
    )

    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body.error || 'Failed to delete admin account.')
      setSubmitting(false)
      return
    }

    setMessage(`Admin account "${showDeleteModal.admin_id}" has been removed.`)
    setShowDeleteModal(null)
    setSubmitting(false)
    await fetchAdmins()
  }

  const openEditModal = (admin: AdminAccount) => {
    setEditAdminId(admin.admin_id)
    setEditAdminName(admin.full_name)
    setShowEditModal(true)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-900">Admin Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create, edit, or remove admin / registrar accounts.
          </p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setError(null); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Admin
        </button>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-700" />
        </div>
      ) : admins.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No admin accounts found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Admin ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Full Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Created</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">{a.admin_id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {a.full_name}
                      {a.user_id === adminProfile.user_id && (
                        <span className="ml-2 px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-xs font-medium">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(a)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors text-xs font-medium"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      {a.user_id !== adminProfile.user_id && (
                        <button
                          onClick={() => setShowDeleteModal(a)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-xs font-medium ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create admin modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !submitting && setShowCreateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
                    <UserPlus className="w-6 h-6 text-brand-700" />
                  </div>
                  <h3 className="font-heading font-bold text-lg text-slate-900">Add New Admin</h3>
                </div>
                <button onClick={() => !submitting && setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Admin ID</label>
                <input
                  type="text"
                  value={newAdminId}
                  onChange={(e) => setNewAdminId(e.target.value)}
                  placeholder="e.g. ADMIN/002"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="e.g. Registrar Name"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowCreateModal(false); setNewAdminId(''); setNewAdminName(''); setNewAdminPassword(''); setError(null); }}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl bg-brand-700 text-white font-semibold hover:bg-brand-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (<><Loader2 className="w-5 h-5 animate-spin" /> Creating...</>) : 'Create Admin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit admin modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !submitting && setShowEditModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Pencil className="w-6 h-6 text-blue-700" />
                  </div>
                  <h3 className="font-heading font-bold text-lg text-slate-900">Edit Admin</h3>
                </div>
                <button onClick={() => !submitting && setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Admin ID</label>
                <input
                  type="text"
                  value={editAdminId}
                  disabled
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-sm cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={editAdminName}
                  onChange={(e) => setEditAdminName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowEditModal(false); setEditAdminId(''); setEditAdminName(''); setError(null); }}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl bg-brand-700 text-white font-semibold hover:bg-brand-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (<><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>) : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !submitting && setShowDeleteModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-heading font-bold text-lg text-slate-900">Remove Admin Account</h3>
              </div>
              <p className="text-sm text-slate-600 mb-1">
                Are you sure you want to remove <span className="font-semibold text-slate-900">{showDeleteModal.full_name}</span> ({showDeleteModal.admin_id})?
              </p>
              <p className="text-sm text-slate-500 mb-6">
                This will permanently delete their account and revoke all admin access. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(null); setError(null); }}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (<><Loader2 className="w-5 h-5 animate-spin" /> Removing...</>) : 'Remove Admin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ACTION_META: Record<string, { label: string; color: string; bg: string; icon: typeof Upload }> = {
  score_import: { label: 'Score Import', color: 'text-blue-700', bg: 'bg-blue-50', icon: Upload },
  capacity_change: { label: 'Capacity Change', color: 'text-amber-700', bg: 'bg-amber-50', icon: Building2 },
  run_placement: { label: 'Run Placement', color: 'text-brand-700', bg: 'bg-brand-50', icon: TrendingUp },
  publish_results: { label: 'Publish Results', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
  calculate_scores: { label: 'Calculate Scores', color: 'text-indigo-700', bg: 'bg-indigo-50', icon: Calculator },
}

function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.rpc('get_audit_logs', { p_limit: 200, p_offset: 0 })

    if (error) {
      setError('Failed to load audit logs.')
    } else {
      setLogs(data as AuditLog[])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const filtered = useMemo(() => {
    return logs.filter((l) => !actionFilter || l.action === actionFilter)
  }, [logs, actionFilter])

  const availableActions = [...new Set(logs.map((l) => l.action))].sort()

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-slate-900">Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {logs.length} recorded admin action{logs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          <ScrollText className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {availableActions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActionFilter('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                !actionFilter ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Actions
            </button>
            {availableActions.map((action) => {
              const meta = ACTION_META[action]
              return (
                <button
                  key={action}
                  onClick={() => setActionFilter(action)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    actionFilter === action ? 'bg-brand-700 text-white' : `${meta?.bg ?? 'bg-slate-100'} ${meta?.color ?? 'text-slate-600'} hover:opacity-80`
                  }`}
                >
                  {meta?.label ?? action}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-700" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <p className="text-red-700">{error}</p>
          <button onClick={fetchLogs} className="mt-4 text-sm text-brand-700 font-medium hover:text-brand-800 transition-colors">
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <ScrollText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No audit log entries found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log) => {
            const meta = ACTION_META[log.action]
            const Icon = meta?.icon ?? ScrollText
            const metaEntries = log.metadata && typeof log.metadata === 'object'
              ? Object.entries(log.metadata as Record<string, unknown>)
              : []
            return (
              <div key={log.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${meta?.bg ?? 'bg-slate-100'}`}>
                    <Icon className={`w-5 h-5 ${meta?.color ?? 'text-slate-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${meta?.bg ?? 'bg-slate-100'} ${meta?.color ?? 'text-slate-600'}`}>
                        {meta?.label ?? log.action}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(log.created_at).toLocaleString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 mt-1.5 font-medium">{log.description}</p>
                    {metaEntries.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {metaEntries.map(([key, val]) => (
                          <span key={key} className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-xs text-slate-500 font-mono">
                            {key}: {String(val)}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-1.5">
                      by <span className="font-medium text-slate-600">{log.admin_name}</span>
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}