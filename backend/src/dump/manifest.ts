export interface FileEntry {
  path: string
  format: 'json' | 'csv' | 'sql'
  table: string
  rows: number
  bytes: number
  sha256: string
}

export interface Manifest {
  name: string
  license: string
  generated_at: string
  total_rows: number
  files: FileEntry[]
}

/** Assemble the dump manifest. total_rows counts the JSON files (one per table). */
export function buildManifest(generatedAt: string, files: FileEntry[]): Manifest {
  return {
    name: 'OpenMRP open dataset',
    license: 'ODbL-1.0',
    generated_at: generatedAt,
    total_rows: files.filter((f) => f.format === 'json').reduce((n, f) => n + f.rows, 0),
    files,
  }
}
