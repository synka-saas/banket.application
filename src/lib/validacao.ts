// Textos em português para a validação nativa dos formulários (ValidityState). Puro: roda no navegador e nos testes.
import { dataCurta } from './datas';

export interface EstadoValidacao {
  valueMissing?: boolean;
  typeMismatch?: boolean;
  patternMismatch?: boolean;
  tooShort?: boolean;
  tooLong?: boolean;
  rangeUnderflow?: boolean;
  rangeOverflow?: boolean;
  stepMismatch?: boolean;
  badInput?: boolean;
}

export interface DadosCampo {
  /** type do input ("email", "radio"…) ou a tag ("select", "textarea") */
  tipo: string;
  min?: string | null;
  max?: string | null;
  minLength?: string | null;
  maxLength?: string | null;
  /** title do campo: com pattern, explica o formato esperado */
  titulo?: string | null;
}

const numero = (v: string) => v.replace('.', ',');

/** Mensagem do primeiro problema do campo; vazio quando não há o que traduzir. */
export function mensagemValidacao(v: EstadoValidacao, campo: DadosCampo): string {
  const { tipo } = campo;
  if (v.valueMissing) {
    if (tipo === 'radio' || tipo === 'select' || tipo === 'select-one' || tipo === 'select-multiple') return 'Selecione uma das opções.';
    if (tipo === 'checkbox') return 'Marque esta opção para continuar.';
    if (tipo === 'file') return 'Escolha um arquivo.';
    return 'Preencha este campo.';
  }
  if (v.typeMismatch) {
    if (tipo === 'email') return 'Informe um e-mail válido, como nome@empresa.com.br.';
    if (tipo === 'url') return 'Informe um endereço válido, como https://www.site.com.br.';
    return 'Confira o formato deste campo.';
  }
  if (v.badInput) {
    if (tipo === 'number') return 'Informe só números.';
    if (tipo === 'date' || tipo === 'datetime-local') return 'Informe uma data válida.';
    if (tipo === 'time') return 'Informe um horário válido.';
    return 'Confira o valor deste campo.';
  }
  if (v.patternMismatch) return campo.titulo?.trim() || 'Confira o formato deste campo.';
  if (v.tooShort && campo.minLength) return `Use pelo menos ${campo.minLength} caracteres.`;
  if (v.tooLong && campo.maxLength) return `Use no máximo ${campo.maxLength} caracteres.`;
  if (v.rangeUnderflow && campo.min) {
    if (tipo === 'date') return `Escolha uma data a partir de ${dataCurta(campo.min)}.`;
    return `O valor mínimo é ${numero(campo.min)}.`;
  }
  if (v.rangeOverflow && campo.max) {
    if (tipo === 'date') return `Escolha uma data até ${dataCurta(campo.max)}.`;
    return `O valor máximo é ${numero(campo.max)}.`;
  }
  if (v.stepMismatch) return tipo === 'number' ? 'Informe um número inteiro.' : 'Confira o valor deste campo.';
  return '';
}
