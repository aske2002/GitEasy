import { safeStorage } from 'electron'
import { request as httpsRequest } from 'https'
import Store from 'electron-store'
import { runGit } from './runner'
import type { AccountInfo, RemoteRepo } from '../../shared/ipc'

interface StoredAccount extends AccountInfo {
  encryptedToken: string // base64-encoded encrypted bytes
}

function encryptToken(token: string): string {
  if (!safeStorage.isEncryptionAvailable()) return Buffer.from(token).toString('base64')
  return safeStorage.encryptString(token).toString('base64')
}

function decryptToken(encrypted: string): string {
  const buf = Buffer.from(encrypted, 'base64')
  if (!safeStorage.isEncryptionAvailable()) return buf.toString()
  return safeStorage.decryptString(buf)
}

function httpsGet(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = httpsRequest(
      { hostname: parsed.hostname, path: parsed.pathname + parsed.search, method: 'GET', headers },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      }
    )
    req.on('error', reject)
    req.end()
  })
}

/** Verify a token against the provider API, store it encrypted, and return public info. */
export async function verifyAndAddAccount(
  store: Store<{ recentRepos: string[]; accounts: StoredAccount[] }>,
  provider: 'github' | 'gitlab' | 'bitbucket' | 'custom',
  host: string,
  token: string
): Promise<AccountInfo> {
  let username: string
  let avatarUrl: string | undefined
  let storedToken = token.trim()

  if (provider === 'github') {
    const data = await httpsGet('https://api.github.com/user', {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'GitEasy/1.0',
      Accept: 'application/vnd.github+json'
    })
    const json = JSON.parse(data)
    if (json.message) throw new Error(`GitHub: ${json.message}`)
    username = json.login
    avatarUrl = json.avatar_url
  } else if (provider === 'bitbucket') {
    const raw = token.trim()
    const splitIdx = raw.indexOf(':')
    const providedUser = splitIdx > 0 ? raw.slice(0, splitIdx).trim() : ''
    const bitbucketToken = splitIdx > 0 ? raw.slice(splitIdx + 1).trim() : raw
    storedToken = bitbucketToken

    const bearerData = await httpsGet('https://api.bitbucket.org/2.0/user', {
      Authorization: `Bearer ${bitbucketToken}`,
      'User-Agent': 'GitEasy/1.0',
      Accept: 'application/json'
    })

    let json = JSON.parse(bearerData)
    if (json.type === 'error' || json.error || json.message) {
      if (!providedUser) {
        throw new Error('Bitbucket: invalid token. For app passwords, use "username:app_password" format.')
      }
      const basicData = await httpsGet('https://api.bitbucket.org/2.0/user', {
        Authorization: `Basic ${Buffer.from(`${providedUser}:${bitbucketToken}`).toString('base64')}`,
        'User-Agent': 'GitEasy/1.0',
        Accept: 'application/json'
      })
      json = JSON.parse(basicData)
      if (json.type === 'error' || json.error || json.message) {
        throw new Error(`Bitbucket: ${json.error?.message ?? json.message ?? 'authentication failed'}`)
      }
    }
    username = json.username ?? json.nickname ?? json.display_name ?? json.account_id
    avatarUrl = json.links?.avatar?.href
    if (!username) throw new Error('Bitbucket: could not resolve account username')
  } else {
    // GitLab (cloud or self-hosted)
    const data = await httpsGet(`https://${host}/api/v4/user`, {
      'PRIVATE-TOKEN': token,
      'User-Agent': 'GitEasy/1.0'
    })
    const json = JSON.parse(data)
    if (json.message || json.error) throw new Error(`GitLab: ${json.message ?? json.error}`)
    username = json.username
    avatarUrl = json.avatar_url
  }

  const accounts: StoredAccount[] = store.get('accounts', [])
  const idx = accounts.findIndex(a => a.host === host && a.username === username)
  const entry: StoredAccount = { provider, host, username, avatarUrl, encryptedToken: encryptToken(storedToken) }
  if (idx >= 0) accounts[idx] = entry
  else accounts.push(entry)
  store.set('accounts', accounts)

  return { provider, host, username, avatarUrl }
}

export function listAccounts(
  store: Store<{ recentRepos: string[]; accounts: StoredAccount[] }>
): AccountInfo[] {
  const accounts: StoredAccount[] = store.get('accounts', [])
  return accounts.map(({ encryptedToken: _tok, ...rest }) => rest)
}

export function removeAccount(
  store: Store<{ recentRepos: string[]; accounts: StoredAccount[] }>,
  host: string,
  username: string
): void {
  const accounts: StoredAccount[] = store.get('accounts', [])
  store.set('accounts', accounts.filter(a => !(a.host === host && a.username === username)))
}

function getAccountForHost(
  store: Store<{ recentRepos: string[]; accounts: StoredAccount[] }>,
  host: string
): StoredAccount | null {
  const accounts: StoredAccount[] = store.get('accounts', [])
  return accounts.find(a => a.host === host) ?? null
}

