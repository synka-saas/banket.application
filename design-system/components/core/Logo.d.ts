export interface LogoProps {
  /** full = mark + "banket" wordmark. mark = rounded terracotta tile with the script "b" only. */
  variant?: "full" | "mark";
  /** dark = black wordmark (light surfaces). light = white wordmark (dark/photo surfaces). */
  tone?: "dark" | "light";
  /** Rendered height in px. Sidebar uses 30–32. Min 20 for full, 16 for mark. */
  height?: number;
  /** Override the image URL (otherwise resolved next to _ds_bundle.js → assets/). */
  src?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Logo(props: LogoProps): JSX.Element;
