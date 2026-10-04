// Ícone padrão do sistema para ilhas Preact (mesmo contrato de Icon.astro): Tabler Icons (outline).
import { ICONES, tracoIcone } from '../../lib/icones';

export function Icon(props: { name: string; size?: number; class?: string; stroke?: number }) {
  const size = props.size ?? 18;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class={props.class ? `icon ${props.class}` : 'icon'}
      data-icone={props.name}
      style={{ fontSize: `${size}px` }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={props.stroke ?? tracoIcone(size)}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONES[props.name] ?? '' }}
    />
  );
}
