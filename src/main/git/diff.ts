import { runGit } from './runner'
import type { DiffFile, DiffHunk, DiffLine } from '../../shared/ipc'
import { promises as fsPromises } from 'fs'
import { join } from 'path'

function parsePatch(patch: string): DiffFile[] {
  const files: DiffFile[] = []
  const fileBlocks = patch.split(/^diff --git /m).filter(Boolean)

  for (const block of fileBlocks) {
    const lines = block.split('\n')
    const headerLine = lines[0] // "a/foo.ts b/foo.ts"
    const paths = headerLine.match(/a\/(.+) b\/(.+)/)
    const path = paths ? paths[2] : headerLine.trim()
    const oldPath = paths ? paths[1] : undefined

    let additions = 0
    let deletions = 0
    const hunks: DiffHunk[] = []
    let currentHunk: DiffHunk | null = null

    let oldLine = 0
    let newLine = 0

    for (const line of lines.slice(1)) {
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
        if (match) {
          oldLine = parseInt(match[1])
          newLine = parseInt(match[2])
        }
        currentHunk = { header: line, lines: [] }
        hunks.push(currentHunk)
      } else if (currentHunk) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentHunk.lines.push({ type: 'add', content: line.slice(1), newLine: newLine++ })
          additions++
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          currentHunk.lines.push({ type: 'del', content: line.slice(1), oldLine: oldLine++ })
          deletions++
        } else if (line.startsWith(' ')) {
          currentHunk.lines.push({ type: 'ctx', content: line.slice(1), oldLine: oldLine++, newLine: newLine++ })
        }
      }
    }

    files.push({ path, oldPath: oldPath !== path ? oldPath : undefined, additions, deletions, hunks })
  }

  return files
}

export async function getCommitDiff(repoPath: string, hash: string): Promise<DiffFile[]> {
  const result = await runGit(repoPath, ['show', '--patch', '--format=', hash])
  if (result.exitCode !== 0) throw new Error(result.stderr)
  return parsePatch(result.stdout)
}

export async function getFileDiff(
  repoPath: string,
  hash: string,
  filePath: string
): Promise<DiffFile | null> {
  const result = await runGit(repoPath, ['show', '--patch', '--format=', hash, '--', filePath])
  if (result.exitCode !== 0) throw new Error(result.stderr)
  const files = parsePatch(result.stdout)
  return files.find(f => f.path === filePath) ?? null
}

export async function getFileContent(
  repoPath: string,
  hash: string,
  filePath: string
): Promise<string> {
  const result = await runGit(repoPath, ['show', `${hash}:${filePath}`])
  if (result.exitCode !== 0) throw new Error(result.stderr)
  return result.stdout
}

export async function getCommitFiles(
  repoPath: string,
  hash: string
): Promise<string[]> {
  const result = await runGit(repoPath, ['ls-tree', '-r', '--name-only', hash])
  if (result.exitCode !== 0) throw new Error(result.stderr)
  return result.stdout.split('\n').filter(Boolean)
}

export async function restoreFile(
  repoPath: string,
  hash: string,
  filePath: string
): Promise<void> {
  const result = await runGit(repoPath, ['show', `${hash}:${filePath}`])
  if (result.exitCode !== 0) throw new Error(result.stderr)
  await fsPromises.writeFile(join(repoPath, filePath), result.stdout, 'utf-8')
}
