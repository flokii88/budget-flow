import { useState, useEffect } from 'react'
import {
  Lock,
  Mail,
  User,
  KeyRound,
  Copy,
  Check,
  Download,
  ShieldCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  Settings2,
  RefreshCw,
  ArrowLeft,
  Terminal,
  ExternalLink,
} from 'lucide-react'
import LogoIcon from '@/components/ui/LogoIcon'
import { useStore } from '@/store/useStore'
import { useTranslation } from '@/i18n'
import pb, { updatePocketBaseUrl } from '@/lib/pocketbase'
import { checkPocketBaseHealth } from '@/lib/sync'
import {
  ServerAuthMode,
  checkServerAuthMode,
  loginWithPassword,
  registerHouseholdUser,
  resetPasswordWithRecoveryKey,
  completeFirstLoginPasswordChange,
  getCurrentUser,
  logoutUser,
} from '@/lib/auth'
import { Language } from '@/lib/types'

interface AuthScreenProps {
  onAuthenticated: () => void
}

type AuthView = 'login' | 'register' | 'force_change_password' | 'recovery_created' | 'forgot'

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const { t, language } = useTranslation()
  const { theme, setTheme, setLanguage } = useStore()

  const [serverMode, setServerMode] = useState<ServerAuthMode>('has_users')
  const [view, setView] = useState<AuthView>('login')
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [checkingServer, setCheckingServer] = useState<boolean>(true)

  // Server URL editor
  const [pbUrlInput, setPbUrlInput] = useState<string>(pb.baseUrl)
  const [showUrlEditor, setShowUrlEditor] = useState<boolean>(false)

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  // Recovery key generated after registration
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [confirmedSavedKey, setConfirmedSavedKey] = useState(false)

  // Forgot password & Force change password states
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [tempPasswordUsed, setTempPasswordUsed] = useState<string>('')
  const [showLostKeyHelp, setShowLostKeyHelp] = useState(false)
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshServerState = async () => {
    setCheckingServer(true)
    setError(null)
    const online = await checkPocketBaseHealth()
    setIsOnline(online)
    if (!online) {
      setShowUrlEditor(true)
      setCheckingServer(false)
      return
    }
    const existingUser = getCurrentUser()
    if (existingUser?.must_change_password) {
      setEmail(existingUser.email)
      setView('force_change_password')
      setCheckingServer(false)
      return
    }
    const mode = await checkServerAuthMode()
    setServerMode(mode)
    if (mode === 'no_users') {
      setView('register')
    } else {
      setView('login')
    }
    setCheckingServer(false)
  }

  useEffect(() => {
    refreshServerState()
  }, [])

  const handleSaveServerUrl = async () => {
    updatePocketBaseUrl(pbUrlInput)
    setShowUrlEditor(false)
    await refreshServerState()
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResetSuccessMsg(null)

    if (!email.trim()) {
      setError(t('auth.errEmailRequired'))
      return
    }

    setSubmitting(true)
    try {
      const user = await loginWithPassword(email, password)
      if (user.must_change_password) {
        setTempPasswordUsed(password)
        setNewPassword('')
        setNewPasswordConfirm('')
        setView('force_change_password')
        return
      }
      onAuthenticated()
    } catch (err: any) {
      if (err?.status === 400) {
        setError(t('auth.errInvalidCredentials'))
      } else {
        setError(err?.message || t('auth.errGeneric'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegisterFirstAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !email.includes('@')) {
      setError(t('auth.errEmailRequired'))
      return
    }
    if (password.length < 8) {
      setError(t('auth.errPasswordLength'))
      return
    }
    if (password !== passwordConfirm) {
      setError(t('auth.errPasswordMismatch'))
      return
    }

    setSubmitting(true)
    try {
      const { recoveryKey } = await registerHouseholdUser({
        email,
        password,
        name,
        autoLogin: true,
      })
      setGeneratedKey(recoveryKey)
      setConfirmedSavedKey(false)
      setView('recovery_created')
    } catch (err: any) {
      if (err?.status === 403) {
        setError(t('auth.errCreationDisabled'))
        setServerMode('has_users')
        setView('login')
      } else {
        const fieldErrors = err?.response?.data
        if (fieldErrors?.email?.message) {
          setError(`Email : ${fieldErrors.email.message}`)
        } else if (fieldErrors?.password?.message) {
          setError(`Mot de passe : ${fieldErrors.password.message}`)
        } else {
          setError(err?.message || t('auth.errGeneric'))
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyRecoveryKey = async () => {
    if (!generatedKey) return
    try {
      await navigator.clipboard.writeText(generatedKey)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2500)
    } catch {
      // Fallback
    }
  }

  const handleDownloadRecoveryKey = () => {
    if (!generatedKey) return
    const content = [
      '====================================================',
      '  BUDGET FLOW — CLE DE SECOURS PERSONNELLE',
      '====================================================',
      '',
      `Compte (Email) : ${email.trim().toLowerCase()}`,
      `Serveur PocketBase : ${pb.baseUrl}`,
      `Clé de secours : ${generatedKey}`,
      '',
      'Conservez ce fichier en lieu sûr (ex: gestionnaire de mots de passe).',
      'Cette clé vous permet de réinitialiser votre mot de passe sur Budget Flow',
      'sans avoir besoin de serveur e-mail (SMTP).',
      '====================================================',
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `budget-flow-recovery-key-${email.trim().split('@')[0] || 'user'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleForceChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError(t('auth.errPasswordLength'))
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setError(t('auth.errPasswordMismatch'))
      return
    }
    if (tempPasswordUsed && newPassword === tempPasswordUsed) {
      setError(t('auth.errSameAsTempPassword'))
      return
    }

    setSubmitting(true)
    try {
      const { recoveryKey } = await completeFirstLoginPasswordChange(
        newPassword,
        tempPasswordUsed || undefined
      )
      setGeneratedKey(recoveryKey)
      setConfirmedSavedKey(false)
      setNewPassword('')
      setNewPasswordConfirm('')
      setTempPasswordUsed('')
      setView('recovery_created')
    } catch (err: any) {
      setError(err?.message || t('auth.errGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError(t('auth.errPasswordLength'))
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setError(t('auth.errPasswordMismatch'))
      return
    }

    setSubmitting(true)
    try {
      await resetPasswordWithRecoveryKey(recoveryKeyInput, newPassword)
      setResetSuccessMsg(t('auth.resetSuccess'))
      setPassword('')
      setRecoveryKeyInput('')
      setNewPassword('')
      setNewPasswordConfirm('')
      setView('login')
    } catch (err: any) {
      if (
        err?.message === 'INVALID_RECOVERY_KEY_FORMAT' ||
        err?.status === 404 ||
        err?.status === 403 ||
        err?.status === 400
      ) {
        setError(t('auth.errInvalidRecoveryKey'))
      } else {
        setError(err?.message || t('auth.errGeneric'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const adminUrl = `${pb.baseUrl.replace(/\/$/, '')}/_/`
  const languages: { code: Language; label: string }[] = [
    { code: 'fr', label: 'FR' },
    { code: 'en', label: 'EN' },
  ]

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4">
      {/* Top Bar: Logo + Language & Theme controls */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between pt-2">
        <div className="flex items-center gap-2.5">
          <LogoIcon className="w-8 h-8 shadow-sm" />
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">Budget</p>
            <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 leading-tight">Flow</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800">
            {languages.map(l => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code)}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                  language === l.code
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            title={theme === 'dark' ? t('topbar.lightMode') : t('topbar.darkMode')}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="card p-6 sm:p-8 shadow-xl border border-gray-200/80 dark:border-gray-800 space-y-6">
          {/* ─── VIEW 1: RECOVERY KEY CREATED ────────────────────────────────── */}
          {view === 'recovery_created' && generatedKey ? (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                    {t('auth.recoveryTitle')}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('auth.recoverySub')}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-gray-900 dark:bg-black text-emerald-400 font-mono text-xs sm:text-sm break-all border border-emerald-500/30 select-all text-center tracking-wider">
                {generatedKey}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyRecoveryKey}
                  className="btn-secondary py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  {copiedKey ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">{t('auth.copiedKey')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>{t('auth.copyKey')}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadRecoveryKey}
                  className="btn-secondary py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('auth.downloadKey')}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                ⚠️ {t('auth.recoveryWarning')}
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={confirmedSavedKey}
                  onChange={e => setConfirmedSavedKey(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="font-medium">{t('auth.recoveryConfirmCheck')}</span>
              </label>

              <button
                type="button"
                disabled={!confirmedSavedKey}
                onClick={onAuthenticated}
                className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('auth.continueToApp')}
              </button>
            </div>
          ) : view === 'force_change_password' ? (
            /* ─── VIEW 1B: FORCE TEMPORARY PASSWORD CHANGE ──────────────────── */
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    logoutUser()
                    setError(null)
                    setView('login')
                  }}
                  className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t('auth.backToLogin')}
                </button>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                    {t('auth.forceChangeTitle')}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {t('auth.forceChangeSub')}
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleForceChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('auth.forceChangeNewPwdLabel')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder={t('auth.passwordPlaceholder')}
                      className="input pl-9 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('auth.passwordConfirmLabel')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={newPasswordConfirm}
                      onChange={e => setNewPasswordConfirm(e.target.value)}
                      placeholder={t('auth.passwordConfirmPlaceholder')}
                      className="input pl-9 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !isOnline}
                  className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? t('common.loading') : t('auth.forceChangeConfirmBtn')}
                </button>
              </form>
            </div>
          ) : view === 'forgot' ? (
            /* ─── VIEW 2: FORGOT PASSWORD (RECOVERY KEY + SERVER FALLBACK) ──── */
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setView('login')
                  }}
                  className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t('auth.backToLogin')}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-primary-100 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                    {t('auth.resetTitle')}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('auth.resetSub')}
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('auth.resetKeyInputLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={recoveryKeyInput}
                    onChange={e => setRecoveryKeyInput(e.target.value)}
                    placeholder={t('auth.resetKeyPlaceholder')}
                    className="input font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('auth.resetNewPasswordLabel')}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="input text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('auth.passwordConfirmLabel')}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPasswordConfirm}
                    onChange={e => setNewPasswordConfirm(e.target.value)}
                    placeholder={t('auth.passwordConfirmPlaceholder')}
                    className="input text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !isOnline}
                  className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-50"
                >
                  {submitting ? t('auth.resetting') : t('auth.resetConfirmBtn')}
                </button>
              </form>

              {/* Option 3: Server Fallback if recovery key is also lost */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowLostKeyHelp(!showLostKeyHelp)}
                  className="w-full flex items-center justify-between text-left text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 py-1.5"
                >
                  <span>{t('auth.lostKeyToggle')}</span>
                  {showLostKeyHelp ? (
                    <ChevronUp className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  )}
                </button>

                {showLostKeyHelp && (
                  <div className="mt-2 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 space-y-3 text-xs text-gray-600 dark:text-gray-400">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {t('auth.lostKeyTitle')}
                    </p>
                    <p className="leading-relaxed">{t('auth.lostKeyIntro')}</p>

                    <div className="space-y-1">
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {t('auth.lostKeyStep1Title')}
                      </p>
                      <p className="leading-relaxed">
                        {t('auth.lostKeyStep1Desc', { adminUrl })}
                      </p>
                      <a
                        href={adminUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline font-medium mt-1"
                      >
                        <span>{adminUrl}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <p className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-primary-500" />
                        <span>{t('auth.lostKeyStep2Title')}</span>
                      </p>
                      <p className="leading-relaxed">{t('auth.lostKeyStep2Desc')}</p>
                      <pre className="p-2 rounded-lg bg-gray-900 text-gray-100 font-mono text-[11px] overflow-x-auto select-all">
                        pocketbase superuser upsert admin@exemple.com NouveauMotDePasse123
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ─── VIEW 3: LOGIN OR INITIAL ACCOUNT CREATION ──────────────────── */
            <div className="space-y-5 animate-fade-in">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-2xl bg-primary-100 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 shrink-0">
                  {view === 'register' ? (
                    <ShieldCheck className="w-6 h-6" />
                  ) : (
                    <Lock className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                    {view === 'register' ? t('auth.setupTitle') : t('auth.loginTitle')}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {view === 'register' ? t('auth.setupSub') : t('auth.loginSub')}
                  </p>
                </div>
              </div>

              {/* Seamless transition reassurance banner when creating the 1st account */}
              {view === 'register' && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{t('auth.setupBanner')}</span>
                </div>
              )}

              {/* Mode switcher if server has no users or legacy unmigrated */}
              {(serverMode === 'no_users' || serverMode === 'legacy_unmigrated') && (
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setView('register')
                    }}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      view === 'register'
                        ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    {t('auth.tabRegister')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setView('login')
                    }}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      view === 'login'
                        ? 'bg-white dark:bg-gray-900 text-primary-600 dark:text-primary-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    {t('auth.tabLogin')}
                  </button>
                </div>
              )}

              {resetSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                  ✓ {resetSuccessMsg}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {view === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('auth.emailLabel')}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder={t('auth.emailPlaceholder')}
                        className="input pl-9 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {t('auth.passwordLabel')}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null)
                          setResetSuccessMsg(null)
                          setView('forgot')
                        }}
                        className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {t('auth.forgotPasswordLink')}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input pl-9 text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !isOnline || checkingServer}
                    className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-50"
                  >
                    {submitting ? t('auth.loggingIn') : t('auth.loginBtn')}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegisterFirstAccount} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('auth.nameLabel')}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={t('auth.namePlaceholder')}
                        className="input pl-9 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('auth.emailLabel')}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder={t('auth.emailPlaceholder')}
                        className="input pl-9 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('auth.passwordLabel')}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t('auth.passwordPlaceholder')}
                        className="input pl-9 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('auth.passwordConfirmLabel')}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={passwordConfirm}
                        onChange={e => setPasswordConfirm(e.target.value)}
                        placeholder={t('auth.passwordConfirmPlaceholder')}
                        className="input pl-9 text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !isOnline || checkingServer}
                    className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-50"
                  >
                    {submitting ? t('auth.creatingAccount') : t('auth.createAccountBtn')}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* PocketBase Server Status & URL Config Footer */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 truncate">
                {checkingServer ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary-500 shrink-0" />
                ) : isOnline ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-red-500 shrink-0" />
                )}
                <span>{t('auth.serverConfig')}</span>
                <code className="font-mono text-gray-700 dark:text-gray-300 truncate">
                  {pb.baseUrl}
                </code>
              </div>

              <button
                type="button"
                onClick={() => setShowUrlEditor(!showUrlEditor)}
                className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 font-medium shrink-0 ml-2"
              >
                <Settings2 className="w-3 h-3" />
                <span>{showUrlEditor ? t('common.close') : t('data.changeUrl')}</span>
              </button>
            </div>

            {showUrlEditor && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={pbUrlInput}
                  onChange={e => setPbUrlInput(e.target.value)}
                  placeholder="http://127.0.0.1:8090"
                  className="input text-xs py-1.5 flex-1"
                />
                <button
                  type="button"
                  onClick={handleSaveServerUrl}
                  className="btn-primary text-xs py-1.5 px-3 shrink-0"
                >
                  {t('data.testValidate')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-gray-400 pb-2">
        Budget Flow • 55 / 25 / 20
      </div>
    </div>
  )
}
