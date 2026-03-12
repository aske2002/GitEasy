import { safeStorage } from 'electron'
import { request as httpsRequest } from 'https'
import Store from 'electron-store'
import { runGit } from './runner'
import type { AccountInfo } from '../../shared/ipc'

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
  provider: 'github' | 'gitlab' | 'custom',
  host: string,
  token: string
): Promise<AccountInfo> {
  let username: string
  let avatarUrl: string | undefined

  if (host === 'github.com') {
    const data = await httpsGet('https://api.github.com/user', {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'GitEasy/1.0',
      Accept: 'application/vnd.github+json'
    })
    const json = JSON.parse(data)
    if (json.message) throw new Error(`GitHub: ${json.message}`)
    username = json.login
    avatarUrl = json.avatar_url
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
  const entry: StoredAccount = { provider, host, username, avatarUrl, encryptedToken: encryptToken(token) }
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

function getTokenForHost(
  store: Store<{ recentRepos: string[]; accounts: StoredAccount[] }>,
  host: string
): string | null {
  const accounts: StoredAccount[] = store.get('accounts', [])
  const account = accounts.find(a => a.host === host)
  if (!account) return null
  return decryptToken(account.encryptedToken)
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
    const token = getTokenForHost(store, parsed.hostname)
    if (!token) return null
    parsed.username = 'oauth2'
    parsed.password = encodeURIComponent(token)
    return parsed.toString()
  } catch {
    return null
  }
}
