/* ============================================================
  My Home — Main Application Logic
  Interactive platform for first-home buyers in Portugal
  ============================================================ */

(function () {
  'use strict';

  /* ─── Global State ─── */
  let currentLang = 'pt';
  let chartsInitialized = false;
  const chartInstances = {};
  const FORM_ENDPOINT = 'https://formspree.io/f/xlgpolvp'; // Formspree endpoint for contact form
  const MARKET_STATE = { referenceRate: null, inflation: null, lending: null, updatedAt: null };
  const BANK_OFFERS_PT = [
    { bank: 'Caixa Geral de Depósitos', type: 'Taxa mista', rate: 'Spread desde 0.75%', note: { pt: 'Condição associada a domiciliação de ordenado e seguros', en: 'Condition linked to salary domiciliation and bundled insurance' } },
    { bank: 'Millennium bcp', type: 'Taxa variável', rate: 'Spread desde 0.80%', note: { pt: 'Campanhas para clientes digitalmente ativos', en: 'Campaigns for digitally active clients' } },
    { bank: 'Novo Banco', type: 'Taxa fixa inicial', rate: 'Taxa promocional inicial', note: { pt: 'Oferta depende de perfil de risco e prazo', en: 'Offer depends on risk profile and term' } },
    { bank: 'Santander Totta', type: 'Taxa mista', rate: 'Condições bonificadas', note: { pt: 'Bonificação com produtos associados', en: 'Discount with linked products' } },
    { bank: 'Banco CTT', type: 'Taxa variável', rate: 'Spread competitivo', note: { pt: 'Simulações online com pré análise rápida', en: 'Online simulations with quick pre analysis' } },
  ];
  const HOUSING_STATE = {
    items: [],
    source: 'all',
    location: 'Lisboa',
    fallback: false,
    status: 'idle',
    filters: { maxBudget: null, minRooms: 0, areaScope: 'nearby', area: '', sort: 'relevance', searchMode: 'fast' },
    areaNote: '',
    areaUnknown: false,
    relatedItems: [],
    relatedFallback: false,
    hasPendingRelated: false,
    nearbyItems: [],
    nearbyAreas: [],
    hasPendingNearby: false,
    allSourcePrefetched: [],
    hasPendingAllSourcePrefetched: false,
    hasBootstrapLoaded: false
  };
  const HOUSING_CACHE = new Map();
  const HOUSING_CACHE_TTL = { fast: 60 * 1000, deep: 180 * 1000 };
  const HOUSING_SESSION_KEY = 'myhome-housing-ui-state-v1';
  const HOUSING_SOURCES = {
    imovirtual: {
      id: 'imovirtual',
      domain: 'imovirtual.com',
      label: 'Imovirtual',
      buildTargetUrl: (q, areaScope) => buildImovirtualUrl(q, areaScope),
      buildAlternativeUrls: (q, areaScope) => buildImovirtualAlternativeUrls(q, areaScope),
    },
    idealista: {
      id: 'idealista',
      domain: 'idealista.pt',
      label: 'Idealista',
      buildTargetUrl: (q, areaScope) => {
        const query = areaScope === 'all-lisbon-towns' ? 'Lisboa' : (q || 'Lisboa');
        return `https://www.idealista.pt/comprar-casas/?q=${encodeURIComponent(query)}`;
      },
      buildAlternativeUrls: (q) => {
        const slug = slugifyLocation(q || 'lisboa') || 'lisboa';
        return [
          `https://www.idealista.pt/comprar-casas/${slug}/`,
          `https://www.idealista.pt/comprar-casas/lisboa/`
        ];
      },
    },
    propertium: {
      id: 'propertium',
      domain: 'propertium.io',
      label: 'Propertium',
      buildTargetUrl: (q, areaScope) => buildPropertiumUrl(q, areaScope),
      buildAlternativeUrls: (q, areaScope) => buildPropertiumAlternativeUrls(q, areaScope),
    }
  };
  const RESOURCE_TOOLS = [
    {
      cat: 'environment',
      url: 'https://shademap.app/',
      title: { pt: 'Shademap', en: 'Shademap' },
      desc: { pt: 'Vê como a luz e sombra mudam numa rua durante o dia.', en: 'Check how sunlight and shade change across a street during the day.' }
    },
    {
      cat: 'environment',
      url: 'https://www.iqair.com/air-quality-map',
      title: { pt: 'Noise and Air Quality Mapper', en: 'Noise and Air Quality Mapper' },
      desc: { pt: 'Cruza qualidade do ar e contexto ambiental para avaliar a zona.', en: 'Combine air quality and local environmental context before choosing an area.' }
    },
    {
      cat: 'financial',
      url: 'https://www.numbeo.com/cost-of-living/',
      title: { pt: 'Utility Bill Cost Estimator', en: 'Utility Bill Cost Estimator' },
      desc: { pt: 'Estima despesas mensais de energia, agua e servicos na zona.', en: 'Estimate monthly utility costs for the area you are considering.' }
    },
    {
      cat: 'property',
      url: 'https://www.sce.pt/pesquisa-certificados/',
      title: { pt: 'Energy Certificate Registry', en: 'Energy Certificate Registry' },
      desc: { pt: 'Consulta certificados energeticos e eficiencia do imovel.', en: 'Check energy certificates and property efficiency ratings.' }
    },
    {
      cat: 'property',
      url: 'https://www.idealista.pt/mapa/',
      title: { pt: 'Area Analysis Tools', en: 'Area Analysis Tools' },
      desc: { pt: 'Analisa preco por m2, oferta e tendencias por bairro.', en: 'Explore price per square meter, inventory, and area trends.' }
    }
  ];
  const LIVE_MAP_LOCATIONS = [
    { key: 'lisboa', lat: 38.7223, lon: -9.1393, label: { pt: 'Lisboa', en: 'Lisbon' } },
    { key: 'porto', lat: 41.1579, lon: -8.6291, label: { pt: 'Porto', en: 'Porto' } },
    { key: 'braga', lat: 41.5454, lon: -8.4265, label: { pt: 'Braga', en: 'Braga' } },
    { key: 'coimbra', lat: 40.2033, lon: -8.4103, label: { pt: 'Coimbra', en: 'Coimbra' } },
    { key: 'setubal', lat: 38.5244, lon: -8.8882, label: { pt: 'Setubal', en: 'Setubal' } },
    { key: 'faro', lat: 37.0194, lon: -7.9304, label: { pt: 'Faro', en: 'Faro' } }
  ];
  const HOUSING_AREA_COORDS = {
    // Lisbon and nearby areas commonly used by this UI selector
    ajuda: { name: 'Ajuda', lat: 38.7085, lon: -9.1983 },
    alcantara: { name: 'Alcântara', lat: 38.7066, lon: -9.1806 },
    alfama: { name: 'Alfama', lat: 38.7111, lon: -9.1293 },
    alvalade: { name: 'Alvalade', lat: 38.7546, lon: -9.1468 },
    areeiro: { name: 'Areeiro', lat: 38.7423, lon: -9.1328 },
    intendente: { name: 'Intendente', lat: 38.7216, lon: -9.1358 },
    arroios: { name: 'Arroios', lat: 38.7283, lon: -9.1352 },
    'avenidas-novas': { name: 'Avenidas Novas', lat: 38.7375, lon: -9.1535 },
    'avenida-da-liberdade': { name: 'Avenida da Liberdade', lat: 38.7204, lon: -9.1452 },
    baixa: { name: 'Baixa', lat: 38.7138, lon: -9.1394 },
    'bairro-alto': { name: 'Bairro Alto', lat: 38.7149, lon: -9.1457 },
    beato: { name: 'Beato', lat: 38.7336, lon: -9.1088 },
    belem: { name: 'Belém', lat: 38.6977, lon: -9.2067 },
    benfica: { name: 'Benfica', lat: 38.7488, lon: -9.2022 },
    'cais-do-sodre': { name: 'Cais do Sodré', lat: 38.7063, lon: -9.1445 },
    'campo-grande': { name: 'Campo Grande', lat: 38.7596, lon: -9.1567 },
    'campo-de-ourique': { name: 'Campo de Ourique', lat: 38.7175, lon: -9.1637 },
    campolide: { name: 'Campolide', lat: 38.7274, lon: -9.1639 },
    carnide: { name: 'Carnide', lat: 38.7572, lon: -9.1915 },
    chiado: { name: 'Chiado', lat: 38.7108, lon: -9.1427 },
    estrela: { name: 'Estrela', lat: 38.7144, lon: -9.1609 },
    graca: { name: 'Graça', lat: 38.7187, lon: -9.1256 },
    lumiar: { name: 'Lumiar', lat: 38.7727, lon: -9.1593 },
    marvila: { name: 'Marvila', lat: 38.7451, lon: -9.1047 },
    misericordia: { name: 'Misericórdia', lat: 38.7129, lon: -9.1479 },
    mouraria: { name: 'Mouraria', lat: 38.7165, lon: -9.1334 },
    odivelas: { name: 'Odivelas', lat: 38.7929, lon: -9.1838 },
    olivais: { name: 'Olivais', lat: 38.7695, lon: -9.1068 },
    'parque-das-nacoes': { name: 'Parque das Nações', lat: 38.7679, lon: -9.0977 },
    'penha-de-franca': { name: 'Penha de França', lat: 38.7286, lon: -9.1268 },
    pontinha: { name: 'Pontinha', lat: 38.7654, lon: -9.1989 },
    'santa-clara': { name: 'Santa Clara', lat: 38.7836, lon: -9.1417 },
    'santa-maria-maior': { name: 'Santa Maria Maior', lat: 38.7112, lon: -9.1336 },
    'santo-antonio': { name: 'Santo António', lat: 38.7215, lon: -9.1504 },
    'sao-domingos-de-benfica': { name: 'São Domingos de Benfica', lat: 38.7454, lon: -9.1718 },
    'sao-vicente': { name: 'São Vicente', lat: 38.7198, lon: -9.1239 },
    telheiras: { name: 'Telheiras', lat: 38.7606, lon: -9.1668 },

    // Main city anchors used in location text field
    lisboa: { name: 'Lisboa', lat: 38.7223, lon: -9.1393 },
    porto: { name: 'Porto', lat: 41.1579, lon: -8.6291 },
    braga: { name: 'Braga', lat: 41.5454, lon: -8.4265 },
    coimbra: { name: 'Coimbra', lat: 40.2033, lon: -8.4103 },
    setubal: { name: 'Setúbal', lat: 38.5244, lon: -8.8882 },
    faro: { name: 'Faro', lat: 37.0194, lon: -7.9304 }
  };

  /* ═══════════════════════════════════════
     LANGUAGE / TRANSLATION ENGINE
     ═══════════════════════════════════════ */
  function setLanguage(lang) {
    currentLang = lang;
    document.body.setAttribute('data-lang', lang);
    document.getElementById('lang-current').textContent = lang.toUpperCase();
    document.getElementById('lang-other').textContent = lang === 'pt' ? 'EN' : 'PT';

    // Translate all [data-translate] elements
    document.querySelectorAll('[data-translate]').forEach(el => {
      const key = el.getAttribute('data-translate');
      if (T[lang] && T[lang][key]) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          // skip — these use placeholder
        } else {
          el.innerHTML = T[lang][key];
        }
      }
    });

    // Translate placeholders
    document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
      const key = el.getAttribute('data-translate-placeholder');
      if (T[lang] && T[lang][key]) {
        el.placeholder = T[lang][key];
      }
    });

    // Update page title
    if (T[lang]['meta.title']) document.title = T[lang]['meta.title'];

    // Rebuild dynamic content
    renderLearnCards();
    renderFAQ();
    renderResources();
    initResourceLiveMap();
    if (chartsInitialized) updateChartLabels();
    renderBankOffers();
    updateAIBrief();
    renderHousingListings(HOUSING_STATE.items, HOUSING_STATE.fallback);
    renderHousingStatusWithSummary(
      HOUSING_STATE.status,
      null,
      HOUSING_STATE.source,
      HOUSING_STATE.location,
      { ...HOUSING_STATE.filters, areaNote: HOUSING_STATE.areaNote, areaUnknown: HOUSING_STATE.areaUnknown }
    );
    renderHousingAlternativeAction(HOUSING_STATE.hasPendingRelated ? HOUSING_STATE.relatedItems : [], HOUSING_STATE.relatedFallback, {
      allowExpandSource: HOUSING_STATE.source !== 'all',
      nearbyListings: HOUSING_STATE.hasPendingNearby ? HOUSING_STATE.nearbyItems : [],
      nearbyAreas: HOUSING_STATE.nearbyAreas,
      allSourceListings: HOUSING_STATE.hasPendingAllSourcePrefetched ? HOUSING_STATE.allSourcePrefetched : []
    });

    // Sync quiz step label with current step number
    const stepTextEl = document.getElementById('quiz-step-text');
    if (stepTextEl) {
      const stepNum = parseInt(stepTextEl.dataset.currentStep || '1', 10);
      const template = T[currentLang]['quiz.step'] || 'Passo {n} de 3';
      stepTextEl.textContent = template.replace('{n}', stepNum);
    }
  }

  /* ═══════════════════════════════════════
     NAVBAR
     ═══════════════════════════════════════ */
  function initNavbar() {
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('navbar-hamburger');
    const links = document.getElementById('navbar-links');
    const navLinks = document.querySelectorAll('.nav-link');

    // Hamburger toggle
    hamburger.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      hamburger.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen);
    });

    // Close mobile menu on link click
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        links.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });

    // Scroll behavior
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      navbar.classList.toggle('scrolled', scrollY > 60);
      lastScroll = scrollY;
    }, { passive: true });

    // Active link on scroll (IntersectionObserver)
    const sections = document.querySelectorAll('section[id]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(l => l.classList.remove('active'));
          const active = document.querySelector(`.nav-link[href="#${id}"]`);
          if (active) active.classList.add('active');
          const sectionColor = entry.target.getAttribute('data-section-color') || id;
          updateNavbarTheme(sectionColor);
        }
      });
    }, { rootMargin: '-40% 0px -50% 0px' });

    sections.forEach(s => observer.observe(s));

    // Language toggle
    document.getElementById('lang-toggle').addEventListener('click', () => {
      setLanguage(currentLang === 'pt' ? 'en' : 'pt');
    });
  }

  function updateNavbarTheme(section) {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    const tokens = ['hero', 'dados', 'simuladores', 'aprender', 'recursos', 'faq', 'projeto'];
    tokens.forEach(token => navbar.classList.remove(`nav-theme-${token}`));
    const normalized = tokens.includes(section) ? section : 'hero';
    navbar.classList.add(`nav-theme-${normalized}`);
  }

  /* ═══════════════════════════════════════
     SCROLL REVEAL ANIMATIONS
     ═══════════════════════════════════════ */
  function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal, .animate-fade-up, .animate-scale-in, .assemble');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.getAttribute('data-delay') || '0', 10);
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealElements.forEach(el => observer.observe(el));
  }

  function initTiltEffects() {
    const cards = document.querySelectorAll('.resource-card');
    cards.forEach(card => {
      card.addEventListener('mousemove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) - 0.5;
        const y = ((event.clientY - rect.top) / rect.height) - 0.5;
        card.style.transform = `rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ═══════════════════════════════════════
     COUNTER ANIMATION
     ═══════════════════════════════════════ */
  function initCounters() {
    const counters = document.querySelectorAll('.counter');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-target'), 10);
          animateCounter(el, target);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(c => observer.observe(c));
  }

  function animateCounter(el, target) {
    const duration = 1800;
    const start = performance.now();
    const initial = 0;

    function step(timestamp) {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(initial + (target - initial) * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ═══════════════════════════════════════
     ONBOARDING
     ═══════════════════════════════════════ */
  function initOnboarding() {
    const overlay = document.getElementById('onboarding');
    const closeBtn = document.getElementById('onboarding-close');
    const startBtn = document.getElementById('onboarding-start');
    const shown = sessionStorage.getItem('myhome-onboarding');

    if (!shown) {
      setTimeout(() => overlay.classList.add('visible'), 800);
    }

    function close() {
      overlay.classList.remove('visible');
      sessionStorage.setItem('myhome-onboarding', 'true');
    }

    closeBtn.addEventListener('click', close);
    startBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  /* ═══════════════════════════════════════
     QUIZ / PERSONALISATION
     ═══════════════════════════════════════ */
  function initQuiz() {
    let step = 1;
    const answers = {};
    const steps = [
      document.getElementById('quiz-step-1'),
      document.getElementById('quiz-step-2'),
      document.getElementById('quiz-step-3'),
    ];
    const result = document.getElementById('quiz-result');
    const progressFill = document.getElementById('quiz-progress-fill');
    const stepText = document.getElementById('quiz-step-text');

    function updateStep() {
      steps.forEach((s, i) => s.classList.toggle('active', i === step - 1));
      progressFill.style.width = `${(step / 3) * 100}%`;
      const template = T[currentLang]['quiz.step'] || 'Passo {n} de 3';
      stepText.dataset.currentStep = step;
      stepText.textContent = template.replace('{n}', step);
    }

    document.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.closest('.quiz-step');
        parent.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
        btn.classList.add('selected');
        const stepId = parseInt(parent.id.replace('quiz-step-', ''), 10);
        answers[stepId] = btn.getAttribute('data-value');

        setTimeout(() => {
          if (stepId < 3) {
            step = stepId + 1;
            updateStep();
          } else {
            showResult();
          }
        }, 350);
      });
    });

    function showResult() {
      steps.forEach(s => s.classList.remove('active'));
      result.style.display = 'block';
      progressFill.style.width = '100%';
      stepText.textContent = '';

      const income = answers[1];
      const timeline = answers[2];
      const obstacle = answers[3];

      let icon = '01';
      let desc = '';
      let insights = [];

      const lang = currentLang;

      if (lang === 'pt') {
        if (income === 'under1000' || income === '1000-1500') {
          desc = 'Com o teu rendimento atual, a taxa de esforço será um desafio. ';
          insights.push('Considera aumentar fontes de rendimento ou co titular o crédito.');
        } else {
          desc = 'O teu rendimento permite explorar opções de financiamento. ';
          insights.push('A tua base financeira é um bom ponto de partida.');
        }

        if (timeline === '1-2') {
          desc += 'Planeas comprar em breve — é essencial começar já o processo de pré-aprovação.';
          insights.push('Agenda reuniões com 3 a 5 bancos nos próximos 30 dias.');
        } else if (timeline === 'unsure') {
          desc += 'Não ter prazo definido é normal — esta plataforma ajuda-te a criar um plano claro.';
          insights.push('Explora o guia de jornada para criar uma linha temporal realista.');
          icon = '02';
        } else {
          desc += 'Tens tempo para planear e poupar — usa-o estrategicamente.';
          insights.push('Define uma meta mensal de poupança com o simulador de tempo.');
        }

        if (obstacle === 'savings') {
          insights.push('Conhece o programa de Garantia Pública para Jovens com financiamento até cem por cento.');
        } else if (obstacle === 'income') {
          insights.push('Com a regra dos 35 por cento, o teu foco deve ser maximizar rendimento ou reduzir despesas.');
        } else if (obstacle === 'knowledge') {
          insights.push('A secção Aprender explica os conceitos chave de forma simples.');
          icon = '03';
        } else {
          insights.push('Segue o guia de jornada passo a passo. O processo é mais simples do que parece.');
        }
        insights.push('Setenta por cento das pessoas como tu partilham as mesmas preocupações. Não estás sozinho.');
      } else {
        if (income === 'under1000' || income === '1000-1500') {
          desc = 'With your current income, the effort rate will be challenging. ';
          insights.push('Consider increasing income sources or adding a co borrower.');
        } else {
          desc = 'Your income allows you to explore financing options. ';
          insights.push('Your financial base is a good starting point.');
        }

        if (timeline === '1-2') {
          desc += "You're planning to buy soon — start the pre-approval process now.";
          insights.push('Schedule meetings with 3 to 5 banks in the next 30 days.');
        } else if (timeline === 'unsure') {
          desc += "Not having a defined timeline is normal — this platform helps you create a clear plan.";
          insights.push('Explore the journey guide to create a realistic timeline.');
          icon = '02';
        } else {
          desc += 'You have time to plan and save — use it strategically.';
          insights.push('Set a monthly savings goal with the time simulator.');
        }

        if (obstacle === 'savings') {
          insights.push('Learn about the Youth Public Guarantee program with up to full financing.');
        } else if (obstacle === 'income') {
          insights.push('With the 35 percent rule, your focus should be maximizing income or reducing expenses.');
        } else if (obstacle === 'knowledge') {
          insights.push('The Learn section explains all key concepts simply.');
          icon = '03';
        } else {
          insights.push('Follow the step by step journey guide. The process is simpler than it seems.');
        }
        insights.push('Seventy percent of people like you share the same concerns. You are not alone.');
      }

      document.getElementById('result-icon').textContent = icon;
      document.getElementById('result-desc').textContent = desc;
      const insightsContainer = document.getElementById('result-insights');
      insightsContainer.innerHTML = insights.map(i =>
        `<div class="result-insight-item">${i}</div>`
      ).join('');
    }

    document.getElementById('quiz-restart').addEventListener('click', () => {
      step = 1;
      result.style.display = 'none';
      document.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
      updateStep();
    });

    // Initialize step text on load
    updateStep();
  }

  /* ═══════════════════════════════════════
     CHARTS (Survey Data)
     ═══════════════════════════════════════ */
  function initCharts() {
    const chartSection = document.getElementById('dados');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !chartsInitialized) {
          createCharts();
          chartsInitialized = true;
          observer.unobserve(chartSection);
        }
      });
    }, { threshold: 0.1 });
    observer.observe(chartSection);
  }

  function getChartColors() {
    return {
      green: '#2D5F4A',
      greenLight: '#4A9B6F',
      blue: '#3D6B9B',
      blueLight: '#6B9FCC',
      beige: '#C4A882',
      red: '#C0392B',
      orange: '#E67E22',
      palette: ['#2D5F4A', '#3D6B9B', '#C4A882', '#6B9FCC', '#4A9B6F'],
    };
  }

  function createCharts() {
    const c = getChartColors();
    const defaults = Chart.defaults;
    defaults.font.family = "'Inter', sans-serif";
    defaults.font.size = 13;
    defaults.color = '#4A4A5E';
    defaults.plugins.legend.labels.usePointStyle = true;
    defaults.plugins.legend.labels.padding = 16;

    // Chart 1: When plan to buy (Pie/Doughnut)
    chartInstances.when = new Chart(document.getElementById('chart-when'), {
      type: 'doughnut',
      data: {
        labels: currentLang === 'pt'
          ? ['Já tem casa', '1–2 anos', '3–5 anos', '6–10 anos', 'Mais de 10 anos']
          : ['Already own', '1–2 years', '3–5 years', '6–10 years', '10+ years'],
        datasets: [{
          data: [6, 9, 25, 28, 45],
          backgroundColor: c.palette,
          borderWidth: 2,
          borderColor: '#fff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
              }
            }
          }
        },
        animation: { animateRotate: true, animateScale: true, duration: 1200 }
      }
    });

    // Chart 2: Main obstacles (Bar)
    chartInstances.obstacles = new Chart(document.getElementById('chart-obstacles'), {
      type: 'bar',
      data: {
        labels: currentLang === 'pt'
          ? ['Dificuldade financeira', 'Complexidade', 'Falta de informação', 'Outro']
          : ['Financial difficulty', 'Complexity', 'Lack of information', 'Other'],
        datasets: [{
          label: currentLang === 'pt' ? 'Respostas' : 'Responses',
          data: [73, 17, 14, 9],
          backgroundColor: [c.green, c.blue, c.beige, c.blueLight],
          borderRadius: 8,
          borderSkipped: false,
          barPercentage: 0.6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { callback: v => v } },
          y: { grid: { display: false } }
        },
        animation: { duration: 1200 }
      }
    });

    // Chart 3: Complexity perception (Doughnut)
    chartInstances.complexity = new Chart(document.getElementById('chart-complexity'), {
      type: 'doughnut',
      data: {
        labels: currentLang === 'pt'
          ? ['Muito complexo', 'Complexo', 'Pouco complexo', 'Nada complexo']
          : ['Very complex', 'Complex', 'Not very complex', 'Not complex'],
        datasets: [{
          data: [51, 43, 14, 5],
          backgroundColor: [c.red, c.orange, c.blueLight, c.beige],
          borderWidth: 2,
          borderColor: '#fff',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        plugins: { legend: { position: 'bottom' } },
        animation: { animateRotate: true, duration: 1200 }
      }
    });

    // Chart 4: Life impact (Bar)
    chartInstances.impact = new Chart(document.getElementById('chart-impact'), {
      type: 'bar',
      data: {
        labels: currentLang === 'pt'
          ? ['Sim, muito', 'Parcialmente', 'Pouco']
          : ['Yes, significantly', 'Partially', 'Not much'],
        datasets: [{
          label: currentLang === 'pt' ? 'Respostas' : 'Responses',
          data: [62, 34, 17],
          backgroundColor: [c.green, c.blue, c.beige],
          borderRadius: 8,
          borderSkipped: false,
          barPercentage: 0.5,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            beginAtZero: true
          },
          x: { grid: { display: false } }
        },
        animation: { duration: 1200 }
      }
    });
  }

  function updateChartLabels() {
    if (!chartInstances.when) return;
    const lang = currentLang;

    chartInstances.when.data.labels = lang === 'pt'
      ? ['Já tem casa', '1–2 anos', '3–5 anos', '6–10 anos', 'Mais de 10 anos']
      : ['Already own', '1–2 years', '3–5 years', '6–10 years', '10+ years'];
    chartInstances.when.update();

    chartInstances.obstacles.data.labels = lang === 'pt'
      ? ['Dificuldade financeira', 'Complexidade', 'Falta de informação', 'Outro']
      : ['Financial difficulty', 'Complexity', 'Lack of information', 'Other'];
    chartInstances.obstacles.data.datasets[0].label = lang === 'pt' ? 'Respostas' : 'Responses';
    chartInstances.obstacles.update();

    chartInstances.complexity.data.labels = lang === 'pt'
      ? ['Muito complexo', 'Complexo', 'Pouco complexo', 'Nada complexo']
      : ['Very complex', 'Complex', 'Not very complex', 'Not complex'];
    chartInstances.complexity.update();

    chartInstances.impact.data.labels = lang === 'pt'
      ? ['Sim, muito', 'Parcialmente', 'Pouco']
      : ['Yes, significantly', 'Partially', 'Not much'];
    chartInstances.impact.data.datasets[0].label = lang === 'pt' ? 'Respostas' : 'Responses';
    chartInstances.impact.update();
  }

  /* ═══════════════════════════════════════
     MARKET INTELLIGENCE
     ═══════════════════════════════════════ */
  function initMarketIntel() {
    const section = document.getElementById('mercado');
    if (!section) return;

    renderBankOffers();
    refreshMarketData();
    updateAIBrief();

    const refreshBtn = document.getElementById('ai-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshMarketData();
        updateAIBrief();
      });
    }

    ['aff-salary', 'aff-savings', 'aff-expenses', 'mort-price', 'mort-rate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateAIBrief);
    });
    document.querySelectorAll('.quiz-option').forEach(btn => btn.addEventListener('click', updateAIBrief));
  }

  async function refreshMarketData() {
    const fallback = { referenceRate: 1.8, inflation: 2.4, lending: 4.2, updatedAt: new Date().getFullYear().toString() };
    try {
      const [referenceRes, inflationRes, lendingRes] = await Promise.all([
        fetch('https://api.worldbank.org/v2/country/PRT/indicator/FR.INR.RINR?format=json&per_page=12'),
        fetch('https://api.worldbank.org/v2/country/PRT/indicator/FP.CPI.TOTL.ZG?format=json&per_page=12'),
        fetch('https://api.worldbank.org/v2/country/PRT/indicator/FR.INR.LEND?format=json&per_page=12')
      ]);
      const [referenceJson, inflationJson, lendingJson] = await Promise.all([
        referenceRes.json(),
        inflationRes.json(),
        lendingRes.json()
      ]);

      const refData = extractWorldBankValue(referenceJson);
      const infData = extractWorldBankValue(inflationJson);
      const lendData = extractWorldBankValue(lendingJson);

      MARKET_STATE.referenceRate = refData.value ?? fallback.referenceRate;
      MARKET_STATE.inflation = infData.value ?? fallback.inflation;
      MARKET_STATE.lending = lendData.value ?? fallback.lending;
      MARKET_STATE.updatedAt = refData.year || infData.year || lendData.year || fallback.updatedAt;
    } catch (error) {
      MARKET_STATE.referenceRate = fallback.referenceRate;
      MARKET_STATE.inflation = fallback.inflation;
      MARKET_STATE.lending = fallback.lending;
      MARKET_STATE.updatedAt = fallback.updatedAt;
    }

    renderMarketIndicators();
    updateAIBrief();
  }

  function extractWorldBankValue(payload) {
    const data = Array.isArray(payload?.[1]) ? payload[1] : [];
    const valid = data.find(row => typeof row?.value === 'number');
    if (!valid) return { value: null, year: null };
    return { value: Number(valid.value), year: valid.date || null };
  }

  function renderMarketIndicators() {
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    setText('mkt-euribor', `${MARKET_STATE.referenceRate.toFixed(2)}%`);
    setText('mkt-inflation', `${MARKET_STATE.inflation.toFixed(2)}%`);
    setText('mkt-lending', `${MARKET_STATE.lending.toFixed(2)}%`);
    setText('mkt-updated', MARKET_STATE.updatedAt || (currentLang === 'pt' ? 'Sem data' : 'No date'));
  }

  function renderBankOffers() {
    const tbody = document.getElementById('bank-offers-body');
    if (!tbody) return;
    tbody.innerHTML = BANK_OFFERS_PT.map(row => `
      <tr>
        <td>${row.bank}</td>
        <td>${row.type}</td>
        <td>${row.rate}</td>
        <td>${row.note[currentLang]}</td>
      </tr>
    `).join('');
  }

  function updateAIBrief() {
    const target = document.getElementById('ai-brief');
    if (!target) return;

    const salary = parseFloat(document.getElementById('aff-salary')?.value || '0');
    const savings = parseFloat(document.getElementById('aff-savings')?.value || '0');
    const expenses = parseFloat(document.getElementById('aff-expenses')?.value || '0');
    const affordabilityBuffer = Math.max(0, salary - expenses);
    const ratePressure = (MARKET_STATE.lending ?? 4.2) + (MARKET_STATE.inflation ?? 2.4);
    const savingsLevel = savings >= 30000 ? 'high' : savings >= 12000 ? 'medium' : 'low';

    if (currentLang === 'pt') {
      let tone = 'moderado';
      if (ratePressure >= 7) tone = 'exigente';
      if (ratePressure <= 5) tone = 'favorável';

      const savingsTip = savingsLevel === 'high'
        ? 'Tens base de entrada sólida para negociar com vários bancos.'
        : savingsLevel === 'medium'
          ? 'A tua poupança já permite avançar para pré aprovação com foco em imóveis compatíveis.'
          : 'A prioridade deve ser reforçar poupança e reduzir encargos fixos.';

      target.textContent = `Com os dados atuais, o contexto de mercado está ${tone}. Taxa real ${MARKET_STATE.referenceRate?.toFixed(2) || '1.80'} por cento, inflação ${MARKET_STATE.inflation?.toFixed(2) || '2.40'} por cento e taxa média de empréstimo ${MARKET_STATE.lending?.toFixed(2) || '4.20'} por cento. O teu excedente mensal estimado é ${fmt(affordabilityBuffer)} euros. ${savingsTip}`;
    } else {
      const pressure = ratePressure >= 7 ? 'demanding' : ratePressure <= 5 ? 'favorable' : 'balanced';
      const savingsTip = savingsLevel === 'high'
        ? 'Your savings base is strong enough to negotiate across several banks.'
        : savingsLevel === 'medium'
          ? 'Your savings level supports pre approval for homes within a disciplined budget.'
          : 'Your next step should focus on saving growth and fixed cost reduction.';

      target.textContent = `Current market context is ${pressure}. Real rate ${MARKET_STATE.referenceRate?.toFixed(2) || '1.80'} percent, inflation ${MARKET_STATE.inflation?.toFixed(2) || '2.40'} percent and average lending rate ${MARKET_STATE.lending?.toFixed(2) || '4.20'} percent. Your estimated monthly buffer is ${fmt(affordabilityBuffer)} euros. ${savingsTip}`;
    }
  }

  /* ═══════════════════════════════════════
     HOUSING LISTINGS (SCRAPED PORTALS)
     ═══════════════════════════════════════ */
  function slugifyLocation(value) {
    return (value || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function haversineKm(a, b) {
    if (!a || !b) return Number.POSITIVE_INFINITY;
    const earthKm = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * earthKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function findAreaCoordinate(area, location) {
    const candidates = [area, location, 'Lisboa']
      .map(value => slugifyLocation(value || ''))
      .filter(Boolean);

    for (const candidate of candidates) {
      if (HOUSING_AREA_COORDS[candidate]) return HOUSING_AREA_COORDS[candidate];
      const match = Object.keys(HOUSING_AREA_COORDS).find(key => key.includes(candidate) || candidate.includes(key));
      if (match) return HOUSING_AREA_COORDS[match];
    }
    return null;
  }

  function getNearbyAreasInRadius(area, location, minKm = 1, maxKm = 10) {
    const anchor = findAreaCoordinate(area, location);
    if (!anchor) return [];

    const areas = Object.values(HOUSING_AREA_COORDS)
      .map(item => ({
        name: item.name,
        distanceKm: haversineKm(anchor, item)
      }))
      .filter(item => Number.isFinite(item.distanceKm))
      .filter(item => item.distanceKm >= minKm && item.distanceKm <= maxKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    // Keep unique names and a short, practical set for parallel prefetching.
    const seen = new Set();
    return areas.filter(item => {
      const key = slugifyLocation(item.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 5);
  }

  function detectListingAreaCoordinate(searchableText) {
    const text = (searchableText || '').toString();
    if (!text) return null;
    const entries = Object.entries(HOUSING_AREA_COORDS)
      .sort((a, b) => b[0].length - a[0].length);
    for (const [key, item] of entries) {
      if (text.includes(key)) return item;
      const byName = slugifyLocation(item?.name || '');
      if (byName && text.includes(byName)) return item;
    }
    return null;
  }

  function isBroadCityLocation(locationSlug) {
    return ['lisboa', 'porto', 'braga', 'coimbra', 'setubal', 'faro'].includes(locationSlug || '');
  }

  function matchesGeoRadius(features, anchorArea, maxKm) {
    if (!features || !anchorArea) return false;
    const listingArea = detectListingAreaCoordinate(features.searchable);
    if (!listingArea) return false;
    return haversineKm(anchorArea, listingArea) <= maxKm;
  }

  function levenshtein(a, b) {
    const s = (a || '').toString();
    const t = (b || '').toString();
    if (s === t) return 0;
    const m = s.length;
    const n = t.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i += 1) dp[i][0] = i;
    for (let j = 0; j <= n; j += 1) dp[0][j] = j;
    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  function normalizeAreaInput(value) {
    const raw = (value || '').trim();
    if (!raw) return { area: '', correctedFrom: '', unknown: false };
    const slug = slugifyLocation(raw);
    if (slug && HOUSING_AREA_COORDS[slug]) {
      return { area: HOUSING_AREA_COORDS[slug].name, correctedFrom: '', unknown: false };
    }

    let bestKey = '';
    let bestDistance = Number.POSITIVE_INFINITY;
    Object.keys(HOUSING_AREA_COORDS).forEach(key => {
      const distance = levenshtein(slug, key);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestKey = key;
      }
    });

    if (bestKey && bestDistance <= 2) {
      return { area: HOUSING_AREA_COORDS[bestKey].name, correctedFrom: raw, unknown: false };
    }

    return { area: raw, correctedFrom: '', unknown: true };
  }

  function persistHousingSessionState() {
    try {
      const payload = {
        source: HOUSING_STATE.source,
        location: HOUSING_STATE.location,
        fallback: !!HOUSING_STATE.fallback,
        status: HOUSING_STATE.status || 'idle',
        filters: HOUSING_STATE.filters || {},
        areaNote: HOUSING_STATE.areaNote || '',
        areaUnknown: !!HOUSING_STATE.areaUnknown,
        items: Array.isArray(HOUSING_STATE.items) ? HOUSING_STATE.items.slice(0, 24) : [],
        relatedItems: Array.isArray(HOUSING_STATE.relatedItems) ? HOUSING_STATE.relatedItems.slice(0, 24) : [],
        relatedFallback: !!HOUSING_STATE.relatedFallback,
        hasPendingRelated: !!HOUSING_STATE.hasPendingRelated,
        nearbyItems: Array.isArray(HOUSING_STATE.nearbyItems) ? HOUSING_STATE.nearbyItems.slice(0, 24) : [],
        nearbyAreas: Array.isArray(HOUSING_STATE.nearbyAreas) ? HOUSING_STATE.nearbyAreas.slice(0, 12) : [],
        hasPendingNearby: !!HOUSING_STATE.hasPendingNearby,
        allSourcePrefetched: Array.isArray(HOUSING_STATE.allSourcePrefetched) ? HOUSING_STATE.allSourcePrefetched.slice(0, 24) : [],
        hasPendingAllSourcePrefetched: !!HOUSING_STATE.hasPendingAllSourcePrefetched,
        hasBootstrapLoaded: !!HOUSING_STATE.hasBootstrapLoaded,
        ts: Date.now()
      };
      sessionStorage.setItem(HOUSING_SESSION_KEY, JSON.stringify(payload));
    } catch (error) {
      // Ignore persistence failures.
    }
  }

  function restoreHousingSessionState() {
    try {
      const raw = sessionStorage.getItem(HOUSING_SESSION_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;

      HOUSING_STATE.source = parsed.source || HOUSING_STATE.source;
      HOUSING_STATE.location = parsed.location || HOUSING_STATE.location;
      HOUSING_STATE.fallback = !!parsed.fallback;
      HOUSING_STATE.status = parsed.status || 'idle';
      HOUSING_STATE.filters = { ...HOUSING_STATE.filters, ...(parsed.filters || {}) };
      HOUSING_STATE.areaNote = parsed.areaNote || '';
      HOUSING_STATE.areaUnknown = !!parsed.areaUnknown;
      HOUSING_STATE.items = Array.isArray(parsed.items) ? parsed.items : [];
      HOUSING_STATE.relatedItems = Array.isArray(parsed.relatedItems) ? parsed.relatedItems : [];
      HOUSING_STATE.relatedFallback = !!parsed.relatedFallback;
      HOUSING_STATE.hasPendingRelated = !!parsed.hasPendingRelated;
      HOUSING_STATE.nearbyItems = Array.isArray(parsed.nearbyItems) ? parsed.nearbyItems : [];
      HOUSING_STATE.nearbyAreas = Array.isArray(parsed.nearbyAreas) ? parsed.nearbyAreas : [];
      HOUSING_STATE.hasPendingNearby = !!parsed.hasPendingNearby;
      HOUSING_STATE.allSourcePrefetched = Array.isArray(parsed.allSourcePrefetched) ? parsed.allSourcePrefetched : [];
      HOUSING_STATE.hasPendingAllSourcePrefetched = !!parsed.hasPendingAllSourcePrefetched;
      HOUSING_STATE.hasBootstrapLoaded = !!parsed.hasBootstrapLoaded;
      return true;
    } catch (error) {
      return false;
    }
  }

  async function resolveWithin(promise, timeoutMs, fallbackValue) {
    const fallback = typeof fallbackValue === 'undefined' ? null : fallbackValue;
    if (!promise || typeof promise.then !== 'function') return fallback;
    let timer = null;
    try {
      return await Promise.race([
        promise,
        new Promise(resolve => {
          timer = setTimeout(() => resolve(fallback), Math.max(0, timeoutMs || 0));
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function prefetchHousingAlternatives(source, location, filters) {
    if (!source || source === 'all') {
      return { nearbyListings: [], nearbyAreas: [], allSourceListings: [] };
    }

    const nearbyAreas = getNearbyAreasInRadius(filters.area, location, 1, 10);
    const nearbyQueries = nearbyAreas.length
      ? nearbyAreas.map(item => item.name)
      : getNearbyAreasInRadius(location, location, 1, 12).map(item => item.name).slice(0, 3);

    const nearbyTasks = nearbyQueries.slice(0, 3).map(areaName =>
      fetchHousingListingsSingle(source, areaName, 'nearby', filters.searchMode)
        .then(items => ({ areaName, items: Array.isArray(items) ? items : [] }))
        .catch(() => ({ areaName, items: [] }))
    );

    const allSourcesTask = fetchHousingListings(
      'all',
      location,
      filters.areaScope === 'all-lisbon-towns' ? 'all-lisbon-towns' : 'nearby',
      filters.searchMode
    ).catch(() => []);

    const [nearbySettled, allSourceListings] = await Promise.all([
      Promise.all(nearbyTasks),
      allSourcesTask
    ]);

    const nearbyMerged = dedupeListings(nearbySettled.flatMap(entry => entry.items || []));
    const nearbyMatched = buildHousingMatchSets(nearbyMerged, {
      ...filters,
      area: '',
      areaScope: 'nearby'
    }, location);

    const allSourceMatched = buildHousingMatchSets(Array.isArray(allSourceListings) ? allSourceListings : [], filters, location);
    const allSourceBest = allSourceMatched.exact.length
      ? allSourceMatched.exact.slice(0, 8)
      : allSourceMatched.related.slice(0, 8);

    return {
      nearbyListings: nearbyMatched.exact.length ? nearbyMatched.exact.slice(0, 8) : nearbyMatched.related.slice(0, 8),
      nearbyAreas: nearbyAreas.map(item => `${item.name} (${item.distanceKm.toFixed(1)} km)`),
      allSourceListings: allSourceBest
    };
  }

  function buildImovirtualUrl(location, areaScope) {
    if (areaScope === 'all-lisbon-towns') {
      return 'https://www.imovirtual.com/pt/resultados/comprar/apartamento/lisboa';
    }
    const cityMap = {
      lisboa: 'lisboa/lisboa',
      porto: 'porto/porto',
      braga: 'braga/braga',
      setubal: 'setubal/setubal',
      aveiro: 'aveiro/aveiro',
      faro: 'faro/faro',
      leiria: 'leiria/leiria',
      coimbra: 'coimbra/coimbra'
    };
    const key = slugifyLocation(location) || 'lisboa';
    const locationPath = cityMap[key];
    if (!locationPath) {
      return `https://www.imovirtual.com/pt/resultados/comprar/apartamento/todo-o-pais?description=${encodeURIComponent(location || 'Lisboa')}`;
    }
    return `https://www.imovirtual.com/pt/resultados/comprar/apartamento/${locationPath}`;
  }

  function buildImovirtualAlternativeUrls(location, areaScope) {
    const q = (location || 'Lisboa').trim() || 'Lisboa';
    const slug = slugifyLocation(q) || 'lisboa';
    const urls = [
      `https://www.imovirtual.com/pt/resultados/comprar/apartamento/todo-o-pais?description=${encodeURIComponent(q)}`,
      `https://www.imovirtual.com/pt/comprar/?search[description]=${encodeURIComponent(q)}&search[dist]=0`,
      `https://www.imovirtual.com/pt/resultados/comprar/apartamento/${slug}`
    ];
    if (areaScope === 'all-lisbon-towns') {
      urls.push('https://www.imovirtual.com/pt/resultados/comprar/apartamento/lisboa');
    }
    return dedupeStrings(urls);
  }

  function buildPropertiumUrl(location, areaScope) {
    const query = (location || 'Lisboa').trim() || 'Lisboa';
    // Propertium uses a search parameter format
    return `https://my.propertium.io/?search[description]=${encodeURIComponent(query)}&search[operation]=sale&search[country]=pt`;
  }

  function buildPropertiumAlternativeUrls(location, areaScope) {
    const q = (location || 'Lisboa').trim() || 'Lisboa';
    const slug = slugifyLocation(q) || 'lisboa';
    const urls = [
      `https://my.propertium.io/?search[description]=${encodeURIComponent(q)}&search[operation]=sale`,
      `https://my.propertium.io/?search[city]=${encodeURIComponent(q)}&search[operation]=sale`,
      `https://my.propertium.io/pt/properties?location=${slug}`,
      `https://my.propertium.io/pt/search?q=${encodeURIComponent(q)}`
    ];
    if (areaScope === 'all-lisbon-towns') {
      urls.push(`https://my.propertium.io/?search[description]=Lisboa&search[operation]=sale&search[country]=pt`);
    }
    return dedupeStrings(urls);
  }

  function buildProxyUrls(url, sourceId) {
    const encoded = encodeURIComponent(url);
    if (sourceId === 'idealista') {
      return [
        `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`,
        `https://api.allorigins.win/raw?url=${encoded}`,
        `https://api.codetabs.com/v1/proxy/?quest=${encoded}`
      ];
    }
    return [
      `https://api.allorigins.win/raw?url=${encoded}`,
      `https://api.codetabs.com/v1/proxy/?quest=${encoded}`,
      `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`
    ];
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const timeout = typeof timeoutMs === 'number' ? timeoutMs : 9000;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...(options || {}), signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

  function isBlockedScrapeResponse(html) {
    const text = (html || '').toLowerCase();
    return text.includes('please enable js and disable any ad blocker')
      || text.includes('captcha')
      || text.includes('access denied');
  }

  function initHousingListings() {
    const form = document.getElementById('housing-form');
    const grid = document.getElementById('housing-grid');
    const statusEl = document.getElementById('housing-status');
    const sourceSelect = document.getElementById('housing-source');
    const locationInput = document.getElementById('housing-location');
    const budgetInput = document.getElementById('housing-budget');
    const roomsSelect = document.getElementById('housing-rooms');
    const scopeSelect = document.getElementById('housing-area-scope');
    const areaInput = document.getElementById('housing-area');
    const sortSelect = document.getElementById('housing-sort');
    const modeSelect = document.getElementById('housing-mode');
    if (!form || !grid || !statusEl || !sourceSelect || !locationInput) return;

    const hasRestoredState = restoreHousingSessionState();

    sourceSelect.value = HOUSING_STATE.source;
    if (!locationInput.value) locationInput.value = HOUSING_STATE.location;
    if (budgetInput) budgetInput.value = HOUSING_STATE.filters.maxBudget ? String(HOUSING_STATE.filters.maxBudget) : '';
    if (roomsSelect) roomsSelect.value = String(HOUSING_STATE.filters.minRooms || 0);
    if (scopeSelect) scopeSelect.value = HOUSING_STATE.filters.areaScope;
    if (areaInput) areaInput.value = HOUSING_STATE.filters.area || '';
    if (sortSelect) sortSelect.value = HOUSING_STATE.filters.sort;
    if (modeSelect) modeSelect.value = HOUSING_STATE.filters.searchMode || 'fast';

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      loadHousingListings();
    });

    if (hasRestoredState) {
      renderHousingListings(HOUSING_STATE.items, HOUSING_STATE.fallback);
      renderHousingStatusWithSummary(
        HOUSING_STATE.status,
        null,
        HOUSING_STATE.source,
        HOUSING_STATE.location,
        { ...HOUSING_STATE.filters, areaNote: HOUSING_STATE.areaNote, areaUnknown: HOUSING_STATE.areaUnknown }
      );
      renderHousingAlternativeAction(HOUSING_STATE.hasPendingRelated ? HOUSING_STATE.relatedItems : [], HOUSING_STATE.relatedFallback, {
        allowExpandSource: HOUSING_STATE.source !== 'all',
        nearbyListings: HOUSING_STATE.hasPendingNearby ? HOUSING_STATE.nearbyItems : [],
        nearbyAreas: HOUSING_STATE.nearbyAreas,
        allSourceListings: HOUSING_STATE.hasPendingAllSourcePrefetched ? HOUSING_STATE.allSourcePrefetched : []
      });
      return;
    }

    loadHousingListings({ bootstrap: true });
  }

  async function loadHousingListings(options = {}) {
    const sourceSelect = document.getElementById('housing-source');
    const locationInput = document.getElementById('housing-location');
    const isBootstrap = !!options.bootstrap && !HOUSING_STATE.hasBootstrapLoaded;
    const source = isBootstrap ? 'all' : (sourceSelect?.value || HOUSING_STATE.source);
    const location = (locationInput?.value || HOUSING_STATE.location || 'Lisboa').trim() || 'Lisboa';
    const filters = readHousingFilters(location);

    HOUSING_STATE.source = source;
    HOUSING_STATE.location = location;
    HOUSING_STATE.filters = filters;
    HOUSING_STATE.areaNote = filters.areaNote || '';
    HOUSING_STATE.areaUnknown = !!filters.areaUnknown;
    HOUSING_STATE.nearbyItems = [];
    HOUSING_STATE.nearbyAreas = [];
    HOUSING_STATE.hasPendingNearby = false;
    HOUSING_STATE.allSourcePrefetched = [];
    HOUSING_STATE.hasPendingAllSourcePrefetched = false;

    if (isBootstrap) {
      renderHousingStatusWithSummary('loading', null, source, location, filters);
      renderHousingAlternativeAction([], false);
      try {
        const firstLoad = await fetchRandomMixedFirstLoadListings(location, filters.searchMode || 'fast');
        if (firstLoad.length) {
          HOUSING_STATE.items = firstLoad;
          HOUSING_STATE.fallback = false;
          HOUSING_STATE.relatedItems = [];
          HOUSING_STATE.hasPendingRelated = false;
          HOUSING_STATE.hasBootstrapLoaded = true;
          renderHousingListings(firstLoad, false);
          renderHousingStatusWithSummary('success', T[currentLang]?.['housing.bootstrapLive'] || 'A mostrar anuncios aleatorios ao vivo de Imovirtual e Idealista.', source, location, filters);
          return;
        }
      } catch (error) {
        // Keep going with the standard loader path.
      }
      HOUSING_STATE.hasBootstrapLoaded = true;
    }

    const cacheKey = makeHousingCacheKey(source, location, filters);
    const cachedListings = getHousingCache(cacheKey, filters.searchMode);
    if (cachedListings && cachedListings.length) {
      const matchedCached = buildHousingMatchSets(cachedListings, filters, location);
      if (matchedCached.exact.length) {
        HOUSING_STATE.items = matchedCached.exact;
        HOUSING_STATE.fallback = false;
        HOUSING_STATE.relatedItems = [];
        HOUSING_STATE.hasPendingRelated = false;
        renderHousingListings(matchedCached.exact, false);
        renderHousingStatusWithSummary('success', T[currentLang]?.['housing.cacheHit'] || 'Resultados em cache.', source, location, filters);
        renderHousingAlternativeAction([], false);
        return;
      }
    }

    const alternativesPrefetchPromise = source !== 'all'
      ? prefetchHousingAlternatives(source, location, filters)
      : Promise.resolve({ nearbyListings: [], nearbyAreas: [], allSourceListings: [] });

    renderHousingStatusWithSummary('loading', null, source, location, filters);
    renderHousingAlternativeAction([], false);
    try {
      const listings = await fetchHousingListings(source, location, filters.areaScope, filters.searchMode);
      const prefetchedAlternatives = await resolveWithin(alternativesPrefetchPromise, 2200, { nearbyListings: [], nearbyAreas: [], allSourceListings: [] });
      HOUSING_STATE.nearbyItems = Array.isArray(prefetchedAlternatives?.nearbyListings) ? prefetchedAlternatives.nearbyListings.slice(0, 8) : [];
      HOUSING_STATE.nearbyAreas = Array.isArray(prefetchedAlternatives?.nearbyAreas) ? prefetchedAlternatives.nearbyAreas.slice(0, 5) : [];
      HOUSING_STATE.hasPendingNearby = HOUSING_STATE.nearbyItems.length > 0;
      HOUSING_STATE.allSourcePrefetched = Array.isArray(prefetchedAlternatives?.allSourceListings) ? prefetchedAlternatives.allSourceListings.slice(0, 8) : [];
      HOUSING_STATE.hasPendingAllSourcePrefetched = HOUSING_STATE.allSourcePrefetched.length > 0;

      const diversifiedListings = ensureSourceDiversity(listings, source, location);
      setHousingCache(cacheKey, diversifiedListings);
      const matched = buildHousingMatchSets(diversifiedListings, filters, location);
      if (!matched.exact.length) {
        HOUSING_STATE.items = [];
        HOUSING_STATE.relatedItems = matched.related.slice(0, 8);
        HOUSING_STATE.hasPendingRelated = HOUSING_STATE.relatedItems.length > 0;
        HOUSING_STATE.relatedFallback = false;
        HOUSING_STATE.fallback = false;
        renderHousingListings([], false);

        if (source !== 'all') {
          if (HOUSING_STATE.hasPendingRelated) {
            renderHousingStatusWithSummary('noExact', T[currentLang]?.['housing.noExact'] || '', source, location, filters);
            renderHousingAlternativeAction(HOUSING_STATE.relatedItems, false, {
              allowExpandSource: true,
              nearbyListings: HOUSING_STATE.nearbyItems,
              nearbyAreas: HOUSING_STATE.nearbyAreas,
              allSourceListings: HOUSING_STATE.allSourcePrefetched
            });
          } else {
            renderHousingStatusWithSummary('sourceEmpty', T[currentLang]?.['housing.sourceEmpty'] || '', source, location, filters);
            renderHousingAlternativeAction([], false, {
              allowExpandSource: true,
              nearbyListings: HOUSING_STATE.nearbyItems,
              nearbyAreas: HOUSING_STATE.nearbyAreas,
              allSourceListings: HOUSING_STATE.allSourcePrefetched
            });
          }
        } else if (HOUSING_STATE.hasPendingRelated) {
          renderHousingListings(HOUSING_STATE.relatedItems, false);
          HOUSING_STATE.relatedItems = [];
          HOUSING_STATE.hasPendingRelated = false;
          renderHousingStatusWithSummary('suggested', T[currentLang]?.['housing.showingRelatable'] || '', source, location, filters);
          renderHousingAlternativeAction([], false);
        } else {
          renderHousingStatusWithSummary('empty', T[currentLang]?.['housing.empty'] || '', source, location, filters);
          renderHousingAlternativeAction([], false);
        }
        return;
      }
      HOUSING_STATE.items = matched.exact;
      HOUSING_STATE.fallback = false;
      HOUSING_STATE.relatedItems = [];
      HOUSING_STATE.hasPendingRelated = false;
      HOUSING_STATE.hasPendingNearby = false;
      HOUSING_STATE.hasPendingAllSourcePrefetched = false;
      renderHousingListings(matched.exact, false);
      renderHousingStatusWithSummary('success', T[currentLang]?.['housing.lastUpdated'] || '', source, location, filters);
    } catch (error) {
      if (source !== 'all') {
        const prefetchedAlternatives = await resolveWithin(alternativesPrefetchPromise, 2200, { nearbyListings: [], nearbyAreas: [], allSourceListings: [] });
        HOUSING_STATE.nearbyItems = Array.isArray(prefetchedAlternatives?.nearbyListings) ? prefetchedAlternatives.nearbyListings.slice(0, 8) : [];
        HOUSING_STATE.nearbyAreas = Array.isArray(prefetchedAlternatives?.nearbyAreas) ? prefetchedAlternatives.nearbyAreas.slice(0, 5) : [];
        HOUSING_STATE.hasPendingNearby = HOUSING_STATE.nearbyItems.length > 0;
        HOUSING_STATE.allSourcePrefetched = Array.isArray(prefetchedAlternatives?.allSourceListings) ? prefetchedAlternatives.allSourceListings.slice(0, 8) : [];
        HOUSING_STATE.hasPendingAllSourcePrefetched = HOUSING_STATE.allSourcePrefetched.length > 0;

        HOUSING_STATE.items = [];
        HOUSING_STATE.relatedItems = [];
        HOUSING_STATE.hasPendingRelated = false;
        HOUSING_STATE.relatedFallback = false;
        HOUSING_STATE.fallback = false;
        renderHousingListings([], false);
        renderHousingStatusWithSummary('sourceUnavailable', T[currentLang]?.['housing.sourceUnavailable'] || '', source, location, filters);
        renderHousingAlternativeAction([], false, {
          allowExpandSource: true,
          nearbyListings: HOUSING_STATE.nearbyItems,
          nearbyAreas: HOUSING_STATE.nearbyAreas,
          allSourceListings: HOUSING_STATE.allSourcePrefetched
        });
        return;
      }

      HOUSING_STATE.items = [];
      HOUSING_STATE.relatedItems = [];
      HOUSING_STATE.hasPendingRelated = false;
      HOUSING_STATE.relatedFallback = false;
      HOUSING_STATE.fallback = false;
      renderHousingListings([], false);
      renderHousingStatusWithSummary('error', T[currentLang]?.['housing.error'] || '', source, location, filters);
      renderHousingAlternativeAction([], false);
    }
  }

  function ensureSourceDiversity(listings, source, location) {
    if (source !== 'all') return Array.isArray(listings) ? listings : [];
    const current = Array.isArray(listings) ? dedupeListings(listings) : [];
    return current;
  }

  async function fetchRandomMixedFirstLoadListings(location, searchMode) {
    const settled = await Promise.allSettled([
      fetchHousingListingsSingle('imovirtual', location, 'nearby', searchMode || 'fast'),
      fetchHousingListingsSingle('idealista', location, 'nearby', searchMode || 'fast'),
      fetchHousingListingsSingle('propertium', location, 'nearby', searchMode || 'fast')
    ]);

    const bySource = {
      imovirtual: [],
      idealista: [],
      propertium: []
    };

    settled.forEach(entry => {
      if (entry.status !== 'fulfilled' || !Array.isArray(entry.value)) return;
      const clean = dedupeListings(entry.value).filter(item => isDirectListingLink(item?.url, detectListingConfig(item)));
      if (!clean.length) return;
      const config = detectListingConfig(clean[0]);
      if (config?.id === 'imovirtual') bySource.imovirtual = clean;
      if (config?.id === 'idealista') bySource.idealista = clean;
      if (config?.id === 'propertium') bySource.propertium = clean;
    });

    if (!bySource.imovirtual.length) {
      bySource.imovirtual = await fetchPortalHomepageListings('imovirtual', 16);
    }
    if (!bySource.idealista.length) {
      bySource.idealista = await fetchPortalHomepageListings('idealista', 16);
    }
    if (!bySource.propertium.length) {
      bySource.propertium = await fetchPortalHomepageListings('propertium', 16);
    }

    const mixed = [];
    if (bySource.imovirtual.length) mixed.push(...pickRandomListings(bySource.imovirtual, 3));
    if (bySource.idealista.length) mixed.push(...pickRandomListings(bySource.idealista, 3));
    if (bySource.propertium.length) mixed.push(...pickRandomListings(bySource.propertium, 2));

    const combined = dedupeListings([...bySource.imovirtual, ...bySource.idealista, ...bySource.propertium]);
    if (!combined.length) return [];
    mixed.push(...pickRandomListings(combined, 8));

    return dedupeListings(mixed).slice(0, 8);
  }

  async function fetchPortalHomepageListings(sourceId, limit) {
    const cfg = HOUSING_SOURCES[sourceId];
    if (!cfg) return [];
    const homepage = cfg.id === 'idealista' ? 'https://www.idealista.pt/' : 'https://www.imovirtual.com/';
    const proxyUrls = buildProxyUrls(homepage, cfg.id);

    for (const proxyUrl of proxyUrls) {
      try {
        const res = await fetchWithTimeout(proxyUrl, { headers: { 'Accept': 'text/html' } }, 10000);
        if (!res.ok) continue;
        const html = await res.text();
        if (isBlockedScrapeResponse(html)) continue;
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const parsed = parseHousingListings(doc, html, cfg);
        if (parsed.length) return dedupeListings(parsed).slice(0, Math.max(1, limit || 12));
      } catch (error) {
        // try next proxy candidate
      }
    }

    return [];
  }

  function pickRandomListings(listings, count) {
    if (!Array.isArray(listings) || !listings.length || !count) return [];
    const pool = listings.slice();
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, Math.max(0, count));
  }

  function makeHousingCacheKey(source, location, filters) {
    const keyObj = {
      source,
      location: (location || '').toLowerCase(),
      maxBudget: filters.maxBudget || 0,
      minRooms: filters.minRooms || 0,
      areaScope: filters.areaScope || 'nearby',
      area: (filters.area || '').toLowerCase(),
      sort: filters.sort || 'relevance',
      mode: filters.searchMode || 'fast'
    };
    return JSON.stringify(keyObj);
  }

  function getHousingCache(key, mode) {
    const entry = HOUSING_CACHE.get(key);
    if (!entry) return null;
    const ttl = mode === 'deep' ? HOUSING_CACHE_TTL.deep : HOUSING_CACHE_TTL.fast;
    if ((Date.now() - entry.ts) > ttl) {
      HOUSING_CACHE.delete(key);
      return null;
    }
    return Array.isArray(entry.listings) ? entry.listings.slice() : null;
  }

  function setHousingCache(key, listings) {
    HOUSING_CACHE.set(key, { ts: Date.now(), listings: Array.isArray(listings) ? listings.slice(0, 240) : [] });
    if (HOUSING_CACHE.size > 40) {
      const firstKey = HOUSING_CACHE.keys().next().value;
      if (firstKey) HOUSING_CACHE.delete(firstKey);
    }
  }

  async function fetchHousingListings(sourceId, location, areaScope, searchMode) {
    if (sourceId === 'all') {
      const settled = await Promise.allSettled([
        fetchHousingListingsSingle('imovirtual', location, areaScope, searchMode),
        fetchHousingListingsSingle('idealista', location, areaScope, searchMode),
        fetchHousingListingsSingle('propertium', location, areaScope, searchMode)
      ]);
      const merged = [];
      settled.forEach(entry => {
        if (entry.status === 'fulfilled' && Array.isArray(entry.value)) {
          merged.push(...entry.value);
        }
      });
      const deduped = dedupeListings(merged);
      if (deduped.length) return deduped.slice(0, 120);
      const firstRejected = settled.find(entry => entry.status === 'rejected');
      throw firstRejected && firstRejected.status === 'rejected' ? firstRejected.reason : new Error('empty');
    }
    return fetchHousingListingsSingle(sourceId, location, areaScope, searchMode);
  }

  async function fetchHousingListingsSingle(sourceId, location, areaScope, searchMode) {
    const cfg = HOUSING_SOURCES[sourceId] || HOUSING_SOURCES.imovirtual;
    const mode = searchMode === 'deep' ? 'deep' : 'fast';
    const targetUrl = cfg.buildTargetUrl(location || 'Lisboa', areaScope);
    const alternativeUrls = typeof cfg.buildAlternativeUrls === 'function' ? cfg.buildAlternativeUrls(location || 'Lisboa', areaScope) : [];
    const baseTargetUrls = dedupeStrings([targetUrl, ...alternativeUrls]);
    const targetUrls = cfg.id === 'imovirtual'
      ? expandImovirtualTargets(baseTargetUrls, mode)
      : expandIdealistaTargets(baseTargetUrls, location, areaScope, mode);
    let lastError = new Error('network');
    const idealistaCap = mode === 'deep' ? 80 : 24;

    if (cfg.id === 'idealista') {
      const apiListings = await tryFetchIdealistaApiListings(location || 'Lisboa', cfg);
      if (apiListings.length >= 12) return apiListings.slice(0, idealistaCap);

      const deepListings = await tryFetchIdealistaDeepListings(location || 'Lisboa', areaScope, cfg, baseTargetUrls, idealistaCap, mode);
      const combined = dedupeListings([...(apiListings || []), ...(deepListings || [])]);
      if (combined.length) return combined.slice(0, idealistaCap);
    }

    const collected = [];
    for (const nextTargetUrl of targetUrls) {
      const proxyUrls = buildProxyUrls(nextTargetUrl, cfg.id);
      for (const proxyUrl of proxyUrls) {
        try {
          const res = await fetchWithTimeout(proxyUrl, { headers: { 'Accept': 'text/html' } }, cfg.id === 'idealista' ? 8500 : 10000);
          if (!res.ok) {
            lastError = new Error('network');
            continue;
          }
          const html = await res.text();
          if (isBlockedScrapeResponse(html)) {
            lastError = new Error('blocked');
            continue;
          }
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const parsed = parseHousingListings(doc, html, cfg);
          if (parsed.length) {
            if (cfg.id === 'idealista') {
              collected.push(...parsed);
              const unique = dedupeListings(collected);
              if (unique.length >= idealistaCap) return unique.slice(0, idealistaCap);
              break;
            }
            collected.push(...parsed);
            const uniqueCount = dedupeListings(collected).length;
            if (uniqueCount >= 120) return dedupeListings(collected).slice(0, 120);
            break;
          }
          lastError = new Error('empty');
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('network');
        }
      }
    }

    if (collected.length) {
      const cap = cfg.id === 'idealista' ? idealistaCap : 120;
      return dedupeListings(collected).slice(0, cap);
    }

    throw lastError;
  }

  function expandImovirtualTargets(urls, mode) {
    const out = [];
    const maxPages = mode === 'deep' ? 5 : 2;
    const addWithPage = (url, page) => {
      if (page <= 1) return url;
      return `${url}${url.includes('?') ? '&' : '?'}page=${page}`;
    };
    (urls || []).forEach(url => {
      for (let page = 1; page <= maxPages; page += 1) {
        out.push(addWithPage(url, page));
      }
    });
    return dedupeStrings(out);
  }

  function expandIdealistaTargets(urls, location, areaScope, mode) {
    const out = [];
    const q = (location || 'Lisboa').trim() || 'Lisboa';
    const slug = slugifyLocation(q) || 'lisboa';
    const maxPage = mode === 'deep' ? 8 : 4;

    (urls || []).forEach(url => {
      out.push(url);
      const clean = url.split('?')[0].replace(/\/+$/, '');

      if (/idealista\.pt\/comprar-casas\//i.test(clean)) {
        for (let page = 2; page <= maxPage; page += 1) {
          out.push(`${clean}/pagina-${page}.htm`);
        }
      }

      const joiner = url.includes('?') ? '&' : '?';
      out.push(`${url}${joiner}ordem=atualizado-desc`);
      if (mode === 'deep') {
        out.push(`${url}${joiner}ordem=precos-asc`);
        out.push(`${url}${joiner}ordem=precos-desc`);
      }
    });

    out.push(`https://www.idealista.pt/comprar-casas/${slug}/`);
    out.push(`https://www.idealista.pt/comprar-casas/?q=${encodeURIComponent(q)}`);
    out.push(`https://www.idealista.pt/comprar-casas/?q=${encodeURIComponent(q)}&ordem=atualizado-desc`);

    if (areaScope === 'all-lisbon-towns') {
      out.push('https://www.idealista.pt/comprar-casas/lisboa/');
      out.push('https://www.idealista.pt/comprar-casas/?q=Lisboa');
    }

    return dedupeStrings(out);
  }

  async function fetchIdealistaTarget(targetUrl, cfg) {
    const proxyUrls = buildProxyUrls(targetUrl, 'idealista');
    const attempts = proxyUrls.map(async (proxyUrl) => {
      const res = await fetchWithTimeout(proxyUrl, { headers: { 'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8' } }, 8500);
      if (!res.ok) throw new Error('network');
      const html = await res.text();
      if (isBlockedScrapeResponse(html)) throw new Error('blocked');
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const parsed = parseHousingListings(doc, html, cfg);
      if (!parsed.length) throw new Error('empty');
      return parsed;
    });

    try {
      const parsed = await Promise.any(attempts);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  async function tryFetchIdealistaDeepListings(location, areaScope, cfg, baseTargetUrls, maxNeeded, mode) {
    const targetUrls = expandIdealistaTargets(baseTargetUrls, location, areaScope, mode);
    const collected = [];
    const batchSize = mode === 'deep' ? 3 : 2;

    for (let i = 0; i < targetUrls.length; i += batchSize) {
      const batch = targetUrls.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(url => fetchIdealistaTarget(url, cfg)));
      results.forEach(items => {
        if (Array.isArray(items) && items.length) collected.push(...items);
      });
      const unique = dedupeListings(collected);
      if (unique.length >= maxNeeded) return unique.slice(0, maxNeeded);
    }

    return dedupeListings(collected).slice(0, maxNeeded);
  }

  async function tryFetchIdealistaApiListings(location, cfg) {
    const fromRapidApi = await tryFetchIdealistaRapidApiListings(location, cfg);
    if (fromRapidApi.length) return fromRapidApi;

    const encoded = encodeURIComponent(location || 'Lisboa');
    const endpoints = [
      `https://www.idealista.pt/ajax/suggest?term=${encoded}`,
      `https://www.idealista.pt/ajax/suggest?country=pt&operation=sale&locale=pt&term=${encoded}`
    ];
    const all = [];

    for (const endpoint of endpoints) {
      const proxyUrls = buildProxyUrls(endpoint, 'idealista');
      for (const proxyUrl of proxyUrls) {
        try {
          const res = await fetchWithTimeout(proxyUrl, { headers: { 'Accept': 'application/json,text/plain,*/*' } }, 7000);
          if (!res.ok) continue;
          const raw = await res.text();
          if (isBlockedScrapeResponse(raw)) continue;
          const parsed = JSON.parse(raw);
          collectListingsFromUnknownJson(parsed, cfg, all);
          if (all.length >= 8) return dedupeListings(all).slice(0, 12);
        } catch (error) {
          // continue to next candidate endpoint/proxy
        }
      }
    }
    return dedupeListings(all).slice(0, 12);
  }

  async function tryFetchIdealistaRapidApiListings(location, cfg) {
    const apiCfg = getIdealistaRapidApiConfig();
    if (!apiCfg.key) return [];

    const query = encodeURIComponent(location || 'Lisboa');
    const endpoints = [
      `${apiCfg.baseUrl}/properties/list?location=${query}&operation=sale&country=pt&locale=pt`,
      `${apiCfg.baseUrl}/properties/search?location=${query}&operation=sale&country=pt&locale=pt`
    ];
    const all = [];

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          headers: {
            'X-RapidAPI-Key': apiCfg.key,
            'X-RapidAPI-Host': apiCfg.host,
            'Accept': 'application/json'
          }
        });
        if (!res.ok) continue;
        const raw = await res.text();
        if (isBlockedScrapeResponse(raw)) continue;
        const parsed = JSON.parse(raw);
        collectListingsFromUnknownJson(parsed, cfg, all);
        if (all.length >= 8) return dedupeListings(all).slice(0, 12);
      } catch (error) {
        // continue to next endpoint
      }
    }

    return dedupeListings(all).slice(0, 12);
  }

  function collectListingsFromUnknownJson(value, cfg, out, depth) {
    const level = depth || 0;
    if (level > 8 || value == null) return;
    if (Array.isArray(value)) {
      value.forEach(entry => collectListingsFromUnknownJson(entry, cfg, out, level + 1));
      return;
    }
    if (typeof value !== 'object') return;
    const maybeUrl = normalizeUrl(value.url || value.href || value.link, cfg.domain);
    const maybeTitle = value.title || value.name || value.description || '';
    const maybePrice = value.price || value.priceValue || value.price_text || '';
    const maybeLocation = value.location || value.address || value.municipality || value.city || '';
    if (maybeUrl && maybeTitle && isListingUrl(maybeUrl, cfg)) {
      out.push(normalizeListing({ title: maybeTitle, price: maybePrice, location: maybeLocation, url: maybeUrl, source: cfg.label }, cfg.domain));
    }
    Object.keys(value).forEach(key => {
      try {
        collectListingsFromUnknownJson(value[key], cfg, out, level + 1);
      } catch (error) {
        // skip invalid nested node
      }
    });
  }

  function parseHousingListings(doc, rawHtml, cfg) {
    const fromJson = extractListingsFromJsonLd(doc, cfg.label, cfg.domain).filter(item => isDirectListingLink(item.url, cfg));
    if (fromJson.length) return dedupeListings(fromJson);
    const fromDom = scrapeListingCards(doc, cfg, rawHtml);
    if (fromDom.length) return dedupeListings(fromDom).filter(item => isDirectListingLink(item.url, cfg));
    const fromMarkdown = extractListingsFromMarkdown(rawHtml, cfg).filter(item => isDirectListingLink(item.url, cfg));
    if (fromMarkdown.length) return dedupeListings(fromMarkdown);
    return [];
  }

  function extractListingsFromMarkdown(rawHtml, cfg) {
    if (typeof rawHtml !== 'string') return [];
    const out = [];
    const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    for (const match of rawHtml.matchAll(re)) {
      const title = (match[1] || '').trim();
      const url = (match[2] || '').trim();
      if (!title || !url || !isListingUrl(url, cfg)) continue;
      out.push(normalizeListing({ title, price: '', location: '', url, source: cfg.label }, cfg.domain));
      if (out.length >= 120) break;
    }
    return out;
  }

  function isListingUrl(url, cfg) {
    if (!url || !cfg) return false;
    if (cfg.id === 'imovirtual') return /imovirtual\.com\/pt\/anuncio\//i.test(url);
    if (cfg.id === 'idealista') return /idealista\.(pt|com)\/imovel\//i.test(url);
    if (cfg.id === 'propertium') return /propertium\.(io|com)\/.*property|propertium\.(io|com)\/.*listing/i.test(url);
    return url.includes(cfg.domain);
  }

  function extractListingsFromJsonLd(doc, sourceLabel, domain) {
    const results = [];
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const parsed = JSON.parse(script.textContent.trim());
        const payloads = Array.isArray(parsed) ? parsed : [parsed];
        payloads.forEach(entry => {
          if (Array.isArray(entry?.itemListElement)) {
            entry.itemListElement.forEach(itemEntry => {
              const item = itemEntry.item || itemEntry;
              const url = normalizeUrl(item?.url || itemEntry?.url, domain);
              const title = item?.name || item?.title;
              const priceVal = item?.offers?.price || item?.offers?.lowPrice || item?.price;
              const currency = item?.offers?.priceCurrency || '';
              const price = priceVal ? `${currency ? currency + ' ' : ''}${priceVal}` : '';
              const location = item?.address?.addressLocality || item?.address?.streetAddress || item?.address || '';
              if (title && url) {
                results.push(normalizeListing({ title, price, location, url, source: sourceLabel }, domain));
              }
            });
          }
        });
      } catch (err) {
        // ignore malformed JSON-LD
      }
    });
    return results;
  }

  function scrapeListingCards(doc, cfg, rawHtml) {
    const selectors = {
      title: ['[data-testid*="title"]', '[data-cy*="title"]', '.offer-title', '.item-title', 'h2', 'h3'],
      price: ['[data-testid*="price"]', '[data-cy*="price"]', '.price', '.item-price', '[class*="price"]'],
      location: ['[data-testid*="location"]', '[data-cy*="location"]', '.location', '.item-detail-location', '[class*="location"]']
    };
    const results = [];
    const cards = Array.from(doc.querySelectorAll('article, li')).slice(0, 40);

    cards.forEach(card => {
      const linkEl = card.querySelector(`a[href*="${cfg.domain}"]`) || card.querySelector('a[href]');
      const url = normalizeUrl(linkEl?.getAttribute('href'), cfg.domain);
      if (!isListingUrl(url, cfg)) return;
      const title = pickFirstText(card, selectors.title) || (linkEl ? linkEl.textContent.trim() : '');
      const price = pickFirstText(card, selectors.price);
      const location = pickFirstText(card, selectors.location);
      if (title && url && (price || location)) {
        results.push(normalizeListing({ title, price, location, url, source: cfg.label }, cfg.domain));
      }
    });

    if (results.length < 3) {
      const anchors = Array.from(doc.querySelectorAll(`a[href*="${cfg.domain}"]`)).slice(0, 20);
      anchors.forEach(anchor => {
        const url = normalizeUrl(anchor.getAttribute('href'), cfg.domain);
        if (!isListingUrl(url, cfg)) return;
        const title = anchor.textContent.trim();
        if (!title || !url) return;
        const container = anchor.closest('article') || anchor.parentElement;
        const price = pickFirstText(container, selectors.price) || pickFirstText(doc.body, selectors.price);
        const location = pickFirstText(container, selectors.location) || '';
        if (title && url) {
          results.push(normalizeListing({ title, price, location, url, source: cfg.label }, cfg.domain));
        }
      });
    }

    return results;
  }

  function pickFirstText(root, selectors) {
    if (!root || !selectors) return '';
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return '';
  }

  function normalizeUrl(href, domain) {
    if (!href) return '';
    const raw = unwrapProxyUrl(href);
    if (!raw) return '';
    if (raw.startsWith('http')) return raw.replace(/^http:\/\//i, 'https://');
    if (raw.startsWith('//')) return `https:${raw}`;
    if (raw.startsWith('/')) return `https://${domain}${raw}`;
    return `https://${domain}/${raw}`;
  }

  function unwrapProxyUrl(url) {
    let value = (url || '').toString().trim();
    if (!value) return '';
    for (let i = 0; i < 3; i += 1) {
      const low = value.toLowerCase();
      if (low.startsWith('https://r.jina.ai/http://')) {
        value = `https://${value.substring('https://r.jina.ai/http://'.length)}`;
        continue;
      }
      if (low.startsWith('https://r.jina.ai/https://')) {
        value = `https://${value.substring('https://r.jina.ai/https://'.length)}`;
        continue;
      }
      if (low.startsWith('https://api.allorigins.win/raw?url=')) {
        value = decodeURIComponent(value.split('?url=')[1] || '');
        continue;
      }
      if (low.startsWith('https://api.codetabs.com/v1/proxy/?quest=')) {
        value = decodeURIComponent(value.split('?quest=')[1] || '');
        continue;
      }
      break;
    }
    return value;
  }

  function detectListingConfig(item) {
    const source = (item?.source || '').toLowerCase();
    const url = (item?.url || '').toLowerCase();
    if (source.includes('idealista') || url.includes('idealista.')) return HOUSING_SOURCES.idealista;
    if (source.includes('propertium') || url.includes('propertium.')) return HOUSING_SOURCES.propertium;
    return HOUSING_SOURCES.imovirtual;
  }

  function isDirectListingLink(url, cfg) {
    if (!url || !cfg) return false;
    const clean = normalizeUrl(url, cfg.domain);
    if (!clean) return false;
    if (cfg.id === 'imovirtual') return /^https:\/\/(www\.)?imovirtual\.com\/pt\/anuncio\//i.test(clean);
    if (cfg.id === 'idealista') return /^https:\/\/(www\.)?idealista\.(pt|com)\/imovel\//i.test(clean);
    if (cfg.id === 'propertium') return /^https:\/\/(www\.)?propertium\.(io|com)\/.*property|^https:\/\/(www\.)?propertium\.(io|com)\/.*listing/i.test(clean) || url.includes('propertium');
    return false;
  }

  function normalizeListing(raw, fallbackDomain) {
    const sourceCfg = detectListingConfig(raw);
    const normalizedUrl = normalizeUrl(raw.url || '', sourceCfg?.domain || fallbackDomain);
    return {
      title: (raw.title || '').trim(),
      price: (raw.price || '').toString().trim(),
      location: (raw.location || '').trim(),
      url: normalizedUrl,
      source: raw.source || ''
    };
  }

  function dedupeListings(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = item.url || item.title;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function dedupeStrings(items) {
    const seen = new Set();
    return (items || []).filter(item => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  }

  function getPrivateRuntimeConfig() {
    let localCfg = {};
    try {
      const raw = window.localStorage.getItem('myHomePrivateConfig') || window.localStorage.getItem('casajaPrivateConfig');
      localCfg = raw ? JSON.parse(raw) : {};
    } catch (error) {
      localCfg = {};
    }
    const globalCfg = (typeof window !== 'undefined' && (window.__MYHOME_PRIVATE__ || window.__CASAJA_PRIVATE__))
      ? (window.__MYHOME_PRIVATE__ || window.__CASAJA_PRIVATE__)
      : {};
    return { ...localCfg, ...globalCfg };
  }

  function getIdealistaRapidApiConfig() {
    const cfg = getPrivateRuntimeConfig();
    const host = cfg.idealistaRapidApiHost || 'idealista-com1.p.rapidapi.com';
    return {
      key: cfg.idealistaRapidApiKey || '',
      host,
      baseUrl: cfg.idealistaRapidApiBaseUrl || `https://${host}`,
    };
  }

  function readHousingFilters(location) {
    const budgetInput = document.getElementById('housing-budget');
    const roomsSelect = document.getElementById('housing-rooms');
    const scopeSelect = document.getElementById('housing-area-scope');
    const areaInput = document.getElementById('housing-area');
    const sortSelect = document.getElementById('housing-sort');
    const modeSelect = document.getElementById('housing-mode');
    const budgetValue = parseInt((budgetInput?.value || '').replace(/[^\d]/g, ''), 10);
    const normalizedArea = normalizeAreaInput(areaInput?.value || '');
    if (normalizedArea.correctedFrom && areaInput) {
      areaInput.value = normalizedArea.area;
    }
    return {
      maxBudget: Number.isFinite(budgetValue) && budgetValue > 0 ? budgetValue : null,
      minRooms: parseInt(roomsSelect?.value || '0', 10) || 0,
      areaScope: scopeSelect?.value || 'nearby',
      area: normalizedArea.area,
      areaNote: normalizedArea.correctedFrom,
      areaUnknown: normalizedArea.unknown,
      sort: sortSelect?.value || 'relevance',
      searchMode: modeSelect?.value || 'fast',
      location: location || HOUSING_STATE.location
    };
  }

  function buildHousingMatchSets(listings, filters, location) {
    const safeFilters = filters || {};
    const direct = (listings || []).filter(item => isDirectListingLink(item?.url, detectListingConfig(item)));
    const scored = direct.map(item => {
      const features = extractListingFeatures(item);
      return {
        item,
        features,
        strict: matchesStrictCriteria(features, safeFilters, location),
        score: computeListingSimilarityScore(features, safeFilters, location)
      };
    });

    const exact = sortHousingListings(scored.filter(x => x.strict).map(x => x.item), safeFilters.sort);
    const exactKeys = new Set(exact.map(item => item.url || item.title));
    const related = scored
      .filter(x => !exactKeys.has(x.item.url || x.item.title))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.item);

    return { exact, related: dedupeListings(related).slice(0, 8) };
  }

  function extractListingFeatures(item) {
    const searchable = slugifyLocation(`${item?.title || ''} ${item?.location || ''} ${item?.url || ''}`);
    return {
      searchable,
      price: parsePriceValue(item?.price),
      rooms: extractRoomsValue(item),
      hasLocation: !!(item?.location || '').trim()
    };
  }

  function matchesStrictCriteria(features, filters, location) {
    if (!features) return false;
    const budget = filters.maxBudget;
    const minRooms = filters.minRooms;
    const hasValidArea = !filters.areaUnknown;
    const selectedArea = hasValidArea ? slugifyLocation(filters.area || '') : '';
    const locationSlug = slugifyLocation(location || '');
    const anchorArea = findAreaCoordinate(filters.area || location || '', location || '');

    if (budget && (features.price === null || features.price > budget)) return false;
    if (minRooms && (features.rooms === null || features.rooms < minRooms)) return false;

    if (selectedArea) {
      const directAreaHit = features.searchable.includes(selectedArea);
      const geoAreaHit = matchesGeoRadius(features, anchorArea, 3);
      if (!directAreaHit && !geoAreaHit) return false;
    }

    if (filters.areaScope === 'all-lisbon-towns' && !isLisbonAreaText(features.searchable)) return false;

    if (locationSlug) {
      const directLocationHit = features.searchable.includes(locationSlug);
      const broadCity = isBroadCityLocation(locationSlug);
      const geoLocationHit = matchesGeoRadius(features, anchorArea, filters.areaScope === 'nearby' ? 10 : 20);

      if (!broadCity && !directLocationHit && !geoLocationHit) return false;
      if (filters.areaScope === 'nearby' && !directLocationHit && !geoLocationHit) return false;
    }

    return true;
  }

  function computeListingSimilarityScore(features, filters, location) {
    if (!features) return 0;
    let score = 0;
    const budget = filters.maxBudget;
    const minRooms = filters.minRooms;
    const selectedArea = slugifyLocation(filters.area || '');
    const locationSlug = slugifyLocation(location || '');

    if (budget) {
      if (features.price !== null) {
        const diff = Math.abs(features.price - budget) / Math.max(budget, 1);
        score += Math.max(0, 3 - (diff * 3));
      }
    } else if (features.price !== null) {
      score += 0.5;
    }

    if (minRooms) {
      if (features.rooms !== null) {
        const roomDiff = Math.abs(features.rooms - minRooms);
        score += Math.max(0, 3 - roomDiff);
      }
    } else if (features.rooms !== null) {
      score += 0.5;
    }

    if (selectedArea) {
      if (features.searchable.includes(selectedArea)) score += 4;
    } else if (filters.areaScope === 'nearby' && locationSlug && features.searchable.includes(locationSlug)) {
      score += 3;
    } else if (filters.areaScope === 'all-lisbon-towns' && isLisbonAreaText(features.searchable)) {
      score += 2;
    }

    if (features.hasLocation) score += 0.5;
    return score;
  }

  function parsePriceValue(text) {
    const digits = (text || '').toString().replace(/[^\d]/g, '');
    if (!digits) return null;
    const parsed = parseInt(digits, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function extractRoomsValue(item) {
    const text = `${item?.title || ''} ${item?.location || ''}`.toLowerCase();
    if (!text) return null;
    if (/\bt0\b|\bstudio\b/.test(text)) return 0;
    const tMatch = text.match(/\bt\s?(\d)\b/i);
    if (tMatch) return parseInt(tMatch[1], 10);
    const roomMatch = text.match(/\b(\d+)\s*(quartos?|bed(room)?s?)\b/i);
    if (roomMatch) return parseInt(roomMatch[1], 10);
    return null;
  }

  function matchesAreaScope(item, areaScope, location) {
    if (!areaScope || areaScope === 'any') return true;
    const text = slugifyLocation(`${item?.location || ''} ${item?.title || ''} ${item?.url || ''}`);
    const target = slugifyLocation(location || '');
    if (areaScope === 'all-lisbon-towns') return isLisbonAreaText(text);
    if (areaScope === 'nearby' && target) return text.includes(target);
    return true;
  }

  function isLisbonAreaText(text) {
    if (!text) return false;
    const lisbonAreas = [
      'lisboa', 'ajuda', 'alcantara', 'alvalade', 'areeiro', 'arroios', 'avenidas-novas', 'beato',
      'belem', 'benfica', 'campo-de-ourique', 'campolide', 'carnide', 'estrela', 'lumiar', 'marvila',
      'misericordia', 'olivais', 'parque-das-nacoes', 'penha-de-franca', 'santa-clara', 'santa-maria-maior',
      'santo-antonio', 'sao-domingos-de-benfica', 'sao-vicente',
      'baixa', 'chiado', 'bairro-alto', 'cais-do-sodre', 'avenida-da-liberdade', 'alfama', 'graca',
      'mouraria', 'campo-grande', 'telheiras', 'intendente', 'pontinha'
    ];
    return lisbonAreas.some(area => text.includes(area));
  }

  function matchesSpecificArea(item, area) {
    if (!area) return true;
    const needle = slugifyLocation(area);
    if (!needle) return true;
    const text = slugifyLocation(`${item?.location || ''} ${item?.title || ''} ${item?.url || ''}`);
    return text.includes(needle);
  }

  function sortHousingListings(listings, sortKey) {
    if (!Array.isArray(listings)) return [];
    const out = listings.slice();
    if (sortKey === 'price-asc') {
      out.sort((a, b) => (parsePriceValue(a.price) ?? Number.MAX_SAFE_INTEGER) - (parsePriceValue(b.price) ?? Number.MAX_SAFE_INTEGER));
      return out;
    }
    if (sortKey === 'price-desc') {
      out.sort((a, b) => (parsePriceValue(b.price) ?? -1) - (parsePriceValue(a.price) ?? -1));
      return out;
    }
    if (sortKey === 'rooms-desc') {
      out.sort((a, b) => (extractRoomsValue(b) ?? -1) - (extractRoomsValue(a) ?? -1));
      return out;
    }
    return out;
  }

  function renderHousingStatus(state, customText) {
    HOUSING_STATE.status = state;
    const el = document.getElementById('housing-status');
    if (!el) return;
    const copy = T[currentLang] || {};
    const text = customText || (state === 'loading'
      ? copy['housing.loading']
      : state === 'error'
        ? copy['housing.error']
        : state === 'sourceEmpty'
          ? copy['housing.sourceEmpty']
          : state === 'sourceUnavailable'
            ? copy['housing.sourceUnavailable']
        : state === 'empty'
          ? copy['housing.empty']
          : state === 'noExact'
            ? copy['housing.noExact']
            : state === 'suggested'
              ? copy['housing.showingRelatable']
              : state === 'nearbySuggested'
                ? copy['housing.showingNearby']
          : '');
    el.textContent = text || '';
    el.style.display = text ? 'block' : 'none';
    persistHousingSessionState();
  }

  function buildHousingStatusSummary(source, location, filters) {
    const copy = T[currentLang] || {};
    const sourceLabel = HOUSING_SOURCES[source]?.label || source || '—';
    const areaPart = filters.area ? ` — ${filters.area}` : '';
    const template = copy['housing.summary'] || 'Fonte {source} · {location}{area}';
    let summary = template
      .replace('{source}', sourceLabel)
      .replace('{location}', location || 'Lisboa')
      .replace('{area}', areaPart);

    const notes = [];
    if (filters.areaNote) {
      const corrected = (copy['housing.areaCorrected'] || 'Zona corrigida de "{from}" para "{to}"')
        .replace('{from}', filters.areaNote)
        .replace('{to}', filters.area || filters.areaNote);
      notes.push(corrected);
    }
    if (filters.areaUnknown && filters.area) {
      notes.push(copy['housing.areaUnknown'] || 'Zona não reconhecida; a pesquisa usou apenas a localização.');
    }

    if (notes.length) summary = `${summary} — ${notes.join(' ')}`;
    return summary;
  }

  function renderHousingStatusWithSummary(state, baseText, source, location, filters) {
    let resolvedBase = baseText;
    if (!resolvedBase) {
      const copy = T[currentLang] || {};
      resolvedBase = state === 'loading'
        ? copy['housing.loading']
        : state === 'error'
          ? copy['housing.error']
          : state === 'sourceEmpty'
            ? copy['housing.sourceEmpty']
            : state === 'sourceUnavailable'
              ? copy['housing.sourceUnavailable']
              : state === 'empty'
                ? copy['housing.empty']
                : state === 'noExact'
                  ? copy['housing.noExact']
                  : state === 'suggested'
                    ? copy['housing.showingRelatable']
                    : state === 'nearbySuggested'
                      ? copy['housing.showingNearby']
                      : baseText;
    }

    const summary = buildHousingStatusSummary(source, location, filters || {});
    const text = summary ? [resolvedBase, summary].filter(Boolean).join(' • ') : resolvedBase;
    renderHousingStatus(state, text);
  }

  function renderHousingListings(listings, isFallback) {
    const grid = document.getElementById('housing-grid');
    if (!grid) return;
    const copy = T[currentLang] || {};
    const directListings = (listings || []).filter(item => isDirectListingLink(item?.url, detectListingConfig(item)));
    if (!directListings.length) {
      grid.innerHTML = '';
      persistHousingSessionState();
      return;
    }
    grid.innerHTML = directListings.slice(0, 8).map(item => `
      <article class="listing-card glass">
        <div class="listing-top">
          <span class="listing-badge ${isFallback ? 'badge-fallback' : 'badge-live'}">${isFallback ? (copy['housing.badge.fallback'] || 'Sample') : (copy['housing.badge.live'] || 'Live')}</span>
          <span class="listing-source">${escapeHtml(item.source || '')}</span>
        </div>
        <a class="listing-title" href="${item.url}" target="_blank" rel="noopener">
          ${escapeHtml(item.title || '')}
        </a>
        <div class="listing-price">${escapeHtml(item.price || '')}</div>
        <div class="listing-location">${escapeHtml(item.location || '')}</div>
        <div class="listing-actions">
          <a class="btn btn-ghost" href="${item.url}" target="_blank" rel="noopener">${copy['housing.seeListing'] || 'See listing'}</a>
        </div>
      </article>
    `).join('');
    persistHousingSessionState();
  }

  function renderHousingAlternativeAction(relatedListings, isFallback, options = {}) {
    const container = document.getElementById('housing-alt-actions');
    if (!container) return;
    const copy = T[currentLang] || {};
    const hasRelated = Array.isArray(relatedListings) && relatedListings.length > 0;
    const nearbyListings = Array.isArray(options.nearbyListings) ? options.nearbyListings : [];
    const nearbyAreas = Array.isArray(options.nearbyAreas) ? options.nearbyAreas : [];
    const allSourceListings = Array.isArray(options.allSourceListings) ? options.allSourceListings : [];
    const hasNearby = nearbyListings.length > 0;
    const allowExpandSource = !!options.allowExpandSource && HOUSING_STATE.source !== 'all';

    if (!hasRelated && !hasNearby && !allowExpandSource) {
      container.innerHTML = '';
      container.style.display = 'none';
      persistHousingSessionState();
      return;
    }

    const actions = [];
    if (hasNearby) {
      actions.push(`<button class="btn btn-primary" id="housing-show-nearby" type="button">${copy['housing.showNearby'] || 'Show nearby listings (5-10 km)'}</button>`);
    }
    if (hasRelated) {
      actions.push(`<button class="btn btn-ghost" id="housing-show-relatable" type="button">${copy['housing.showRelatable'] || 'Show relatable listings'}</button>`);
    }
    if (allowExpandSource) {
      actions.push(`<button class="btn btn-primary" id="housing-expand-source" type="button">${copy['housing.tryAllSources'] || 'Try all portals'}</button>`);
    }

    container.innerHTML = actions.join('');
    container.style.display = 'block';
    persistHousingSessionState();

    const nearbyBtn = document.getElementById('housing-show-nearby');
    if (nearbyBtn) {
      nearbyBtn.addEventListener('click', () => {
        HOUSING_STATE.items = nearbyListings.slice(0, 8);
        HOUSING_STATE.fallback = !!isFallback;
        renderHousingListings(HOUSING_STATE.items, !!isFallback);
        const suffix = nearbyAreas.length
          ? ` ${copy['housing.nearbyHintPrefix'] || 'Areas:'} ${nearbyAreas.join(', ')}`
          : '';
        renderHousingStatus('nearbySuggested', `${copy['housing.showingNearby'] || 'Showing nearby listings around your area.'}${suffix}`);
        renderHousingAlternativeAction(HOUSING_STATE.hasPendingRelated ? HOUSING_STATE.relatedItems : [], false, {
          allowExpandSource: HOUSING_STATE.source !== 'all',
          nearbyListings: HOUSING_STATE.hasPendingNearby ? HOUSING_STATE.nearbyItems : [],
          nearbyAreas: HOUSING_STATE.nearbyAreas,
          allSourceListings: HOUSING_STATE.hasPendingAllSourcePrefetched ? HOUSING_STATE.allSourcePrefetched : []
        });
      });
    }

    const btn = document.getElementById('housing-show-relatable');
    if (btn) {
      btn.addEventListener('click', () => {
        HOUSING_STATE.items = relatedListings.slice(0, 8);
        HOUSING_STATE.fallback = !!isFallback;
        renderHousingListings(HOUSING_STATE.items, !!isFallback);
        renderHousingStatus('suggested');
        renderHousingAlternativeAction(HOUSING_STATE.hasPendingRelated ? HOUSING_STATE.relatedItems : [], false, {
          allowExpandSource: HOUSING_STATE.source !== 'all',
          nearbyListings: HOUSING_STATE.hasPendingNearby ? HOUSING_STATE.nearbyItems : [],
          nearbyAreas: HOUSING_STATE.nearbyAreas,
          allSourceListings: HOUSING_STATE.hasPendingAllSourcePrefetched ? HOUSING_STATE.allSourcePrefetched : []
        });
      });
    }

    const expandBtn = document.getElementById('housing-expand-source');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        if (allSourceListings.length) {
          HOUSING_STATE.source = 'all';
          HOUSING_STATE.items = allSourceListings.slice(0, 8);
          HOUSING_STATE.fallback = false;
          HOUSING_STATE.relatedItems = [];
          HOUSING_STATE.hasPendingRelated = false;
          HOUSING_STATE.nearbyItems = [];
          HOUSING_STATE.hasPendingNearby = false;
          HOUSING_STATE.allSourcePrefetched = [];
          HOUSING_STATE.hasPendingAllSourcePrefetched = false;
          const sourceSelect = document.getElementById('housing-source');
          if (sourceSelect) sourceSelect.value = 'all';
          renderHousingListings(HOUSING_STATE.items, false);
          renderHousingStatus('success', copy['housing.prefetchedAllSources'] || 'Showing prefetched listings from all portals.');
          renderHousingAlternativeAction([], false);
          return;
        }
        const sourceSelect = document.getElementById('housing-source');
        if (sourceSelect) sourceSelect.value = 'all';
        HOUSING_STATE.source = 'all';
        loadHousingListings();
      });
    }

    persistHousingSessionState();
  }

  /* ═══════════════════════════════════════
     SIMULATORS
     ═══════════════════════════════════════ */
  function initSimulators() {
    initSimTabs();
    initMortgageCalc();
    initAffordCalc();
    initTimeCalc();
    initCostCalc();
  }

  function initSimTabs() {
    const tabs = document.querySelectorAll('.sim-tab');
    const panels = document.querySelectorAll('.sim-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const target = document.getElementById('sim-' + tab.getAttribute('data-tab'));
        if (target) target.classList.add('active');
      });
    });
  }

  /* Utility: sync range ↔ number input */
  function syncInputs(rangeId, numberId, callback) {
    const range = document.getElementById(rangeId);
    const num = document.getElementById(numberId);
    if (!range || !num) return;

    range.addEventListener('input', () => { num.value = range.value; callback(); });
    num.addEventListener('input', () => {
      let v = parseFloat(num.value);
      if (!isNaN(v)) {
        v = Math.max(parseFloat(range.min), Math.min(parseFloat(range.max), v));
        range.value = v;
        callback();
      }
    });
    num.addEventListener('change', () => {
      let v = parseFloat(num.value);
      if (isNaN(v)) v = parseFloat(range.value);
      v = Math.max(parseFloat(range.min), Math.min(parseFloat(range.max), v));
      num.value = v;
      range.value = v;
      callback();
    });
  }

  function fmt(n) {
    return Math.round(n).toLocaleString('pt-PT');
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ── Mortgage Calculator ── */
  function initMortgageCalc() {
    function calc() {
      const price = parseFloat(document.getElementById('mort-price').value);
      const downPct = parseFloat(document.getElementById('mort-down').value) / 100;
      const rate = parseFloat(document.getElementById('mort-rate').value) / 100;
      const term = parseInt(document.getElementById('mort-term').value, 10);

      const downAmount = price * downPct;
      const loan = price - downAmount;
      const monthlyRate = rate / 12;
      const payments = term * 12;

      let monthly;
      if (rate === 0) {
        monthly = loan / payments;
      } else {
        monthly = loan * (monthlyRate * Math.pow(1 + monthlyRate, payments)) / (Math.pow(1 + monthlyRate, payments) - 1);
      }

      const totalPaid = monthly * payments;
      const totalInterest = totalPaid - loan;
      const capitalPct = (loan / totalPaid) * 100;
      const interestPct = 100 - capitalPct;

      document.getElementById('mort-monthly').textContent = fmt(monthly);
      document.getElementById('mort-loan').textContent = '€' + fmt(loan);
      document.getElementById('mort-interest').textContent = '€' + fmt(totalInterest);
      document.getElementById('mort-total').textContent = '€' + fmt(totalPaid);
      document.getElementById('mort-down-amount').textContent =
        (currentLang === 'pt' ? 'Entrada: €' : 'Down payment: €') + fmt(downAmount);

      document.getElementById('mort-capital-bar').style.width = capitalPct + '%';
      document.getElementById('mort-interest-bar').style.width = interestPct + '%';

      // Effort rate: monthly / (salary needed so effort = 30%)
      const salaryNeeded = monthly / 0.30;
      const effortEl = document.getElementById('mort-effort');
      effortEl.textContent = '€' + fmt(salaryNeeded) + (currentLang === 'pt' ? ' líq./mês' : ' net/month');

      const hint = document.getElementById('mort-effort-hint');
      if (salaryNeeded > 2500) {
        hint.textContent = currentLang === 'pt'
          ? '⚠️ Precisas de um rendimento elevado para esta prestação. Considera um prazo maior ou um imóvel mais acessível.'
          : '⚠️ You need a high income for this payment. Consider a longer term or a more affordable property.';
      } else if (salaryNeeded > 1500) {
        hint.textContent = currentLang === 'pt'
          ? 'Com um rendimento médio, esta prestação é possível mas exigente. Mantém a taxa de esforço abaixo de 35 por cento.'
          : 'With an average income, this payment is possible but demanding. Keep the effort rate below 35 percent.';
      } else {
        hint.textContent = currentLang === 'pt'
          ? '✅ Esta prestação está ao alcance da maioria dos rendimentos médios em Portugal.'
          : '✅ This payment is within reach for most average incomes in Portugal.';
      }
    }

    syncInputs('mort-price-range', 'mort-price', calc);
    syncInputs('mort-down-range', 'mort-down', calc);
    syncInputs('mort-rate-range', 'mort-rate', calc);
    syncInputs('mort-term-range', 'mort-term', calc);
    calc();
  }

  /* ── Affordability Calculator ── */
  function initAffordCalc() {
    function calc() {
      const salary = parseFloat(document.getElementById('aff-salary').value);
      const expenses = parseFloat(document.getElementById('aff-expenses').value);
      const savings = parseFloat(document.getElementById('aff-savings').value);
      const rate = parseFloat(document.getElementById('aff-rate').value) / 100;

      const maxPayment = salary * 0.35;
      const monthlyRate = rate / 12;
      const payments = 30 * 12; // assume 30 year term

      let maxLoan;
      if (rate === 0) {
        maxLoan = maxPayment * payments;
      } else {
        maxLoan = maxPayment * (Math.pow(1 + monthlyRate, payments) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, payments));
      }

      const maxProperty = maxLoan / 0.8; // assuming 80% financing
      const downNeeded = maxProperty * 0.20;
      const gap = Math.max(0, downNeeded - savings);

      document.getElementById('aff-max').textContent = fmt(maxProperty);
      document.getElementById('aff-disposable').textContent = '€' + fmt(maxPayment) + '/mês';
      document.getElementById('aff-down').textContent = '€' + fmt(downNeeded);
      document.getElementById('aff-gap').textContent = gap > 0 ? '€' + fmt(gap) : (currentLang === 'pt' ? '✅ Tens o suficiente!' : '✅ You have enough!');

      // Gauge
      const gaugeScore = Math.min(100, (savings / downNeeded) * 100);
      document.getElementById('aff-gauge-fill').style.width = gaugeScore + '%';
      const status = document.getElementById('aff-gauge-status');
      if (gaugeScore >= 80) {
        status.textContent = currentLang === 'pt' ? 'Muito bom. Estás quase pronto.' : 'Very good. You are almost ready.';
      } else if (gaugeScore >= 40) {
        status.textContent = currentLang === 'pt' ? 'A caminho. Continua a poupar.' : 'On track. Keep saving.';
      } else {
        status.textContent = currentLang === 'pt' ? 'Ainda no início. Foca te na poupança.' : 'Still early. Focus on savings.';
      }

      const hint = document.getElementById('aff-hint');
      if (maxProperty < 100000) {
        hint.textContent = currentLang === 'pt'
          ? 'Com este rendimento, explora zonas mais acessíveis ou considera co titular o crédito para aumentar a capacidade.'
          : 'With this income, explore more affordable areas or consider co borrowing to increase capacity.';
      } else {
        hint.textContent = currentLang === 'pt'
          ? 'Este é um cenário estimado com prazo de 30 anos e taxa de esforço de 35 por cento. O valor real depende do banco.'
          : 'This is an estimated scenario with a 30 year term and 35 percent effort rate. The actual value depends on the bank.';
      }
    }

    syncInputs('aff-salary-range', 'aff-salary', calc);
    syncInputs('aff-expenses-range', 'aff-expenses', calc);
    syncInputs('aff-savings-range', 'aff-savings', calc);
    syncInputs('aff-rate-range', 'aff-rate', calc);
    calc();
  }

  /* ── Time to Buy Calculator ── */
  function initTimeCalc() {
    function calc() {
      const target = parseFloat(document.getElementById('time-target').value);
      const downPct = parseFloat(document.getElementById('time-down-pct').value) / 100;
      const current = parseFloat(document.getElementById('time-current').value);
      const monthly = parseFloat(document.getElementById('time-monthly').value);

      const downNeeded = target * downPct;
      const gap = Math.max(0, downNeeded - current);
      const months = monthly > 0 ? Math.ceil(gap / monthly) : 999;
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;

      document.getElementById('time-down-needed').textContent =
        (currentLang === 'pt' ? 'Entrada necessária: €' : 'Deposit needed: €') + fmt(downNeeded);

      document.getElementById('time-years').textContent = years;
      const extraEl = document.getElementById('time-months-extra');
      if (remainingMonths > 0 && months < 999) {
        extraEl.textContent = (currentLang === 'pt' ? `e ${remainingMonths} meses` : `and ${remainingMonths} months`);
      } else if (months >= 999) {
        document.getElementById('time-years').textContent = '∞';
        extraEl.textContent = currentLang === 'pt' ? 'Aumenta a poupança mensal' : 'Increase monthly savings';
      } else {
        extraEl.textContent = '';
      }

      document.getElementById('time-total-needed').textContent = '€' + fmt(downNeeded);
      document.getElementById('time-gap').textContent = gap > 0 ? '€' + fmt(gap) : '✅';
      document.getElementById('time-milestone').textContent = '€' + fmt(downNeeded / 2);

      // Timeline
      const progress = Math.min(100, (current / downNeeded) * 100);
      document.getElementById('time-fill').style.width = progress + '%';
      const marker = document.getElementById('time-marker');
      marker.style.left = `calc(${progress}% - 11px)`;

      const goalLabel = document.getElementById('time-goal-label');
      if (months < 999) {
        const goalDate = new Date();
        goalDate.setMonth(goalDate.getMonth() + months);
        const dateStr = goalDate.toLocaleDateString(currentLang === 'pt' ? 'pt-PT' : 'en-US', { month: 'short', year: 'numeric' });
        goalLabel.textContent = dateStr;
      } else {
        goalLabel.textContent = '—';
      }

      const hint = document.getElementById('time-hint');
      if (gap <= 0) {
        hint.textContent = currentLang === 'pt' ? 'Já tens poupanças suficientes para a entrada. Próximo passo: pré aprovação bancária.' : 'You already have enough savings for the deposit. Next step: bank pre approval.';
      } else if (months <= 24) {
        hint.textContent = currentLang === 'pt' ? 'Estás perto. Mantém a consistência e vais conseguir.' : 'You are close. Stay consistent and you will get there.';
      } else {
        hint.textContent = currentLang === 'pt' ? 'Para acelerar, tenta aumentar a poupança mensal em 100 euros ou considerar o programa de Garantia Pública.' : 'To speed up, try increasing monthly savings by 100 euros or consider the Public Guarantee program.';
      }
    }

    syncInputs('time-target-range', 'time-target', calc);
    syncInputs('time-down-pct-range', 'time-down-pct', calc);
    syncInputs('time-current-range', 'time-current', calc);
    syncInputs('time-monthly-range', 'time-monthly', calc);
    calc();
  }

  /* ── Cost Breakdown Calculator ── */
  function initCostCalc() {
    let isPrimary = true;

    document.getElementById('cost-type-primary').addEventListener('click', () => {
      isPrimary = true;
      document.getElementById('cost-type-primary').classList.add('active');
      document.getElementById('cost-type-secondary').classList.remove('active');
      calc();
    });
    document.getElementById('cost-type-secondary').addEventListener('click', () => {
      isPrimary = false;
      document.getElementById('cost-type-secondary').classList.add('active');
      document.getElementById('cost-type-primary').classList.remove('active');
      calc();
    });

    function calcIMT(price, primary) {
      // Simplified 2024 IMT brackets for urban property — primary residence
      if (primary) {
        if (price <= 97064) return 0;
        if (price <= 132774) return price * 0.02 - 1941.28;
        if (price <= 181034) return price * 0.05 - 5924.06;
        if (price <= 301688) return price * 0.07 - 9545.74;
        if (price <= 603289) return price * 0.08 - 12562.62;
        return price * 0.06; // flat 6% above
      } else {
        // Secondary residence
        if (price <= 97064) return price * 0.01;
        if (price <= 132774) return price * 0.02 - 970.64;
        if (price <= 181034) return price * 0.05 - 4953.42;
        if (price <= 301688) return price * 0.07 - 8575.10;
        if (price <= 578598) return price * 0.08 - 11591.78;
        return price * 0.06;
      }
    }

    function calc() {
      const price = parseFloat(document.getElementById('cost-price').value);

      const imt = Math.max(0, calcIMT(price, isPrimary));
      const is = price * 0.008; // 0.8% stamp duty
      const notary = 800 + Math.min(price * 0.001, 500); // estimated
      const bank = 1200; // avg bank processing fees
      const realtor = 0; // buyer usually doesn't pay in Portugal

      const totalCosts = imt + is + notary + bank + realtor;
      const downPayment = price * 0.20;
      const grandTotal = downPayment + totalCosts;

      document.getElementById('cost-imt').textContent = '€' + fmt(imt);
      document.getElementById('cost-is').textContent = '€' + fmt(is);
      document.getElementById('cost-notary').textContent = '€' + fmt(notary);
      document.getElementById('cost-bank').textContent = '€' + fmt(bank);
      document.getElementById('cost-realtor').textContent = '€' + fmt(realtor);
      document.getElementById('cost-total').textContent = fmt(totalCosts);
      document.getElementById('cost-grand-total').textContent = '€' + fmt(grandTotal);

      const pctNote = document.getElementById('cost-pct-note');
      const pct = ((totalCosts / price) * 100).toFixed(1);
      pctNote.textContent = currentLang === 'pt'
        ? `≈ ${pct}% do valor do imóvel`
        : `≈ ${pct}% of property value`;
    }

    syncInputs('cost-price-range', 'cost-price', calc);
    calc();
  }

  /* ═══════════════════════════════════════
     LEARN SECTION
     ═══════════════════════════════════════ */
  function renderLearnCards() {
    const grid = document.getElementById('learn-grid');
    if (!grid) return;
    const lang = currentLang;

    grid.innerHTML = LEARN_CARDS.map((card, i) => `
      <div class="learn-card" data-cat="${card.cat}" data-index="${i}">
        <div class="learn-card-icon">${card.icon}</div>
        <h4 class="learn-card-title">${card.title[lang]}</h4>
        <p class="learn-card-desc">${card.desc[lang]}</p>
        <span class="learn-card-tag">${card.cat}</span>
      </div>
    `).join('');

    // Card click → open modal
    grid.querySelectorAll('.learn-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.getAttribute('data-index'), 10);
        openLearnModal(idx);
      });
    });
  }

  function initLearnTabs() {
    document.querySelectorAll('.learn-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.learn-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const cat = tab.getAttribute('data-cat');
        document.querySelectorAll('.learn-card').forEach(card => {
          card.style.display = (cat === 'all' || card.getAttribute('data-cat') === cat) ? '' : 'none';
        });
      });
    });
  }

  function openLearnModal(index) {
    const card = LEARN_CARDS[index];
    const modal = document.getElementById('learn-modal');
    document.getElementById('learn-modal-content').innerHTML = card.full[currentLang];
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    toggleOverlay(true, () => closeLearnModal());
  }

  function closeLearnModal() {
    document.getElementById('learn-modal').classList.remove('open');
    document.getElementById('learn-modal').setAttribute('aria-hidden', 'true');
    toggleOverlay(false);
  }

  /* ═══════════════════════════════════════
     FAQ
     ═══════════════════════════════════════ */
  function renderFAQ() {
    const list = document.getElementById('faq-list');
    if (!list) return;
    const lang = currentLang;

    list.innerHTML = FAQ_DATA.map((item, i) => `
      <div class="faq-item" data-cat="${item.cat}" data-index="${i}">
        <button class="faq-question" aria-expanded="false">
          <span>${item.q[lang]}</span>
          <span class="faq-toggle">+</span>
        </button>
        <div class="faq-answer">
          <p class="faq-answer-text">${item.a[lang]}</p>
        </div>
      </div>
    `).join('');

    // Accordion behaviour
    list.querySelectorAll('.faq-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const isOpen = item.classList.contains('open');
        // Close all
        list.querySelectorAll('.faq-item').forEach(fi => fi.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      });
    });
  }

  function renderResources(cat) {
    const grid = document.getElementById('resource-grid');
    if (!grid) return;
    const selected = cat || document.querySelector('.resource-cat.active')?.getAttribute('data-cat') || 'all';
    const lang = currentLang;
    const labels = {
      all: lang === 'pt' ? 'Todos' : 'All',
      financial: lang === 'pt' ? 'Financeiro' : 'Financial',
      property: lang === 'pt' ? 'Imovel' : 'Property',
      environment: lang === 'pt' ? 'Ambiente' : 'Environment'
    };

    const list = RESOURCE_TOOLS.filter(item => selected === 'all' || item.cat === selected);
    grid.innerHTML = list.map((item) => `
      <article class="resource-card reveal" data-cat="${item.cat}" role="listitem" title="${escapeHtml(item.desc[lang])}">
        <div class="resource-header">
          <h3 class="resource-title">${escapeHtml(item.title[lang])}</h3>
          <span class="resource-tag">${labels[item.cat] || item.cat}</span>
        </div>
        <p class="resource-desc">${escapeHtml(item.desc[lang])}</p>
        <a class="resource-link" href="${item.url}" target="_blank" rel="noopener">${lang === 'pt' ? 'Abrir ferramenta' : 'Open tool'} <span aria-hidden="true">↗</span></a>
      </article>
    `).join('');

    grid.querySelectorAll('.resource-card').forEach(card => card.classList.add('visible'));
  }

  function buildOsmEmbedUrl(lat, lon) {
    const delta = 0.08;
    const left = (lon - delta).toFixed(6);
    const right = (lon + delta).toFixed(6);
    const top = (lat + delta).toFixed(6);
    const bottom = (lat - delta).toFixed(6);
    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat.toFixed(6)}%2C${lon.toFixed(6)}`;
  }

  function buildAirEmbedUrl(lat, lon) {
    const latVal = lat.toFixed(4);
    const lonVal = lon.toFixed(4);
    return `https://embed.windy.com/embed2.html?lat=${latVal}&lon=${lonVal}&detailLat=${latVal}&detailLon=${lonVal}&width=650&height=420&zoom=9&level=surface&overlay=pm2p5&menu=&message=true&marker=true&calendar=24&pressure=true&type=map&location=coordinates&detail=true&metricWind=default&metricTemp=default&radarRange=-1`;
  }

  function buildShadeEmbedUrl(lat, lon) {
    return `https://shademap.app/#12/${lat.toFixed(4)}/${lon.toFixed(4)}`;
  }

  async function fetchAirQualitySnapshot(lat, lon) {
    const endpoint = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm10,pm2_5`;
    const res = await fetch(endpoint, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('air-api');
    const payload = await res.json();
    return payload?.current || null;
  }

  function initResourceLiveMap() {
    const select = document.getElementById('resource-map-location');
    const frame = document.getElementById('resource-map-frame');
    const externalLink = document.getElementById('resource-external-open');
    const featureButtons = document.querySelectorAll('.resource-feature-btn');
    const airPanel = document.getElementById('resource-air-panel');
    const airAqi = document.getElementById('resource-air-aqi');
    const airPm25 = document.getElementById('resource-air-pm25');
    const airPm10 = document.getElementById('resource-air-pm10');
    const airUpdated = document.getElementById('resource-air-updated');
    if (!select || !frame || !externalLink || !featureButtons.length || !airPanel) return;

    const previous = select.value || 'lisboa';
    const previousFeature = select.dataset.feature || 'base';
    select.innerHTML = LIVE_MAP_LOCATIONS.map(item => {
      const label = item.label[currentLang] || item.label.pt;
      return `<option value="${item.key}">${label}</option>`;
    }).join('');

    if (LIVE_MAP_LOCATIONS.some(item => item.key === previous)) select.value = previous;
    select.dataset.feature = previousFeature;

    const setFeatureActive = (feature) => {
      select.dataset.feature = feature;
      featureButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-feature') === feature));
    };

    const setAirPending = (pending) => {
      airAqi.textContent = pending ? '...' : '--';
      airPm25.textContent = pending ? '...' : '--';
      airPm10.textContent = pending ? '...' : '--';
      airUpdated.textContent = pending ? '...' : '--';
    };

    const updateMap = async () => {
      const selected = LIVE_MAP_LOCATIONS.find(item => item.key === select.value) || LIVE_MAP_LOCATIONS[0];
      const feature = select.dataset.feature || 'base';

      if (feature === 'air') {
        frame.src = buildAirEmbedUrl(selected.lat, selected.lon);
        externalLink.href = `https://www.iqair.com/world-air-quality?keyword=${encodeURIComponent(selected.label.en)}`;
        airPanel.style.display = 'grid';
        setAirPending(true);
        try {
          const current = await fetchAirQualitySnapshot(selected.lat, selected.lon);
          if (current) {
            airAqi.textContent = Number.isFinite(current.european_aqi) ? Math.round(current.european_aqi).toString() : '--';
            airPm25.textContent = Number.isFinite(current.pm2_5) ? `${current.pm2_5.toFixed(1)} µg/m3` : '--';
            airPm10.textContent = Number.isFinite(current.pm10) ? `${current.pm10.toFixed(1)} µg/m3` : '--';
            airUpdated.textContent = current.time || '--';
          } else {
            setAirPending(false);
          }
        } catch (error) {
          setAirPending(false);
        }
        return;
      }

      airPanel.style.display = 'none';
      if (feature === 'shade') {
        frame.src = buildShadeEmbedUrl(selected.lat, selected.lon);
        externalLink.href = buildShadeEmbedUrl(selected.lat, selected.lon);
      } else {
        frame.src = buildOsmEmbedUrl(selected.lat, selected.lon);
        externalLink.href = `https://www.openstreetmap.org/?mlat=${selected.lat.toFixed(6)}&mlon=${selected.lon.toFixed(6)}#map=12/${selected.lat.toFixed(6)}/${selected.lon.toFixed(6)}`;
      }
    };

    updateMap();
    if (!select.dataset.bound) {
      select.addEventListener('change', updateMap);
      featureButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          setFeatureActive(btn.getAttribute('data-feature') || 'base');
          updateMap();
        });
      });
      select.dataset.bound = 'true';
    }

    setFeatureActive(select.dataset.feature || 'base');
  }

  function initResources() {
    const cats = document.querySelectorAll('.resource-cat');
    if (!cats.length) return;

    cats.forEach(btn => {
      btn.addEventListener('click', () => {
        cats.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderResources(btn.getAttribute('data-cat'));
        initTiltEffects();
      });
    });

    renderResources('all');
  }

  function initFAQ() {
    renderFAQ();

    // Category filtering
    document.querySelectorAll('.faq-cat').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.faq-cat').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.getAttribute('data-cat');
        document.querySelectorAll('.faq-item').forEach(item => {
          item.style.display = (cat === 'all' || item.getAttribute('data-cat') === cat) ? '' : 'none';
        });
        document.getElementById('faq-no-results').style.display = 'none';
      });
    });

    // Search
    const searchInput = document.getElementById('faq-search');
    const clearBtn = document.getElementById('faq-clear');

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      clearBtn.classList.toggle('visible', q.length > 0);
      let found = 0;

      document.querySelectorAll('.faq-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        const match = q === '' || text.includes(q);
        item.style.display = match ? '' : 'none';
        if (match) found++;
      });

      document.getElementById('faq-no-results').style.display = found === 0 ? '' : 'none';
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.classList.remove('visible');
      document.querySelectorAll('.faq-item').forEach(item => { item.style.display = ''; });
      document.getElementById('faq-no-results').style.display = 'none';
    });
  }

  /* ═══════════════════════════════════════
     JOURNEY GUIDE (Step Details)
     ═══════════════════════════════════════ */
  function initJourneyGuide() {
    const stepDetails = {
      1: {
        pt: '<h3>📒 Definir Objetivos</h3><p>Antes de procurar casa, responde a estas perguntas:</p><ul><li>Que tipo de imóvel? (apartamento, moradia, T1, T2…)</li><li>Em que zona? (centro, periferia, outra cidade?)</li><li>Qual o orçamento máximo realista?</li><li>Comprar sozinho/a ou com alguém?</li></ul><p>Ter critérios claros evita perder tempo e dinheiro com opções inadequadas.</p><div class="tip-box">💡 Visita portais imobiliários para ter noção dos preços praticados na tua zona alvo.</div>',
        en: '<h3>📒 Define Goals</h3><p>Before searching for a home, answer these questions:</p><ul><li>What type of property? (apartment, house, studio, 1-bed…)</li><li>Which area? (city center, suburbs, another city?)</li><li>What\'s the maximum realistic budget?</li><li>Buying alone or with someone?</li></ul><p>Clear criteria prevent wasting time and money on unsuitable options.</p><div class="tip-box">💡 Visit property portals to understand prices in your target area.</div>'
      },
      2: {
        pt: '<h3>💼 Preparar Finanças</h3><p>Documentos a reunir:</p><ul><li>Declaração de IRS e nota de liquidação</li><li>3 últimos recibos de vencimento</li><li>Extractos bancários (3 meses)</li><li>Mapa de responsabilidades do BdP</li></ul><p>Ações recomendadas:</p><ul><li>Limpa dívidas existentes (cartões de crédito, etc.)</li><li>Define um plano de poupança mensal</li><li>Melhora a tua taxa de esforço</li></ul><div class="tip-box">💡 Usa o simulador de acessibilidade para entender a tua capacidade real.</div>',
        en: '<h3>💼 Prepare Finances</h3><p>Documents to gather:</p><ul><li>Tax return and settlement note</li><li>Last 3 pay slips</li><li>Bank statements (3 months)</li><li>Bank of Portugal credit responsibility map</li></ul><p>Recommended actions:</p><ul><li>Clear existing debts (credit cards, etc.)</li><li>Set a monthly savings plan</li><li>Improve your effort rate</li></ul><div class="tip-box">💡 Use the affordability simulator to understand your real capacity.</div>'
      },
      3: {
        pt: '<h3>🏦 Pré-Aprovação</h3><p>A pré-aprovação indica quanto o banco te pode emprestar:</p><ul><li>Contacta 3-5 bancos diferentes</li><li>Compara TAN, TAEG, spreads</li><li>Verifica condições de vinculação (seguros, domiciliação)</li><li>Negocia — tudo é negociável!</li></ul><p>A pré-aprovação não é vinculativa e é gratuita.</p><div class="tip-box">💡 Podes usar um intermediário de crédito para comparar propostas de vários bancos gratuitamente.</div>',
        en: '<h3>🏦 Pre-Approval</h3><p>Pre-approval indicates how much the bank can lend you:</p><ul><li>Contact 3-5 different banks</li><li>Compare TAN, TAEG, spreads</li><li>Check tied conditions (insurance, salary domiciliation)</li><li>Negotiate — everything is negotiable!</li></ul><p>Pre-approval is non-binding and free.</p><div class="tip-box">💡 You can use a credit intermediary to compare proposals from multiple banks for free.</div>'
      },
      4: {
        pt: '<h3>🔍 Procura do Imóvel</h3><p>Ao visitar imóveis, verifica:</p><ul><li>Caderneta Predial Urbana (na AT)</li><li>Certidão do Registo Predial (penhoras, hipotecas)</li><li>Licença de habitação</li><li>Estado real (humidades, instalações, estacionamento)</li></ul><p>Negocia sempre — o preço anunciado é um ponto de partida.</p><div class="tip-box">💡 Contrata um perito independente para avaliar o estado do imóvel antes de fazer proposta.</div>',
        en: '<h3>🔍 Property Search</h3><p>When visiting properties, check:</p><ul><li>Urban Property Record (at the Tax Authority)</li><li>Land Registry Certificate (liens, mortgages)</li><li>Housing license</li><li>Actual condition (damp, installations, parking)</li></ul><p>Always negotiate — the listed price is just a starting point.</p><div class="tip-box">💡 Hire an independent surveyor to assess the property condition before making an offer.</div>'
      },
      5: {
        pt: '<h3>📝 CPCV e Aprovação Final</h3><p>Após encontrar o imóvel certo:</p><ul><li>Negoceia e aceita a proposta de preço</li><li>Assina o CPCV com pagamento de sinal (10-20%)</li><li>O banco agenda avaliação do imóvel</li><li>Aprovação formal do crédito</li></ul><p>O CPCV deve ser revisto por um advogado. Inclui cláusula de contingência para o crédito.</p><div class="tip-box">💡 Se o banco não aprovar o crédito, a cláusula de contingência protege-te e recuperas o sinal.</div>',
        en: '<h3>📝 CPCV and Final Approval</h3><p>After finding the right property:</p><ul><li>Negotiate and accept the price offer</li><li>Sign the CPCV with deposit payment (10-20%)</li><li>Bank schedules property valuation</li><li>Formal mortgage approval</li></ul><p>The CPCV should be reviewed by a lawyer. Include a contingency clause for the loan.</p><div class="tip-box">💡 If the bank doesn\'t approve the loan, the contingency clause protects you and you recover the deposit.</div>'
      },
      6: {
        pt: '<h3>🗝️ Escritura e Chaves</h3><p>O grande dia! O que acontece:</p><ul><li>Pagamento de IMT e IS (antes da escritura)</li><li>Escritura pública (notário ou Casa Pronta)</li><li>Assinatura de todos os documentos</li><li>Registo automático na Conservatória</li><li>Recebes as chaves! 🎉</li></ul><div class="tip-box">💡 O serviço Casa Pronta permite tratar tudo num só local — escritura, registo e pagamento de impostos.</div>',
        en: '<h3>🗝️ Deed and Keys</h3><p>The big day! What happens:</p><ul><li>Payment of IMT and IS (before the deed)</li><li>Public deed (notary or Casa Pronta)</li><li>Signing all documents</li><li>Automatic registration at the Land Registry</li><li>You receive the keys! 🎉</li></ul><div class="tip-box">💡 The Casa Pronta service lets you handle everything in one place — deed, registration and tax payment.</div>'
      }
    };

    const modal = document.getElementById('step-modal');
    const modalContent = document.getElementById('step-modal-content');
    const closeBtn = document.getElementById('step-modal-close');
    if (!modal || !modalContent || !closeBtn) return;

    document.querySelectorAll('.jg-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const step = btn.getAttribute('data-step');
        const content = stepDetails[step];
        if (content) {
          modalContent.innerHTML = content[currentLang];
          modal.classList.add('open');
          modal.setAttribute('aria-hidden', 'false');
          toggleOverlay(true, () => closeStepModal());
        }
      });
    });

    closeBtn.addEventListener('click', closeStepModal);

    function closeStepModal() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      toggleOverlay(false);
    }
  }

  /* ═══════════════════════════════════════
     CHATBOT
     ═══════════════════════════════════════ */
  function initChatbot() {
    const fab = document.getElementById('chatbot-fab');
    const panel = document.getElementById('chatbot-panel');
    const closeBtn = document.getElementById('chatbot-close');
    const messagesEl = document.getElementById('chatbot-messages');
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send');

    fab.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      panel.setAttribute('aria-hidden', !isOpen);
      if (isOpen) input.focus();
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    });

    // Quick question buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.getAttribute('data-question');
        const label = btn.textContent;
        addMessage(label, 'user');
        setTimeout(() => {
          const response = CHATBOT_RESPONSES[currentLang][q] || CHATBOT_RESPONSES[currentLang].default;
          addMessage(response, 'bot');
        }, 600);
      });
    });

    // Send custom message
    function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      addMessage(text, 'user');
      input.value = '';

      setTimeout(() => {
        const lower = text.toLowerCase();
        let answer;
        const responses = CHATBOT_RESPONSES[currentLang];

        if (lower.includes('imt') || lower.includes('imposto') || lower.includes('tax')) {
          answer = responses.imt;
        } else if (lower.includes('financ') || lower.includes('crédit') || lower.includes('credit') || lower.includes('mortgage') || lower.includes('empréstimo') || lower.includes('loan')) {
          answer = responses.financing;
        } else if (lower.includes('mercado') || lower.includes('taxa') || lower.includes('euribor') || lower.includes('banco') || lower.includes('market') || lower.includes('rate')) {
          const refRate = (MARKET_STATE.referenceRate ?? 1.8).toFixed(2);
          const lendRate = (MARKET_STATE.lending ?? 4.2).toFixed(2);
          answer = currentLang === 'pt'
            ? `No último dado disponível, a taxa real está em ${refRate}% e a taxa média de empréstimo em ${lendRate}%. Usa esta referência para comparar propostas entre bancos e confirmar custo total no simulador.`
            : `In the latest available data, real interest is ${refRate}% and average lending rate is ${lendRate}%. Use this as a benchmark when comparing bank offers and total cost in the simulator.`;
        } else if (lower.includes('entrada') || lower.includes('deposit') || lower.includes('sinal') || lower.includes('down payment')) {
          answer = responses.downpayment;
        } else if (lower.includes('apoio') || lower.includes('support') || lower.includes('garantia') || lower.includes('porta 65') || lower.includes('government')) {
          answer = responses.support;
        } else {
          answer = responses.default;
        }
        addMessage(answer, 'bot');
      }, 800);
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

    function addMessage(text, type) {
      const div = document.createElement('div');
      div.className = `chat-msg ${type}`;
      div.innerHTML = `<span>${text}</span>`;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  /* ═══════════════════════════════════════
     CONTACT FORM
     ═══════════════════════════════════════ */
  function initContactForm() {
    const form = document.getElementById('contact-form');
    const success = document.getElementById('form-success');
    const errorEl = document.getElementById('form-error');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!submitBtn) return;

      success.style.display = 'none';
      errorEl.style.display = 'none';

      if (!FORM_ENDPOINT || FORM_ENDPOINT.includes('your-id-here')) {
        errorEl.textContent = currentLang === 'pt' ? 'Configura o endpoint Formspree primeiro.' : 'Configure the Formspree endpoint first.';
        errorEl.style.display = 'block';
        return;
      }

      const payload = {
        name: document.getElementById('c-name').value.trim(),
        email: document.getElementById('c-email').value.trim(),
        subject: document.getElementById('c-subject').value,
        message: document.getElementById('c-message').value.trim(),
        topic: document.getElementById('c-subject').value,
        language: currentLang,
        source: 'myhome-web',
        timestamp: new Date().toISOString()
      };

      submitBtn.disabled = true;
      submitBtn.textContent = currentLang === 'pt' ? 'A enviar...' : 'Sending...';

      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Request failed');

        success.textContent = T[currentLang]?.['contact.success'] || 'Mensagem enviada!';
        success.style.display = 'block';
        form.reset();
      } catch (err) {
        errorEl.textContent = currentLang === 'pt' ? 'Erro ao enviar. Tenta novamente.' : 'Failed to send. Try again.';
        errorEl.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = T[currentLang]?.['contact.send'] || 'Enviar mensagem';
        setTimeout(() => {
          success.style.display = 'none';
          errorEl.style.display = 'none';
        }, 6000);
      }
    });
  }

  /* ═══════════════════════════════════════
     MODAL OVERLAY
     ═══════════════════════════════════════ */
  let overlayEl = null;
  let overlayClickCb = null;

  function toggleOverlay(show, clickCallback) {
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'modal-overlay';
      document.body.appendChild(overlayEl);
      overlayEl.addEventListener('click', () => {
        if (overlayClickCb) overlayClickCb();
        toggleOverlay(false);
      });
    }

    if (show) {
      overlayClickCb = clickCallback || null;
      requestAnimationFrame(() => overlayEl.classList.add('visible'));
    } else {
      overlayEl.classList.remove('visible');
      overlayClickCb = null;
    }
  }

  /* ═══════════════════════════════════════
     PARALLAX (subtle hero background shapes)
     ═══════════════════════════════════════ */
  function initParallax() {
    const circles = document.querySelectorAll('.hero-circle');
    const orbs = document.querySelectorAll('.resource-orb');
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        circles.forEach((c, i) => {
          const speed = (i + 1) * 0.03;
          c.style.transform = `translateY(${y * speed}px)`;
        });
      }
      if (orbs.length) {
        orbs.forEach((orb, i) => {
          const speed = (i + 2) * 0.018;
          orb.style.transform = `translateY(${y * speed}px)`;
        });
      }
    }, { passive: true });
  }

  /* ═══════════════════════════════════════
     LEARN MODAL CLOSE
     ═══════════════════════════════════════ */
  function initLearnModal() {
    document.getElementById('learn-modal-close').addEventListener('click', closeLearnModal);
  }

  /* ═══════════════════════════════════════
     INIT
     ═══════════════════════════════════════ */
  function init() {
    initNavbar();
    initScrollReveal();
    initCounters();
    initOnboarding();
    initQuiz();
    initCharts();
    initMarketIntel();
    initHousingListings();
    initSimulators();
    renderLearnCards();
    initLearnTabs();
    initLearnModal();
    initFAQ();
    initResources();
    initResourceLiveMap();
    initJourneyGuide();
    initChatbot();
    initContactForm();
    initParallax();
    initTiltEffects();

    // Set initial language
    setLanguage('pt');
  }

  // Launch
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
