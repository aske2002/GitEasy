import { runGit } from './runner'
import { createStash } from './stash'
import type { CheckoutOptions, MergeOptions, RebaseOptions, GitOperationResult, ResetMode } from '../../shared/ipc'

const DIRTY_WORKING_TREE_PATTERNS = [
  'Your local changes to the following files would be overwritten',
  'Please commit your changes or stash them',
  'error: uncommitted changes'
]

function isDirtyWorkingTreeError(stderr: string): boolean {
  return DIRTY_WORKING_TREE_PATTERNS.some(p => stderr.includes(p))
}

export async function checkout(repoPath: string, opts: CheckoutOptions): Promise<GitOperationResult> {
  const args = ['checkout']
  if (opts.createBranch) {
    args.push('-b', opts.createBranch)
    args.push(opts.target)
  } else if (opts.isRemote) {
    // Checkout remote tracking branch: create local branch tracking the remote
    // e.g. git checkout --track origin/develop  →  creates local 'develop' tracking it
    args.push('--track', opts.target)
  } else {
    args.push(opts.target)
  }

  let result = await runGit(repoPath, args)

  if (result.exitCode !== 0 && isDirtyWorkingTreeError(result.stderr)) {
    // Auto-stash changes and retry checkout
    const stashResult = await createStash(repoPath, 'Auto-stash before branch switch')
    if (!stashResult.success) {
      return { success: false, error: stashResult.error }
    }
    result = await runGit(repoPath, args)
  }

  if (result.exitCode !== 0 && opts.isRemote && result.stderr.includes('already exists')) {
    // Local branch already exists — just switch to it
    const localBranch = opts.target.replace(/^[^/]+\//, '')
    const fallback = await runGit(repoPath, ['checkout', localBranch])
    return {
      success: fallback.exitCode === 0,
      error: fallback.exitCode !== 0 ? fallback.stderr : undefined
    }
  }

  return {
    success: result.exitCode === 0,
    error: result.exitCode !== 0 ? result.stderr : undefined
  }
}

export async function reset(repoPath: string, hash: string, mode: ResetMode): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['reset', `--${mode}`, hash])
  return {
    success: result.exitCode === 0,
    error: result.exitCode !== 0 ? result.stderr : undefined
  }
}

export async function merge(repoPath: string, opts: MergeOptions): Promise<GitOperationResult> {
  const args = ['merge']
  if (opts.strategy === 'squash') args.push('--squash')
  else if (opts.strategy === 'ff-only') args.push('--ff-only')
  args.push(opts.source)

  const result = await runGit(repoPath, args)

  if (result.exitCode !== 0) {
    // Check for conflicts
    const conflictsResult = await runGit(repoPath, ['diff', '--name-only', '--diff-filter=U'])
    const conflicts = conflictsResult.stdout.split('\n').filter(Boolean)
    return { success: false, error: result.stderr, conflicts }
  }

  return { success: true }
}

export async function rebase(repoPath: string, _currentBranch: string, opts: RebaseOptions): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['rebase', opts.onto])
  if (result.exitCode !== 0) {
    const conflictsResult = await runGit(repoPath, ['diff', '--name-only', '--diff-filter=U'])
    const conflicts = conflictsResult.stdout.split('\n').filter(Boolean)
    // Abort the rebase to leave repo clean
    await runGit(repoPath, ['rebase', '--abort'])
    return { success: false, error: result.stderr, conflicts }
  }
  return { success: true }
}