/**
 * Returns the authenticated HTTPS remote URL (token embedded) if we have credentials
 * for the remote's host, or null otherwise.
 * Token is injected as: https://oauth2:TOKEN@host/path
 */
export async function getRemoteAuthUrl(
  repoPath: string,
  store: Store<{ recentRepos: string[]; accounts: StoredAccount[] }>,
  remote = 'origin'
): Promise<string | null> {
  const result = await runGit(repoPath, ['remote', 'get-url', remote])
  if (result.exitCode !== 0) return null
  const url = result.stdout.trim()
  if (!url.startsWith('https://')) return null

  try {
    const parsed = new URL(url)
    const account = getAccountForHost(store, parsed.hostname)
    if (!account) return null
    const token = decryptToken(account.encryptedToken)
    parsed.username = account.provider === 'bitbucket' ? account.username : 'oauth2'
    parsed.password = encodeURIComponent(token)
    return parsed.toString()
  } catch {
    return null
  }
}

export function buildAuthCloneUrl(
  store: Store<{ recentRepos: string[]; accounts: StoredAccount[] }>,
  cloneUrl: string
): string | null {
  try {
    const parsed = new URL(cloneUrl)
    const account = getAccountForHost(store, parsed.hostname)
    if (!account) return null
    const token = decryptToken(account.encryptedToken)
    parsed.username = account.provider === 'bitbucket' ? account.username : 'oauth2'
    parsed.password = encodeURIComponent(token)
    return parsed.toString()
  } catch {
    return null
  }
}

export async function listRemoteRepos(
  store: Store<{ recentRepos: string[]; accounts: StoredAccount[] }>,
  host: string
): Promise<RemoteRepo[]> {
  const account = getAccountForHost(store, host)
  if (!account) throw new Error('No account for host: ' + host)
  const token = decryptToken(account.encryptedToken)

  const results: RemoteRepo[] = []

  if (account.provider === 'github') {
    for (let page = 1; page <= 3; page++) {
      const data = await httpsGet(
        `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
        { Authorization: `Bearer ${token}`, 'User-Agent': 'GitEasy/1.0', Accept: 'application/vnd.github+json' }
      )
      const json = JSON.parse(data)
      if (!Array.isArray(json) || json.length === 0) break
      for (const r of json) {
        results.push({
          name: r.name,
          fullName: r.full_name,
          cloneUrl: r.clone_url,
          description: r.description ?? null,
          isPrivate: r.private,
          updatedAt: r.updated_at
        })
      }
      if (json.length < 100) break
    }
  } else if (account.provider === 'bitbucket') {
    const fetchBitbucketPage = async (url: string) => {
      const bearerData = await httpsGet(url, {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'GitEasy/1.0',
        Accept: 'application/json'
      })
      let json = JSON.parse(bearerData)
      if (!(json.type === 'error' || json.error)) return json

      const basicData = await httpsGet(url, {
        Authorization: `Basic ${Buffer.from(`${account.username}:${token}`).toString('base64')}`,
        'User-Agent': 'GitEasy/1.0',
        Accept: 'application/json'
      })
      json = JSON.parse(basicData)
      if (json.type === 'error' || json.error) {
        throw new Error(`Bitbucket: ${json.error?.message ?? 'Failed to list repositories'}`)
      }
      return json
    }

    let next: string | null = 'https://api.bitbucket.org/2.0/repositories?role=member&pagelen=100&sort=-updated_on'
    for (let page = 0; page < 5 && next; page++) {
      const json = await fetchBitbucketPage(next)

      const values = Array.isArray(json.values) ? json.values : []
      for (const r of values) {
        const clone = Array.isArray(r.links?.clone)
          ? r.links.clone.find((c: any) => c.name === 'https')?.href
          : null
        if (!clone) continue
        results.push({
          name: r.slug ?? r.name,
          fullName: r.full_name ?? r.name,
          cloneUrl: clone,
          description: r.description ?? null,
          isPrivate: !!r.is_private,
          updatedAt: r.updated_on ?? new Date().toISOString()
        })
      }

      next = typeof json.next === 'string' ? json.next : null
      if (values.length === 0) break
    }
  } else {
    // GitLab (cloud or self-hosted)
    for (let page = 1; page <= 3; page++) {
      const data = await httpsGet(
        `https://${host}/api/v4/projects?membership=true&per_page=100&page=${page}&order_by=last_activity_at&simple=true`,
        { 'PRIVATE-TOKEN': token, 'User-Agent': 'GitEasy/1.0' }
      )
      const json = JSON.parse(data)
      if (!Array.isArray(json) || json.length === 0) break
      for (const r of json) {
        results.push({
          name: r.path,
          fullName: r.path_with_namespace,
          cloneUrl: r.http_url_to_repo,
          description: r.description ?? null,
          isPrivate: r.visibility !== 'public',
          updatedAt: r.last_activity_at
        })
      }
      if (json.length < 100) break
    }
  }

  return results
}
