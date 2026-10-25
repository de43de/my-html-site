/* ============================================================
   交互逻辑：渲染 / 主题切换 / 滚动动效 / 彩蛋 / 复制
   ============================================================ */
(function () {
    const QQ_NUM = '3603823836';
    const STEAM_ID = '1533011988';

    // ---------- 工具 ----------
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    let toastTimer = null;
    function showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toast.classList.remove('show');
        }, 2200);
    }

    function copyText(text, okMsg) {
        const done = function () { showToast(okMsg); };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
        } else {
            fallbackCopy(text, done);
        }
    }
    function fallbackCopy(text, done) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:-999px;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        try {
            if (document.execCommand('copy')) { done(); }
            else { showToast('复制失败，请手动复制：' + text); }
        } catch (e) {
            showToast('复制失败，请手动复制：' + text);
        }
        document.body.removeChild(ta);
    }

    function addQQFriend(qq) {
        copyText(qq, 'QQ 号已复制：' + qq);
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
            window.location.href = 'mqqapi://card/show_pslcard?src_type=internal&version=1&uin=' + qq + '&card_type=person&source=sharecard';
        } else {
            window.location.href = 'tencent://AddContact/?fromId=45&fromSubId=1&subcmd=all&uin=' + qq;
        }
    }

    // ---------- 渲染想法流 ----------
    const D = window.SITE_DATA;
    const postList = document.getElementById('postList');
    D.posts.forEach(function (p) {
        const card = document.createElement('article');
        card.className = 'post-card';
        card.innerHTML =
            '<div class="post-meta">' +
            '<span class="post-tag">' + escapeHtml(p.tag) + '</span>' +
            '<time class="post-time">' + escapeHtml(p.time) + '</time>' +
            '</div>' +
            '<p class="post-text">' + escapeHtml(p.text) + '</p>';
        postList.appendChild(card);
    });
    document.getElementById('streamCount').textContent = D.posts.length + ' 条';

    // ---------- 渲染社交链接 ----------
    const socialsEl = document.getElementById('socials');
    D.socials.forEach(function (s) {
        const a = document.createElement('a');
        a.className = 'social-link';
        a.title = s.label;
        a.setAttribute('aria-label', s.label);
        a.innerHTML = '<i class="' + s.icon + '"></i>';
        if (s.href) {
            a.href = s.href;
            if (s.href.indexOf('mailto:') !== 0) {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
            }
        } else if (s.action === 'qq') {
            a.href = 'javascript:void(0)';
            a.addEventListener('click', function () { addQQFriend(QQ_NUM); });
        } else if (s.action === 'steam') {
            a.href = 'javascript:void(0)';
            a.addEventListener('click', function () { copyText(STEAM_ID, 'Steam 好友码已复制：' + STEAM_ID); });
        }
        socialsEl.appendChild(a);
    });

    // ---------- 渲染 FAQ ----------
    const faqEl = document.getElementById('faq');
    D.faq.forEach(function (f) {
        const details = document.createElement('details');
        details.innerHTML = '<summary>' + escapeHtml(f.q) + '</summary>' +
            '<div class="faq-answer">' + escapeHtml(f.a) + '</div>';
        faqEl.appendChild(details);
    });

    // ---------- 滚动入场 ----------
    const cards = document.querySelectorAll('.post-card');
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) {
                    en.target.classList.add('visible');
                    io.unobserve(en.target);
                }
            });
        }, { threshold: 0.12 });
        cards.forEach(function (c) { io.observe(c); });
    } else {
        cards.forEach(function (c) { c.classList.add('visible'); });
    }

    // ---------- 主题切换 ----------
    const themeToggle = document.getElementById('themeToggle');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    function applyTheme(theme, save) {
        document.body.setAttribute('data-theme', theme);
        const isCyber = theme === 'cyber';
        themeToggle.innerHTML = isCyber ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        themeToggle.title = isCyber ? '切换到极简' : '切换到赛博';
        themeColorMeta.setAttribute('content', isCyber ? '#0a0a12' : '#f7f7f4');
        if (save) { try { localStorage.setItem('dede-theme-v3', theme); } catch (e) {} }
    }

    let currentTheme = 'cyber';
    try { currentTheme = localStorage.getItem('dede-theme-v3') || 'cyber'; } catch (e) {}
    applyTheme(currentTheme, false);

    themeToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        currentTheme = currentTheme === 'cyber' ? 'minimal' : 'cyber';
        applyTheme(currentTheme, true);
        showToast(currentTheme === 'cyber' ? '已切换到赛博' : '已切换到极简');
    });

    // ---------- 彩蛋入口按钮 ----------
    const eggBtn = document.getElementById('eggBtn');
    eggBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (currentTheme === 'minimal') {
            showToast('极简模式没有彩蛋');
            return;
        }
        if (window.DEDE_EGG) {
            const rect = eggBtn.getBoundingClientRect();
            const nx = (rect.left + rect.width / 2) / window.innerWidth;
            const ny = (rect.top + rect.height / 2) / window.innerHeight;
            window.DEDE_EGG.burst(nx, ny);
        }
    });

    // ---------- 43 彩蛋 ----------
    const easterEgg = document.getElementById('easterEgg');
    let isFortyThree = false;
    let originalTexts = new Map();

    function renderEggMessage(el, msg) { el.innerHTML = msg; }

    function backupTextNodes() {
        originalTexts.clear();
        const walker = document.createTreeWalker(
            document.body, NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    let parent = node.parentElement;
                    while (parent) {
                        if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
                        parent = parent.parentElement;
                    }
                    if (node.textContent.trim() === '') return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );
        let node;
        while ((node = walker.nextNode()) !== null) {
            originalTexts.set(node, node.textContent);
        }
    }

    function setAllTextTo43() {
        const walker = document.createTreeWalker(
            document.body, NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    let parent = node.parentElement;
                    while (parent) {
                        if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
                        parent = parent.parentElement;
                    }
                    if (node.textContent.trim() === '') return NodeFilter.FILTER_REJECT;
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );
        let node;
        while ((node = walker.nextNode()) !== null) {
            node.textContent = '43';
        }
        document.body.classList.add('forty-three-mode');
    }

    function restoreAllText() {
        originalTexts.forEach(function (original, node) {
            node.textContent = original;
        });
        document.body.classList.remove('forty-three-mode');
    }

    function toggleFortyThree() {
        if (!isFortyThree) {
            setAllTextTo43();
            isFortyThree = true;
        } else {
            restoreAllText();
            isFortyThree = false;
        }
    }

    function initEasterEgg() {
        const msgs = D.eggMessages;
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        renderEggMessage(easterEgg, msg);
        backupTextNodes();
    }
    initEasterEgg();

    easterEgg.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleFortyThree();
    });

    // 隐藏彩蛋：双击 logo 也触发 43 模式
    document.getElementById('logo').addEventListener('dblclick', function () {
        toggleFortyThree();
    });

    // 隐藏彩蛋：Konami 码
    const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIdx = 0;
    window.addEventListener('keydown', function (e) {
        // 面板打开时（游戏/工具）不响应 Konami 彩蛋，避免误触
        if (location.hash === '#/game' || location.hash === '#/tools') return;
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (k === KONAMI[konamiIdx]) {
            konamiIdx++;
            if (konamiIdx === KONAMI.length) {
                konamiIdx = 0;
                toggleFortyThree();
            }
        } else {
            konamiIdx = (k === KONAMI[0]) ? 1 : 0;
        }
    });
})();
