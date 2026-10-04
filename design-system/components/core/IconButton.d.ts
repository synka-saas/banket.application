import * as React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tabler icon name: "x", "dots", "chevron-left", "chevron-up", "pencil"… */
  icon: string;
  /** Accessible label (also used as tooltip). Required. */
  label: string;
  variant?: "ghost" | "secondary" | "primary";
  /** xs 24 · sm 32 · md 40 */
  size?: "xs" | "sm" | "md";
  iconSize?: number;
}

export function IconButton(props: IconButtonProps): JSX.Element;
