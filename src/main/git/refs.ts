import { runGit } from './runner'
import type { RefInfo } from '../../shared/ipc'

export async function getRefs(repoPath: string): Promise<RefInfo[]> {
  const refs: RefInfo[] = []

  // Get HEAD
  const headResult = await runGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const headBranch = headResult.stdout.trim()

  // Get all branches (local + remote) with tracking info
  // %(refname) gives the full ref path (refs/heads/main or refs/remotes/origin/main)
  // %(refname:short) gives the display name (main or origin/main)
  const branchResult = await runGit(repoPath, [
    'branch',
    '-a',
    '--format=%(refname)\t%(refname:short)\t%(objectname)\t%(upstream:short)\t%(upstream:track)'
  ])

  for (const line of branchResult.stdout.split('\n')) {
    const parts = line.split('\t').map(p => p.trim())
    if (parts.length < 3) continue
    const [refname, shortName, hash, upstream, track] = parts

    if (!refname || !shortName || !hash) continue
    // Skip symbolic refs (e.g. refs/remotes/origin/HEAD -> origin/main)
    if (hash.includes(' ') || hash.includes('->')) continue

    const isRemote = refname.startsWith('refs/remotes/')

    // Parse ahead/behind from [ahead 2, behind 3] format
    let ahead = 0
    let behind = 0
    if (track) {
      const aheadMatch = track.match(/ahead (\d+)/)
      const behindMatch = track.match(/behind (\d+)/)
      if (aheadMatch) ahead = parseInt(aheadMatch[1])
      if (behindMatch) behind = parseInt(behindMatch[1])
    }

    refs.push({
      name: shortName,
      hash,
      type: isRemote ? 'remote' : 'local',
      isHead: shortName === headBranch,
      upstream: upstream || undefined,
      ahead,
      behind
    })
  }

  // Get tags
  // *objectname dereferences annotated tags to the commit; for lightweight tags *objectname is empty
  const tagResult = await runGit(repoPath, [
    'tag',
    '--format=%(refname:short)\t%(*objectname)\t%(objectname)'
  ])

  for (const line of tagResult.stdout.split('\n')) {
    const parts = line.trim().split('\t')
    if (parts.length < 3) continue
    const [name, derefHash, ownHash] = parts
    if (!name) continue
    const hash = derefHash.trim() || ownHash.trim()
    if (!hash) continue
    refs.push({ name, hash, type: 'tag', isHead: false })
  }

  return refs
}
