// Ícones Tabler (outline, @tabler/icons 3.19.0, a mesma versão do app) embarcados no HTML em tempo de build.
// Regra do design system do Banket: traço 1,5 (1,75 até 16px) e currentColor.
import fs from 'node:fs';
import path from 'node:path';

export const ICONS_DIR = path.join(process.cwd(), 'node_modules', '@tabler', 'icons', 'icons', 'outline');
const cache = new Map();

export function iconSvg(name, size = 20, strokeWidth = size <= 16 ? 1.75 : 1.5) {
  const key = `${name}:${size}:${strokeWidth}`;
  if (cache.has(key)) return cache.get(key);
  let raw;
  try {
    raw = fs.readFileSync(path.join(ICONS_DIR, `${name}.svg`), 'utf8');
  } catch {
    throw new Error(`[central de ajuda] ícone Tabler inexistente: "${name}"`);
  }
  const svg = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s*class="[^"]*"/, '')
    .replace('width="24"', `width="${size}"`)
    .replace('height="24"', `height="${size}"`)
    .replace('stroke-width="2"', `stroke-width="${strokeWidth}"`)
    .replace('<svg', '<svg aria-hidden="true" focusable="false" style="display:block"')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
  cache.set(key, svg);
  return svg;
}
