// Política de senha: mínimo de 8 caracteres, com letras, números e símbolos.

export const REGRA_SENHA = 'Mínimo de 8 caracteres, com letras, números e símbolos.';

export function validarSenha(senha: string, confirmacao?: string): string | null {
  if (senha.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (senha.length > 128) return 'A senha deve ter no máximo 128 caracteres.';
  if (!/[A-Za-zÀ-ÿ]/.test(senha)) return 'A senha deve conter letras.';
  if (!/\d/.test(senha)) return 'A senha deve conter números.';
  if (!/[^A-Za-zÀ-ÿ0-9]/.test(senha)) return 'A senha deve conter pelo menos um símbolo.';
  if (confirmacao !== undefined && senha !== confirmacao) return 'As senhas não conferem.';
  return null;
}
