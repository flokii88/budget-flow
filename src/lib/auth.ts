import pb, { COLLECTIONS } from './pocketbase'

export interface AuthUser {
  id: string
  email: string
  name: string
  must_change_password?: boolean
  created?: string
  updated?: string
}

export type ServerAuthMode = 'has_users' | 'no_users' | 'legacy_unmigrated'

const PB_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const SECRET_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function randomChars(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  let out = ''
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}

/**
 * Génère un identifiant PocketBase valide de 15 caractères ([a-z0-9]{15}).
 */
export function generatePocketBaseRecordId(): string {
  return randomChars(PB_ID_ALPHABET, 15)
}

/**
 * Génère le secret interne de récupération (format XXXX-XXXX-XXXX-XXXX).
 */
export function generateRecoverySecret(): string {
  const raw = randomChars(SECRET_ALPHABET, 16)
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`
}

/**
 * Formate la clé de secours complète remise à l'utilisateur : BF-<userId>-<secret>
 */
export function formatFullRecoveryKey(userId: string, secret: string): string {
  return `BF-${userId.toLowerCase()}-${secret.toUpperCase()}`
}

/**
 * Extrait l'identifiant utilisateur PocketBase et le secret depuis une clé de secours complète.
 */
export function parseRecoveryKey(input: string): { userId: string; secret: string } | null {
  const cleaned = input.trim().replace(/\s+/g, '')
  const match = /^BF-([a-z0-9]{15})-([A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4})$/i.exec(cleaned)
  if (!match) return null
  return {
    userId: match[1].toLowerCase(),
    secret: match[2].toUpperCase(),
  }
}

/**
 * Retourne l'utilisateur actuellement authentifié dans PocketBase, ou null.
 */
export function getCurrentUser(): AuthUser | null {
  if (!pb.authStore.isValid) return null
  const model = (pb.authStore as any).record || pb.authStore.model
  if (!model || !model.id) return null
  return {
    id: model.id,
    email: model.email || '',
    name: model.name || '',
    must_change_password: !!model.must_change_password,
    created: model.created,
    updated: model.updated,
  }
}

/**
 * S'abonne aux changements d'état d'authentification PocketBase.
 */
export function subscribeAuth(listener: (user: AuthUser | null) => void): () => void {
  listener(getCurrentUser())
  return pb.authStore.onChange(() => {
    listener(getCurrentUser())
  })
}

/**
 * Rafraîchit la session courante auprès de PocketBase.
 * Si le jeton est expiré ou invalide (401/403), nettoie authStore.
 */
export async function refreshAuthSession(): Promise<AuthUser | null> {
  if (!pb.authStore.isValid) return null
  try {
    await pb.collection(COLLECTIONS.USERS).authRefresh()
    return getCurrentUser()
  } catch (err: any) {
    if (err?.status === 401 || err?.status === 403) {
      pb.authStore.clear()
      return null
    }
    // En cas d'erreur réseau temporaire, conserve la session locale
    return getCurrentUser()
  }
}

/**
 * Interroge la vue publique `app_status` pour savoir si au moins un utilisateur
 * existe déjà dans PocketBase (`has_users`) ou s'il s'agit de l'initialisation
 * du premier compte (`no_users`).
 */
export async function checkServerAuthMode(): Promise<ServerAuthMode> {
  try {
    const list = await pb.collection(COLLECTIONS.APP_STATUS).getList(1, 1)
    const item = list.items?.[0] as any
    if (!item) return 'no_users'
    const count = Number(item.user_count) || 0
    return count > 0 ? 'has_users' : 'no_users'
  } catch (err: any) {
    if (err?.status === 404) {
      return 'legacy_unmigrated'
    }
    return 'has_users'
  }
}

/**
 * Connexion par email et mot de passe.
 */
export async function loginWithPassword(email: string, password: string): Promise<AuthUser> {
  const cleanEmail = email.trim().toLowerCase()
  await pb.collection(COLLECTIONS.USERS).authWithPassword(cleanEmail, password)
  const user = getCurrentUser()
  if (!user) {
    throw new Error('Authentication failed')
  }
  return user
}

/**
 * Crée un compte utilisateur dans la collection `users` avec une clé de secours générée.
 * Si aucun utilisateur n'est actuellement connecté (création du 1er compte), connecte
 * automatiquement ce nouveau compte.
 */
export async function registerHouseholdUser(params: {
  email: string
  password: string
  name?: string
  autoLogin?: boolean
  mustChangePassword?: boolean
}): Promise<{ user: AuthUser; recoveryKey: string }> {
  const cleanEmail = params.email.trim().toLowerCase()
  const cleanName = (params.name || '').trim()
  const userId = generatePocketBaseRecordId()
  const secret = generateRecoverySecret()
  const mustChange = !!params.mustChangePassword

  const created = await pb.collection(COLLECTIONS.USERS).create({
    id: userId,
    email: cleanEmail,
    emailVisibility: true,
    name: cleanName,
    password: params.password,
    passwordConfirm: params.password,
    recovery_key: secret,
    must_change_password: mustChange,
  })

  const shouldLogin = params.autoLogin ?? !pb.authStore.isValid
  if (shouldLogin) {
    await pb.collection(COLLECTIONS.USERS).authWithPassword(cleanEmail, params.password)
  }

  return {
    user: {
      id: created.id,
      email: (created as any).email || cleanEmail,
      name: (created as any).name || cleanName,
      must_change_password: !!(created as any).must_change_password,
      created: created.created,
      updated: created.updated,
    },
    recoveryKey: formatFullRecoveryKey(created.id, secret),
  }
}

/**
 * Finalise la première connexion d'un membre invité avec un mot de passe temporaire :
 * définit son nouveau mot de passe personnel, désactive `must_change_password`,
 * génère sa propre clé de secours et rafraîchit sa session.
 */
export async function completeFirstLoginPasswordChange(
  newPassword: string,
  oldTempPassword?: string
): Promise<{ user: AuthUser; recoveryKey: string }> {
  const current = getCurrentUser()
  if (!current) {
    throw new Error('NOT_AUTHENTICATED')
  }

  const newSecret = generateRecoverySecret()
  const payload: Record<string, any> = {
    password: newPassword,
    passwordConfirm: newPassword,
    must_change_password: false,
    recovery_key: newSecret,
  }
  if (oldTempPassword) {
    payload.oldPassword = oldTempPassword
  }

  await pb.collection(COLLECTIONS.USERS).update(current.id, payload)
  await pb.collection(COLLECTIONS.USERS).authWithPassword(current.email, newPassword)

  const updatedUser = getCurrentUser()
  if (!updatedUser) {
    throw new Error('Authentication failed')
  }

  return {
    user: updatedUser,
    recoveryKey: formatFullRecoveryKey(current.id, newSecret),
  }
}

/**
 * Réinitialise le mot de passe d'un utilisateur sans serveur SMTP grâce à sa clé de secours.
 */
export async function resetPasswordWithRecoveryKey(
  rawRecoveryKey: string,
  newPassword: string
): Promise<void> {
  const parsed = parseRecoveryKey(rawRecoveryKey)
  if (!parsed) {
    throw new Error('INVALID_RECOVERY_KEY_FORMAT')
  }

  await pb.collection(COLLECTIONS.USERS).update(parsed.userId, {
    recovery_key: parsed.secret,
    password: newPassword,
    passwordConfirm: newPassword,
  })
}

/**
 * Régénère une nouvelle clé de secours pour l'utilisateur actuellement connecté.
 */
export async function regenerateRecoveryKey(): Promise<string> {
  const current = getCurrentUser()
  if (!current) {
    throw new Error('NOT_AUTHENTICATED')
  }
  const newSecret = generateRecoverySecret()
  await pb.collection(COLLECTIONS.USERS).update(current.id, {
    recovery_key: newSecret,
  })
  return formatFullRecoveryKey(current.id, newSecret)
}

/**
 * Modifie le mot de passe de l'utilisateur connecté et maintient sa session active.
 */
export async function changeCurrentUserPassword(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const current = getCurrentUser()
  if (!current) {
    throw new Error('NOT_AUTHENTICATED')
  }
  await pb.collection(COLLECTIONS.USERS).update(current.id, {
    oldPassword,
    password: newPassword,
    passwordConfirm: newPassword,
  })
  if (current.email) {
    await pb.collection(COLLECTIONS.USERS).authWithPassword(current.email, newPassword)
  }
}

/**
 * Récupère la liste des comptes membres du foyer enregistrés dans PocketBase.
 */
export async function fetchHouseholdUsers(): Promise<AuthUser[]> {
  const records = await pb.collection(COLLECTIONS.USERS).getFullList({ sort: 'created' })
  return records.map((r: any) => ({
    id: r.id,
    email: r.email || '',
    name: r.name || '',
    must_change_password: !!r.must_change_password,
    created: r.created,
    updated: r.updated,
  }))
}

/**
 * Déconnecte l'utilisateur courant.
 */
export function logoutUser(): void {
  pb.authStore.clear()
}
