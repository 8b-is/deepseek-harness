import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply } from '../src/index.ts'
import { parseEngramBench, parseEngramBenchRuns } from '../src/parse.ts'
import type { EngramBenchReport } from '../src/parse.ts'

const FIXTURE = `
=========================================================================================
  8b-is / Engram — Sovereign p/q + Omni BFP-64 + MEM|8 + Quantum 64-Trit Benchmark
=========================================================================================
  1. Multi-Head N-Gram Prime Hashing (1024 tokens x 16 prime heads = 16,384 hashes):
     - Hardware \`% prime\` modulo:                  15.02 us (1.00x)
     - Lemire p/q (q=2^64) Reciprocal:             16.55 us (0.91x speedup, bit-exact!)
  3. Isolated Engram Head Projection (\`1024 -> 512\`, 16 Pre-Quantized 64-Dim Heads):
     - Dense FP64 Projection:                     463.86 us (1.00x)
     - Integer-Aligned BFP-64 (i16 -> i64):        13.94 us (33.26x speedup) | rel_err: 0.00315
     - Zero-Float Q16 BFP-64 (i16->i64->Q16):      14.11 us (32.88x speedup) | rel_err: 0.00317
  4. Full Engram Layer Step (16x64 Gather + 4 KeyProjs + 1 ValProj [2.62M weights] + Fused Gate + ShortConv):
     - Dense FP64 Engram Step:                   2568.16 us (1.00x)
     - 100% Zero-Float p/q Engram Step (Q16):      79.89 us (32.15x speedup) | rel_err: 0.00010
=========================================================================================
`

describe('parseEngramBench', () => {
  it('parses latency, speedup, and relative error rows', () => {
    const { rows } = parseEngramBench(FIXTURE)
    const q16 = rows.find(r => r.kernel.includes('Zero-Float p/q Engram Step'))
    expect(q16).toBeDefined()
    expect(q16!.latency_us).toBe(79.89)
    expect(q16!.speedup).toBe(32.15)
    expect(q16!.rel_err).toBeCloseTo(0.00010, 5)
    const dense = rows.find(r => r.kernel === 'Dense FP64 Engram Step')
    expect(dense!.latency_us).toBe(2568.16)
    expect(dense!.speedup).toBe(1)
  })

  it('keeps bit-exact annotations as notes', () => {
    const { rows } = parseEngramBench(FIXTURE)
    const lemire = rows.find(r => r.kernel.startsWith('Lemire'))
    expect(lemire!.note).toContain('bit-exact')
  })

  it('splits multi-banner output into runs', () => {
    const runs = parseEngramBenchRuns(FIXTURE + FIXTURE)
    expect(runs.length).toBeGreaterThanOrEqual(1)
    for (const run of runs) expect(run.tool).toBe('engram-pq')
  })
})

describe('engram-pq plugin', () => {
  it('provides the service, emits bench-done, and parses the run', async () => {
    const ctx = new Context()
    const runner = vi.fn(async () => FIXTURE)
    await ctx.plugin(apply, runner)
    const done = vi.fn<(reports: EngramBenchReport[]) => void>()
    ctx.on('engram/bench-done', done)
    const reports = await ctx.engram.bench({ cwd: '/tmp' })
    expect(runner).toHaveBeenCalledWith({ cwd: '/tmp' })
    expect(done).toHaveBeenCalledWith(reports)
    expect(reports.length).toBeGreaterThanOrEqual(1)
    await ctx.fiber.dispose()
  })

  it('propagates runner failures', async () => {
    const ctx = new Context()
    const runner = vi.fn(async () => { throw new Error('no engine') })
    await ctx.plugin(apply, runner)
    await expect(ctx.engram.bench()).rejects.toThrow('no engine')
    await ctx.fiber.dispose()
  })
})
