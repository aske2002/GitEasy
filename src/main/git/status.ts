import { runGit } from './runner'
import type { StatusFile } from '../../shared/ipc'

export async function getStatus(repoPath: string): Promise<StatusFile[]> {
  const result = await runGit(repoPath, ['status', '--porcelain=v1', '-u'])

  if (result.exitCode !== 0) return []

  const files: StatusFile[] = []

  for (const line of result.stdout.split('\n')) {
    if (line.length < 3) continue

    const x = line[0] // index (staged)
    const y = line[1] // worktree (unstaged)
    const path = line.slice(3).trim()

    if (!path) continue

    files.push({
      path,
      staged: x !== ' ' && x !== '?',
      unstaged: y !== ' ',
      untracked: x === '?' && y === '?',
      statusCode: `${x}${y}`
    })
  }

  return files
}

export async function stageFile(repoPath: string, filePath: string): Promise<void> {
  await runGit(repoPath, ['add', '--', filePath])
}

export async function unstageFile(repoPath: string, filePath: string): Promise<void> {
  // Check if HEAD exists (initial commit edge case)
  const headCheck = await runGit(repoPath, ['rev-parse', '--verify', 'HEAD'])
  if (headCheck.exitCode !== 0) {
    // No commits yet — use rm --cached to unstage new files
    await runGit(repoPath, ['rm', '--cached', '--', filePath])
  } else {
    await runGit(repoPath, ['restore', '--staged', '--', filePath])
  }
}

export async function stageAll(repoPath: string): Promise<void> {
  await runGit(repoPath, ['add', '-A'])
}

export async function unstageAll(repoPath: string): Promise<void> {
  const headCheck = await runGit(repoPath, ['rev-parse', '--verify', 'HEAD'])
  if (headCheck.exitCode !== 0) {
    await runGit(repoPath, ['rm', '-r', '--cached', '.'])
  } else {
    await runGit(repoPath, ['restore', '--staged', '.'])
  }
}

export async function commitChanges(repoPath: string, message: string): Promise<{ success: boolean; error?: string }> {
  const result = await runGit(repoPath, ['commit', '-m', message])
  if (result.exitCode !== 0) {
    return { success: false, error: result.stderr || result.stdout }
  }
  return { success: true }
}
