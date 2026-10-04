export interface AvatarProps {
  /** Person or company name — initials are derived from it. */
  name?: string;
  /** Optional photo URL. */
  src?: string;
  /** sm 28 · md 36 · lg 48 */
  size?: "sm" | "md" | "lg";
  /** rounded (default, echoes the app-icon mark) or circle. */
  shape?: "rounded" | "circle";
  className?: string;
  style?: React.CSSProperties;
}

export function Avatar(props: AvatarProps): JSX.Element;
