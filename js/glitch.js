/* ============================================================
   终端乱码团块：绿色乱码字符聚成一团，带惯性和拖尾
   - 桌面：团块追鼠标（速度累积 + 阻尼，有惯性冲过再回头），追上触发彩蛋
   - 移动端：团块随机游走 + 边界反弹，点击空白处触发彩蛋
   - 彩蛋（每次打开网页仅一次）：渐变黑屏 → 从触发点乱码水花扩散
     → 逐渐变成「43」→ 黑幕淡出消失
   ============================================================ */
(function () {
    const canvas = document.getElementById('glitchCanvas');
    const ctx = canvas.getContext('2d');

    const GREEN = '#00ff41';
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\|{}[]#$%&*+=?~^@;:.,!';
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 600;
    const FONT_SIZE = isMobile ? 9 : 10;

    let W = 0, H = 0, DPR = 1;
    let inited = false;

    // ---------- 团块 ----------
    const blob = { x: 0, y: 0, vx: 0, vy: 0 };
    const BLOB_R = isMobile ? 66 : 100;
    const PARTICLE_N = isMobile ? 120 : 180;
    const particles = [];
    const wander = { x: 0, y: 0 };
    let mouse = { x: 0, y: 0 };

    // ---------- 状态 ----------
    let state = 'idle';   // idle | darken | wave | recover
    let stateTime = 0;
    let passiveTriggered = false;   // 被动触发（团块抓鼠标）仅一次
    let trigger = { x: 0.5, y: 0.5 };   // 归一化
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
        if (!inited) {
            blob.x = W / 2; blob.y = H / 2;
            mouse.x = W / 2; mouse.y = H / 2;
            wander.x = W / 2; wander.y = H / 2;
            inited = true;
        }
    }

    function spawnBlob() {
        particles.length = 0;
        for (let i = 0; i < PARTICLE_N; i++) {
            const ang = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * BLOB_R;
            particles.push({
                ox: Math.cos(ang) * r,
                oy: Math.sin(ang) * r,
                c: randomChar()
            });
        }
    }

    // ---------- 输入 ----------
    window.addEventListener('mousemove', function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }, { passive: true });

    window.addEventListener('click', function (e) {
        if (state !== 'idle') return;
        const t = e.target;
        if (t && t.closest && t.closest('a, button, summary, [role="button"], input, textarea, select')) return;
        tryActiveTrigger(e.clientX / W, e.clientY / H);
    });

    // ---------- 触发 ----------
    function startEgg(nx, ny) {
        trigger.x = nx;
        trigger.y = ny;
        state = 'darken';
        stateTime = 0;
        blackAlpha = 0;
    }

    // 主动触发（点击）：不限次数
    function tryActiveTrigger(nx, ny) {
        if (state !== 'idle') return;
        startEgg(nx, ny);
    }

    // 被动触发（桌面团块抓鼠标）：仅一次
    function tryPassiveTrigger(nx, ny) {
        if (passiveTriggered || state !== 'idle') return;
        passiveTriggered = true;
        startEgg(nx, ny);
    }

    // ---------- 团块物理（惯性） ----------
    function updateBlob(dt) {
        if (isMobile) {
            // 平滑随机游走：朝随机目标点匀速漂移（带轻微惯性），到达/定期换目标，边界反弹
            const margin = BLOB_R * 1.1;
            if (Math.random() < 0.015) {
                wander.x = margin + Math.random() * (W - margin * 2);
                wander.y = margin + Math.random() * (H - margin * 2);
            }
            const dx = wander.x - blob.x;
            const dy = wander.y - blob.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 12) {
                wander.x = margin + Math.random() * (W - margin * 2);
                wander.y = margin + Math.random() * (H - margin * 2);
            }
            const SPEED = 80;   // px/s，缓慢漂移
            if (dist > 1) {
                const tvx = (dx / dist) * SPEED;
                const tvy = (dy / dist) * SPEED;
                blob.vx += (tvx - blob.vx) * 0.06;
                blob.vy += (tvy - blob.vy) * 0.06;
            }
            if (blob.x < margin) { blob.x = margin; wander.x = margin + Math.random() * W; }
            if (blob.x > W - margin) { blob.x = W - margin; wander.x = Math.random() * (W - margin); }
            if (blob.y < margin) { blob.y = margin; wander.y = margin + Math.random() * H; }
            if (blob.y > H - margin) { blob.y = H - margin; wander.y = Math.random() * (H - margin); }
        } else {
            // 追鼠标（速度累积 + 阻尼，冲过头再回头）
            blob.vx += (mouse.x - blob.x) * 1.5 * dt;
            blob.vy += (mouse.y - blob.y) * 1.5 * dt;
            blob.vx *= 0.90;
            blob.vy *= 0.90;
            const sp = Math.hypot(blob.vx, blob.vy);
            const MAXV = 900;
            if (sp > MAXV) { blob.vx *= MAXV / sp; blob.vy *= MAXV / sp; }
        }
        blob.x += blob.vx * dt;
        blob.y += blob.vy * dt;

        // 字符 glitch 闪烁
        for (let k = 0; k < 3; k++) {
            particles[(Math.random() * particles.length) | 0].c = randomChar();
        }

        // 桌面：团块追上鼠标被动触发（仅一次）
        if (!isMobile) {
            if (Math.hypot(blob.x - mouse.x, blob.y - mouse.y) < BLOB_R * 0.45) {
                tryPassiveTrigger(blob.x / W, blob.y / H);
            }
        }
    }

    function drawBlob() {
        ctx.fillStyle = GREEN;
        ctx.font = FONT_SIZE + 'px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.fillText(p.c, blob.x + p.ox, blob.y + p.oy);
        }
    }

    // ---------- 彩蛋：水花 ----------
    function spawnWave() {
        wave.length = 0;
        const n = isMobile ? 160 : 240;
        for (let i = 0; i < n; i++) {
            wave.push({
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
    }

    function updateWave(dt) {
        for (let i = 0; i < wave.length; i++) {
            const p = wave[i];
            p.life += dt;
            if (p.life < p.born) continue;
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
        const cx = trigger.x * W;
        const cy = trigger.y * H;
        for (let i = 0; i < wave.length; i++) {
            const p = wave[i];
            if (p.life < p.born) continue;
            const x = cx + Math.cos(p.ang) * p.r * W;
            const y = cy + Math.sin(p.ang) * p.r * H;
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
            if (stateTime > 0.6) { state = 'wave'; stateTime = 0; spawnWave(); }
        } else if (state === 'wave') {
            blackAlpha = 1;
            updateWave(dt);
            if (stateTime > 2.4) { state = 'recover'; stateTime = 0; }
        } else if (state === 'recover') {
            blackAlpha = Math.max(0, 1 - stateTime / 1.0);
            updateWave(dt);
            if (stateTime > 1.0) { state = 'idle'; stateTime = 0; wave.length = 0; }
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

    // ---------- 主循环 ----------
    let last = performance.now();

    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;

        if (state === 'idle') {
            // 拖尾：逐帧擦除（磷光残影，保持透明不盖背景）
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'source-over';
            updateBlob(dt);
            drawBlob();
        } else {
            ctx.clearRect(0, 0, W, H);
            updateEgg(dt);
            drawEgg();
        }

        requestAnimationFrame(frame);
    }

    // ---------- 启动 ----------
    resize();
    spawnBlob();
    wander.x = Math.random() * W;
    wander.y = Math.random() * H;
    window.addEventListener('resize', resize, { passive: true });
    requestAnimationFrame(frame);
})();
