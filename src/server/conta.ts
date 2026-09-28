// Minha conta (UX-154): perfil e senha do usuário. A conta é global (vale para todas as empresas),
// por isso roda na conexão de sistema, como o autoatendimento.
import { z } from 'zod';
import { systemQuery } from '../lib/db';
import { UserError, optionalText, requiredText } from '../lib/forms';
import { validarSenha } from '../lib/senha';
import { invalidateMembership } from '../lib/membership';
import { invalidarEmpresas } from './autoatendimento';

export const perfilSchema = z.object({
  // Sem exigir sobrenome: contas antigas com um só nome poderiam travar nesta tela
  nome: requiredText('Informe seu nome.', 255),
  telefone: optionalText(20),
});

export interface PerfilConta {
  nome: string;
  email: string;
  telefone: string | null;
}

export async function carregarPerfil(usuarioId: string): Promise<PerfilConta> {
  const { rows } = await systemQuery<PerfilConta>('SELECT nome, email, telefone FROM usuarios WHERE id = $1', [usuarioId]);
  if (!rows[0]) throw new UserError('Conta não encontrada.');
  return rows[0];
}

export async function atualizarPerfil(usuarioId: string, tenantId: string, input: z.infer<typeof perfilSchema>) {
  await systemQuery('UPDATE usuarios SET nome = $2, telefone = $3, updated_at = now() WHERE id = $1', [
    usuarioId,
    input.nome,
    input.telefone,
  ]);
  // O nome exibido vem do vínculo (cache de 30 s): derruba para refletir na hora
  invalidateMembership(usuarioId, tenantId);
  invalidarEmpresas(usuarioId);
}

export async function trocarSenha(usuarioId: string, senhaAtual: string, nova: string, confirmacao: string) {
  const erro = validarSenha(nova, confirmacao);
  if (erro) throw new UserError(erro, 'senha');
  const { rows } = await systemQuery<{ confere: boolean }>(
    'SELECT senha_hash = crypt($2, senha_hash) AS confere FROM usuarios WHERE id = $1',
    [usuarioId, senhaAtual]
  );
  if (!rows[0]?.confere) throw new UserError('A senha atual não confere.', 'senha_atual');
  await systemQuery(`UPDATE usuarios SET senha_hash = crypt($2, gen_salt('bf')), updated_at = now() WHERE id = $1`, [
    usuarioId,
    nova,
  ]);
}
