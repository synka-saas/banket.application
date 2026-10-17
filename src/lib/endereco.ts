// Endereço desmembrado (CEP, logradouro, número, complemento, bairro, cidade, UF) e a consulta à ViaCEP.
// Puro: roda no servidor e no navegador. `enderecoCompleto` monta o texto que continua em tenants.endereco (propostas,
// documentos com {empresa_endereco}, Stripe).

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export interface PartesEndereco {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

const limpo = (v: string | null | undefined) => (v ?? '').trim();
export const cepDigitos = (cep: string | null | undefined) => (cep ?? '').replace(/\D/g, '');
export const formatarCep = (cep: string | null | undefined) => {
  const d = cepDigitos(cep);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

/** "Rua das Flores, 100, Sala 2 – Centro, São Paulo/SP, CEP 01001-000" (só as partes preenchidas). Vazio → null. */
export function enderecoCompleto(p: PartesEndereco): string | null {
  const rua = [limpo(p.logradouro), limpo(p.numero), limpo(p.complemento)].filter(Boolean).join(', ');
  const local = [limpo(p.cidade), limpo(p.uf).toUpperCase()].filter(Boolean).join('/');
  const cep = cepDigitos(p.cep).length === 8 ? `CEP ${formatarCep(p.cep)}` : '';
  const texto = [[rua, limpo(p.bairro)].filter(Boolean).join(' – '), local, cep].filter(Boolean).join(', ');
  return texto || null;
}

export interface EnderecoViaCep {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  complemento: string;
}

/** Consulta a ViaCEP (navegador). CEP inválido ou não encontrado → null. */
export async function buscarCep(cep: string, f: typeof fetch = fetch): Promise<EnderecoViaCep | null> {
  const d = cepDigitos(cep);
  if (d.length !== 8) return null;
  const r = await f(`https://viacep.com.br/ws/${d}/json/`);
  if (!r.ok) return null;
  const j = (await r.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string; complemento?: string };
  if (j.erro) return null;
  return { logradouro: j.logradouro ?? '', bairro: j.bairro ?? '', cidade: j.localidade ?? '', uf: j.uf ?? '', complemento: j.complemento ?? '' };
}
