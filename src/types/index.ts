import {
  BookOpen, Languages, Globe, Scroll, Landmark,
  Calculator, TrendingUp, Briefcase, Megaphone,
  type LucideIcon,
} from 'lucide-react'

export interface StudentProfile {
  id: string
  user_id: string
  student_id: string
  full_name: string
  gpa: number
  stream: string
  entrance_result: number
  grade_12_score: number
  first_year_gpa: number
  is_female: boolean
  has_disability: boolean
  is_developing_region: boolean
  bonus_points: number
  composite_score: number
  created_at: string
}

export interface StudentPreference {
  id: string
  user_id: string
  ranked_departments: string[]
  status: 'pending' | 'placed' | 'rejected'
  placed_department: string | null
  is_published: boolean
  submitted_at: string
  updated_at: string
}

export interface AdminProfile {
  id: string
  user_id: string
  admin_id: string
  full_name: string
  created_at: string
}

export interface SignUpData {
  studentId: string
  fullName: string
  password: string
  gpa: number
  stream: string
  entranceResult: number
}

export interface AdminSignUpData {
  adminId: string
  fullName: string
  password: string
}

export interface DepartmentCapacity {
  id: string
  department_name: string
  capacity: number
  updated_at: string
}

export interface StudentWithPreferences {
  user_id: string
  full_name: string
  student_id: string
  gpa: number
  stream: string
  entrance_result: number
  grade_12_score: number
  first_year_gpa: number
  is_female: boolean
  has_disability: boolean
  is_developing_region: boolean
  bonus_points: number
  composite_score: number
  ranked_departments: string[]
  status: 'pending' | 'placed' | 'rejected'
  placed_department: string | null
  is_published: boolean
}

export interface PlacementSummary {
  department_name: string
  assigned_count: number
  capacity: number
}

export interface AuditLog {
  id: string
  admin_id: string
  admin_name: string
  action: string
  description: string
  metadata: Record<string, unknown>
  created_at: string
}

export const DEPARTMENTS = [
  'Amharic Language and Literature',
  'English Language and Literature',
  'Geography and Environmental Science',
  'History and Heritage Management',
  'Political Science and International Relation',
  'Accounting and Finance',
  'Economics',
  'Management',
  'Marketing Management',
] as const

export const DEPARTMENT_ICONS: Record<string, LucideIcon> = {
  'Amharic Language and Literature': BookOpen,
  'English Language and Literature': Languages,
  'Geography and Environmental Science': Globe,
  'History and Heritage Management': Scroll,
  'Political Science and International Relation': Landmark,
  'Accounting and Finance': Calculator,
  'Economics': TrendingUp,
  'Management': Briefcase,
  'Marketing Management': Megaphone,
}

export const STREAMS = [
  'Social Sciences',
  'Business',
  'Humanities',
  'Natural Sciences',
] as const

export function getRankColor(rank: number): string {
  if (rank === 0) return 'bg-gradient-to-br from-amber-400 to-amber-600 text-white'
  if (rank === 1) return 'bg-gradient-to-br from-slate-300 to-slate-500 text-white'
  if (rank === 2) return 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
  return 'bg-gradient-to-br from-brand-500 to-brand-700 text-white'
}
