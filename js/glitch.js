/* ============================================================
   彩蛋交互层：一次性乱码水花 → 「43」，600ms 内结束
   canvas 平时不渲染，仅在触发时短暂绘制。
   触发：底部「43」按钮、点击空白背景（夜间主题）。
   ============================================================ */
(function () {
    const canvas = document.getElementById('glitchCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\|{}[]#$%&*+=?~^@;:.,!';
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 600;
    const DURATION = 600;   // ms，一次性结束

    let W = 0, H = 0, DPR = 1;
    let burst = null;       // { x, y, t0, parts }
    let rafId = null;

    function theme() {
        return document.body.getAttribute('data-theme') === 'day' ? 'day' : 'night';
    }
    function accent() {
        return theme() === 'day' ? '#8A5A1C' : '#D9A85C';
    }
    function randomChar() {
        return CHARS[(Math.random() * CHARS.length) | 0];
    }

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.floor(W * DPR);
        canvas.height = Math.floor(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function startEgg(nx, ny) {
        resize();
        const n = isMobile ? 120 : 200;
        const parts = [];
        for (let i = 0; i < n; i++) {
            const ang = Math.random() * Math.PI * 2;
            parts.push({
                ang: ang,
                speed: 0.15 + Math.random() * 0.5,
                born: Math.random() * 0.25,
                switchAt: 0.35 + Math.random() * 0.4,
                c: randomChar(),
                to43: false
            });
        }
        burst = { x: nx, y: ny, t0: performance.now(), parts: parts };
        canvas.style.pointerEvents = 'auto';
        if (!rafId) rafId = requestAnimationFrame(frame);
    }

    function frame(now) {
        if (!burst) { rafId = null; return; }
        const dt = now - burst.t0;
        ctx.clearRect(0, 0, W, H);

        // 短暂暗化（前 40%），快速淡出
        if (dt < DURATION * 0.4) {
            ctx.fillStyle = 'rgba(20, 17, 14, ' + (0.35 * (dt / (DURATION * 0.4))) + ')';
            ctx.fillRect(0, 0, W, H);
        }

        ctx.fillStyle = accent();
        ctx.font = (isMobile ? 9 : 10) + 'px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const p = Math.min(dt / DURATION, 1);
        for (let i = 0; i < burst.parts.length; i++) {
            const pt = burst.parts[i];
            const life = p - pt.born;
            if (life < 0 || life > 1) continue;
            if (!pt.to43 && life >= pt.switchAt) {
                pt.to43 = true;
                pt.c = Math.random() < 0.5 ? '4' : '3';
            }
            const r = pt.speed * life;
            const x = burst.x * W + Math.cos(pt.ang) * r * W;
            const y = burst.y * H + Math.sin(pt.ang) * r * H;
            ctx.globalAlpha = Math.max(0, 1 - life);
            ctx.fillText(pt.c, x, y);
        }
        ctx.globalAlpha = 1;

        if (dt >= DURATION) {
            ctx.clearRect(0, 0, W, H);
            burst = null;
            rafId = null;
            canvas.style.pointerEvents = 'none';
            return;
        }
        rafId = requestAnimationFrame(frame);
    }

    // 输入：点击空白背景触发（夜间主题）
    const UI_SELECTOR = 'a, button, summary, input, textarea, select, [role="button"], ' +
        'article, h1, h2, h3, p, time, details, .hero, .stream, .footer, .tools-view, .game-view';
    window.addEventListener('click', function (e) {
        const t = e.target;
        if (t && t.closest && t.closest(UI_SELECTOR)) return;
        tryActiveTrigger(e.clientX / W, e.clientY / H);
    }, true);

    function tryActiveTrigger(nx, ny) {
        if (theme() === 'day') return;
        startEgg(nx, ny);
    }

    window.addEventListener('resize', function () {
        if (burst) resize();
    }, { passive: true });

    // 初始测量（避免首次点击时 W/H 为 0）
    resize();

    // 暴露主动触发接口，供页面按钮调用
    window.DEDE_EGG = { burst: tryActiveTrigger };
})();
