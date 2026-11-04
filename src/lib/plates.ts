// Uluslararası plaka renk kodu
export function PLATE_COLORS(kg: number) {
  if (kg >= 25) return 'var(--plate-red)'
  if (kg >= 20) return 'var(--accent)'
  if (kg >= 15) return 'var(--plate-yellow)'
  if (kg >= 10) return 'var(--plate-green)'
  return 'var(--ink-2)'
}
