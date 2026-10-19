// Early feedback only; the server independently enforces these limits.
export const IMPORT_LIMITS = {files: 3, fileBytes: 250 * 1024 * 1024, sessionBytes: 750 * 1024 * 1024};

type FileInfo = {name: string; size: number};

export function importSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

export function importProblem(files: FileInfo[], existing: FileInfo[]): string | null {
  if (files.length + existing.length > IMPORT_LIMITS.files) {
    return `This batch would exceed 3 datasets per session (${existing.length} already imported). Choose fewer files or clear the session.`;
  }
  for (const file of files) {
    if (!/\.(csv|parquet)$/i.test(file.name)) return `“${file.name}” is not a CSV or Parquet file.`;
    if (!file.size) return `“${file.name}” is empty. Choose a file containing data.`;
    if (file.size > IMPORT_LIMITS.fileBytes) return `“${file.name}” exceeds the 250 MiB per-file limit.`;
  }
  if ([...existing, ...files].reduce((size, file) => size + file.size, 0) > IMPORT_LIMITS.sessionBytes) {
    return 'This batch would exceed the 750 MiB session limit. Choose fewer files or clear the session.';
  }
  return null;
}
