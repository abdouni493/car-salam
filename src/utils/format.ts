export function formatAmount(
  value: number | string | null | undefined,
  locale = 'fr-FR',
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || value === '') {
    return '0';
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '0';
  }

  try {
    return number.toLocaleString(locale, options);
  } catch (error) {
    return String(number);
  }
}
