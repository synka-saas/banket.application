// Ícone padrão do sistema para islands Preact (mesmo contrato de Icon.astro): Google Material Symbols.
export function Icon(props: { name: string; size?: number; class?: string }) {
  return (
    <span class={props.class ? `icon ${props.class}` : 'icon'} style={{ fontSize: `${props.size ?? 20}px` }} aria-hidden="true" translate={false}>
      {props.name}
    </span>
  );
}
