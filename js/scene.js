/* ============================================================
   WebGL 流体背景：鼠标/触摸划动产生流动的彩色流体
   - 原生 WebGL，不依赖 Three.js
   - canvas 透明，叠加在 CSS 主题背景之上
   - 两套主题各配一套染料调色板
   - 降级：不支持 WebGL / half-float / 减弱动态 → CSS 背景
   ============================================================ */
(function () {
    const canvas = document.getElementById('sceneCanvas');
    const fallback = document.getElementById('sceneFallback');

    function useFallback() {
        canvas.style.display = 'none';
        fallback.style.display = 'block';
    }

    // 尊重系统「减弱动态」偏好
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        useFallback();
        return;
    }

    // ---------- WebGL 上下文 ----------
    const attrs = { alpha: true, depth: false, stencil: false, antialias: false, premultipliedAlpha: false };
    const gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    if (!gl) { useFallback(); return; }

    const halfFloat = gl.getExtension('OES_texture_half_float');
    if (!halfFloat) { useFallback(); return; }
    const hasLinear = !!gl.getExtension('OES_texture_half_float_linear');

    // ---------- 参数 ----------
    const isMobile = window.innerWidth < 600;
    const SIM_W = isMobile ? 64 : 128;
    const SIM_H = isMobile ? 64 : 128;
    const DYE_W = isMobile ? 256 : 512;
    const DYE_H = isMobile ? 256 : 512;

    const DENSITY_DISSIPATION = 1.5;
    const VELOCITY_DISSIPATION = 0.2;
    const PRESSURE = 0.8;
    const PRESSURE_ITERATIONS = 20;
    const CURL = 30;
    const SPLAT_RADIUS = 0.25;
    const FILTER = hasLinear ? gl.LINEAR : gl.NEAREST;

    // ---------- 调色板 ----------
    const PALETTES = {
        cyber: [
            [0.05, 0.70, 0.85],   // 暗青
            [0.80, 0.20, 0.60],   // 暗洋红
            [0.40, 0.32, 0.80],   // 暗紫
            [0.18, 0.38, 0.80],   // 暗蓝
            [0.00, 0.75, 0.50]    // 暗绿青
        ],
        minimal: [
            [0.62, 0.76, 0.90],   // 淡蓝
            [0.78, 0.72, 0.88],   // 淡紫
            [0.90, 0.82, 0.70],   // 米色
            [0.64, 0.86, 0.80],   // 浅青
            [0.86, 0.84, 0.80]    // 暖灰
        ]
    };
    let currentPalette = PALETTES.cyber;

    function pickColor() {
        const c = currentPalette[(Math.random() * currentPalette.length) | 0];
        const jitter = 0.6 + Math.random() * 0.35;
        return [c[0] * jitter, c[1] * jitter, c[2] * jitter];
    }

    // ---------- Shader ----------
    const VERT = [
        'precision highp float;',
        'attribute vec2 aPosition;',
        'varying vec2 vUv;',
        'varying vec2 vL;',
        'varying vec2 vR;',
        'varying vec2 vT;',
        'varying vec2 vB;',
        'uniform vec2 texelSize;',
        'void main () {',
        '  vUv = aPosition * 0.5 + 0.5;',
        '  vL = vUv - vec2(texelSize.x, 0.0);',
        '  vR = vUv + vec2(texelSize.x, 0.0);',
        '  vT = vUv + vec2(0.0, texelSize.y);',
        '  vB = vUv - vec2(0.0, texelSize.y);',
        '  gl_Position = vec4(aPosition, 0.0, 1.0);',
        '}'
    ].join('\n');

    const SPLAT_FRAG = [
        'precision highp float;',
        'precision highp sampler2D;',
        'varying vec2 vUv;',
        'uniform sampler2D uTarget;',
        'uniform float aspectRatio;',
        'uniform vec3 color;',
        'uniform vec2 point;',
        'uniform float radius;',
        'void main () {',
        '  vec2 p = vUv - point.xy;',
        '  p.x *= aspectRatio;',
        '  vec3 splat = exp(-dot(p, p) / radius) * color;',
        '  vec3 base = texture2D(uTarget, vUv).xyz;',
        '  gl_FragColor = vec4(base + splat, 1.0);',
        '}'
    ].join('\n');

    const ADVECTION_FRAG = [
        'precision highp float;',
        'precision highp sampler2D;',
        'varying vec2 vUv;',
        'uniform sampler2D uVelocity;',
        'uniform sampler2D uSource;',
        'uniform vec2 texelSize;',
        'uniform float dt;',
        'uniform float dissipation;',
        'void main () {',
        '  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;',
        '  vec4 result = texture2D(uSource, coord);',
        '  float decay = 1.0 + dissipation * dt;',
        '  gl_FragColor = result / decay;',
        '}'
    ].join('\n');

    const DIVERGENCE_FRAG = [
        'precision mediump float;',
        'precision mediump sampler2D;',
        'varying highp vec2 vUv;',
        'varying highp vec2 vL;',
        'varying highp vec2 vR;',
        'varying highp vec2 vT;',
        'varying highp vec2 vB;',
        'uniform sampler2D uVelocity;',
        'void main () {',
        '  float L = texture2D(uVelocity, vL).x;',
        '  float R = texture2D(uVelocity, vR).x;',
        '  float T = texture2D(uVelocity, vT).y;',
        '  float B = texture2D(uVelocity, vB).y;',
        '  vec2 C = texture2D(uVelocity, vUv).xy;',
        '  if (vL.x < 0.0) { L = -C.x; }',
        '  if (vR.x > 1.0) { R = -C.x; }',
        '  if (vT.y > 1.0) { T = -C.y; }',
        '  if (vB.y < 0.0) { B = -C.y; }',
        '  float div = 0.5 * (R - L + T - B);',
        '  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);',
        '}'
    ].join('\n');

    const CURL_FRAG = [
        'precision mediump float;',
        'precision mediump sampler2D;',
        'varying highp vec2 vUv;',
        'varying highp vec2 vL;',
        'varying highp vec2 vR;',
        'varying highp vec2 vT;',
        'varying highp vec2 vB;',
        'uniform sampler2D uVelocity;',
        'void main () {',
        '  float L = texture2D(uVelocity, vL).y;',
        '  float R = texture2D(uVelocity, vR).y;',
        '  float T = texture2D(uVelocity, vT).x;',
        '  float B = texture2D(uVelocity, vB).x;',
        '  float vorticity = R - L - T + B;',
        '  gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);',
        '}'
    ].join('\n');

    const VORTICITY_FRAG = [
        'precision highp float;',
        'precision highp sampler2D;',
        'varying vec2 vUv;',
        'varying vec2 vL;',
        'varying vec2 vR;',
        'varying vec2 vT;',
        'varying vec2 vB;',
        'uniform sampler2D uVelocity;',
        'uniform sampler2D uCurl;',
        'uniform float curl;',
        'uniform float dt;',
        'void main () {',
        '  float L = texture2D(uCurl, vL).x;',
        '  float R = texture2D(uCurl, vR).x;',
        '  float T = texture2D(uCurl, vT).x;',
        '  float B = texture2D(uCurl, vB).x;',
        '  float C = texture2D(uCurl, vUv).x;',
        '  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));',
        '  force /= length(force) + 0.0001;',
        '  force *= curl * C;',
        '  force.y *= -1.0;',
        '  vec2 velocity = texture2D(uVelocity, vUv).xy;',
        '  velocity += force * dt;',
        '  velocity = min(max(velocity, -1000.0), 1000.0);',
        '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
        '}'
    ].join('\n');

    const PRESSURE_FRAG = [
        'precision mediump float;',
        'precision mediump sampler2D;',
        'varying highp vec2 vUv;',
        'varying highp vec2 vL;',
        'varying highp vec2 vR;',
        'varying highp vec2 vT;',
        'varying highp vec2 vB;',
        'uniform sampler2D uPressure;',
        'uniform sampler2D uDivergence;',
        'void main () {',
        '  float L = texture2D(uPressure, vL).x;',
        '  float R = texture2D(uPressure, vR).x;',
        '  float T = texture2D(uPressure, vT).x;',
        '  float B = texture2D(uPressure, vB).x;',
        '  float C = texture2D(uPressure, vUv).x;',
        '  float divergence = texture2D(uDivergence, vUv).x;',
        '  float pressure = (L + R + B + T - divergence) * 0.25;',
        '  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);',
        '}'
    ].join('\n');

    const GRADIENT_SUBTRACT_FRAG = [
        'precision mediump float;',
        'precision mediump sampler2D;',
        'varying highp vec2 vUv;',
        'varying highp vec2 vL;',
        'varying highp vec2 vR;',
        'varying highp vec2 vT;',
        'varying highp vec2 vB;',
        'uniform sampler2D uPressure;',
        'uniform sampler2D uVelocity;',
        'void main () {',
        '  float L = texture2D(uPressure, vL).x;',
        '  float R = texture2D(uPressure, vR).x;',
        '  float T = texture2D(uPressure, vT).x;',
        '  float B = texture2D(uPressure, vB).x;',
        '  vec2 velocity = texture2D(uVelocity, vUv).xy;',
        '  velocity.xy -= vec2(R - L, T - B);',
        '  gl_FragColor = vec4(velocity, 0.0, 1.0);',
        '}'
    ].join('\n');

    // 透明输出：染料亮度转 alpha，premultiplied 混合，让 CSS 背景透出来
    const DISPLAY_FRAG = [
        'precision highp float;',
        'precision highp sampler2D;',
        'varying vec2 vUv;',
        'uniform sampler2D uTexture;',
        'void main () {',
        '  vec3 c = texture2D(uTexture, vUv).rgb;',
        '  c *= 0.9;',
        '  float a = clamp(dot(c, vec3(0.299, 0.587, 0.114)) * 1.4, 0.0, 1.0);',
        '  gl_FragColor = vec4(c * a, a);',
        '}'
    ].join('\n');

    // ---------- 编译工具 ----------
    function compileShader(type, source) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, source);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(sh));
        }
        return sh;
    }

    function createProgram(vertSrc, fragSrc) {
        const prog = gl.createProgram();
        gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vertSrc));
        gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fragSrc));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(prog));
        }
        const uniforms = {};
        const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) {
            const info = gl.getActiveUniform(prog, i);
            uniforms[info.name] = gl.getUniformLocation(prog, info.name);
        }
        return {
            prog: prog,
            uniforms: uniforms,
            aPosition: gl.getAttribLocation(prog, 'aPosition'),
            bind: function () { gl.useProgram(prog); }
        };
    }

    let P;
    try {
        P = {
            splat: createProgram(VERT, SPLAT_FRAG),
            advection: createProgram(VERT, ADVECTION_FRAG),
            divergence: createProgram(VERT, DIVERGENCE_FRAG),
            curl: createProgram(VERT, CURL_FRAG),
            vorticity: createProgram(VERT, VORTICITY_FRAG),
            pressure: createProgram(VERT, PRESSURE_FRAG),
            gradientSubtract: createProgram(VERT, GRADIENT_SUBTRACT_FRAG),
            display: createProgram(VERT, DISPLAY_FRAG)
        };
    } catch (e) {
        useFallback();
        return;
    }

    // ---------- Framebuffer ----------
    function createTexture(w, h) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, FILTER);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, FILTER);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, halfFloat.HALF_FLOAT_OES, null);
        return tex;
    }

    function createFBO(w, h) {
        const tex = createTexture(w, h);
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return {
            tex: tex, fbo: fbo, width: w, height: h,
            attach: function () { gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo); },
            texUnit: function (unit) {
                gl.activeTexture(gl.TEXTURE0 + unit);
                gl.bindTexture(gl.TEXTURE_2D, this.tex);
            }
        };
    }

    function createDoubleFBO(w, h) {
        return {
            width: w, height: h,
            read: createFBO(w, h),
            write: createFBO(w, h),
            swap: function () { const t = this.read; this.read = this.write; this.write = t; }
        };
    }

    const velocity = createDoubleFBO(SIM_W, SIM_H);
    const dye = createDoubleFBO(DYE_W, DYE_H);
    const divergence = createFBO(SIM_W, SIM_H);
    const curl = createFBO(SIM_W, SIM_H);
    const pressure = createDoubleFBO(SIM_W, SIM_H);

    const simTexel = [1 / SIM_W, 1 / SIM_H];

    // ---------- 渲染工具 ----------
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    let currentProgram = null;
    function useProgram(p) {
        p.bind();
        currentProgram = p;
    }

    function blit(target) {
        const w = target ? target.width : canvas.width;
        const h = target ? target.height : canvas.height;
        if (target) { target.attach(); }
        else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
        gl.viewport(0, 0, w, h);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.enableVertexAttribArray(currentProgram.aPosition);
        gl.vertexAttribPointer(currentProgram.aPosition, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function clearFBO(fbo) {
        fbo.attach();
        gl.viewport(0, 0, fbo.width, fbo.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    function clearAll() {
        clearFBO(velocity.read); clearFBO(velocity.write);
        clearFBO(dye.read); clearFBO(dye.write);
        clearFBO(divergence); clearFBO(curl);
        clearFBO(pressure.read); clearFBO(pressure.write);
    }

    let aspect = window.innerWidth / window.innerHeight;

    function splat(x, y, dx, dy, color) {
        useProgram(P.splat);
        gl.uniform1i(P.splat.uniforms.uTarget, 0);
        gl.uniform1f(P.splat.uniforms.aspectRatio, aspect);
        gl.uniform2f(P.splat.uniforms.point, x, y);
        gl.uniform1f(P.splat.uniforms.radius, SPLAT_RADIUS);

        // 速度场
        velocity.read.texUnit(0);
        gl.uniform3f(P.splat.uniforms.color, dx, dy, 0.0);
        blit(velocity.write); velocity.swap();

        // 染料场
        dye.read.texUnit(0);
        gl.uniform3f(P.splat.uniforms.color, color[0], color[1], color[2]);
        blit(dye.write); dye.swap();
    }

    // ---------- 模拟步 ----------
    function step(dt) {
        gl.disable(gl.BLEND);

        // 旋度
        useProgram(P.curl);
        gl.uniform2f(P.curl.uniforms.texelSize, simTexel[0], simTexel[1]);
        velocity.read.texUnit(0);
        gl.uniform1i(P.curl.uniforms.uVelocity, 0);
        blit(curl);

        // 涡量
        useProgram(P.vorticity);
        gl.uniform2f(P.vorticity.uniforms.texelSize, simTexel[0], simTexel[1]);
        gl.uniform1i(P.vorticity.uniforms.uVelocity, 0);
        velocity.read.texUnit(0);
        curl.texUnit(1);
        gl.uniform1i(P.vorticity.uniforms.uCurl, 1);
        gl.uniform1f(P.vorticity.uniforms.curl, CURL);
        gl.uniform1f(P.vorticity.uniforms.dt, dt);
        blit(velocity.write); velocity.swap();

        // 散度
        useProgram(P.divergence);
        gl.uniform2f(P.divergence.uniforms.texelSize, simTexel[0], simTexel[1]);
        velocity.read.texUnit(0);
        gl.uniform1i(P.divergence.uniforms.uVelocity, 0);
        blit(divergence);

        // 压力迭代
        clearFBO(pressure.write);
        useProgram(P.pressure);
        gl.uniform2f(P.pressure.uniforms.texelSize, simTexel[0], simTexel[1]);
        divergence.texUnit(1);
        gl.uniform1i(P.pressure.uniforms.uDivergence, 1);
        for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
            pressure.read.texUnit(0);
            gl.uniform1i(P.pressure.uniforms.uPressure, 0);
            blit(pressure.write); pressure.swap();
        }

        // 梯度减法
        useProgram(P.gradientSubtract);
        gl.uniform2f(P.gradientSubtract.uniforms.texelSize, simTexel[0], simTexel[1]);
        pressure.read.texUnit(0);
        gl.uniform1i(P.gradientSubtract.uniforms.uPressure, 0);
        velocity.read.texUnit(1);
        gl.uniform1i(P.gradientSubtract.uniforms.uVelocity, 1);
        blit(velocity.write); velocity.swap();

        // 速度对流
        useProgram(P.advection);
        gl.uniform2f(P.advection.uniforms.texelSize, simTexel[0], simTexel[1]);
        velocity.read.texUnit(0);
        gl.uniform1i(P.advection.uniforms.uVelocity, 0);
        gl.uniform1i(P.advection.uniforms.uSource, 0);
        gl.uniform1f(P.advection.uniforms.dt, dt);
        gl.uniform1f(P.advection.uniforms.dissipation, VELOCITY_DISSIPATION);
        blit(velocity.write); velocity.swap();

        // 染料对流
        useProgram(P.advection);
        gl.uniform2f(P.advection.uniforms.texelSize, simTexel[0], simTexel[1]);
        velocity.read.texUnit(0);
        gl.uniform1i(P.advection.uniforms.uVelocity, 0);
        dye.read.texUnit(1);
        gl.uniform1i(P.advection.uniforms.uSource, 1);
        gl.uniform1f(P.advection.uniforms.dt, dt);
        gl.uniform1f(P.advection.uniforms.dissipation, DENSITY_DISSIPATION);
        blit(dye.write); dye.swap();

        // 渲染到屏幕（透明，premultiplied）
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        useProgram(P.display);
        gl.uniform2f(P.display.uniforms.texelSize, 1 / DYE_W, 1 / DYE_H);
        dye.read.texUnit(0);
        gl.uniform1i(P.display.uniforms.uTexture, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.enableVertexAttribArray(P.display.aPosition);
        gl.vertexAttribPointer(P.display.aPosition, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.disable(gl.BLEND);
    }

    // ---------- 输入 ----------
    let lastX = 0.5, lastY = 0.5, accumX = 0, accumY = 0, hasMove = false;
    let pointer = { x: 0.5, y: 0.5 };

    function onMove(clientX, clientY) {
        const x = clientX / window.innerWidth;
        const y = 1 - clientY / window.innerHeight;
        accumX += x - lastX;
        accumY += y - lastY;
        lastX = x; lastY = y;
        pointer.x = x; pointer.y = y;
        hasMove = true;
    }

    function burst(clientX, clientY) {
        const x = clientX / window.innerWidth;
        const y = 1 - clientY / window.innerHeight;
        const color = pickColor();
        const rings = isMobile ? 8 : 14;
        for (let i = 0; i < rings; i++) {
            const ang = (i / rings) * Math.PI * 2;
            const speed = 380 + Math.random() * 160;
            splat(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, color);
        }
    }

    window.addEventListener('mousemove', function (e) {
        onMove(e.clientX, e.clientY);
    }, { passive: true });

    window.addEventListener('mousedown', function (e) {
        burst(e.clientX, e.clientY);
    });

    window.addEventListener('touchmove', function (e) {
        if (e.touches.length) {
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    window.addEventListener('touchstart', function (e) {
        if (e.touches.length) {
            burst(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    // ---------- 循环 ----------
    let lastTime = performance.now();
    let lastAuto = 0;

    function frame(now) {
        let dt = (now - lastTime) / 1000;
        lastTime = now;
        dt = Math.min(dt, 0.1);

        // 鼠标/触摸拖动 → 沿轨迹 splat
        if (hasMove) {
            hasMove = false;
            const dx = accumX * canvas.width * 8;
            const dy = accumY * canvas.height * 8;
            accumX = 0; accumY = 0;
            const color = pickColor();
            const n = isMobile ? 2 : 4;
            for (let i = 0; i < n; i++) {
                const t = i / n;
                splat(pointer.x + (dx / canvas.width) * t, pointer.y + (dy / canvas.height) * t, dx, dy, color);
            }
        }

        // 自动漂移，保持画面流动
        if (now - lastAuto > 1300) {
            lastAuto = now;
            const color = pickColor();
            const x = Math.random();
            const y = Math.random();
            const dx = (Math.random() - 0.5) * 320;
            const dy = (Math.random() - 0.5) * 320;
            splat(x, y, dx, dy, color);
        }

        step(dt);
        requestAnimationFrame(frame);
    }

    // ---------- 尺寸 ----------
    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        aspect = window.innerWidth / window.innerHeight;
    }

    // ---------- 主题 ----------
    function setTheme(theme) {
        currentPalette = theme === 'minimal' ? PALETTES.minimal : PALETTES.cyber;
        clearAll();
    }

    // ---------- 启动 ----------
    try {
        resize();
        clearAll();
        window.addEventListener('resize', resize, { passive: true });
        window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        requestAnimationFrame(frame);
    } catch (e) {
        useFallback();
        return;
    }

    // 上下文丢失 → 降级
    canvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        useFallback();
    });

    // 暴露给 main.js
    window.DEDE_SCENE = { setTheme: setTheme };
})();
