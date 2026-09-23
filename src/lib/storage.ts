// Armazenamento de arquivos em disco (volume Docker), sempre particionado por tenant:
//   {UPLOAD_DIR}/{tenantId}/{pasta}/{arquivo}
// A interface (save/read/remove + chave relativa) permite trocar por S3 no futuro.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

function baseDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? './uploads');
}

/** Resolve a chave para um caminho absoluto, impedindo sair do diretório do tenant. */
function resolveKey(tenantId: string, key: string): string {
  const tenantDir = path.join(baseDir(), tenantId);
  const full = path.resolve(tenantDir, key);
  if (!full.startsWith(tenantDir + path.sep)) throw new Error('Caminho de arquivo inválido');
  return full;
}

export function contentTypeFor(key: string): string {
  return MIME[path.extname(key).toLowerCase()] ?? 'application/octet-stream';
}

/** URL pública (autenticada) de um arquivo do tenant. */
export function fileUrl(tenantId: string, key: string): string {
  return `/uploads/${tenantId}/${key}`;
}

export async function saveFile(tenantId: string, key: string, content: Uint8Array): Promise<string> {
  const full = resolveKey(tenantId, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content);
  return key;
}

/** Salva um upload de formulário com nome único na pasta indicada. */
export async function saveUpload(
  tenantId: string,
  folder: string,
  file: File,
  opts: { allowedTypes?: string[]; maxBytes?: number } = {}
): Promise<string> {
  const { allowedTypes = IMAGE_TYPES, maxBytes = 5 * 1024 * 1024 } = opts;
  if (!allowedTypes.includes(file.type)) throw new Error('Tipo de arquivo não permitido.');
  if (file.size > maxBytes) throw new Error(`Arquivo maior que ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const ext = Object.entries(MIME).find(([, type]) => type === file.type)?.[0] ?? '';
  const key = `${folder}/${crypto.randomUUID()}${ext}`;
  await saveFile(tenantId, key, new Uint8Array(await file.arrayBuffer()));
  return key;
}

export async function readFile(tenantId: string, key: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(resolveKey(tenantId, key));
  } catch {
    return null;
  }
}

export async function removeFile(tenantId: string, key: string): Promise<void> {
  await fs.rm(resolveKey(tenantId, key), { force: true });
}

/** Remove uma pasta inteira do tenant (ex.: PDFs das versões de um evento excluído). */
export async function removeDir(tenantId: string, key: string): Promise<void> {
  await fs.rm(resolveKey(tenantId, key), { force: true, recursive: true });
}
