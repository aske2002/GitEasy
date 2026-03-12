import { runGit } from './runner'
import type { CommitRaw } from '../../shared/ipc'

// Delimiter unlikely to appear in commit messages
const SEP = '\x1f'
const REC = '\x1e'

const FORMAT = [
  '%H',   // full hash
  '%h',   // short hash
  '%P',   // parent hashes (space-separated)
  '%an',  // author name
  '%ae',  // author email
  '%aI',  // author date ISO 8601
  '%s',   // subject
  '%b'    // body
].join(SEP)

export async function getGraph(repoPath: string): Promise<CommitRaw[]> {
  const result = await runGit(repoPath, [
    'log',
    '--all',
    '--topo-order',
    `--format=${FORMAT}${REC}`,
    '--decorate=full'
  ])

  if (result.exitCode !== 0) {
    throw new Error(`git log failed: ${result.stderr}`)
  }

  // Also get refs to attach to commits
  const refsResult = await runGit(repoPath, [
    'log',
    '--all',
    '--topo-order',
    '--format=%H %D'
  ])
  const refMap = new Map<string, string[]>()
  for (const line of refsResult.stdout.split('\n')) {
    const spaceIdx = line.indexOf(' ')
    if (spaceIdx === -1) continue
    const hash = line.slice(0, spaceIdx).trim()
    const decoration = line.slice(spaceIdx + 1).trim()
    if (decoration) {
      refMap.set(hash, decoration.split(',').map(r => r.trim()).filter(Boolean))
    }
  }

  const records = result.stdout.split(REC).map(r => r.trim()).filter(Boolean)
  const commits: CommitRaw[] = []

  for (const record of records) {
    const parts = record.split(SEP)
    if (parts.length < 7) continue

    const [hash, shortHash, parentHashesRaw, authorName, authorEmail, authorDate, subject, ...bodyParts] = parts
    commits.push({
      hash: hash.trim(),
      shortHash: shortHash.trim(),
      parentHashes: parentHashesRaw.trim() ? parentHashesRaw.trim().split(' ') : [],
      authorName: authorName.trim(),
      authorEmail: authorEmail.trim(),
      authorDate: authorDate.trim(),
      subject: subject.trim(),
      body: bodyParts.join(SEP).trim(),
      refs: refMap.get(hash.trim()) ?? []
    })
  }

  return commits
}
