import { runGit } from './runner'
import type { GitOperationResult } from '../../shared/ipc'

export async function createStash(repoPath: string, message?: string, includeUntracked = true): Promise<GitOperationResult> {
  const args = ['stash', 'push']
  if (includeUntracked) args.push('-u')
  if (message?.trim()) args.push('-m', message.trim())

  const result = await runGit(repoPath, args)
  const stderr = result.stderr.trim()

  return {
    success: result.exitCode === 0,
    error: result.exitCode !== 0 ? stderr : undefined
  }
}

export async function popStash(repoPath: string, stashRef: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['stash', 'pop', stashRef])
  return {
    success: result.exitCode === 0,
    error: result.exitCode !== 0 ? result.stderr.trim() : undefined
  }
}

export async function applyStash(repoPath: string, stashRef: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['stash', 'apply', stashRef])
  return {
    success: result.exitCode === 0,
    error: result.exitCode !== 0 ? result.stderr.trim() : undefined
  }
}

export async function dropStash(repoPath: string, stashRef: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['stash', 'drop', stashRef])
  return {
    success: result.exitCode === 0,
    error: result.exitCode !== 0 ? result.stderr.trim() : undefined
  }
}
