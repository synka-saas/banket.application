import * as React from "react";

/**
 * Banket button. Sentence case labels ("Novo evento", "Salvar"), one primary per view region.
 * @startingPoint section="Core" subtitle="Primary, secondary, ghost, soft, danger and text buttons" viewport="700x320"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = terracotta fill (main CTA). secondary = outlined (Filtros, Exportar CSV). ghost = toolbar. soft = tinted accent. danger = destructive (Excluir). text = inline table action (Editar, Abrir). */
  variant?: "primary" | "secondary" | "ghost" | "soft" | "danger" | "text";
  /** sm 32px · md 40px · lg 48px */
  size?: "sm" | "md" | "lg";
  /** Only for variant="text": color the label as accent link or danger. */
  tone?: "accent" | "danger";
  /** Leading Tabler icon name (e.g. "circle-plus", "download", "filter"). */
  icon?: string;
  /** Trailing Tabler icon name (e.g. "chevron-down", "arrow-right"). */
  iconRight?: string;
  /** Full width. */
  block?: boolean;
  /** Render as a link. */
  href?: string;
  as?: React.ElementType;
  children?: React.ReactNode;
}

export function Button(props: ButtonProps): JSX.Element;
