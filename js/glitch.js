/* ============================================================
   终端乱码交互：绿色乱码字符串缓慢追鼠标，
   追上后满屏「43」，几秒后从边界向中间以乱码方式恢复
   ============================================================ */
(function () {
    const canvas = document.getElementById('glitchCanvas');
    const ctx = canvas.getContext('2d');

    const GREEN = '#00ff41';
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789<>/\\|{}[]#$%&*+=?~^@;:.,!43';
    const FONT = '16px "Courier New", monospace';
    const CELL = 26;          // 满屏 43 的网格单元大小
    const SNAKE_N = 30;       // 追鼠标的字符串长度
    const SEG = 16;           // 字符间距 px
    const CATCH_DIST = 18;    // 抓到判定距离 px

    let W = 0, H = 0, DPR = 1;
    let mouse = { x: 0, y: 0 };
    let mouseInit = false;
    const SNAKE = [];

    let state = 'chase';      // chase | fill | full | recover
    let stateTime = 0;
    let trigger = { x: 0, y: 0 };

    let tile43 = null;

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
        if (!mouseInit) { mouse.x = W / 2; mouse.y = H / 2; mouseInit = true; }
        buildTile();
    }

    // 预渲染一个「43」小块，满屏铺贴时用 drawImage 更省
    function buildTile() {
        tile43 = document.createElement('canvas');
        tile43.width = Math.ceil(CELL * DPR);
        tile43.height = Math.ceil(CELL * DPR);
        const t = tile43.getContext('2d');
        t.setTransform(DPR, 0, 0, DPR, 0, 0);
        t.fillStyle = GREEN;
        t.font = FONT;
        t.textAlign = 'center';
        t.textBaseline = 'middle';
        t.fillText('43', CELL / 2, CELL / 2);
    }

    // 生成一条从鼠标附近延伸出去、且头不贴鼠标的蛇
    function spawnSnake() {
        SNAKE.length = 0;
        const ang = Math.random() * Math.PI * 2;
        const dist = 130 + Math.random() * 90;
        let hx = Math.min(W - 10, Math.max(10, mouse.x + Math.cos(ang) * dist));
        let hy = Math.min(H - 10, Math.max(10, mouse.y + Math.sin(ang) * dist));
        for (let i = 0; i < SNAKE_N; i++) {
            SNAKE.push({
                x: hx - Math.cos(ang) * SEG * i,
                y: hy - Math.sin(ang) * SEG * i,
                c: randomChar()
            });
        }
    }

    // ---------- 输入 ----------
    window.addEventListener('mousemove', function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouseInit = true;
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
        if (e.touches.length) {
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
            mouseInit = true;
        }
    }, { passive: true });

    // ---------- 追鼠标 ----------
    function updateChase() {
        const head = SNAKE[0];
        head.x += (mouse.x - head.x) * 0.025;
        head.y += (mouse.y - head.y) * 0.025;
        for (let i = 1; i < SNAKE_N; i++) {
            const p = SNAKE[i - 1], c = SNAKE[i];
            const dx = p.x - c.x, dy = p.y - c.y;
            const d = Math.hypot(dx, dy) || 1;
            const move = (d - SEG) * 0.4;
            c.x += (dx / d) * move;
            c.y += (dy / d) * move;
            if (Math.random() < 0.1) c.c = randomChar();
        }
        if (Math.hypot(head.x - mouse.x, head.y - mouse.y) < CATCH_DIST) {
            trigger.x = mouse.x;
            trigger.y = mouse.y;
            state = 'fill';
            stateTime = 0;
        }
    }

    function drawSnake() {
        ctx.fillStyle = GREEN;
        ctx.font = FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < SNAKE_N; i++) {
            ctx.fillText(SNAKE[i].c, SNAKE[i].x, SNAKE[i].y);
        }
    }

    // ---------- 满屏 43 ----------
    function drawFill() {
        const p = Math.min(stateTime / 0.6, 1);
        const R = p * Math.hypot(W, H);
        const tx = trigger.x, ty = trigger.y;
        for (let gy = 0; gy < H; gy += CELL) {
            for (let gx = 0; gx < W; gx += CELL) {
                const dx = gx + CELL / 2 - tx;
                const dy = gy + CELL / 2 - ty;
                if (dx * dx + dy * dy <= R * R) {
                    ctx.drawImage(tile43, gx, gy, CELL, CELL);
                }
            }
        }
    }

    function drawFull() {
        for (let gy = 0; gy < H; gy += CELL) {
            for (let gx = 0; gx < W; gx += CELL) {
                ctx.drawImage(tile43, gx, gy, CELL, CELL);
            }
        }
    }

    // ---------- 从边界向中间乱码恢复 ----------
    function drawRecover() {
        const p = Math.min(stateTime / 1.8, 1);
        const frontier = 1 - p;
        const band = 0.12;
        ctx.font = FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let gy = 0; gy < H; gy += CELL) {
            for (let gx = 0; gx < W; gx += CELL) {
                const px = (gx + CELL / 2) / W;
                const py = (gy + CELL / 2) / H;
                const d = Math.max(Math.abs(px - 0.5) * 2, Math.abs(py - 0.5) * 2);
                if (d > frontier + band) {
                    ctx.drawImage(tile43, gx, gy, CELL, CELL);
                } else if (d > frontier) {
                    ctx.fillStyle = GREEN;
                    ctx.fillText(randomChar(), gx + CELL / 2, gy + CELL / 2);
                }
            }
        }
    }

    // ---------- 主循环 ----------
    let last = performance.now();

    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        stateTime += dt;

        ctx.clearRect(0, 0, W, H);

        switch (state) {
            case 'chase':
                updateChase();
                drawSnake();
                break;
            case 'fill':
                drawFill();
                if (stateTime > 0.6) { state = 'full'; stateTime = 0; }
                break;
            case 'full':
                drawFull();
                if (stateTime > 3.0) { state = 'recover'; stateTime = 0; }
                break;
            case 'recover':
                drawRecover();
                if (stateTime > 1.8) { state = 'chase'; stateTime = 0; spawnSnake(); }
                break;
        }

        requestAnimationFrame(frame);
    }

    // ---------- 启动 ----------
    resize();
    spawnSnake();
    window.addEventListener('resize', resize, { passive: true });
    requestAnimationFrame(frame);
})();
