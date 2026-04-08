import { promises as fs } from 'fs'
import { join } from 'path'
import { runGit } from './runner'
import type { ConflictContent, ConflictSegment } from '../../shared/ipc'

export async function getConflictContent(repoPath: string, filePath: string): Promise<ConflictContent> {
  const fullPath = join(repoPath, filePath)
  const content = await fs.readFile(fullPath, 'utf-8')
  return parseConflictMarkers(filePath, content)
}

function parseConflictMarkers(filePath: string, content: string): ConflictContent {
  const lines = content.split('\n')
  const segments: ConflictSegment[] = []
  let i = 0
  let conflictIndex = 0

  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      const oursLines: string[] = []
      const theirsLines: string[] = []
      let theirLabel = ''

      i++ // skip <<<<<<< HEAD line

      // Collect our side
      while (i < lines.length && !lines[i].startsWith('=======')) {
        oursLines.push(lines[i])
        i++
      }
      i++ // skip =======

      // Collect their side
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        theirsLines.push(lines[i])
        i++
      }

      // Extract label from >>>>>>> <label>
      if (i < lines.length) {
        theirLabel = lines[i].replace(/^>>>>>>> ?/, '').trim()
        i++ // skip >>>>>>> line
      }

      segments.push({ type: 'conflict', index: conflictIndex++, oursLines, theirsLines, theirLabel })
    } else {
      const normalLines: string[] = []
      while (i < lines.length && !lines[i].startsWith('<<<<<<<')) {
        normalLines.push(lines[i])
        i++
      }
      if (normalLines.length > 0) {
        segments.push({ type: 'normal', lines: normalLines })
      }
    }
  }

  return { filePath, segments }
}

export async function resolveConflict(repoPath: string, filePath: string, content: string): Promise<void> {
  const fullPath = join(repoPath, filePath)
  await fs.writeFile(fullPath, content, 'utf-8')
  await runGit(repoPath, ['add', '--', filePath])
}
