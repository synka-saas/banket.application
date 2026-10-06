// Site institucional do Banket — interações das páginas, sem dependências.
// Cada bloco só age se encontrar os seus elementos na página.
(() => {
  'use strict';

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const semMovimento = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const SUAVE = 'cubic-bezier(.2,.7,.2,1)';

  // ── Menu do cabeçalho (telas estreitas) ─────────────────────────────────
  const btnMenu = $('.site-menu-btn');
  const menu = $('#site-menu');
  if (btnMenu && menu) {
    const abrirMenu = (abrir) => {
      menu.hidden = !abrir;
      btnMenu.setAttribute('aria-expanded', String(abrir));
    };
    btnMenu.addEventListener('click', () => abrirMenu(menu.hidden));
    // Os links levam às seções da própria página: fecha o menu ao escolher.
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) abrirMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) { abrirMenu(false); btnMenu.focus(); }
    });
  }

  // ── Telas do sistema em escala: data-fit="<largura de desenho em px>" ────
  const ajustar = (el) => {
    const largura = +el.dataset.fit;
    const miolo = el.firstElementChild;
    if (!miolo || !largura || !el.clientWidth) return;
    miolo.style.width = largura + 'px';
    miolo.style.zoom = String(Math.min(1, el.clientWidth / largura));
  };
  if ('ResizeObserver' in window) {
    const obsAjuste = new ResizeObserver((es) => es.forEach((e) => ajustar(e.target)));
    $$('[data-fit]').forEach((el) => { obsAjuste.observe(el); ajustar(el); });
  }

  // ── Entrada ao rolar: data-reveal="<atraso em ms>" ──────────────────────
  // Só o que está fora da tela ao carregar é escondido; o que já aparece fica como está.
  if (!semMovimento && 'IntersectionObserver' in window) {
    const revelar = (el) => {
      el.style.opacity = '';
      delete el.dataset.hidden;
      el.animate(
        [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }],
        { duration: 760, delay: +el.dataset.reveal || 0, easing: SUAVE, fill: 'backwards' },
      );
    };
    const obsEntrada = new IntersectionObserver((es) => es.forEach((e) => {
      const el = e.target;
      if (e.isIntersecting) {
        obsEntrada.unobserve(el);
        if (el.dataset.hidden === '1') revelar(el);
      } else if (!el.dataset.hidden && document.visibilityState === 'visible') {
        el.dataset.hidden = '1';
        el.style.opacity = '0';
      }
    }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    $$('[data-reveal]').forEach((el) => obsEntrada.observe(el));

    const mostrarTudo = () => $$('[data-hidden="1"]').forEach((el) => {
      el.style.opacity = '';
      delete el.dataset.hidden;
      obsEntrada.unobserve(el);
    });
    window.addEventListener('beforeprint', mostrarTudo);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') mostrarTudo(); });
  }

  // ── Movimento decorativo: data-float (flutuar) e data-orbit (girar) ─────
  if (!semMovimento) {
    $$('[data-float]').forEach((el) => el.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-8px)' }, { transform: 'translateY(0)' }],
      { duration: 6400, delay: -(+el.dataset.float || 0), iterations: Infinity, easing: 'ease-in-out' },
    ));
    $$('[data-orbit]').forEach((el) => {
      const graus = el.dataset.dir === 'rev' ? -360 : 360;
      el.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(' + graus + 'deg)' }],
        { duration: +el.dataset.orbit || 60000, iterations: Infinity },
      );
    });
  }

  // ── Hero: avisos que se alternam ────────────────────────────────────────
  const avisos = $$('.hero-toast');
  if (avisos.length > 1) {
    let atual = 0;
    const mostrarAviso = () => avisos.forEach((a, i) => {
      a.classList.toggle('is-on', i === atual);
      a.classList.toggle('is-out', i === (atual + avisos.length - 1) % avisos.length);
    });
    mostrarAviso();
    setInterval(() => { atual = (atual + 1) % avisos.length; mostrarAviso(); }, 3800);
  }

  // ── Como funciona: passos com avanço automático ─────────────────────────
  const tour = $('#como-funciona');
  const passos = $$('.tour-step');
  if (tour && passos.length) {
    const paineis = $$('.tour-panel');
    const moldura = $('[data-panel]');
    const caminho = $('[data-bind="tourPath"]');
    const CAMINHOS = [
      'app.banket.com.br/f/buffet-jardim',
      'app.banket.com.br/funil?visao=lista',
      'app.banket.com.br/eventos/248/orcamento',
      'app.banket.com.br/eventos/248/proposta',
      'app.banket.com.br/agenda',
      'app.banket.com.br/dashboard',
    ];
    let passo = 0;
    let progresso = null;
    let visivel = false;
    let ponteiroSobre = false;

    // O avanço só corre com a seção à vista e sem o ponteiro em cima.
    const sincronizar = () => {
      if (!progresso) return;
      if (visivel && !ponteiroSobre) progresso.play(); else progresso.pause();
    };
    const iniciarProgresso = () => {
      if (progresso) { progresso.onfinish = null; progresso.cancel(); progresso = null; }
      const barra = $('[data-progress="' + passo + '"]');
      if (!barra) return;
      progresso = barra.animate(
        [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: 7000, easing: 'linear', fill: 'forwards' },
      );
      progresso.onfinish = () => irPara((passo + 1) % passos.length);
      sincronizar();
    };
    const irPara = (i) => {
      if (i !== passo) {
        passo = i;
        passos.forEach((b, n) => {
          b.classList.toggle('is-active', n === passo);
          b.setAttribute('aria-expanded', String(n === passo));
        });
        paineis.forEach((p, n) => { p.hidden = n !== passo; });
        if (caminho) caminho.textContent = CAMINHOS[passo] || '';
        if (moldura && !semMovimento) {
          moldura.animate(
            [{ opacity: 0.35, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
            { duration: 420, easing: SUAVE },
          );
        }
      }
      iniciarProgresso();
    };

    passos.forEach((b, i) => b.addEventListener('click', () => irPara(i)));
    const area = passos[0].parentElement.parentElement;
    area.addEventListener('mouseenter', () => { ponteiroSobre = true; sincronizar(); });
    area.addEventListener('mouseleave', () => { ponteiroSobre = false; sincronizar(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visivel = e.isIntersecting; sincronizar(); }, { threshold: 0.2 }).observe(tour);
    } else {
      visivel = true;
    }
    iniciarProgresso();
  }

  // ── Recursos: staff pelo número de convidados ───────────────────────────
  const faixa = $('#staff-convidados');
  if (faixa) {
    const escrever = (chave, texto) => {
      const el = $('[data-bind="' + chave + '"]');
      if (el) el.textContent = texto;
    };
    const calcular = () => {
      const convidados = +faixa.value;
      const garcons = Math.ceil(convidados / 20);
      const copeiros = Math.ceil(convidados / 50);
      const cozinheiros = Math.ceil(convidados / 80);
      escrever('guests', convidados);
      escrever('staff.garcons', garcons);
      escrever('staff.copeiros', copeiros);
      escrever('staff.cozinheiros', cozinheiros);
      escrever('staff.total', garcons + copeiros + cozinheiros + ' profissionais');
    };
    faixa.addEventListener('input', calcular);
    calcular();
  }

  // ── Planos: cobrança mensal ou anual ────────────────────────────────────
  const cobranca = $('#seg-cobranca');
  if (cobranca) {
    const PRECOS = {
      anual: {
        ess: '89', pro: '197', pri: '447',
        essOld: 'R$ 127/mês', proOld: 'R$ 297/mês', priOld: 'R$ 597/mês',
        essNote: 'R$ 1.068 cobrados por ano', proNote: 'R$ 2.364 cobrados por ano', priNote: 'R$ 5.364 cobrados por ano',
      },
      mensal: {
        ess: '127', pro: '297', pri: '597',
        essOld: '', proOld: '', priOld: '',
        essNote: 'Cobrança mensal', proNote: 'Cobrança mensal', priNote: 'Cobrança mensal',
      },
    };
    const aplicarCobranca = (ciclo) => {
      const p = PRECOS[ciclo];
      $$('[data-valor]', cobranca).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.valor === ciclo)));
      $$('[data-bind^="pr."]').forEach((el) => { el.textContent = p[el.dataset.bind.slice(3)] ?? ''; });
      // Primeira linha da tabela de comparação: a mensalidade de cada plano.
      const mensalidades = $$('#comparacao tbody tr:first-child td');
      ['ess', 'pro', 'pri'].forEach((plano, i) => {
        if (mensalidades[i + 1]) mensalidades[i + 1].textContent = 'R$ ' + p[plano] + '/mês';
      });
      if (!semMovimento) {
        $$('[data-price]').forEach((el) => el.animate(
          [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
          { duration: 320, easing: SUAVE },
        ));
      }
    };
    cobranca.addEventListener('click', (e) => {
      const b = e.target.closest('[data-valor]');
      if (b && b.getAttribute('aria-pressed') !== 'true') aplicarCobranca(b.dataset.valor);
    });
  }

  // ── Planos: tabela de comparação ────────────────────────────────────────
  const btnComparar = $('#btn-comparar');
  const comparacao = $('#comparacao');
  if (btnComparar && comparacao) {
    btnComparar.addEventListener('click', () => {
      const abrir = comparacao.hidden;
      comparacao.hidden = !abrir;
      btnComparar.setAttribute('aria-expanded', String(abrir));
      const rotulo = $('span', btnComparar);
      if (rotulo) rotulo.textContent = abrir ? 'Ocultar comparação' : 'Comparar todos os recursos';
    });
  }

  // ── Dúvidas: uma resposta aberta por vez ────────────────────────────────
  const duvidas = $$('.faq-item');
  const abrirDuvida = (item, abrir) => {
    const botao = $('button', item);
    const resposta = document.getElementById(botao.getAttribute('aria-controls'));
    item.classList.toggle('is-open', abrir);
    botao.setAttribute('aria-expanded', String(abrir));
    if (resposta) resposta.hidden = !abrir;
  };
  duvidas.forEach((item) => $('button', item).addEventListener('click', () => {
    const abrir = !item.classList.contains('is-open');
    duvidas.forEach((outro) => abrirDuvida(outro, false));
    if (abrir) abrirDuvida(item, true);
  }));

  // ── Contato: agendamento da demonstração (Agenda do Manager Hwesta) ──────
  // O site só fala com /api/agenda/* no próprio domínio; o Nginx repassa cada rota ao calendário fixo
  // do Manager (GET slots, POST bookings, GET ics). Tudo que vem da API entra no DOM por textContent,
  // nunca como HTML; o único link montado na tela é o do .ics, a partir do token validado por regex.
  const form = $('#form-demo');
  const passoHorario = $('#demo-horario');
  const enviado = $('#demo-enviado');
  if (form && passoHorario && enviado) {
    const SLOT_MINUTOS = 30;
    const MAX_DIAS = 60;
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const fmtDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
    const dois = (n) => String(n).padStart(2, '0');
    const chaveDia = (d) => d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());
    const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    const quando = (inicio) => maiuscula(fmtDia.format(inicio)) + ', ' + fmtHora.format(inicio) + ' – ' + fmtHora.format(new Date(inicio.getTime() + SLOT_MINUTOS * 60000));

    const selPlano = form.elements.plano;
    const btnEnviar = $('button[type="submit"]', form);
    const erro = $('#agenda-erro');
    const dias = $('#agenda-dias');
    const slots = $('#agenda-slots');
    const btnAnt = $('#agenda-ant');
    const btnProx = $('#agenda-prox');
    const escolhido = $('#agenda-escolhido');
    const btnConfirmar = $('#agenda-confirmar');

    const hoje = new Date();
    const primeiroMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + MAX_DIAS);
    let mes = primeiroMes;
    let porDia = new Map(); // 'AAAA-MM-DD' → [Date]
    let diaAtivo = null;
    let horarioAtivo = null;
    let primeiraCarga = true;

    const nomeFuso = new Intl.DateTimeFormat('pt-BR', { timeZoneName: 'long' }).formatToParts(hoje).find((p) => p.type === 'timeZoneName');
    $('#agenda-fuso').textContent = nomeFuso ? nomeFuso.value : fuso;

    // Os botões dos planos (data-plano) levam ao formulário já com o plano escolhido.
    $$('[data-plano]').forEach((botao) => botao.addEventListener('click', () => {
      const opcao = selPlano && [...selPlano.options].find((o) => o.value === botao.dataset.plano);
      if (opcao) selPlano.value = opcao.value;
    }));

    const mostrarPasso = (passo) => {
      form.hidden = passo !== 'dados';
      passoHorario.hidden = passo !== 'horario';
      enviado.hidden = passo !== 'enviado';
      const foco = passo === 'horario' ? $('#agenda-titulo') : passo === 'enviado' ? $('#demo-enviado-titulo') : form.elements.nome;
      if (foco) foco.focus({ preventScroll: true });
    };
    const avisar = (texto) => {
      erro.textContent = texto || '';
      erro.hidden = !texto;
    };
    const mensagemSlots = (texto) => {
      slots.replaceChildren();
      const el = document.createElement('div');
      el.className = 'agenda-vazio';
      el.textContent = texto;
      slots.append(el);
    };
    const escolherHorario = (inicio) => {
      horarioAtivo = inicio;
      $$('.agenda-slot', slots).forEach((b) => {
        const ativo = !!inicio && +b.dataset.inicio === inicio.getTime();
        b.classList.toggle('ativo', ativo);
        b.setAttribute('aria-pressed', String(ativo));
      });
      escolhido.hidden = !inicio;
      $('#agenda-escolhido-texto').textContent = inicio ? quando(inicio) : '';
      btnConfirmar.disabled = !inicio;
    };

    const desenharSlots = () => {
      const lista = porDia.get(diaAtivo) || [];
      $('#agenda-dia-rotulo').textContent = lista.length ? maiuscula(fmtDia.format(lista[0])) : '';
      slots.replaceChildren();
      for (const inicio of lista) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'agenda-slot';
        b.dataset.inicio = String(inicio.getTime());
        b.textContent = fmtHora.format(inicio);
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', () => escolherHorario(inicio));
        slots.append(b);
      }
      escolherHorario(null);
    };
    const escolherDia = (chave) => {
      diaAtivo = chave;
      $$('.agenda-dia', dias).forEach((b) => b.classList.toggle('ativo', b.dataset.dia === chave));
      desenharSlots();
    };
    const desenharMes = () => {
      const a = mes.getFullYear(), m = mes.getMonth();
      dias.replaceChildren();
      for (let i = 0; i < new Date(a, m, 1).getDay(); i++) dias.append(document.createElement('div'));
      const total = new Date(a, m + 1, 0).getDate();
      for (let d = 1; d <= total; d++) {
        const chave = a + '-' + dois(m + 1) + '-' + dois(d);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'agenda-dia';
        b.dataset.dia = chave;
        b.textContent = String(d);
        if (chave === chaveDia(hoje)) b.classList.add('hoje');
        if (porDia.has(chave)) {
          b.classList.add('livre');
          b.setAttribute('aria-label', maiuscula(fmtDia.format(porDia.get(chave)[0])));
          b.addEventListener('click', () => escolherDia(chave));
        } else {
          b.disabled = true;
        }
        if (chave === diaAtivo) b.classList.add('ativo');
        dias.append(b);
      }
      if (diaAtivo && porDia.has(diaAtivo)) desenharSlots();
      else {
        diaAtivo = null;
        escolherHorario(null);
        $('#agenda-dia-rotulo').textContent = '';
        mensagemSlots(porDia.size ? 'Escolha um dia destacado.' : 'Nenhum horário livre neste mês.');
      }
    };

    const carregarMes = async () => {
      const a = mes.getFullYear(), m = mes.getMonth();
      $('#agenda-mes-rotulo').textContent = maiuscula(fmtMes.format(mes));
      btnAnt.disabled = mes <= primeiroMes;
      btnProx.disabled = new Date(a, m + 1, 1) > ultimoDia;
      dias.replaceChildren();
      $('#agenda-dia-rotulo').textContent = '';
      mensagemSlots('Carregando horários…');

      // Um dia de margem de cada lado: o servidor trabalha no fuso de quem atende, não no do visitante.
      const de = chaveDia(new Date(a, m, 0));
      const ate = chaveDia(new Date(a, m + 1, 1));
      let lista = [];
      try {
        const res = await fetch('/api/agenda/slots?from=' + de + '&to=' + ate, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const corpo = await res.json();
        if (!corpo || !corpo.data || !Array.isArray(corpo.data.slots)) throw new Error('resposta inesperada');
        lista = corpo.data.slots.map((s) => new Date(s)).filter((d) => !Number.isNaN(d.getTime()));
      } catch {
        mensagemSlots('Não foi possível carregar os horários. Tente novamente em instantes.');
        return;
      }
      if (mes.getFullYear() !== a || mes.getMonth() !== m) return; // o visitante já trocou de mês

      porDia = new Map();
      for (const inicio of lista) {
        if (inicio.getFullYear() !== a || inicio.getMonth() !== m) continue;
        const chave = chaveDia(inicio);
        if (!porDia.has(chave)) porDia.set(chave, []);
        porDia.get(chave).push(inicio);
      }
      // Mês atual sem horário livre (fim do mês, por exemplo): já abre no próximo.
      if (primeiraCarga && porDia.size === 0 && !btnProx.disabled) {
        primeiraCarga = false;
        mes = new Date(a, m + 1, 1);
        return carregarMes();
      }
      primeiraCarga = false;
      desenharMes();
    };

    btnAnt.addEventListener('click', () => { mes = new Date(mes.getFullYear(), mes.getMonth() - 1, 1); carregarMes(); });
    btnProx.addEventListener('click', () => { mes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1); carregarMes(); });
    $('#agenda-voltar').addEventListener('click', () => mostrarPasso('dados'));

    // Passo 1 → 2: os campos passam pela validação nativa do navegador antes de abrir a agenda.
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      avisar('');
      mostrarPasso('horario');
      if (primeiraCarga) carregarMes();
    });

    // Passo 2 → 3: reserva o horário no calendário do Manager.
    btnConfirmar.addEventListener('click', async () => {
      if (!horarioAtivo) return;
      avisar('');
      const rotulo = $('span', btnConfirmar);
      btnConfirmar.disabled = true;
      rotulo.textContent = 'Agendando…';
      const campos = form.elements;
      const notas = [
        'Plano de interesse: ' + campos.plano.value,
        'Eventos por mês: ' + campos.eventos_mes.value,
        'Origem: banket.com.br',
      ].join('\n');
      let res, corpo;
      try {
        res = await fetch('/api/agenda/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            start: horarioAtivo.toISOString(),
            name: campos.nome.value.trim(),
            email: campos.email.value.trim(),
            phone: campos.whatsapp.value.trim(),
            company: campos.buffet.value.trim(),
            notes: notas,
            website: campos.website.value,
            timezone: fuso,
          }),
        });
        corpo = await res.json().catch(() => ({}));
      } catch {
        avisar('Erro de conexão. Tente novamente.');
        rotulo.textContent = 'Confirmar agendamento';
        btnConfirmar.disabled = false;
        return;
      }
      rotulo.textContent = 'Confirmar agendamento';
      btnConfirmar.disabled = false;

      const dados = res.status === 201 && corpo && corpo.data ? corpo.data : null;
      const inicio = dados ? new Date(dados.starts_at) : null;
      if (dados && inicio && !Number.isNaN(inicio.getTime())) {
        const email = campos.email.value.trim();
        $('#demo-enviado-texto').textContent = quando(inicio) + '. ' + (dados.email_sent
          ? 'Enviamos a confirmação' + (dados.meet_url ? ' com o link do Google Meet' : '') + ' para ' + email + '.'
          : 'Anote a data: é por e-mail que você recebe o link da chamada.');
        // Só o convite .ics fica na tela; o link do Meet e o de cancelar chegam pelo e-mail de confirmação.
        const token = UUID.test(String(dados.token || '')) ? dados.token : null;
        const linkIcs = $('#demo-ics');
        linkIcs.hidden = !token; if (token) linkIcs.href = '/api/agenda/ics/' + token;
        mostrarPasso('enviado');
        return;
      }
      if (corpo && corpo.code === 'slot_taken') {
        // Alguém reservou o mesmo horário enquanto o formulário era preenchido.
        avisar(typeof corpo.message === 'string' ? corpo.message : 'Este horário acabou de ser reservado. Escolha outro.');
        escolherHorario(null);
        carregarMes();
        return;
      }
      if (res.status === 429) {
        avisar('Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.');
        return;
      }
      avisar(corpo && typeof corpo.message === 'string' ? corpo.message : 'Não foi possível concluir o agendamento. Tente novamente.');
    });

    $('#demo-novo').addEventListener('click', () => {
      const planoAtual = selPlano ? selPlano.value : null;
      form.reset();
      if (selPlano && planoAtual) selPlano.value = planoAtual;
      escolherHorario(null);
      mostrarPasso('dados');
    });
  }
})();
