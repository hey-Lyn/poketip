export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function isErrorNamed(error: unknown, name: string): boolean {
  return error instanceof Error && error.name === name;
}

export function errorProperties(error: unknown): Record<string, unknown> {
  return typeof error === "object" && error !== null
    ? error as Record<string, unknown>
    : {};
}
