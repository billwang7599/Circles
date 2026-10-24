export function log(fields: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(fields)}\n`);
}
