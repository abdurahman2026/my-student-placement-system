import { useState, type FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { STREAMS } from '@/types'
import UniversityHeader from '@/components/UniversityHeader'
import {
  Eye, EyeOff, AlertCircle, Loader2,
  ShieldCheck, CheckCircle2, Sparkles, Shield,
  GraduationCap, Info,
} from 'lucide-react'

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all'

export default function Login() {
  const { signIn, signUp, adminSignIn } = useAuth()
  const [role, setRole] = useState<'student' | 'admin'>('student')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [loginStudentId, setLoginStudentId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [regStudentId, setRegStudentId] = useState('')
  const [regFullName, setRegFullName] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regGpa, setRegGpa] = useState('')
  const [regStream, setRegStream] = useState<string>('Social Sciences')
  const [regEntranceResult, setRegEntranceResult] = useState('')

  const [adminId, setAdminId] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!loginStudentId.trim() || !loginPassword) {
      setError('Please enter your Student ID and password.')
      return
    }
    setLoading(true)
    const { error } = await signIn(loginStudentId, loginPassword)
    setLoading(false)
    if (error) setError(error)
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!regStudentId.trim() || !regFullName.trim() || !regPassword) {
      setError('Please fill in all fields.')
      return
    }
    const gpaNum = parseFloat(regGpa)
    if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 4) {
      setError('GPA must be between 0.00 and 4.00.')
      return
    }
    const resultNum = parseFloat(regEntranceResult)
    if (isNaN(resultNum) || resultNum < 0 || resultNum > 100) {
      setError('Entrance Result must be between 0 and 100.')
      return
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    const { error } = await signUp({
      studentId: regStudentId,
      fullName: regFullName,
      password: regPassword,
      gpa: gpaNum,
      stream: regStream,
      entranceResult: resultNum,
    })
    setLoading(false)
    if (error) setError(error)
  }

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!adminId.trim() || !adminPassword) {
      setError('Please enter your Admin ID and password.')
      return
    }
    setLoading(true)
    const { error } = await adminSignIn(adminId, adminPassword)
    setLoading(false)
    if (error) {
      setError(error)
    }
  }

  const handleRoleChange = (newRole: 'student' | 'admin') => {
    setRole(newRole)
    setError(null)
    if (newRole === 'admin') {
      setMode('login')
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-800 via-brand-900 to-brand-950 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-600/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-20 text-white w-full">
          <UniversityHeader variant="light" />

          <div>
            <h1 className="font-heading text-4xl xl:text-5xl font-bold leading-tight">
              Student Department Placement System
            </h1>
            <p className="text-brand-200 mt-6 text-lg leading-relaxed max-w-md">
              Rank your department preferences and track your placement status — all in one place.
            </p>

            <div className="flex flex-wrap gap-6 mt-12">
              <div className="flex items-center gap-2 text-brand-200">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-sm font-medium">Secure</span>
              </div>
              <div className="flex items-center gap-2 text-brand-200">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Fair Process</span>
              </div>
              <div className="flex items-center gap-2 text-brand-200">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-medium">Transparent</span>
              </div>
            </div>
          </div>

          <p className="text-brand-300 text-sm">
            &copy; {new Date().getFullYear()} Mekdela Amba University. All rights reserved.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <UniversityHeader />
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Role toggle */}
            <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
              <button
                onClick={() => handleRoleChange('student')}
                className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  role === 'student' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                Student
              </button>
              <button
                onClick={() => handleRoleChange('admin')}
                className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  role === 'admin' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Shield className="w-4 h-4" />
                Admin / Registrar
              </button>
            </div>

            {/* Login/Register toggle — only for students */}
            {role === 'student' && (
              <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
                <button
                  onClick={() => { setMode('login'); setError(null) }}
                  className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    mode === 'login' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMode('register'); setError(null) }}
                  className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    mode === 'register' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Register
                </button>
              </div>
            )}

            {role === 'admin' && (
              <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
                <Info className="w-4 h-4 text-slate-400" />
                <span>Admin accounts are managed by existing administrators.</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Student login */}
            {role === 'student' && mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Student ID</label>
                  <input
                    type="text"
                    value={loginStudentId}
                    onChange={(e) => setLoginStudentId(e.target.value)}
                    placeholder="e.g. MAU/2024/001"
                    className={inputClass}
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={inputClass + ' pr-12'}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-xl bg-brand-700 text-white font-semibold hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (<><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</>) : 'Sign In'}
                </button>
              </form>
            )}

            {/* Student register */}
            {role === 'student' && mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Student ID</label>
                  <input type="text" value={regStudentId} onChange={(e) => setRegStudentId(e.target.value)} placeholder="e.g. MAU/2024/004" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                  <input type="text" value={regFullName} onChange={(e) => setRegFullName(e.target.value)} placeholder="Your full name" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="At least 6 characters" className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">GPA</label>
                    <input type="number" min="0" max="4" step="0.01" value={regGpa} onChange={(e) => setRegGpa(e.target.value)} placeholder="3.50" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Entrance Result</label>
                    <input type="number" min="0" max="100" step="0.01" value={regEntranceResult} onChange={(e) => setRegEntranceResult(e.target.value)} placeholder="85.50" className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Stream / College</label>
                  <select value={regStream} onChange={(e) => setRegStream(e.target.value)} className={inputClass}>
                    {STREAMS.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-xl bg-brand-700 text-white font-semibold hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (<><Loader2 className="w-5 h-5 animate-spin" /> Registering...</>) : 'Create Account'}
                </button>
              </form>
            )}

            {/* Admin login — no registration */}
            {role === 'admin' && (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Admin ID</label>
                  <input type="text" value={adminId} onChange={(e) => setAdminId(e.target.value)} placeholder="e.g. ADMIN/001" className={inputClass} autoComplete="username" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Enter your password" className={inputClass + ' pr-12'} autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 rounded-xl bg-brand-700 text-white font-semibold hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (<><Loader2 className="w-5 h-5 animate-spin" /> Signing in...</>) : 'Sign In as Admin'}
                </button>
              </form>
            )}

            {role === 'student' && mode === 'login' && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-sm font-medium text-blue-900 mb-1">Demo Account</p>
                <p className="text-sm text-blue-700">
                  Student ID: <span className="font-mono font-semibold">MAU/2024/001</span>
                  <br />
                  Password: <span className="font-mono font-semibold">student123</span>
                </p>
              </div>
            )}
            {role === 'admin' && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-sm font-medium text-amber-900 mb-1">Demo Admin Account</p>
                <p className="text-sm text-amber-700">
                  Admin ID: <span className="font-mono font-semibold">ADMIN/001</span>
                  <br />
                  Password: <span className="font-mono font-semibold">abdu06941134++</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
