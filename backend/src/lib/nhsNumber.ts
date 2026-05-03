const NHS_NUMBER_REGEX = /\b(\d{3}[ -]?\d{3}[ -]?\d{4})\b/;

export function extractNhsNumber(text: string): string | undefined {
  const match = NHS_NUMBER_REGEX.exec(text);
  return match?.[1]?.replace(/[ -]/g, '');
}
