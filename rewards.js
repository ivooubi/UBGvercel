/* UBGames.88 · Recompensas (misiones, logros, tienda). Cargar DESPUÉS del script principal. */
(function () {
    'use strict';
    if (!window.sb || !window.Arcade) { console.warn('rewards.js: falta window.sb / window.Arcade'); return; }
    const sb = window.sb;
    const $ = (id) => document.getElementById(id);
    const el = (tag, cls, txt) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (txt != null) e.textContent = txt;
        return e;
    };
    const fmt = (s) => {
        const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60);
        return hh ? hh + ' h ' + mm + ' min' : mm + ' min';
    };
    function toast(t) {
        const n = $('arcade-toast');
        n.textContent = t;
        n.classList.add('show');
        clearTimeout(toast.t);
        toast.t = setTimeout(() => n.classList.remove('show'), 3500);
    }

    /* ---------- Estilos ---------- */
    const style = el('style');
    style.textContent = `
.r-body{width:min(860px,92%);padding-bottom:120px}
.r-tabs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px}
.r-tab{background:none;border:1px solid rgba(128,128,128,.4);color:var(--text-color);padding:8px 16px;border-radius:20px;font:900 .75rem Montserrat,sans-serif;text-transform:uppercase;cursor:pointer;opacity:.6}
.r-tab.on{opacity:1;border-color:var(--text-color)}
.r-stats{text-align:center;font-size:.8rem;font-weight:700;opacity:.7;margin-bottom:16px}
.r-list{display:grid;gap:10px}
.r-shop{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.r-card{background:var(--card-bg);border:1px solid rgba(128,128,128,.2);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px}
.r-row{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:.85rem}
.r-reward{font-size:.7rem;font-weight:700;opacity:.8;white-space:nowrap}
.r-sub{font-size:.7rem;opacity:.7}
.r-bar{height:8px;border-radius:4px;background:rgba(128,128,128,.25);overflow:hidden}
.r-fill{height:100%;background:var(--accent-ia);transition:width .4s}
.r-swatch{height:70px;border-radius:8px;border:1px solid rgba(128,128,128,.3)}
.r-empty{text-align:center;opacity:.6}
body.layout-compact #games-section .games-container{grid-template-columns:repeat(5,160px);gap:10px}
body.layout-compact #games-section .game-card{padding:12px 6px}
body.layout-neon #games-section .game-card{border-color:var(--accent-ia);box-shadow:0 0 14px var(--accent-ia)}
body.layout-big #games-section .games-container{grid-template-columns:repeat(2,340px)}
body.layout-big #games-section .game-card{padding:44px 10px}
@media(max-width:850px){
 body.layout-compact #games-section .games-container,body.layout-big #games-section .games-container{grid-template-columns:repeat(2,1fr)}
}`;
    document.head.appendChild(style);

    /* ---------- Sidebar y secciones ---------- */
    const side = $('sidebar');
    const logoutItem = side.lastElementChild;
    function addSide(id, label) {
        const d = el('div', 'sidebar-item', label);
        d.id = 'btn-' + id;
        d.onclick = () => showSection(id);
        side.insertBefore(d, logoutItem);
    }
    function addSection(id, title) {
        const s = el('section', 'section');
        s.id = id + '-section';
        s.append(el('h1', 'main-title', title));
        const body = el('div', 'r-body');
        s.append(body);
        $('main-content').append(s);
        return body;
    }
    addSide('rewards', 'Misiones y logros');
    addSide('shop', 'Tienda');
    const rBody = addSection('rewards', 'Misiones y logros');
    const sBody = addSection('shop', 'Tienda');
    const eBody = addSection('early', 'Acceso anticipado');
    let earlyBtn = false;

    /* ---------- Estado ---------- */
    let state = null, tabR = 'mission', tabS = 'background';
    const ready = new Set();

    function scan(announce) {
        if (!state) return;
        state.quests.forEach((q) => {
            if (q.progress >= q.target && !q.claimed && !ready.has(q.id)) {
                ready.add(q.id);
                if (announce) toast('🎯 ¡Completada: ' + q.title + '!');
            }
        });
    }

    let loadRun = 0;
    function say(body, text) { body.replaceChildren(el('p', 'r-empty', text)); }
    async function load() {
        const run = ++loadRun;
        if (!state) [rBody, sBody, eBody].forEach((b) => say(b, 'Cargando…'));
        try {
            const { data: { session } } = await sb.auth.getSession();
            let next = null;
            if (session) {
                const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Tiempo de espera agotado')), 12000));
                const { data, error } = await Promise.race([sb.rpc('rw_get_state'), timeout]);
                if (error) throw error;
                next = data;
            }
            if (run !== loadRun) return;
            state = next;
            scan(false);
            apply();
            render();
        } catch (e) {
            if (run !== loadRun) return;
            console.warn('rewards:', e);
            state = null;
            [rBody, sBody, eBody].forEach((b) => say(b, 'No se pudo cargar: ' + (e.message || e) + ' (¿ejecutaste rewards.sql?)'));
        }
    }

    function apply() {
        document.body.className = document.body.className.split(' ').filter((c) => !c.startsWith('layout-')).join(' ');
        document.body.style.backgroundImage = '';
        document.body.style.backgroundAttachment = 'fixed';
        if (!state) return;
        state.items.filter((i) => i.equipped).forEach((i) => {
            if (i.kind === 'background' && i.data.css) document.body.style.backgroundImage = i.data.css;
            if (i.kind === 'layout' && /^layout-[a-z0-9-]+$/.test(i.data.class || '')) document.body.classList.add(i.data.class);
        });
        if (!earlyBtn && state.items.some((i) => i.kind === 'early_access' && i.owned)) {
            addSide('early', 'Anticipado');
            earlyBtn = true;
        }
    }

    /* ---------- Render ---------- */
    function tabs(list, current, pick) {
        const w = el('div', 'r-tabs');
        list.forEach(([k, label]) => {
            const b = el('button', 'r-tab' + (k === current ? ' on' : ''), label);
            b.onclick = () => pick(k);
            w.append(b);
        });
        return w;
    }

    function renderRewards() {
        rBody.replaceChildren();
        if (!state) { rBody.append(el('p', 'r-empty', 'Inicia sesión para ver tus misiones y logros.')); return; }
        rBody.append(tabs([['mission', 'Misiones diarias'], ['achievement', 'Logros']], tabR, (k) => { tabR = k; renderRewards(); }));
        rBody.append(el('div', 'r-stats',
            'Hoy: ' + fmt(state.seconds_today) + ' · ' + state.games_today + ' juego(s)   |   Total: ' +
            fmt(state.seconds_total) + ' · ' + state.games_total + ' juego(s)'));
        const list = el('div', 'r-list');
        state.quests.filter((q) => q.kind === tabR).forEach((q) => {
            const done = q.progress >= q.target;
            const c = el('div', 'r-card');
            const top = el('div', 'r-row');
            top.append(el('strong', null, q.title), el('span', 'r-reward', '+' + q.exp + ' EXP · +' + q.coins + ' 🪙'));
            const bar = el('div', 'r-bar'), fill = el('div', 'r-fill');
            fill.style.width = Math.min(100, (q.progress / q.target) * 100) + '%';
            bar.append(fill);
            const p = Math.min(q.progress, q.target);
            const row = el('div', 'r-row');
            row.append(el('span', 'r-sub', q.metric === 'seconds' ? fmt(p) + ' / ' + fmt(q.target) : p + ' / ' + q.target + ' juegos'));
            const b = el('button', 'hud-btn', q.claimed ? 'Reclamada ✓' : done ? 'Reclamar' : 'En curso');
            b.disabled = q.claimed || !done;
            b.onclick = () => claim(q);
            row.append(b);
            c.append(top, bar, row);
            list.append(c);
        });
        rBody.append(list);
    }

    function renderShop() {
        sBody.replaceChildren();
        if (!state) { sBody.append(el('p', 'r-empty', 'Inicia sesión para usar la tienda.')); return; }
        sBody.append(tabs([['background', 'Fondos'], ['layout', 'Pantalla de juegos'], ['early_access', 'Acceso anticipado']],
            tabS, (k) => { tabS = k; renderShop(); }));
        sBody.append(el('div', 'r-stats', 'Tus monedas: ' + state.coins + ' 🪙'));
        const grid = el('div', 'r-shop');
        state.items.filter((i) => i.kind === tabS).forEach((i) => {
            const c = el('div', 'r-card');
            if (i.kind === 'background') {
                const s = el('div', 'r-swatch');
                s.style.background = i.data.css || '#000';
                c.append(s);
            }
            c.append(el('strong', null, i.name), el('div', 'r-sub', i.description));
            const row = el('div', 'r-row');
            row.append(el('span', 'r-reward', i.owned ? 'Comprado' : i.price + ' 🪙'));
            let b;
            if (!i.owned) {
                b = el('button', 'hud-btn', 'Comprar');
                b.disabled = state.coins < i.price;
                b.onclick = () => buy(i);
            } else if (i.kind === 'early_access') {
                b = el('button', 'hud-btn', 'Desbloqueado ✓');
                b.disabled = true;
            } else {
                b = el('button', 'hud-btn', i.equipped ? 'Quitar' : 'Equipar');
                b.onclick = () => equip(i, !i.equipped);
            }
            row.append(b);
            c.append(row);
            grid.append(c);
        });
        sBody.append(grid);
    }

    function renderEarly() {
        eBody.replaceChildren();
        const games = state ? state.items.filter((i) => i.kind === 'early_access' && i.owned).flatMap((i) => i.data.games || []) : [];
        if (!games.length) { eBody.append(el('p', 'r-empty', 'Aún no tienes acceso anticipado.')); return; }
        const g = el('div', 'games-container');
        games.forEach((x) => {
            const c = el('div', 'game-card');
            c.append(el('h3', null, x.name));
            c.onclick = () => openGame(x.url);
            g.append(c);
        });
        eBody.append(g);
    }

    function render() { renderRewards(); renderShop(); renderEarly(); }

    /* ---------- Acciones ---------- */
    async function after() { await load(); if (window.renderHud) window.renderHud(); }

    async function claim(q) {
        const { data, error } = await sb.rpc('rw_claim_quest', { p_id: q.id });
        if (error) return toast(error.message);
        toast('+' + data.exp + ' EXP · +' + data.coins + ' monedas');
        after();
    }
    async function buy(i) {
        if (!confirm('¿Comprar "' + i.name + '" por ' + i.price + ' monedas?')) return;
        const { error } = await sb.rpc('rw_buy_item', { p_id: i.id });
        if (error) return toast(error.message);
        toast('Comprado: ' + i.name);
        after();
    }
    async function equip(i, on) {
        const { error } = await sb.rpc('rw_equip_item', { p_id: i.id, p_equip: on });
        if (error) return toast(error.message);
        after();
    }

    /* ---------- Seguimiento de juego ---------- */
    let beat = null;
    const present = () => document.visibilityState === 'visible' && document.hasFocus();
    function slug(url) {
        try {
            const u = new URL(url);
            return (u.hostname + u.pathname).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'juego';
        } catch (e) { return 'juego'; }
    }
    async function tick() {
        if (!present()) return;
        try {
            await sb.rpc('rw_heartbeat');
            const { data } = await sb.rpc('rw_get_state');
            if (data) { state = data; scan(true); }
        } catch (e) { console.warn('rewards tick:', e.message || e); }
    }

    const startOrig = Arcade.startGame, stopOrig = Arcade.stopGame;
    Arcade.startGame = async function (url) {
        await startOrig(url);
        try {
            const { data: { session } } = await sb.auth.getSession();
            if (!session) return;
            await sb.rpc('rw_game_start', { p_slug: slug(url) });
            clearInterval(beat);
            beat = setInterval(tick, 30000);
        } catch (e) { console.warn('rewards start:', e.message || e); }
    };
    Arcade.stopGame = async function () {
        if (beat) {
            clearInterval(beat);
            beat = null;
            try { await sb.rpc('rw_game_end'); } catch (e) { /* ignorar */ }
        }
        await stopOrig();
    };

    /* ---------- Integración ---------- */
    const showOrig = window.showSection;
    window.showSection = function (id) {
        showOrig(id);
        if (['rewards', 'shop', 'early'].includes(id)) load();
    };
    let authTimer = null;
    sb.auth.onAuthStateChange(() => { clearTimeout(authTimer); authTimer = setTimeout(load, 300); });
    load();
})();
