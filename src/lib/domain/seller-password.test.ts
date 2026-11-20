import { describe, expect, it } from "vitest";
import { sellerPasswordError } from "./seller-password";
describe("seller password compatibility", () => {
  it("accepts letters and existing PINs", () => {
    for (const value of ["Lentes2026", "Vendedor!", "1234", "12345678", " senha "]) expect(sellerPasswordError(value)).toBeNull();
  });
  it("rejects empty, short, NUL and oversized UTF-8 passwords", () => {
    for (const value of ["", "abc", "    ", "abc\0def", "a".repeat(65), "é".repeat(33)]) expect(sellerPasswordError(value)).not.toBeNull();
    expect(sellerPasswordError("é".repeat(32))).toBeNull();
  });
});
