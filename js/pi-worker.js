// π 计算 Worker：用 gmp-wasm（GMP/MPFR 的 WebAssembly 绑定）现场计算 π。
// MPFR 的 const_pi 走 Brent-Salamin AGM 迭代 + GMP 的 FFT 大数乘法，
// 比纯 JS BigInt 快几十倍。1 亿位在主流电脑上约 10~15 分钟，移动端会慢很多。
importScripts('vendor/gmp-wasm.min.js');

let piDigits = null;   // 缓存的小数部分（同一 Worker 生命周期内不重算）
let computing = false;

function compute(digits) {
    if (piDigits) {
        postMessage({ type: 'done', digits: piDigits, elapsed: 0, cached: true });
        return;
    }
    if (computing) { postMessage({ type: 'busy' }); return; }
    computing = true;
    postMessage({ type: 'start', digits: digits });
    const t0 = Date.now();
    gmp.init().then(function (api) {
        // 十进制位数 → MPFR 二进制精度（+32 位余量保证前 digits 位正确）
        const precisionBits = gmp.precisionToBits(digits) + 32;
        const s = api.calculate(function (g) {
            return g.Pi().toString();
        }, { precisionBits: precisionBits });
        const t1 = Date.now();
        piDigits = s.split('.')[1] || '';
        computing = false;
        postMessage({ type: 'done', digits: piDigits, elapsed: t1 - t0 });
    }).catch(function (err) {
        computing = false;
        postMessage({ type: 'error', message: String(err && err.message || err) });
    });
}

self.onmessage = function (e) {
    const d = e.data || {};
    if (d.cmd === 'compute') compute(d.digits || 100000000);
};
