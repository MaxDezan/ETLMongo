/**
 * Dashboard App — Adaptive Prototype
 * -----------------------------------
 * Fetches pre-computed metrics from the /metricas aggregate endpoint.
 * Satisfaction averages use only formatted data (metricas with nota_0_a_5).
 * Total counts reflect ALL responses, including unformatted ones.
 */

(() => {
    'use strict';

    // ── Config ──────────────────────────────────────────────────
    const API_URL = '/metricas';
    const FALLBACK_API_URL = '/respostas';
    const CHART_COLORS = [
        'hsl(245, 70%, 65%)',
        'hsl(280, 65%, 60%)',
        'hsl(200, 75%, 55%)',
        'hsl(160, 60%, 50%)',
        'hsl(38,  90%, 58%)',
        'hsl(340, 70%, 58%)',
        'hsl(170, 55%, 48%)',
        'hsl(20,  80%, 55%)',
    ];

    // ── Mock Data (used when API is unavailable) ────────────────
    const MOCK_DATA = {
        total: 347,
        dados: generateMockResponses(347),
    };

    function generateMockResponses(count) {
        const categories = {
            'Infraestrutura':        { weight: 0.22, sentiments: [4, 3, 5, 2, 4, 3, 5, 4] },
            'Atendimento':           { weight: 0.19, sentiments: [5, 4, 5, 5, 4, 3, 5, 4] },
            'Limpeza':               { weight: 0.15, sentiments: [4, 5, 4, 3, 5, 4, 4, 5] },
            'Segurança':             { weight: 0.13, sentiments: [3, 4, 3, 2, 4, 3, 3, 4] },
            'Acessibilidade':        { weight: 0.10, sentiments: [3, 2, 4, 3, 3, 2, 4, 3] },
            'Transporte':            { weight: 0.09, sentiments: [4, 3, 4, 3, 4, 5, 3, 4] },
            'Alimentação':           { weight: 0.07, sentiments: [5, 4, 5, 4, 5, 4, 5, 4] },
            'Comunicação':           { weight: 0.05, sentiments: [3, 4, 3, 4, 3, 2, 4, 3] },
        };

        const responses = [];
        for (const [cat, info] of Object.entries(categories)) {
            const n = Math.round(count * info.weight);
            for (let i = 0; i < n; i++) {
                responses.push({
                    categoria: cat,
                    nota: info.sentiments[i % info.sentiments.length],
                    data: randomDate(),
                });
            }
        }
        return responses;
    }

    function randomDate() {
        const start = new Date(2025, 0, 1);
        const end = new Date(2026, 5, 1);
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
            .toISOString().slice(0, 10);
    }

    // ── DOM Refs ────────────────────────────────────────────────
    const $status      = document.getElementById('connection-status');
    const $kpiTotal    = document.getElementById('kpi-total-value');
    const $kpiCats     = document.getElementById('kpi-categories-value');

    const $badgesList  = document.getElementById('badges-list');
    const $tableBody   = document.getElementById('table-body');
    const $footerYear  = document.getElementById('footer-year');

    // ── Init ────────────────────────────────────────────────────
    $footerYear.textContent = new Date().getFullYear();
    loadDashboard();

    async function loadDashboard() {
        let data;
        let source = 'mock'; // 'api' | 'mock'

        try {
            const res = await fetch(API_URL, { signal: AbortSignal.timeout(6000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            data = await res.json();
            source = 'api';
        } catch {
            console.warn('[Dashboard] API /metricas indisponível — usando dados de protótipo.');
            data = null;
        }

        if (data && source === 'api') {
            // Use the aggregate endpoint data
            setStatus(source);
            const processed = processAggregateData(data);
            renderKPIs(processed);
            renderProgressRing(processed);
            renderBadges(processed);
            renderTable(processed);
        } else {
            // Fallback to mock data
            setStatus('mock');
            const processed = processMockData(MOCK_DATA);
            renderKPIs(processed);
            renderProgressRing(processed);
            renderBadges(processed);
            renderTable(processed);
        }
    }

    // ── Status indicator ────────────────────────────────────────
    function setStatus(source) {
        const dot  = $status.querySelector('.status-dot');
        const text = $status.querySelector('.status-text');
        dot.className = 'status-dot';

        if (source === 'api') {
            dot.classList.add('status-dot--ok');
            text.textContent = 'Dados em tempo real';
        } else {
            dot.classList.add('status-dot--mock');
            text.textContent = 'Dados de demonstração';
        }
    }

    // ── Process aggregate data from /metricas endpoint ──────────
    function processAggregateData(data) {
        const totalRespondents = data.total; // ALL responses (formatted + unformatted)
        const categorias = data.categorias || [];

        // Global satisfaction from formatted data only
        const globalAvg = data.globalAvg || 0;
        const satisfactionPct = (globalAvg / 5) * 100;

        // Equipamentos satisfaction from formatted data only
        const equipAvg = data.equipAvg;
        const equipSatisfactionPct = equipAvg !== null ? (equipAvg / 5) * 100 : null;

        // Total metricas count across all formatted responses
        const totalMetricas = categorias.reduce((s, c) => s + c.count, 0);

        // Badge groups: equipment vs others based on category names
        const equipKeywords = /equipamento|recurso.?tecnol|internet|wi-?fi|cabeada|computador|laborat|ti e equip/i;
        let equipCount = 0;
        let outrosCount = 0;

        for (const cat of categorias) {
            if (equipKeywords.test(cat.name)) {
                equipCount += cat.count;
            } else {
                outrosCount += cat.count;
            }
        }

        const badgeGroups = [
            { name: 'Equipamentos', count: equipCount },
            { name: 'Outros',       count: outrosCount },
        ];

        // Categories for table — use aggregate data directly
        const K = 3; // Bayesian credibility factor
        const categories = categorias.map(cat => {
            const rawPct = (cat.avgNota / 5) * 100;
            const weightedPct = ((cat.count * rawPct) + (K * satisfactionPct)) / (cat.count + K);

            return {
                name: cat.name,
                count: cat.count,
                pct: totalMetricas > 0 ? ((cat.count / totalMetricas) * 100) : 0,
                satisfaction: weightedPct,
            };
        });

        const totalCategories = categories.length;

        return { total: totalRespondents, categories, badgeGroups, satisfactionPct, equipSatisfactionPct, totalCategories };
    }

    // ── Process mock data (fallback) ────────────────────────────
    function processMockData(raw) {
        const docs = raw.dados || [];
        const totalRespondents = raw.total || docs.length;

        const tally = {};
        const categoryScores = {};

        for (const doc of docs) {
            const cat = doc.categoria || 'Outros';
            tally[cat] = (tally[cat] || 0) + 1;

            if (!categoryScores[cat]) categoryScores[cat] = [];
            categoryScores[cat].push(doc.nota || 3);
        }

        const allScores = docs.map(d => d.nota || 3);
        const globalAvgScore = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length) : 3;
        const globalAvgPct = (globalAvgScore / 5) * 100;

        const K = 3;
        const totalDocsCount = docs.length;
        const categories = Object.entries(tally)
            .map(([name, count]) => {
                const scores = categoryScores[name] || [];
                const avgScore = scores.reduce((a, b) => a + b, 0) / count;
                const rawPct = (avgScore / 5) * 100;
                const weightedPct = ((count * rawPct) + (K * globalAvgPct)) / (count + K);

                return {
                    name,
                    count,
                    pct: totalDocsCount > 0 ? ((count / totalDocsCount) * 100) : 0,
                    satisfaction: weightedPct,
                };
            })
            .sort((a, b) => b.count - a.count);

        const satisfactionPct = globalAvgPct;

        const badgeGroups = [
            { name: 'Equipamentos', count: 0 },
            { name: 'Outros',       count: totalDocsCount },
        ];

        const totalCategories = Object.keys(tally).length;

        return { total: totalRespondents, categories, badgeGroups, satisfactionPct, equipSatisfactionPct: null, totalCategories };
    }

    // ── Render: KPIs ────────────────────────────────────────────
    function renderKPIs({ total, totalCategories }) {
        animateCounter($kpiTotal, total);
        animateCounter($kpiCats, totalCategories);
    }

    function animateCounter(el, target) {
        const duration = 800;
        const start = performance.now();

        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(eased * target).toLocaleString('pt-BR');
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // ── Render: Progress Rings ───────────────────────────────────
    function renderProgressRing({ satisfactionPct, equipSatisfactionPct }) {
        // General ring
        animateRing(
            document.getElementById('progress-ring-fill'),
            document.getElementById('progress-ring-value'),
            satisfactionPct
        );
        // Equipamentos ring
        animateRing(
            document.getElementById('progress-ring-equip-fill'),
            document.getElementById('progress-ring-equip-value'),
            equipSatisfactionPct
        );
    }

    function animateRing(fill, text, rawPct) {
        const pct = rawPct !== null ? rawPct : 0;

        // Circle math
        const radius = 85;
        const circumference = 2 * Math.PI * radius; // ≈ 534.07
        const offset = circumference - (pct / 100) * circumference;

        // Animate after a short delay for visual impact
        requestAnimationFrame(() => {
            setTimeout(() => {
                fill.style.strokeDashoffset = offset;
            }, 200);
        });

        // Animate the percentage text
        animatePercentage(text, pct);
    }

    function animatePercentage(el, target) {
        const duration = 1400;
        const start = performance.now();

        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * target;
            el.textContent = current.toFixed(1) + '%';
            if (progress < 1) requestAnimationFrame(tick);
        }
        // Small delay to sync with ring animation
        setTimeout(() => requestAnimationFrame(tick), 200);
    }

    // ── Render: Badges ──────────────────────────────────────────
    function renderBadges({ badgeGroups, total }) {
        $badgesList.innerHTML = '';

        badgeGroups.forEach((group, i) => {
            const badge = document.createElement('span');
            badge.className = `badge badge--${(i % 8) + 1}`;
            badge.style.animationDelay = `${i * 60 + 300}ms`;
            badge.innerHTML = `
                ${escapeHtml(group.name)}
                <span class="badge__count">${group.count}</span>
            `;
            const pct = total > 0 ? ((group.count / total) * 100).toFixed(1) : '0.0';
            badge.title = `${pct}% das perguntas`;
            $badgesList.appendChild(badge);
        });
    }

    // ── Render: Table ───────────────────────────────────────────
    function renderTable({ categories }) {
        $tableBody.innerHTML = '';

        categories.forEach((cat, i) => {
            const tr = document.createElement('tr');
            const color = CHART_COLORS[i % CHART_COLORS.length];
            const satisfactionPct = cat.satisfaction != null ? cat.satisfaction : 0;

            tr.innerHTML = `
                <td>
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle;"></span>
                    ${escapeHtml(cat.name)}
                </td>
                <td><strong>${cat.count}</strong></td>
                <td>${cat.pct.toFixed(1)}%</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-weight:600;min-width:35px;color:var(--clr-text-muted);">${satisfactionPct.toFixed(0)}%</span>
                        <div class="progress-bar" title="Satisfação de ${cat.name}: ${satisfactionPct.toFixed(1)}% (suavizada por volume: ${cat.count} respostas)">
                            <div class="progress-bar__fill" style="width:${satisfactionPct}%;background:${color};"></div>
                        </div>
                    </div>
                </td>
            `;
            $tableBody.appendChild(tr);
        });
    }

    // ── Utils ───────────────────────────────────────────────────
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
})();
