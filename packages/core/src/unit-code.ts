const UNIT_CODE = /(?<![A-Z0-9])[A-Z]{2,6}-\d{1,5}(?![A-Z0-9])/i;

export function extractUnitCode(message: string): string | null {
  const match = UNIT_CODE.exec(message);
  return match ? match[0].toUpperCase() : null;
}
