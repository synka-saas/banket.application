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
