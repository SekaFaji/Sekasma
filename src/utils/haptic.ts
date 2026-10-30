/** Short vibration feedback on platforms that support it. */

export function haptic(ms: number) {
  try {
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    nav.vibrate?.(ms);
  } catch {
    /* device without vibration */
  }
}
