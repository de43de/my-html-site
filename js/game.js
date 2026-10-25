/* ============================================================
   俄罗斯方块：赛博霓虹风，入口 #/game
   键盘：← → 移动　↑ 旋转　↓ 软降　空格 硬降　P 暂停
   移动端：底部触控按钮（左 / 右 / 旋转 / 下 / 硬降）
   ============================================================ */
(function () {
    const view = document.getElementById('gameView');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const nextCanvas = document.getElementById('gameNextCanvas');
    const nctx = nextCanvas.getContext('2d');
    const scoreEl = document.getElementById('gameScore');
    const levelEl = document.getElementById('gameLevel');
    const linesEl = document.getElementById('gameLines');
    const startBtn = document.getElementById('gameStart');
    const overlayEl = document.getElementById('gameOverlay');
    const overTitleEl = document.getElementById('overTitle');
    const overScoreEl = document.getElementById('overScore');
    const overHintEl = document.getElementById('overHint');

    const COLS = 10, ROWS = 20, CELL = 30;
    const NEXT_CELL = 24;

    const SHAPES = {
        I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
        O: [[1, 1], [1, 1]],
        T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
        S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
        Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
        J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
        L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
    };
    const COLORS = {
        I: '#00e5ff', O: '#ffd60a', T: '#bf5af2', S: '#32d74b',
        Z: '#ff453a', J: '#0a84ff', L: '#ff9f0a'
    };
    const TYPES = Object.keys(SHAPES);

    let board = null, piece = null, nextType = null;
    let score = 0, level = 1, lines = 0;
    let running = false, over = false;
    let acc = 0, lastTime = 0, rafId = null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function setupCanvas(cv, c, w, h) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    setupCanvas(canvas, ctx, COLS * CELL, ROWS * CELL);
    setupCanvas(nextCanvas, nctx, 4 * NEXT_CELL, 4 * NEXT_CELL);

    function randomType() { return TYPES[(Math.random() * TYPES.length) | 0]; }

    function rotate(m) {
        const n = m.length, r = [];
        for (let i = 0; i < n; i++) {
            r[i] = [];
            for (let j = 0; j < n; j++) r[i][j] = m[n - 1 - j][i];
        }
        return r;
    }

    function collide(m, x, y) {
        for (let i = 0; i < m.length; i++)
            for (let j = 0; j < m[i].length; j++)
                if (m[i][j]) {
                    const nx = x + j, ny = y + i;
                    if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
                    if (ny >= 0 && board[ny][nx]) return true;
                }
        return false;
    }

    function lock() {
        const m = piece.m;
        for (let i = 0; i < m.length; i++)
            for (let j = 0; j < m[i].length; j++)
                if (m[i][j]) {
                    const ny = piece.y + i, nx = piece.x + j;
                    if (ny < 0) { gameOver(); return; }
                    board[ny][nx] = piece.type;
                }
        clearLines();
        spawn();
    }

    function clearLines() {
        let cleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
            if (board[y].every(function (c) { return c; })) {
                board.splice(y, 1);
                board.unshift(new Array(COLS).fill(0));
                cleared++; y++;
            }
        }
        if (cleared) {
            const pts = [0, 100, 300, 500, 800];
            score += (pts[cleared] || 800) * level;
            lines += cleared;
            level = Math.floor(lines / 10) + 1;
            updateHud();
        }
    }

    function spawn() {
        const type = nextType;
        nextType = randomType();
        const m = SHAPES[type];
        piece = { m: m, type: type, x: Math.floor((COLS - m[0].length) / 2), y: 0 };
        drawNext();
        if (collide(m, piece.x, piece.y)) gameOver();
    }

    function updateHud() {
        scoreEl.textContent = score;
        levelEl.textContent = level;
        linesEl.textContent = lines;
    }

    function gameOver() {
        over = true; running = false;
        overTitleEl.textContent = 'GAME OVER';
        overScoreEl.textContent = '得分 ' + score;
        overHintEl.textContent = '空格键重新开始';
        overlayEl.classList.add('show');
    }

    function togglePause() {
        if (over) return;
        running = !running;
        if (running) {
            lastTime = performance.now(); acc = 0;
            overlayEl.classList.remove('show');
        } else {
            overTitleEl.textContent = '已暂停';
            overScoreEl.textContent = '';
            overHintEl.textContent = '按 P 继续';
            overlayEl.classList.add('show');
        }
    }

    function start() {
        board = new Array(ROWS).fill(0).map(function () { return new Array(COLS).fill(0); });
        score = 0; level = 1; lines = 0; over = false; running = true;
        nextType = randomType();
        updateHud();
        overlayEl.classList.remove('show');
        spawn();
        acc = 0; lastTime = performance.now();
        if (!rafId) rafId = requestAnimationFrame(loop);
    }

    function step() {
        if (!running) return;
        if (collide(piece.m, piece.x, piece.y + 1)) lock();
        else piece.y++;
    }
    function move(dx) {
        if (!running) return;
        if (!collide(piece.m, piece.x + dx, piece.y)) piece.x += dx;
    }
    function tryRotate() {
        if (!running) return;
        const r = rotate(piece.m);
        if (!collide(r, piece.x, piece.y)) { piece.m = r; return; }
        if (!collide(r, piece.x - 1, piece.y)) { piece.x--; piece.m = r; return; }
        if (!collide(r, piece.x + 1, piece.y)) { piece.x++; piece.m = r; return; }
    }
    function hardDrop() {
        if (!running) return;
        let d = 0;
        while (!collide(piece.m, piece.x, piece.y + 1)) { piece.y++; d++; }
        score += d * 2;
        updateHud();
        lock();
    }

    // ---------- 渲染 ----------
    function drawCell(c, x, y, color, cell) {
        c.fillStyle = color;
        c.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
        c.fillStyle = 'rgba(255, 255, 255, 0.22)';
        c.fillRect(x * cell + 1, y * cell + 1, cell - 2, 4);
    }

    function draw() {
        ctx.clearRect(0, 0, COLS * CELL, ROWS * CELL);

        // 网格线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        for (let x = 1; x < COLS; x++) {
            ctx.beginPath(); ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, ROWS * CELL); ctx.stroke();
        }
        for (let y = 1; y < ROWS; y++) {
            ctx.beginPath(); ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(COLS * CELL, y * CELL + 0.5); ctx.stroke();
        }

        // 已锁定
        for (let y = 0; y < ROWS; y++)
            for (let x = 0; x < COLS; x++)
                if (board[y][x]) drawCell(ctx, x, y, COLORS[board[y][x]], CELL);

        // 当前方块
        if (piece) {
            const m = piece.m;
            for (let i = 0; i < m.length; i++)
                for (let j = 0; j < m[i].length; j++)
                    if (m[i][j]) {
                        const ny = piece.y + i, nx = piece.x + j;
                        if (ny >= 0) drawCell(ctx, nx, ny, COLORS[piece.type], CELL);
                    }
        }
    }

    function drawNext() {
        nctx.clearRect(0, 0, 4 * NEXT_CELL, 4 * NEXT_CELL);
        const m = SHAPES[nextType];
        const ox = (4 - m[0].length) / 2, oy = (4 - m.length) / 2;
        for (let i = 0; i < m.length; i++)
            for (let j = 0; j < m[i].length; j++)
                if (m[i][j]) drawCell(nctx, ox + j, oy + i, COLORS[nextType], NEXT_CELL);
    }

    function loop(now) {
        rafId = requestAnimationFrame(loop);
        if (!running) return;
        acc += now - lastTime;
        lastTime = now;
        const speed = Math.max(70, 800 - (level - 1) * 70);
        if (acc >= speed) { acc = 0; step(); }
        draw();
    }

    // ---------- 输入 ----------
    window.addEventListener('keydown', function (e) {
        if (location.hash !== '#/game') return;
        if (e.key === 'Escape') { closeGame(); return; }
        if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].indexOf(e.key) >= 0) e.preventDefault();
        if (over) {
            if (e.key === ' ' || e.key === 'Enter') start();
            return;
        }
        switch (e.key) {
            case 'ArrowLeft': move(-1); break;
            case 'ArrowRight': move(1); break;
            case 'ArrowDown': step(); break;
            case 'ArrowUp': tryRotate(); break;
            case ' ': hardDrop(); break;
            case 'p': case 'P': togglePause(); break;
        }
    });

    document.getElementById('gameControls').addEventListener('click', function (e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (over) { start(); return; }
        const act = btn.getAttribute('data-act');
        if (act === 'left') move(-1);
        else if (act === 'right') move(1);
        else if (act === 'rotate') tryRotate();
        else if (act === 'down') step();
        else if (act === 'drop') hardDrop();
    });

    startBtn.addEventListener('click', start);
    overlayEl.addEventListener('click', function () {
        if (over) start();
        else togglePause();
    });

    // ---------- 路由 ----------
    const glitchCanvas = document.getElementById('glitchCanvas');
    function isOverlay() {
        return location.hash === '#/tools' || location.hash === '#/game';
    }
    function closeGame() {
        if (location.hash === '#/game') {
            if (window.history.length > 1) history.back();
            else location.hash = '';
        }
    }
    function applyRoute() {
        const open = location.hash === '#/game';
        view.classList.toggle('open', open);
        document.body.style.overflow = isOverlay() ? 'hidden' : '';
        if (glitchCanvas) glitchCanvas.style.display = isOverlay() ? 'none' : '';
        if (open) {
            if (!board) start();                       // 首次打开自动开始
            else if (!over && !running) {              // 之前暂停，恢复
                running = true; lastTime = performance.now(); acc = 0;
            }
        } else {
            running = false;                            // 关闭面板即暂停
        }
    }
    window.addEventListener('hashchange', applyRoute);
    document.getElementById('gameClose').addEventListener('click', closeGame);

    applyRoute();
})();
