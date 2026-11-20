/** Preserve old PINs and prevent bcrypt truncation. */
export function sellerPasswordError(value: string): string | null {
  if (Array.from(value).length < 4 || new TextEncoder().encode(value).length > 64 || value.includes("\0") || !value.trim()) {
    return "Use pelo menos 4 caracteres e no máximo 64 bytes. Letras, números e símbolos são aceitos.";
  }
  return null;
}
