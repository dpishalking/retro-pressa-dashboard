export function safeDiv(num: number, den: number) {
  return den === 0 ? 0 : num / den;
}
