/** Engram p/q + BFP-64 engine as a Cordis service.
 *
 * The service runs the 8b-is/Engram sovereign benchmark (Rust, zero-float
 * p/q kernels) and reports parsed rows over the `engram/bench-done` event.
 * The runner is injected so tests stay hermetic and hosts can swap in a
 * remote executor later. */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'engram-pq'
export const inject = []

export interface EngramBenchOptions {
  cwd?: string
  timeoutMs?: number
}

export type BenchRunner = (options: EngramBenchOptions) => Promise<string>

export interface EngramService {
  bench: (options?: EngramBenchOptions) => Promise<import('./parse.ts').EngramBenchReport[]>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    engram: EngramService
  }
  interface Events {
    'engram/bench-done': (reports: import('./parse.ts').EngramBenchReport[]) => void
  }
}

export function apply(ctx: Context, runner?: BenchRunner): void {
  const run: BenchRunner = runner ?? (async ({ cwd, timeoutMs }) => {
    const { spawn } = await import('node:child_process')
    const bin = process.env.ENGRAM_PQ_BIN ?? 'cargo'
    const args = process.env.ENGRAM_PQ_BIN
      ? []
      : ['run', '--manifest-path', 'rust/Cargo.toml', '--release', '--bin', 'bench']
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, { cwd, timeout: timeoutMs ?? 120_000 })
      let out = ''
      child.stdout.on('data', (c) => { out += c })
      child.stderr.on('data', () => {})
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) resolve(out)
        else reject(new Error(`engram bench exited ${code}`))
      })
    })
  })

  ctx.provide('engram', {
    async bench(options = {}) {
      const { parseEngramBenchRuns } = await import('./parse.ts')
      const output = await run(options)
      const reports = parseEngramBenchRuns(output)
      ;(ctx as unknown as { emit: (name: string, value: unknown) => void }).emit('engram/bench-done', reports)
      return reports
    },
  })
}
