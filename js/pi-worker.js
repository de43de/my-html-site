// π 计算 Worker：Chudnovsky 算法 + 二进制分裂，BigInt 实现。
// 在浏览器后台线程现场计算 π 的小数位，算完把结果字符串发回主线程。
// 100 万位在主流机器上约 10~20 秒。

const C3_24 = 10939058860032000n;

function bs(a, b) {
    if (b - a === 1) {
        if (a === 0) return [1n, 1n, 13591409n];
        const P = BigInt(6 * a - 5) * BigInt(2 * a - 1) * BigInt(6 * a - 1);
        const Q = BigInt(a) ** 3n * C3_24;
        let T = P * (13591409n + 545140134n * BigInt(a));
        if (a & 1) T = -T;
        return [P, Q, T];
    }
    const m = (a + b) >> 1;
    const PamQamTam = bs(a, m);
    const PmbQmbTmb = bs(m, b);
    return [
        PamQamTam[0] * PmbQmbTmb[0],
        PamQamTam[1] * PmbQmbTmb[1],
        PmbQmbTmb[1] * PamQamTam[2] + PamQamTam[0] * PmbQmbTmb[2]
    ];
}

function isqrt(n) {
    if (n < 2n) return n;
    let x = 1n << BigInt((n.toString(2).length + 1) >> 1);
    let y = (x + n / x) >> 1n;
    while (y < x) { x = y; y = (x + n / x) >> 1n; }
    return x;
}

function piDigits(n) {
    const total = n + 1;
    const N = Math.floor(total / 14) + 1;
    const PT = bs(0, N);
    const one = 10n ** BigInt(total + 10);
    const sqrtC = isqrt(10005n * one * one);
    const pi = (426880n * PT[1] * sqrtC) / PT[2];
    return pi.toString().slice(1, 1 + n);
}

self.onmessage = function (e) {
    const n = (e.data && e.data.digits) || 1000000;
    try {
        postMessage({ type: 'start', digits: n });
        const d = piDigits(n);
        postMessage({ type: 'done', digits: d });
    } catch (err) {
        postMessage({ type: 'error', message: String(err) });
    }
};