export async function fetch(repoPath: string, authUrl?: string): Promise<GitOperationResult> {
  const args = authUrl
    ? ['fetch', authUrl, '--prune', '--tags']
    : ['fetch', '--all', '--prune']
  const result = await runGit(repoPath, args)
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function pull(repoPath: string, authUrl?: string, rebase = false): Promise<GitOperationResult> {
  if (authUrl) {
    // Get current branch to know what to merge after fetch
    const branchRes = await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const branch = branchRes.stdout.trim()
    // Resolve the remote name for this branch so we can update its tracking ref
    const remoteRes = await runGit(repoPath, ['config', `branch.${branch}.remote`])
    const remote = remoteRes.stdout.trim() || 'origin'
    // Use a full refspec so the remote-tracking ref (origin/<branch>) is updated
    const fetchRes = await runGit(repoPath, ['fetch', authUrl, `refs/heads/${branch}:refs/remotes/${remote}/${branch}`])
    if (fetchRes.exitCode !== 0) return { success: false, error: fetchRes.stderr }
    if (rebase) {
      const rebaseRes = await runGit(repoPath, ['rebase', 'FETCH_HEAD'])
      if (rebaseRes.exitCode !== 0) {
        await runGit(repoPath, ['rebase', '--abort'])
      }
      return { success: rebaseRes.exitCode === 0, error: rebaseRes.stderr || undefined }
    }
    const mergeRes = await runGit(repoPath, ['merge', 'FETCH_HEAD', '--ff-only'])
    return { success: mergeRes.exitCode === 0, error: mergeRes.stderr || undefined }
  }
  const result = await runGit(repoPath, rebase ? ['pull', '--rebase'] : ['pull'])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

async function getDefaultRemote(repoPath: string): Promise<string> {
  const branchRes = await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = branchRes.stdout.trim()
  if (branch && branch !== 'HEAD') {
    const remoteRes = await runGit(repoPath, ['config', `branch.${branch}.remote`])
    const remote = remoteRes.stdout.trim()
    if (remote) return remote
  }
  const remotesRes = await runGit(repoPath, ['remote'])
  const first = remotesRes.stdout.trim().split('\n')[0]
  return first || 'origin'
}

export async function push(repoPath: string, authUrl?: string): Promise<GitOperationResult> {
  if (authUrl) {
    const branchRes = await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const branch = branchRes.stdout.trim()
    const result = await runGit(repoPath, ['push', authUrl, `HEAD:refs/heads/${branch}`])
    return { success: result.exitCode === 0, error: result.stderr || undefined }
  }
  const remote = await getDefaultRemote(repoPath)
  const result = await runGit(repoPath, ['push', remote])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function canFastForward(repoPath: string, source: string, target: string): Promise<boolean> {
  // FF is possible when target is a direct ancestor of source
  const result = await runGit(repoPath, ['merge-base', '--is-ancestor', target, source])
  return result.exitCode === 0
}

export async function forcePush(repoPath: string, authUrl?: string): Promise<GitOperationResult> {
  if (authUrl) {
    const branchRes = await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
    const branch = branchRes.stdout.trim()
    const result = await runGit(repoPath, ['push', '--force', authUrl, `HEAD:refs/heads/${branch}`])
    return { success: result.exitCode === 0, error: result.stderr || undefined }
  }
  const remote = await getDefaultRemote(repoPath)
  const result = await runGit(repoPath, ['push', '--force', remote])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function createBranch(repoPath: string, name: string, from: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['checkout', '-b', name, from])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function deleteBranch(repoPath: string, name: string, force = false): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['branch', force ? '-D' : '-d', name])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function deleteRemoteBranch(repoPath: string, remote: string, branchName: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['push', remote, '--delete', branchName])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function renameBranch(repoPath: string, oldName: string, newName: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['branch', '-m', oldName, newName])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function cherryPick(repoPath: string, hash: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['cherry-pick', hash])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function createTag(repoPath: string, name: string, hash: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['tag', name, hash])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function pushTag(repoPath: string, name: string, authUrl?: string): Promise<GitOperationResult> {
  const remote = authUrl ?? await getDefaultRemote(repoPath)
  const result = await runGit(repoPath, ['push', remote, `refs/tags/${name}`])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function deleteTag(repoPath: string, name: string): Promise<GitOperationResult> {
  const result = await runGit(repoPath, ['tag', '-d', name])
  return { success: result.exitCode === 0, error: result.stderr || undefined }
}

export async function cloneRepo(
  parentDir: string,
  authCloneUrl: string,
  repoName: string
): Promise<{ success: boolean; clonedPath?: string; error?: string }> {
  const result = await runGit(parentDir, ['clone', authCloneUrl, repoName])
  if (result.exitCode !== 0) {
    // Strip the auth URL from any error message to avoid leaking tokens
    const safeError = result.stderr.replace(/https?:\/\/[^@]+@/g, 'https://')
    return { success: false, error: safeError }
  }
  const path = await import('path')
  return { success: true, clonedPath: path.join(parentDir, repoName) }
}
