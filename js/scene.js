/* ============================================================
   3D 背景：赛博 / 极简两套场景 + 视差 + 降级
   依赖 Three.js（CDN 加载失败则回退到 CSS 背景）
   ============================================================ */
(function () {
    const canvas = document.getElementById('sceneCanvas');
    const fallback = document.getElementById('sceneFallback');

    if (!window.THREE) {
        fallback.style.display = 'block';
        return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 600;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: !isMobile
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // ---------- 主题分组 ----------
    const cyberGroup = new THREE.Group();
    const minimalGroup = new THREE.Group();
    scene.add(cyberGroup, minimalGroup);

    // ---------- 赛博场景 ----------
    const CYAN = 0x00e5ff;
    const MAGENTA = 0xff2ec4;

    const grid = new THREE.GridHelper(60, 40, CYAN, 0x14313d);
    grid.position.y = -4.5;
    cyberGroup.add(grid);

    const cyberShapes = [];
    const shapeGeo = [
        new THREE.IcosahedronGeometry(0.9, 0),
        new THREE.OctahedronGeometry(1.1, 0),
        new THREE.TetrahedronGeometry(1.2, 0)
    ];
    const cyberCount = isMobile ? 4 : 7;
    for (let i = 0; i < cyberCount; i++) {
        const geo = shapeGeo[i % shapeGeo.length];
        const color = i % 2 === 0 ? CYAN : MAGENTA;
        const mat = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: true,
            transparent: true,
            opacity: 0.55
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
            (Math.random() - 0.5) * 16,
            (Math.random() - 0.5) * 10 + 1,
            (Math.random() - 0.5) * 8 - 2
        );
        mesh.userData = {
            spin: 0.002 + Math.random() * 0.006,
            bob: 0.3 + Math.random() * 0.8,
            phase: Math.random() * Math.PI * 2,
            baseY: mesh.position.y
        };
        cyberGroup.add(mesh);
        cyberShapes.push(mesh);
    }

    const cyberParticles = makeParticles(isMobile ? 120 : 320, [CYAN, MAGENTA], 22, 12);
    cyberGroup.add(cyberParticles);

    // ---------- 极简场景 ----------
    const torus = new THREE.Mesh(
        new THREE.TorusGeometry(2.6, 0.02, 16, 120),
        new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 })
    );
    torus.position.set(0, 0.4, -1);
    minimalGroup.add(torus);

    const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.4, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05 })
    );
    sphere.position.set(0, 0.2, -2);
    minimalGroup.add(sphere);

    const minimalParticles = makeParticles(isMobile ? 50 : 130, [0xffffff, 0xdddddd], 18, 10);
    minimalGroup.add(minimalParticles);

    // ---------- 粒子工具 ----------
    function makeParticles(count, colors, spreadX, spreadY) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const c = new THREE.Color();
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * spreadX;
            pos[i * 3 + 1] = (Math.random() - 0.5) * spreadY;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1;
            c.set(colors[(Math.random() * colors.length) | 0]);
            col[i * 3] = c.r;
            col[i * 3 + 1] = c.g;
            col[i * 3 + 2] = c.b;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const mat = new THREE.PointsMaterial({
            size: isMobile ? 0.05 : 0.04,
            vertexColors: true,
            transparent: true,
            opacity: 0.7,
            sizeAttenuation: true
        });
        return new THREE.Points(geo, mat);
    }

    // ---------- 视差 ----------
    let mouseX = 0, mouseY = 0;
    let targetRX = 0, targetRY = 0;

    if (!isMobile && !reduced) {
        window.addEventListener('mousemove', function (e) {
            mouseX = (e.clientX / window.innerWidth - 0.5);
            mouseY = (e.clientY / window.innerHeight - 0.5);
        });
    }
    window.addEventListener('scroll', function () {
        camera.position.y = Math.min(window.scrollY * 0.0012, 2.5);
    }, { passive: true });

    // ---------- 主题 ----------
    function setTheme(theme) {
        const cyber = theme !== 'minimal';
        cyberGroup.visible = cyber;
        minimalGroup.visible = !cyber;
    }

    // ---------- 循环 ----------
    const clock = new THREE.Clock();
    function renderFrame() {
        const t = clock.getElapsedTime();
        targetRX += (mouseY * 0.6 - targetRX) * 0.04;
        targetRY += (mouseX * 0.8 - targetRY) * 0.04;

        if (cyberGroup.visible) {
            cyberGroup.rotation.x = targetRX;
            cyberGroup.rotation.y = targetRY;
            for (const m of cyberShapes) {
                m.rotation.x += m.userData.spin;
                m.rotation.y += m.userData.spin * 1.3;
                m.position.y = m.userData.baseY + Math.sin(t * 0.6 + m.userData.phase) * m.userData.bob;
            }
            cyberParticles.rotation.y = t * 0.02;
        } else {
            minimalGroup.rotation.x = targetRX * 0.4;
            minimalGroup.rotation.y = targetRY * 0.4;
            torus.rotation.x = t * 0.2;
            torus.rotation.y = t * 0.14;
            minimalParticles.rotation.y = t * 0.015;
        }

        renderer.render(scene, camera);
        requestAnimationFrame(renderFrame);
    }

    // ---------- 启动 ----------
    if (reduced) {
        setTheme(document.body.getAttribute('data-theme'));
        renderer.render(scene, camera);
    } else {
        setTheme(document.body.getAttribute('data-theme'));
        renderFrame();
    }

    window.addEventListener('resize', function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 暴露给 main.js
    window.DEDE_SCENE = { setTheme: setTheme };
})();
