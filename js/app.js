/* ============================================================
   CasaJá — Main Application Logic
   Interactive platform for first-home buyers in Portugal
   ============================================================ */

(function () {
  'use strict';

  /* ─── Global State ─── */
  let currentLang = 'pt';
  let chartsInitialized = false;
  const chartInstances = {};

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
    if (chartsInitialized) updateChartLabels();
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
        }
      });
    }, { rootMargin: '-40% 0px -50% 0px' });

    sections.forEach(s => observer.observe(s));

    // Language toggle
    document.getElementById('lang-toggle').addEventListener('click', () => {
      setLanguage(currentLang === 'pt' ? 'en' : 'pt');
    });
  }

  /* ═══════════════════════════════════════
     SCROLL REVEAL ANIMATIONS
     ═══════════════════════════════════════ */
  function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal, .animate-fade-up, .animate-scale-in');

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
    const shown = sessionStorage.getItem('casaja-onboarding');

    if (!shown) {
      setTimeout(() => overlay.classList.add('visible'), 800);
    }

    function close() {
      overlay.classList.remove('visible');
      sessionStorage.setItem('casaja-onboarding', 'true');
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

      let icon = '🎯';
      let desc = '';
      let insights = [];

      const lang = currentLang;

      if (lang === 'pt') {
        if (income === 'under1000' || income === '1000-1500') {
          desc = 'Com o teu rendimento atual, a taxa de esforço será um desafio. ';
          insights.push('💸 Considera aumentar fontes de rendimento ou co-titular o crédito.');
        } else {
          desc = 'O teu rendimento permite explorar opções de financiamento. ';
          insights.push('✅ A tua base financeira é um bom ponto de partida.');
        }

        if (timeline === '1-2') {
          desc += 'Planeas comprar em breve — é essencial começar já o processo de pré-aprovação.';
          insights.push('⏰ Agenda reuniões com 3-5 bancos nos próximos 30 dias.');
        } else if (timeline === 'unsure') {
          desc += 'Não ter prazo definido é normal — esta plataforma ajuda-te a criar um plano claro.';
          insights.push('🗺️ Explora o guia de jornada para criar uma linha temporal realista.');
          icon = '🧭';
        } else {
          desc += 'Tens tempo para planear e poupar — usa-o estrategicamente.';
          insights.push('📈 Define uma meta mensal de poupança com o simulador de tempo.');
        }

        if (obstacle === 'savings') {
          insights.push('🏦 Conhece o programa de Garantia Pública para Jovens (até 100% financiamento).');
        } else if (obstacle === 'income') {
          insights.push('💼 Com a regra dos 35%, o teu foco deve ser maximizar rendimento ou reduzir despesas.');
        } else if (obstacle === 'knowledge') {
          insights.push('📚 A secção "Aprender" explica todos os conceitos-chave de forma simples.');
          icon = '📖';
        } else {
          insights.push('🧩 Segue o guia de jornada passo a passo — o processo é mais simples do que parece.');
        }
        insights.push('👥 70% das pessoas como tu partilham as mesmas preocupações. Não estás sozinho/a.');
      } else {
        if (income === 'under1000' || income === '1000-1500') {
          desc = 'With your current income, the effort rate will be challenging. ';
          insights.push('💸 Consider increasing income sources or co-borrowing.');
        } else {
          desc = 'Your income allows you to explore financing options. ';
          insights.push('✅ Your financial base is a good starting point.');
        }

        if (timeline === '1-2') {
          desc += "You're planning to buy soon — start the pre-approval process now.";
          insights.push('⏰ Schedule meetings with 3-5 banks in the next 30 days.');
        } else if (timeline === 'unsure') {
          desc += "Not having a defined timeline is normal — this platform helps you create a clear plan.";
          insights.push('🗺️ Explore the journey guide to create a realistic timeline.');
          icon = '🧭';
        } else {
          desc += 'You have time to plan and save — use it strategically.';
          insights.push('📈 Set a monthly savings goal with the time simulator.');
        }

        if (obstacle === 'savings') {
          insights.push('🏦 Learn about the Youth Public Guarantee program (up to 100% financing).');
        } else if (obstacle === 'income') {
          insights.push("💼 With the 35% rule, your focus should be maximizing income or reducing expenses.");
        } else if (obstacle === 'knowledge') {
          insights.push('📚 The "Learn" section explains all key concepts simply.');
          icon = '📖';
        } else {
          insights.push('🧩 Follow the step-by-step journey guide — the process is simpler than it seems.');
        }
        insights.push("👥 70% of people like you share the same concerns. You're not alone.");
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
          ? '💡 Com um rendimento médio, esta prestação é possível mas exigente. Mantém a taxa de esforço abaixo dos 35%.'
          : '💡 With an average income, this payment is possible but demanding. Keep the effort rate below 35%.';
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
        status.textContent = currentLang === 'pt' ? '🟢 Muito bom — estás quase pronto!' : '🟢 Very good — you\'re almost ready!';
      } else if (gaugeScore >= 40) {
        status.textContent = currentLang === 'pt' ? '🟡 A caminho — continua a poupar.' : '🟡 On the way — keep saving.';
      } else {
        status.textContent = currentLang === 'pt' ? '🔴 Ainda no início — foca-te na poupança.' : '🔴 Still early — focus on saving.';
      }

      const hint = document.getElementById('aff-hint');
      if (maxProperty < 100000) {
        hint.textContent = currentLang === 'pt'
          ? '💡 Com este rendimento, explora zonas mais acessíveis ou considera co-titular o crédito para aumentar a capacidade.'
          : '💡 With this income, explore more affordable areas or consider co-borrowing to increase capacity.';
      } else {
        hint.textContent = currentLang === 'pt'
          ? '💡 Este é um cenário estimado com prazo de 30 anos e taxa de esforço de 35%. O valor real depende do banco.'
          : '💡 This is an estimated scenario with a 30-year term and 35% effort rate. The actual value depends on the bank.';
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
        hint.textContent = currentLang === 'pt' ? '🎉 Já tens poupanças suficientes para a entrada! Próximo passo: pré-aprovação bancária.' : '🎉 You already have enough savings for the deposit! Next step: bank pre-approval.';
      } else if (months <= 24) {
        hint.textContent = currentLang === 'pt' ? '💪 Estás perto! Mantém a consistência e vais conseguir.' : '💪 You\'re close! Stay consistent and you\'ll get there.';
      } else {
        hint.textContent = currentLang === 'pt' ? '📊 Para acelerar, tenta aumentar a poupança mensal em €100 ou considerar o programa de Garantia Pública.' : '📊 To speed up, try increasing monthly savings by €100 or consider the Public Guarantee program.';
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

    document.getElementById('step-modal-close').addEventListener('click', closeStepModal);

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

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // Simulate submission
      success.style.display = 'block';
      form.reset();
      setTimeout(() => { success.style.display = 'none'; }, 5000);
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
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y < window.innerHeight) {
        circles.forEach((c, i) => {
          const speed = (i + 1) * 0.03;
          c.style.transform = `translateY(${y * speed}px)`;
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
    initSimulators();
    renderLearnCards();
    initLearnTabs();
    initLearnModal();
    initFAQ();
    initJourneyGuide();
    initChatbot();
    initContactForm();
    initParallax();

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
