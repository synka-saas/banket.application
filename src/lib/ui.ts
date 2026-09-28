// Atalhos tipados para os componentes globais de feedback, instalados pelos layouts:
// Toast (components/ui/Toast.astro) e Confirmar (components/ui/Confirmar.astro).
// Só para o navegador (scripts de página e ilhas Preact).

export type ToastTipo = 'success' | 'error' | 'info';

export interface ToastOpcoes {
  /** Botão no toast, ex.: { rotulo: 'Desfazer', executar: () => … } */
  acao?: { rotulo: string; executar: () => void };
}

export interface ConfirmarOpcoes {
  titulo: string;
  texto?: string;
  /** Rótulo do botão de confirmação (padrão: "Confirmar") */
  confirmar?: string;
  cancelar?: string;
  /** Ação destrutiva: botão de confirmação em vermelho */
  perigo?: boolean;
}

declare global {
  interface Window {
    banketToast?: (mensagem: string, tipo?: ToastTipo, opcoes?: ToastOpcoes) => void;
    banketConfirmar?: (opcoes: ConfirmarOpcoes) => Promise<boolean>;
  }
}

export function toast(mensagem: string, tipo: ToastTipo = 'info', opcoes?: ToastOpcoes) {
  window.banketToast?.(mensagem, tipo, opcoes);
}

/** Pede confirmação num modal; sem o componente na página, cai no confirm do navegador. */
export function confirmar(opcoes: ConfirmarOpcoes): Promise<boolean> {
  if (window.banketConfirmar) return window.banketConfirmar(opcoes);
  return Promise.resolve(window.confirm([opcoes.titulo, opcoes.texto].filter(Boolean).join('\n\n')));
}

/**
 * Põe o botão em carregamento (desabilitado, spinner e rótulo temporário) e devolve a função que o restaura.
 * Em formulários comuns basta data-carregando="Enviando…" no botão de envio (ver AppLayout).
 */
export function emCarregamento(botao: HTMLButtonElement | HTMLAnchorElement, rotulo?: string): () => void {
  const original = botao.innerHTML;
  const estavaDesabilitado = botao instanceof HTMLButtonElement && botao.disabled;
  if (botao instanceof HTMLButtonElement) botao.disabled = true;
  botao.classList.add('btn-carregando');
  botao.setAttribute('aria-busy', 'true');
  if (rotulo) botao.textContent = rotulo;
  return () => {
    botao.innerHTML = original;
    botao.classList.remove('btn-carregando');
    botao.removeAttribute('aria-busy');
    if (botao instanceof HTMLButtonElement) botao.disabled = estavaDesabilitado;
  };
}

/**
 * Baixa um arquivo gerado pelo servidor (ex.: PDF) esperando a resposta de verdade.
 * Se a rota responder outra coisa (erro com redirect + flash), navega até lá para mostrar a mensagem.
 */
export async function baixarArquivo(url: string, tipoEsperado = 'application/pdf'): Promise<boolean> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok || !(res.headers.get('Content-Type') ?? '').startsWith(tipoEsperado)) {
    window.location.assign(res.redirected ? res.url : url);
    return false;
  }
  const disposicao = res.headers.get('Content-Disposition') ?? '';
  const nome = decodeURIComponent(disposicao.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ?? disposicao.match(/filename="?([^";]+)"?/i)?.[1] ?? 'arquivo');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await res.blob());
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  return true;
}

/** Tira os destaques de erro (mensagens .field-erro e aria-invalid) de um formulário ou painel. */
export function limparErrosDosCampos(raiz: ParentNode) {
  raiz.querySelectorAll('.field-erro').forEach((el) => el.remove());
  raiz.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  });
  raiz.querySelectorAll('.field.com-erro').forEach((el) => el.classList.remove('com-erro'));
}

/** Tira o destaque de um campo quando o usuário o corrige. */
export function limparErroDoCampo(campo: HTMLElement) {
  if (campo.getAttribute('aria-invalid') !== 'true') return;
  campo.removeAttribute('aria-invalid');
  const id = campo.getAttribute('aria-describedby');
  if (id) document.getElementById(id)?.remove();
  campo.removeAttribute('aria-describedby');
  campo.closest('.field')?.classList.remove('com-erro');
}

/**
 * Mostra cada mensagem junto do campo de mesmo `name` (abaixo dele, com aria-invalid e aria-describedby).
 * Devolve o primeiro campo marcado, para receber o foco. Campos ocultos ou inexistentes são ignorados.
 */
export function marcarErrosNosCampos(form: HTMLFormElement, campos: Record<string, string>): HTMLElement | null {
  let primeiro: HTMLElement | null = null;
  for (const [nome, texto] of Object.entries(campos)) {
    const item = form.elements.namedItem(nome);
    const campo = (item instanceof RadioNodeList ? item[0] : item) as HTMLElement | null;
    if (!campo || (campo as HTMLInputElement).type === 'hidden') continue;
    const id = `erro-${form.id || 'form'}-${nome}`;
    document.getElementById(id)?.remove();
    const aviso = document.createElement('p');
    aviso.className = 'field-erro';
    aviso.id = id;
    aviso.textContent = texto;
    const container = campo.closest<HTMLElement>('.field') ?? campo.parentElement!;
    container.classList.add('com-erro');
    container.appendChild(aviso);
    campo.setAttribute('aria-invalid', 'true');
    campo.setAttribute('aria-describedby', id);
    primeiro ??= campo;
  }
  return primeiro;
}
