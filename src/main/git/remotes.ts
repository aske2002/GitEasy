import { runGit } from './runner'
import type { GitOperationResult, RemoteConfig } from '../../shared/ipc'

export async function listRemotes(repoPath: string): Promise<RemoteConfig[]> {
  const result = await runGit(repoPath, ['remote', '-v'])
  if (result.exitCode !== 0) return []

  const map = new Map<string, RemoteConfig>()
  for (const line of result.stdout.split('\n')) {
    const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/)
    if (!m) continue
    const [, name, url, type] = m
    if (!map.has(name)) map.set(name, { name, fetchUrl: '', pushUrl: '' })
    const entry = map.get(name)!
    if (type === 'fetch') entry.fetchUrl = url
    else entry.pushUrl = url
  }
  return Array.from(map.values())
}

export async function addRemote(repoPath: string, name: string, url: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['remote', 'add', name, url])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function removeRemote(repoPath: string, name: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['remote', 'remove', name])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function renameRemote(repoPath: string, oldName: string, newName: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['remote', 'rename', oldName, newName])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function setRemoteUrl(repoPath: string, name: string, url: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['remote', 'set-url', name, url])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}
