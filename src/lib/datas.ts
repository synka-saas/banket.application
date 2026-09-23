// Formatação de datas "YYYY-MM-DD" (sem fuso) e horários "HH:MM" para exibição.

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function partes(iso: string | null | undefined): [number, number, number] | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** "2027-12-21" → "21/12/2027" */
export function dataCurta(iso: string | null | undefined): string {
  const p = partes(iso);
  return p ? `${String(p[2]).padStart(2, '0')}/${String(p[1]).padStart(2, '0')}/${p[0]}` : '-';
}

/** "2027-12-21" → "21/12/2027 - Terça-feira" */
export function dataComDiaSemana(iso: string | null | undefined): string {
  const p = partes(iso);
  if (!p) return '-';
  const dia = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return `${dataCurta(iso)} - ${DIAS[dia]}`;
}

/** "2027-12-21" → "21 dez 2027" */
export function dataMesAbreviado(iso: string | null | undefined): string {
  const p = partes(iso);
  return p ? `${p[2]} ${MESES[p[1] - 1]} ${p[0]}` : '-';
}

/** Faixa de horário: "12h às 20h", "19:30" ou "-" */
export function faixaHorario(inicio: string | null | undefined, fim: string | null | undefined): string {
  const h = (v: string) => (v.endsWith(':00') ? `${Number(v.slice(0, 2))}h` : v);
  if (inicio && fim) return `${h(inicio)} às ${h(fim)}`;
  if (inicio) return h(inicio);
  return '-';
}

export function horasTexto(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '-';
  const n = String(valor).replace('.', ',').replace(/,0$/, '');
  return `${n} ${Number(valor) === 1 ? 'hora' : 'horas'}`;
}

/** Data/hora de registro (timestamp) no fuso de São Paulo: "21/12/2027 às 14:30" */
export function dataHora(valor: Date | string): string {
  const d = new Date(valor);
  const data = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return `${data} às ${hora}`;
}
