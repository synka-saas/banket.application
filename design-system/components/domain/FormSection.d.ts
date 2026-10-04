export interface FormQuestion {
  label: string;
  /** "Texto curto", "E-mail", "Escolha única · 2 opções"… */
  type: string;
  required?: boolean;
  /** System question — always required, cannot be disabled. */
  locked?: boolean;
  enabled?: boolean;
}

export interface FormSectionProps {
  index: number;
  title: string;
  description?: string;
  /** Audience badge: "Somente B2B", "Somente B2C". */
  badge?: string;
  active?: boolean;
  /** First section — shows "Sempre ativa" lock instead of a switch. */
  alwaysActive?: boolean;
  onToggleActive?: (active: boolean) => void;
  questions?: FormQuestion[];
  onAddQuestion?: () => void;
  onQuestionChange?: (index: number, patch: Partial<FormQuestion>) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function FormSection(props: FormSectionProps): JSX.Element;
