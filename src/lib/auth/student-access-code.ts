export function normalizeStudentAccessCode(value: string): string {
  return value.normalize('NFKC').toLowerCase().trim().replace(/[\s-]+/g, '');
}
