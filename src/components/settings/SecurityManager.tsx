import { useState, useEffect } from 'react'
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Users,
  UserPlus,
  LogOut,
  Copy,
  Check,
  Download,
  AlertCircle,
  CheckCircle2,
  Mail,
  User,
} from 'lucide-react'
import {
  AuthUser,
  getCurrentUser,
  subscribeAuth,
  regenerateRecoveryKey,
  changeCurrentUserPassword,
  fetchHouseholdUsers,
  registerHouseholdUser,
  logoutUser,
} from '@/lib/auth'
import pb from '@/lib/pocketbase'
import { useTranslation } from '@/i18n'

export default function SecurityManager() {
  const { t } = useTranslation()
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getCurrentUser())
  const [householdUsers, setHouseholdUsers] = useState<AuthUser[]>([])

  // Recovery key state
  const [newRecoveryKey, setNewRecoveryKey] = useState<string | null>(null)
  const [generatingKey, setGeneratingKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  // Password change state
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [updatingPwd, setUpdatingPwd] = useState(false)

  // Add household member state
  const [memberName, setMemberName] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberPassword, setMemberPassword] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [memberTempCreds, setMemberTempCreds] = useState<{
    email: string
    tempPassword: string
  } | null>(null)
  const [copiedMemberCreds, setCopiedMemberCreds] = useState(false)

  // Feedback banners
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadUsers = async () => {
    try {
      const list = await fetchHouseholdUsers()
      setHouseholdUsers(list)
    } catch {
      // Ignore if offline
    }
  }

  useEffect(() => {
    loadUsers()
    return subscribeAuth(setCurrentUser)
  }, [])

  const showMessage = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 6000)
  }

  const handleGenerateKey = async () => {
    setGeneratingKey(true)
    setFeedback(null)
    try {
      const key = await regenerateRecoveryKey()
      setNewRecoveryKey(key)
      showMessage(t('security.keyGeneratedSuccess'), 'success')
    } catch (err: any) {
      showMessage(err?.message || t('auth.errGeneric'), 'error')
    } finally {
      setGeneratingKey(false)
    }
  }

  const handleCopyKey = async (keyToCopy: string, isMemberCreds = false) => {
    try {
      await navigator.clipboard.writeText(keyToCopy)
      if (isMemberCreds) {
        setCopiedMemberCreds(true)
        setTimeout(() => setCopiedMemberCreds(false), 2500)
      } else {
        setCopiedKey(true)
        setTimeout(() => setCopiedKey(false), 2500)
      }
    } catch {
      // Ignore
    }
  }

  const handleDownloadKey = (email: string, key: string) => {
    const content = [
      '====================================================',
      '  BUDGET FLOW — CLE DE SECOURS PERSONNELLE',
      '====================================================',
      '',
      `Compte (Email) : ${email}`,
      `Serveur PocketBase : ${pb.baseUrl}`,
      `Clé de secours : ${key}`,
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
    a.download = `budget-flow-recovery-key-${email.split('@')[0] || 'user'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    if (newPassword.length < 8) {
      showMessage(t('auth.errPasswordLength'), 'error')
      return
    }
    if (newPassword !== confirmNewPassword) {
      showMessage(t('auth.errPasswordMismatch'), 'error')
      return
    }

    setUpdatingPwd(true)
    try {
      await changeCurrentUserPassword(oldPassword, newPassword)
      setOldPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      showMessage(t('security.pwdUpdatedSuccess'), 'success')
    } catch (err: any) {
      showMessage(err?.message || t('auth.errInvalidCredentials'), 'error')
    } finally {
      setUpdatingPwd(false)
    }
  }

  const handleAddHouseholdMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    if (!memberEmail.trim() || !memberEmail.includes('@')) {
      showMessage(t('auth.errEmailRequired'), 'error')
      return
    }
    if (memberPassword.length < 8) {
      showMessage(t('auth.errPasswordLength'), 'error')
      return
    }

    setAddingMember(true)
    try {
      const targetEmail = memberEmail.trim().toLowerCase()
      const tempPwd = memberPassword
      await registerHouseholdUser({
        email: targetEmail,
        password: tempPwd,
        name: memberName,
        autoLogin: false,
        mustChangePassword: true,
      })
      setMemberTempCreds({ email: targetEmail, tempPassword: tempPwd })
      setMemberName('')
      setMemberEmail('')
      setMemberPassword('')
      await loadUsers()
      showMessage(t('security.memberAddedSuccess', { email: targetEmail }), 'success')
    } catch (err: any) {
      showMessage(err?.message || t('auth.errGeneric'), 'error')
    } finally {
      setAddingMember(false)
    }
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium animate-fade-in shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 1. Compte actuel & Déconnexion */}
      <div className="card p-5 border-l-4 border-l-primary-500 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-100 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('security.currentAccountTitle')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t('security.connectedAs')}{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {currentUser?.name ? `${currentUser.name} (${currentUser.email})` : currentUser?.email}
              </span>
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{t('security.currentAccountDesc')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={logoutUser}
          className="btn-danger text-xs py-2 px-3.5 flex items-center gap-1.5"
          title={t('auth.logoutTitle')}
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{t('auth.logout')}</span>
        </button>
      </div>

      {/* 2. Clé de secours personnelle (Recovery Key) */}
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('security.recoveryTitle')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-xl leading-relaxed">
                {t('security.recoveryDesc')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateKey}
            disabled={generatingKey}
            className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shrink-0"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>
              {generatingKey ? t('security.generatingKey') : t('security.generateNewKeyBtn')}
            </span>
          </button>
        </div>

        {newRecoveryKey && (
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800/60 space-y-3 animate-fade-in">
            <div className="p-3 rounded-lg bg-gray-900 dark:bg-black text-emerald-400 font-mono text-xs sm:text-sm break-all text-center select-all tracking-wider">
              {newRecoveryKey}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleCopyKey(newRecoveryKey, false)}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                {copiedKey ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {t('auth.copiedKey')}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t('auth.copyKey')}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDownloadKey(currentUser?.email || 'user', newRecoveryKey)}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('auth.downloadKey')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 3. Changement de mot de passe */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('security.changePwdTitle')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('security.changePwdDesc')}
              </p>
            </div>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('security.oldPwdLabel')}
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="input text-xs py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('security.newPwdLabel')}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="input text-xs py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('security.confirmNewPwdLabel')}
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                className="input text-xs py-2"
              />
            </div>
            <button
              type="submit"
              disabled={updatingPwd}
              className="btn-primary w-full text-xs py-2 font-semibold"
            >
              {updatingPwd ? t('security.updatingPwd') : t('security.updatePwdBtn')}
            </button>
          </form>
        </div>

        {/* 4. Membres du foyer (Foyer partagé) */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('security.householdTitle')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {t('security.householdDesc')}
              </p>
            </div>
          </div>

          {householdUsers.length > 0 && (
            <div className="space-y-1.5">
              {householdUsers.map(u => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/70 text-xs"
                >
                  <div className="truncate">
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {u.name || u.email}
                    </span>
                    {u.name && (
                      <span className="text-gray-400 ml-1.5">({u.email})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {u.must_change_password && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                        {t('security.pendingFirstLoginBadge')}
                      </span>
                    )}
                    {u.id === currentUser?.id && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300">
                        {t('security.youBadge')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddHouseholdMember} className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="relative">
              <User className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                placeholder={t('auth.namePlaceholder')}
                className="input pl-8 text-xs py-1.5"
              />
            </div>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={memberEmail}
                onChange={e => setMemberEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                className="input pl-8 text-xs py-1.5"
              />
            </div>
            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={8}
                value={memberPassword}
                onChange={e => setMemberPassword(e.target.value)}
                placeholder={t('security.tempPwdPlaceholder')}
                className="input pl-8 text-xs py-1.5"
              />
            </div>
            <button
              type="submit"
              disabled={addingMember}
              className="btn-secondary w-full text-xs py-2 font-semibold flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t('security.addMemberBtn')}</span>
            </button>
          </form>

          {memberTempCreds && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2 text-xs">
              <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                {t('security.memberTempCredsTitle', { email: memberTempCreds.email })}
              </p>
              <div className="p-2.5 rounded-lg bg-gray-900 text-emerald-400 font-mono text-[11px] space-y-1">
                <div>Email : {memberTempCreds.email}</div>
                <div>
                  {t('security.memberTempPwdLabel')} {memberTempCreds.tempPassword}
                </div>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                ℹ️ {t('security.memberTempHint')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleCopyKey(
                      `Email: ${memberTempCreds.email}\nMot de passe temporaire: ${memberTempCreds.tempPassword}`,
                      true
                    )
                  }
                  className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
                >
                  {copiedMemberCreds ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>
                    {copiedMemberCreds ? t('security.copiedCredsBtn') : t('security.copyCredsBtn')}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
