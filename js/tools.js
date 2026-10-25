/* ============================================================
   实用小工具：IP 查询 / JSON 格式化 / 时间戳 / Base64 / URL / 密码
   纯前端离线可用（IP 查询需联网调免费接口）；入口 #/tools
   ============================================================ */
(function () {
    const view = document.getElementById('toolsView');
    const tabsEl = document.getElementById('toolsTabs');
    const bodyEl = document.getElementById('toolsBody');

    // ---------- 通用复制 ----------
    function copyText(text, btn) {
        function done() {
            if (!btn) return;
            const old = btn.textContent;
            btn.textContent = '已复制';
            setTimeout(function () { btn.textContent = old; }, 1200);
        }
        function fallback() {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;top:-999px;opacity:0;';
            document.body.appendChild(ta);
            ta.select();
            try { if (document.execCommand('copy')) done(); } catch (e) {}
            document.body.removeChild(ta);
        }
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done).catch(fallback);
        } else {
            fallback();
        }
    }

    // ---------- IP 查询 ----------
    function ipHtml() {
        return '<div class="tool-pane">' +
            '<div class="tool-block"><div class="tool-label">公网 IP</div>' +
            '<div class="ip-line"><span id="ipPub" class="mono">查询中…</span><button class="mini-btn" id="ipCopyBtn">复制</button></div></div>' +
            '<div class="tool-block"><div class="tool-label">归属信息</div><div id="ipDetail" class="ip-detail">加载中…</div></div>' +
            '<div class="tool-block"><div class="tool-label">本机环境</div><div id="ipLocal" class="ip-detail"></div></div>' +
            '</div>';
    }
    function initIp(root) {
        const pub = root.querySelector('#ipPub');
        const detail = root.querySelector('#ipDetail');
        const local = root.querySelector('#ipLocal');
        local.innerHTML =
            'UA：' + navigator.userAgent + '<br>' +
            '语言：' + (navigator.language || '未知') + '<br>' +
            '屏幕：' + screen.width + ' × ' + screen.height + '<br>' +
            '时区：' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '未知') + '<br>' +
            '触屏：' + (navigator.maxTouchPoints > 0 ? '是（' + navigator.maxTouchPoints + ' 点）' : '否') + '<br>' +
            '在线：' + (navigator.onLine ? '是' : '否');
        function setIp(text, desc) { pub.textContent = text; detail.textContent = desc; }
        fetch('https://ipapi.co/json/', { cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d && d.ip) {
                    const parts = [d.city, d.region, d.country_name, d.org, d.timezone].filter(Boolean);
                    setIp(d.ip, parts.join(' · '));
                } else { throw new Error('empty'); }
            })
            .catch(function () {
                fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
                    .then(function (r) { return r.json(); })
                    .then(function (d) { setIp(d.ip, '仅获取到 IP'); })
                    .catch(function () { setIp('获取失败', '网络不可用或接口被限'); });
            });
        root.querySelector('#ipCopyBtn').addEventListener('click', function (e) {
            const v = pub.textContent;
            if (v && v !== '查询中…' && v !== '获取失败') copyText(v, e.target);
        });
        return null;
    }

    // ---------- JSON ----------
    function jsonHtml() {
        return '<div class="tool-pane">' +
            '<textarea id="jsonIn" class="tool-area" rows="7" placeholder="粘贴 JSON…" spellcheck="false"></textarea>' +
            '<div class="tool-row">' +
            '<button class="mini-btn" data-act="fmt">格式化</button>' +
            '<button class="mini-btn" data-act="min">压缩</button>' +
            '<button class="mini-btn" data-act="clear">清空</button>' +
            '<button class="mini-btn" data-act="copy">复制结果</button>' +
            '</div><pre id="jsonOut" class="tool-out"></pre></div>';
    }
    function initJson(root) {
        const input = root.querySelector('#jsonIn');
        const out = root.querySelector('#jsonOut');
        root.querySelector('.tool-row').addEventListener('click', function (e) {
            const btn = e.target.closest('.mini-btn');
            if (!btn) return;
            const act = btn.getAttribute('data-act');
            if (act === 'clear') { input.value = ''; out.textContent = ''; out.classList.remove('err'); return; }
            if (act === 'copy') { if (out.textContent) copyText(out.textContent, btn); return; }
            const raw = input.value.trim();
            if (!raw) { out.textContent = '（空）'; out.classList.remove('err'); return; }
            try {
                const obj = JSON.parse(raw);
                out.textContent = act === 'fmt' ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
                out.classList.remove('err');
            } catch (err) {
                out.textContent = 'JSON 解析失败：' + err.message;
                out.classList.add('err');
            }
        });
        return null;
    }

    // ---------- 时间戳 ----------
    function tsHtml() {
        return '<div class="tool-pane">' +
            '<div class="tool-block"><div class="tool-label">当前时间戳</div>' +
            '<div class="ip-line"><span id="tsNow" class="mono"></span><button class="mini-btn" id="tsNowCopy">复制</button></div></div>' +
            '<div class="tool-block"><div class="tool-label">时间戳 → 日期（秒或毫秒）</div>' +
            '<input id="tsIn" class="tool-input" placeholder="如 1760000000 或 1760000000000"><div id="tsOut" class="tool-out"></div></div>' +
            '<div class="tool-block"><div class="tool-label">日期 → 时间戳</div>' +
            '<input id="dtIn" class="tool-input" type="datetime-local"><div id="dtOut" class="tool-out"></div></div>' +
            '</div>';
    }
    function fmtDate(d) {
        function p(n) { return n < 10 ? '0' + n : '' + n; }
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
            p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
    }
    function initTs(root) {
        const nowEl = root.querySelector('#tsNow');
        const inEl = root.querySelector('#tsIn');
        const outEl = root.querySelector('#tsOut');
        const dtIn = root.querySelector('#dtIn');
        const dtOut = root.querySelector('#dtOut');
        function tick() {
            const now = Date.now();
            nowEl.textContent = now + '（秒 ' + Math.floor(now / 1000) + '）';
        }
        tick();
        const timer = setInterval(tick, 1000);
        root.querySelector('#tsNowCopy').addEventListener('click', function (e) {
            copyText(String(Date.now()), e.target);
        });
        inEl.addEventListener('input', function () {
            const v = inEl.value.trim();
            if (!v) { outEl.textContent = ''; return; }
            const n = Number(v);
            if (!isFinite(n)) { outEl.textContent = '请输入数字'; return; }
            const d = new Date(String(v).length <= 10 ? n * 1000 : n);
            outEl.textContent = isNaN(d.getTime()) ? '无效时间戳' : fmtDate(d);
        });
        dtIn.addEventListener('change', function () {
            if (!dtIn.value) { dtOut.textContent = ''; return; }
            const t = new Date(dtIn.value).getTime();
            dtOut.textContent = t + '（秒 ' + Math.floor(t / 1000) + '）';
        });
        return function () { clearInterval(timer); };
    }

    // ---------- Base64 ----------
    function b64Html() {
        return '<div class="tool-pane">' +
            '<textarea id="b64In" class="tool-area" rows="5" placeholder="输入文本…" spellcheck="false"></textarea>' +
            '<div class="tool-row">' +
            '<button class="mini-btn" data-act="enc">编码</button>' +
            '<button class="mini-btn" data-act="dec">解码</button>' +
            '<button class="mini-btn" data-act="copy">复制结果</button>' +
            '</div><div id="b64Out" class="tool-out"></div></div>';
    }
    function b64Encode(str) {
        const bytes = new TextEncoder().encode(str);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    }
    function b64Decode(b64) {
        const bin = atob(b64.trim());
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    }
    function initB64(root) {
        const input = root.querySelector('#b64In');
        const out = root.querySelector('#b64Out');
        root.querySelector('.tool-row').addEventListener('click', function (e) {
            const btn = e.target.closest('.mini-btn');
            if (!btn) return;
            const act = btn.getAttribute('data-act');
            if (act === 'copy') { if (out.textContent) copyText(out.textContent, btn); return; }
            if (!input.value) { out.textContent = '（空）'; out.classList.remove('err'); return; }
            try {
                out.textContent = act === 'enc' ? b64Encode(input.value) : b64Decode(input.value);
                out.classList.remove('err');
            } catch (err) {
                out.textContent = '失败：' + err.message;
                out.classList.add('err');
            }
        });
        return null;
    }

    // ---------- URL ----------
    function urlHtml() {
        return '<div class="tool-pane">' +
            '<textarea id="urlIn" class="tool-area" rows="5" placeholder="输入文本或 URL…" spellcheck="false"></textarea>' +
            '<div class="tool-row">' +
            '<button class="mini-btn" data-act="enc">编码</button>' +
            '<button class="mini-btn" data-act="dec">解码</button>' +
            '<button class="mini-btn" data-act="copy">复制结果</button>' +
            '</div><div id="urlOut" class="tool-out"></div></div>';
    }
    function initUrl(root) {
        const input = root.querySelector('#urlIn');
        const out = root.querySelector('#urlOut');
        root.querySelector('.tool-row').addEventListener('click', function (e) {
            const btn = e.target.closest('.mini-btn');
            if (!btn) return;
            const act = btn.getAttribute('data-act');
            if (act === 'copy') { if (out.textContent) copyText(out.textContent, btn); return; }
            try {
                out.textContent = act === 'enc' ? encodeURIComponent(input.value) : decodeURIComponent(input.value);
                out.classList.remove('err');
            } catch (err) {
                out.textContent = '失败：' + err.message;
                out.classList.add('err');
            }
        });
        return null;
    }

    // ---------- 密码生成 ----------
    function pwdHtml() {
        return '<div class="tool-pane">' +
            '<div class="tool-block"><div class="tool-label">长度：<span id="pwdLenVal">16</span></div>' +
            '<input type="range" id="pwdLen" class="tool-range" min="4" max="64" value="16"></div>' +
            '<div class="tool-block tool-checks">' +
            '<label><input type="checkbox" id="pwdLower" checked> 小写</label>' +
            '<label><input type="checkbox" id="pwdUpper" checked> 大写</label>' +
            '<label><input type="checkbox" id="pwdNum" checked> 数字</label>' +
            '<label><input type="checkbox" id="pwdSym" checked> 符号</label>' +
            '</div>' +
            '<div class="tool-row"><button class="mini-btn" id="pwdGen">生成</button><button class="mini-btn" id="pwdCopy">复制</button></div>' +
            '<div id="pwdOut" class="tool-out mono"></div></div>';
    }
    function initPwd(root) {
        const lenEl = root.querySelector('#pwdLen');
        const lenVal = root.querySelector('#pwdLenVal');
        const out = root.querySelector('#pwdOut');
        const sets = {
            lower: 'abcdefghijklmnopqrstuvwxyz',
            upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            num: '0123456789',
            sym: '!@#$%^&*()-_=+[]{};:,.<>?'
        };
        function generate() {
            const chars = [];
            if (root.querySelector('#pwdLower').checked) chars.push(sets.lower);
            if (root.querySelector('#pwdUpper').checked) chars.push(sets.upper);
            if (root.querySelector('#pwdNum').checked) chars.push(sets.num);
            if (root.querySelector('#pwdSym').checked) chars.push(sets.sym);
            const pool = chars.join('');
            if (!pool) { out.textContent = '请至少勾选一种字符'; return; }
            const len = Number(lenEl.value);
            const arr = new Uint32Array(len);
            crypto.getRandomValues(arr);
            let s = '';
            for (let i = 0; i < len; i++) s += pool[arr[i] % pool.length];
            out.textContent = s;
        }
        lenEl.addEventListener('input', function () { lenVal.textContent = lenEl.value; generate(); });
        root.querySelectorAll('.tool-checks input').forEach(function (cb) { cb.addEventListener('change', generate); });
        root.querySelector('#pwdGen').addEventListener('click', generate);
        root.querySelector('#pwdCopy').addEventListener('click', function (e) {
            if (out.textContent && out.textContent !== '请至少勾选一种字符') copyText(out.textContent, e.target);
        });
        generate();
        return null;
    }

    // ---------- 43 编码解码 ----------
    // 算法：文本 → UTF-8 字节 → 每字节 8 位二进制 → 0 映射为「4」、1 映射为「3」。
    // 解码反过来。结果是一串纯 4/3，完全可逆。
    function c43Html() {
        return '<div class="tool-pane">' +
            '<textarea id="c43In" class="tool-area" rows="5" placeholder="输入文本…" spellcheck="false"></textarea>' +
            '<div class="tool-row">' +
            '<button class="mini-btn" data-act="enc">编码 → 43</button>' +
            '<button class="mini-btn" data-act="dec">解码 43 → 文本</button>' +
            '<button class="mini-btn" data-act="copy">复制结果</button>' +
            '</div>' +
            '<div class="tool-block"><div class="tool-label">结果（纯 4 和 3）</div>' +
            '<div id="c43Out" class="tool-out mono"></div></div></div>';
    }
    function encode43(str) {
        const bytes = new TextEncoder().encode(str);
        let out = '';
        for (let i = 0; i < bytes.length; i++) {
            let b = bytes[i];
            for (let k = 7; k >= 0; k--) out += ((b >> k) & 1) ? '3' : '4';
        }
        return out;
    }
    function decode43(s) {
        const clean = s.replace(/[^34]/g, '');
        if (!clean) return '';
        if (clean.length % 8 !== 0) throw new Error('长度不是 8 的倍数，可能被截断');
        const bytes = new Uint8Array(clean.length / 8);
        for (let i = 0; i < clean.length; i += 8) {
            let b = 0;
            for (let k = 0; k < 8; k++) b = (b << 1) | (clean[i + k] === '3' ? 1 : 0);
            bytes[i / 8] = b;
        }
        return new TextDecoder().decode(bytes);
    }
    function initC43(root) {
        const input = root.querySelector('#c43In');
        const out = root.querySelector('#c43Out');
        root.querySelector('.tool-row').addEventListener('click', function (e) {
            const btn = e.target.closest('.mini-btn');
            if (!btn) return;
            const act = btn.getAttribute('data-act');
            if (act === 'copy') { if (out.textContent) copyText(out.textContent, btn); return; }
            if (!input.value) { out.textContent = '（空）'; out.classList.remove('err'); return; }
            try {
                out.textContent = act === 'enc' ? encode43(input.value) : decode43(input.value);
                out.classList.remove('err');
            } catch (err) {
                out.textContent = '失败：' + err.message;
                out.classList.add('err');
            }
        });
        return null;
    }

    // ---------- 工具注册 ----------
    const tools = [
        { id: 'ip', name: 'IP 查询', icon: 'fa-globe', html: ipHtml, init: initIp },
        { id: 'json', name: 'JSON', icon: 'fa-code', html: jsonHtml, init: initJson },
        { id: 'ts', name: '时间戳', icon: 'fa-clock', html: tsHtml, init: initTs },
        { id: 'b64', name: 'Base64', icon: 'fa-shield-halved', html: b64Html, init: initB64 },
        { id: 'url', name: 'URL', icon: 'fa-link', html: urlHtml, init: initUrl },
        { id: 'pwd', name: '密码', icon: 'fa-key', html: pwdHtml, init: initPwd },
        { id: 'c43', name: '43 编码', icon: 'fa-ghost', html: c43Html, init: initC43 }
    ];

    let activeId = 'ip';
    let cleanup = null;
    let activated = false;

    function renderTabs() {
        tabsEl.innerHTML = tools.map(function (t) {
            return '<button class="tool-tab' + (t.id === activeId ? ' active' : '') + '" data-id="' + t.id + '">' +
                '<i class="fas ' + t.icon + '"></i> ' + t.name + '</button>';
        }).join('');
    }

    function activate(id) {
        const tool = tools.find(function (t) { return t.id === id; });
        if (!tool) return;
        activeId = id;
        renderTabs();
        if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
        bodyEl.innerHTML = tool.html();
        if (tool.init) cleanup = tool.init(bodyEl);
    }

    function ensureActive() {
        if (!activated) { activated = true; activate(activeId); }
    }

    tabsEl.addEventListener('click', function (e) {
        const btn = e.target.closest('.tool-tab');
        if (!btn) return;
        activate(btn.getAttribute('data-id'));
    });

    // ---------- 路由 ----------
    const glitchCanvas = document.getElementById('glitchCanvas');
    function applyRoute() {
        const open = location.hash === '#/tools';
        view.classList.toggle('open', open);
        document.body.style.overflow = open ? 'hidden' : '';
        // 打开工具面板时隐藏终端乱码层，避免乱码透过毛玻璃遮罩透出
        if (glitchCanvas) glitchCanvas.style.display = open ? 'none' : '';
        if (open) ensureActive();
    }
    window.addEventListener('hashchange', applyRoute);

    document.getElementById('toolsClose').addEventListener('click', function () {
        if (location.hash === '#/tools') {
            if (window.history.length > 1) { history.back(); }
            else { location.hash = ''; }
        }
    });
    window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && location.hash === '#/tools') {
            if (window.history.length > 1) { history.back(); }
            else { location.hash = ''; }
        }
    });

    // 初始
    renderTabs();
    applyRoute();
})();
