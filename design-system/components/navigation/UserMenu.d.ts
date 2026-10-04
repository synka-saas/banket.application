import type { MenuItem } from "../overlay/Menu";

export interface UserMenuProps {
  name: string;
  /** Papel: "Proprietário", "Usuário". */
  role?: string;
  avatar?: string;
  /** When set, clicking opens a Menu with these items (Meu perfil, Trocar empresa, Sair…). */
  items?: MenuItem[];
  onClick?: () => void;
  className?: string;
}

export function UserMenu(props: UserMenuProps): JSX.Element;
