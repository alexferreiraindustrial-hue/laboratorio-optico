const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export function validateAttachment(file: { name: string; type: string; size: number }) {
  if (!ALLOWED.has(file.type)) {
    return "Envie uma imagem JPG, PNG, WEBP ou um PDF.";
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    return "O arquivo deve ter até 8 MB.";
  }
  return null;
}

export function safeStoragePath(entityType: string, entityId: string, mime: string, id: string) {
  const extension = EXTENSIONS[mime];
  if (!extension) throw new Error("Tipo de arquivo não permitido.");
  if (!/^[a-z_]+$/.test(entityType)) throw new Error("Origem do anexo inválida.");
  if (!/^[0-9a-f-]{36}$/i.test(entityId) || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("Identificador inválido.");
  }
  return `${entityType}/${entityId}/${id}.${extension}`;
}
