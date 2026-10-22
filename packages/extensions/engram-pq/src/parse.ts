/** Parse the 8b-is/Engram Rust benchmark output into rows. */
export interface EngramRow {
  kernel: string
  latency_us?: number
  speedup?: number
  rel_err?: number
  note?: string
}

export interface EngramBenchReport {
  tool: 'engram-pq'
  rows: EngramRow[]
}

const LATENCY_LINE = /^\s+-\s(.+):\s+([\d.]+)\s+us\s+\(([\d.]+)x(?: speedup)?(?:, (.+?))?\)(?: \| rel_err: ([\d.e-]+))?$/
const COMPRESSION_LINE = /^\s+-\s(.+):\s+([\d.]+)\s+(GB|MB)\s+([\w-]+)\s+->\s+([\d.]+)\s+(GB|MB)\s+\((\w+)\)\s+=\s+([\d.]+)x\s+smaller/
const ERR_LINE = /rel_err:\s+([\d.e-]+)/

/** Parse the human-readable bench output. Lines the parser does not know
 * are carried as rows with only a note, never dropped. */
export function parseEngramBench(output: string): EngramBenchReport {
  const rows: EngramRow[] = []
  for (const line of output.split('\n')) {
    const m = LATENCY_LINE.exec(line)
    if (m) {
      const [, kernel, latency, speedup, note] = m
      const row: EngramRow = {
        kernel: (kernel ?? '').trim(),
        latency_us: Number(latency),
        speedup: Number(speedup),
      }
      if (m[5]) row.rel_err = Number(m[5])
      const err = ERR_LINE.exec(line)
      if (err) row.rel_err = Number(err[1])
      if (note) row.note = note.trim()
      rows.push(row)
      continue
    }
    const c = COMPRESSION_LINE.exec(line)
    if (c) {
      const [, kernel, sizeA, unitA, fmtA, sizeB, unitB, fmtB, ratio] = c
      rows.push({
        kernel: (kernel ?? '').trim(),
        note: `${sizeA} ${unitA} (${fmtA}) -> ${sizeB} ${unitB} (${fmtB}) = ${ratio}x smaller`,
      })
    }
  }
  return { tool: 'engram-pq', rows }
}

/** Split multi-bench output into one report per banner. */
export function parseEngramBenchRuns(output: string): EngramBenchReport[] {
  const parts = output.split(/={20,}/).map(s => s.trim()).filter(s => s.includes('us') || s.includes('smaller'))
  return parts.length ? parts.map(parseEngramBench) : [parseEngramBench(output)]
}
