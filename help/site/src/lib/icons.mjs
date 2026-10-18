// Ícones Lucide embarcados no HTML em tempo de build (o Design System carrega
// do CDN em runtime; aqui ficam inline, sem requisição extra e sem CDN).
// Mesmo ajuste do componente Icon do DS: traço 1.5 e currentColor.
import fs from 'node:fs';
import path from 'node:path';

const ICONS_DIR = path.join(process.cwd(), 'node_modules', 'lucide-static', 'icons');
const cache = new Map();

export function iconSvg(name, size = 20, strokeWidth = 1.5) {
  const key = `${name}:${size}:${strokeWidth}`;
  if (cache.has(key)) return cache.get(key);
  let raw;
  try {
    raw = fs.readFileSync(path.join(ICONS_DIR, `${name}.svg`), 'utf8');
  } catch {
    throw new Error(`[central de ajuda] ícone Lucide inexistente: "${name}"`);
  }
  const svg = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s*class="[^"]*"/, '')
    .replace('width="24"', `width="${size}"`)
    .replace('height="24"', `height="${size}"`)
    .replace('stroke-width="2"', `stroke-width="${strokeWidth}"`)
    .replace('<svg', '<svg aria-hidden="true" focusable="false" style="display:block"')
    .trim();
  cache.set(key, svg);
  return svg;
}
