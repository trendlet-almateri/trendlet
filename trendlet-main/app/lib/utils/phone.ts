/**
 * Normalize a Saudi phone number to E.164 (+9665XXXXXXXX). Used before
 * sending Twilio WhatsApp messages so the templates resolve correctly.
 *
 * Accepts formats: 05X XXXXXXX, 5X XXXXXXX, +9665X XXXXXXX, 009665X XXXXXXX.
 * Returns null when the digits don't shape into a valid Saudi mobile number.
 */
export function normalizeSaudiPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("966")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  // Saudi mobiles start with 5 and have 9 digits after country code (5XXXXXXXX)
  if (!/^5\d{8}$/.test(digits)) return null;
  return `+966${digits}`;
}
