const CODE = /^LN-[A-Z2-9]{10}$/;

export function isPublicCode(value: string) {
  return CODE.test(value.trim().toUpperCase());
}

export function resolveQrScan(raw: string):
  | { status: "identified"; code: string }
  | { status: "invalid"; message: string } {
  const text = raw.trim();
  if (!text) {
    return { status: "invalid", message: "Nenhum código foi lido." };
  }

  const direct = text.toUpperCase();
  if (isPublicCode(direct)) return { status: "identified", code: direct };

  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1]?.toUpperCase() ?? "";
    if (isPublicCode(last)) return { status: "identified", code: last };
    const queryCode = url.searchParams.get("code");
    if (queryCode && isPublicCode(queryCode.toUpperCase())) {
      return { status: "identified", code: queryCode.toUpperCase() };
    }
  } catch {
    // texto livre, não é URL
  }

  return {
    status: "invalid",
    message: "A leitura não corresponde a um identificador de estoque deste laboratório.",
  };
}
