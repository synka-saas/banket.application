export interface CalendarEvent {
  /** ISO date "2026-10-29". */
  date: string;
  /** "11:00". */
  time?: string;
  title: string;
  stage?: "new" | "negotiation" | "won" | "lost";
  color?: string;
  [k: string]: any;
}

/**
 * Agenda month grid (Dom → Sáb) with event chips colored by funnel stage.
 */
export interface CalendarMonthProps {
  year: number;
  /** 0-based month (9 = outubro). */
  month: number;
  events?: CalendarEvent[];
  /** ISO date to highlight as today. Defaults to the real today. */
  today?: string;
  maxPerDay?: number;
  onDayClick?: (isoDate: string) => void;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function CalendarMonth(props: CalendarMonthProps): JSX.Element;
