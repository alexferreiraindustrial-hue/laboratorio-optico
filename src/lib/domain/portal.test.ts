import { describe, expect, it } from "vitest";
import { canPortalSeeOrder, messageError, sanitizeMessage, sellersForStore } from "./portal";

const norte = "11111111-1111-1111-1111-111111111111";
const leste = "22222222-2222-2222-2222-222222222222";
const ana = "33333333-3333-3333-3333-333333333333";
const bia = "44444444-4444-4444-4444-444444444444";

describe("portal externo", () => {
  it("mostra só as OS da loja autorizada", () => {
    const access = { kind: "store" as const, storeId: norte };
    expect(canPortalSeeOrder(access, { storeId: norte, sellerId: ana })).toBe(true);
    expect(canPortalSeeOrder(access, { storeId: leste, sellerId: bia })).toBe(false);
    expect(canPortalSeeOrder(access, { storeId: null, sellerId: ana })).toBe(false);
  });

  it("mostra só as OS do vendedor autorizado", () => {
    const access = { kind: "seller" as const, sellerId: ana };
    expect(canPortalSeeOrder(access, { storeId: norte, sellerId: ana })).toBe(true);
    expect(canPortalSeeOrder(access, { storeId: leste, sellerId: ana })).toBe(true);
    expect(canPortalSeeOrder(access, { storeId: norte, sellerId: bia })).toBe(false);
  });

  it("remove marcação e recusa mensagem curta ou enorme", () => {
    expect(sanitizeMessage("  <script>alert(1)</script>Olá  ")).toBe("alert(1)Olá");
    expect(messageError("oi")).toMatch(/5 e 800/);
    expect(messageError("a".repeat(801))).toMatch(/5 e 800/);
    expect(messageError("Podem concluir hoje?")).toBeNull();
  });

  it("filtra vendedores pela loja selecionada", () => {
    const sellers = [
      { id: ana, name: "Ana" },
      { id: bia, name: "Bia" },
    ];
    const links = [
      { seller_id: ana, store_id: norte },
      { seller_id: bia, store_id: leste },
      { seller_id: ana, store_id: leste },
    ];
    expect(sellersForStore(sellers, links, norte).map((item) => item.name)).toEqual(["Ana"]);
    expect(sellersForStore(sellers, links, leste).map((item) => item.name)).toEqual(["Ana", "Bia"]);
  });
});
