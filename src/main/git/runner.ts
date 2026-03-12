import { spawn } from 'child_process'

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Safely runs a git command in the given repository directory.
 * Uses args array (never shell:true) to prevent injection.
 */
export function runGit(repoPath: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve) => {
    const proc = spawn('git', args, {
      cwd: repoPath,
      shell: false, // CRITICAL: never use shell:true with user-supplied data
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0', // suppress interactive prompts
        LANG: 'en_US.UTF-8'
      }
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    proc.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk))
    proc.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

    proc.on('close', (code) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        exitCode: code ?? 1
      })
    })

    proc.on('error', (err) => {
      resolve({ stdout: '', stderr: err.message, exitCode: 1 })
    })
  })
}
