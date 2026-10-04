import * as React from "react";

export interface SegmentedOption { value: string; label: React.ReactNode; icon?: string }

export interface SegmentedControlProps {
  /** Options as strings or {value,label,icon}. */
  options: Array<SegmentedOption | string>;
  value: string;
  onChange?: (value: string) => void;
  /** subtle = white tile on clay track (view toggles: Lista/Kanban, Mês/Semana). accent = terracotta fill (settings choices: 1 mês / 3 meses / 6 meses). */
  variant?: "subtle" | "accent";
  size?: "md" | "lg";
  block?: boolean;
  className?: string;
}

export function SegmentedControl(props: SegmentedControlProps): JSX.Element;
