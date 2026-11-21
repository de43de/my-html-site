/* ============================================================
   43 彩蛋：乱码水花（无常驻渲染）
   - 由页面按钮（右下角 43）通过 window.DEDE_EGG.burst 触发
   - 触发 → 渐变黑屏 → 从触发点乱码水花扩散 → 逐渐变成「43」
     → 黑幕淡出消失，全程约 4 秒后自动结束
   - 平时 canvas 完全空，不跑循环
   ============================================================ */
(function () {
    const canvas = document.getElementById('glitchCanvas');
    const ctx = canvas.getContext('2d');

    const GREEN = '#00ff41';
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\|{}[]#$%&*+=?~^@;:.,!';
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 600;
    const FONT_SIZE = isMobile ? 9 : 10;

    let W = 0, H = 0, DPR = 1;

    // ---------- 状态 ----------
    let state = 'idle';   // idle | darken | wave | recover
    let stateTime = 0;
    let blackAlpha = 0;
    const wave = [];

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

    // ---------- 触发 ----------
    function startEgg(nx, ny) {
        wave.length = 0;
        pushWave(nx, ny);
        state = 'darken';
        stateTime = 0;
        blackAlpha = 0;
        canvas.style.pointerEvents = 'auto';   // 黑屏期间拦截点击，防穿透到底层元素
        startLoop();
    }

    // 主动触发（按钮）：不限次数；黑屏中继续点则叠加水花（放烟花）
    function tryActiveTrigger(nx, ny) {
        if (state === 'idle') {
            startEgg(nx, ny);
        } else if (state === 'darken') {
            pushWave(nx, ny);
        } else {   // wave / recover
            pushWave(nx, ny);
            state = 'wave';
            stateTime = 0;
            blackAlpha = 1;
        }
    }

    // ---------- 水花 ----------
    const MAX_WAVE = isMobile ? 2000 : 3000;
    function pushWave(cx, cy) {
        const n = isMobile ? 280 : 420;
        for (let i = 0; i < n; i++) {
            wave.push({
                cx: cx,
                cy: cy,
                ang: Math.random() * Math.PI * 2,
                r: 0,
                speed: 0.25 + Math.random() * 0.6,
                born: Math.random() * 0.4,
                life: 0,
                switchAt: 0.5 + Math.random() * 1.0,
                c: randomChar(),
                to43: false
            });
        }
        // 连续点击叠加过多时，裁掉最老的（已淡出）粒子，防卡顿
        if (wave.length > MAX_WAVE) {
            wave.splice(0, wave.length - MAX_WAVE);
        }
    }

    function updateWave(dt) {
        for (let i = 0; i < wave.length; i++) {
            const p = wave[i];
            p.life += dt;
            if (p.life < p.born || p.life > 3.0) continue;
            p.r += p.speed * dt;
            if (p.life >= p.switchAt) {
                if (!p.to43) { p.to43 = true; p.c = '43'; }
            } else if (Math.random() < 0.25) {
                p.c = randomChar();
            }
        }
    }

    function drawWave(fade) {
        ctx.font = FONT_SIZE + 'px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < wave.length; i++) {
            const p = wave[i];
            if (p.life < p.born || p.life > 3.0) continue;
            const x = p.cx * W + Math.cos(p.ang) * p.r * W;
            const y = p.cy * H + Math.sin(p.ang) * p.r * H;
            ctx.globalAlpha = fade * Math.max(0, 1 - p.life / 3.0);
            ctx.fillStyle = GREEN;
            ctx.fillText(p.c, x, y);
        }
        ctx.globalAlpha = 1;
    }

    function updateEgg(dt) {
        stateTime += dt;
        if (state === 'darken') {
            blackAlpha = Math.min(stateTime / 0.6, 1);
            if (stateTime > 0.6) { state = 'wave'; stateTime = 0; }
        } else if (state === 'wave') {
            blackAlpha = 1;
            updateWave(dt);
            if (stateTime > 2.4) { state = 'recover'; stateTime = 0; }
        } else if (state === 'recover') {
            blackAlpha = Math.max(0, 1 - stateTime / 1.0);
            updateWave(dt);
            if (stateTime > 1.0) { state = 'idle'; stateTime = 0; wave.length = 0; canvas.style.pointerEvents = 'none'; }
        }
    }

    function drawEgg() {
        if (blackAlpha > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, ' + blackAlpha + ')';
            ctx.fillRect(0, 0, W, H);
        }
        if (state === 'wave' || state === 'recover') {
            drawWave(blackAlpha);
        }
    }

    // ---------- 循环（仅彩蛋期间运行） ----------
    let last = performance.now();
    let rafId = null;

    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        ctx.clearRect(0, 0, W, H);
        updateEgg(dt);
        drawEgg();
        if (state !== 'idle') {
            rafId = requestAnimationFrame(frame);
        } else {
            rafId = null;
        }
    }

    function startLoop() {
        if (rafId !== null) return;
        last = performance.now();
        rafId = requestAnimationFrame(frame);
    }

    // ---------- 启动 ----------
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // 暴露主动触发接口，供页面按钮调用
    window.DEDE_EGG = { burst: tryActiveTrigger };
})();
