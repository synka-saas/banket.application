// Acesso diário de cada usuário por empresa (acessos_dia), lido pelo Manager Hwesta em manager_ro.v_contas
// ("último acesso", "dias ativos nas últimas 4 semanas"). Chamado pelo middleware a cada requisição autenticada:
// grava no máximo uma vez a cada 10 min por usuário e processo (ultimo_em tem essa precisão) e nunca espera,
// pelo pool de métricas, que descarta sob pressão. Perder um acesso não afeta o app.
import { gravarMetrica } from './db';
import { emSaoPaulo } from './planos/trial';

export const INTERVALO_ACESSO_MS = 10 * 60_000;

const ultimos = new Map<string, number>();

export function registrarAcesso(usuarioId: string, tenantId: string, agora = new Date()): void {
  const chave = `${usuarioId}:${tenantId}`;
  const ultimo = ultimos.get(chave);
  if (ultimo !== undefined && agora.getTime() - ultimo < INTERVALO_ACESSO_MS) return;
  ultimos.set(chave, agora.getTime());
  gravarMetrica(
    `INSERT INTO acessos_dia (tenant_id, usuario_id, dia) VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, usuario_id, dia) DO UPDATE SET ultimo_em = now()`,
    [tenantId, usuarioId, emSaoPaulo(agora).data]
  );
}
