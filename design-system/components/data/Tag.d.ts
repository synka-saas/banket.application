export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  /** neutral (clay) for categories · accent (terracotta) for time-in-stage / highlights · sage / ochre / cobalt / wine glazes for typed categories. */
  tone?: "neutral" | "accent" | "sage" | "ochre" | "cobalt" | "wine";
  /** Uppercase + tracking (use sparingly — e.g. event type on kanban cards). */
  caps?: boolean;
  outline?: boolean;
  size?: "sm" | "md";
  icon?: string;
}

export function Tag(props: TagProps): JSX.Element;
