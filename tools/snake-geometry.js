/**
 * Snake schedule geometry generator
 * ---------------------------------
 * Rebuilds the SVG path and circle centers for the wedding timeline.
 *
 * Rules (final design):
 * - Turns use radius R (wider than the circle).
 * - Circles use radius r and touch the turn ONLY at the outer apex.
 * - Connectors between turns have a gentle downward slope (no flat horizontals).
 * - The last turn stops at the apex (no bottom "tail").
 *
 * Usage:
 *   node tools/snake-geometry.js
 *
 * Then paste the printed PATH into both .snake-line / .snake-line-bloom
 * and update --x/--y on .snake-item plus --snake-r / viewBox in CSS/HTML.
 */

const r = 82; // circle radius (CSS: --snake-r)
const R = 115; // turn radius (must be > r for apex-only contact + gap)
const L = 250; // left column circle centers x
const Rg = 750; // right column circle centers x
const slope = 26; // vertical drop between exit of one turn and entry of the next
const y1 = 120; // first circle center y
const viewBoxW = 1000;

const rnd = (n) => Math.round(n * 10) / 10;

/** Right U-turn: circle touches rightmost apex */
function rightTurn(midY) {
    const ax = Rg - R + r; // semicircle center x
    return {
        midY,
        ax,
        top: [ax, midY - R],
        bot: [ax, midY + R],
        apex: [ax + R, midY],
        circle: [Rg, midY],
    };
}

/** Left U-turn: circle touches leftmost apex */
function leftTurn(midY) {
    const ax = L + R - r;
    return {
        midY,
        ax,
        top: [ax, midY - R],
        bot: [ax, midY + R],
        apex: [ax - R, midY],
        circle: [L, midY],
    };
}

/** Gentle cubic between two points; dir = +1 right, -1 left */
function cubic(p0, p3, dir) {
    const dist = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
    const h = dist / 3;
    const dy = Math.sign(p3[1] - p0[1] || 1);
    const t0 = [dir, 0.06 * dy];
    const t3 = [dir, 0.06 * dy];
    const n0 = Math.hypot(t0[0], t0[1]);
    const n3 = Math.hypot(t3[0], t3[1]);
    t0[0] /= n0;
    t0[1] /= n0;
    t3[0] /= n3;
    t3[1] /= n3;
    return {
        p1: [p0[0] + t0[0] * h, p0[1] + t0[1] * h].map(rnd),
        p2: [p3[0] - t3[0] * h, p3[1] - t3[1] * h].map(rnd),
        p3: p3.map(rnd),
    };
}

const midGap = 2 * R + slope;
const c2mid = y1 + r + slope + R;
const c3mid = c2mid + midGap;
const c4mid = c3mid + midGap;

const t2 = rightTurn(c2mid);
const t3 = leftTurn(c3mid);
const t4 = rightTurn(c4mid); // last turn — ends at right apex

const c1 = [L, y1];
const c1Bottom = [L, y1 + r];

const viewBoxH = Math.ceil(t4.circle[1] + r + 40);

let d = `M ${c1Bottom.map(rnd).join(' ')}`;

let seg = cubic(c1Bottom, t2.top, +1);
d += `\nC ${seg.p1.join(' ')}, ${seg.p2.join(' ')}, ${seg.p3.join(' ')}`;
d += `\nA ${R} ${R} 0 0 1 ${t2.bot.map(rnd).join(' ')}`;

seg = cubic(t2.bot, t3.top, -1);
d += `\nC ${seg.p1.join(' ')}, ${seg.p2.join(' ')}, ${seg.p3.join(' ')}`;
d += `\nA ${R} ${R} 0 0 0 ${t3.bot.map(rnd).join(' ')}`;

// Last turn ends at apex — no bottom tail
seg = cubic(t3.bot, t4.top, +1);
d += `\nC ${seg.p1.join(' ')}, ${seg.p2.join(' ')}, ${seg.p3.join(' ')}`;
d += `\nA ${R} ${R} 0 0 1 ${t4.apex.map(rnd).join(' ')}`;

const centers = [
    { id: 'c1', side: 'left', xy: c1 },
    { id: 'c2', side: 'right', xy: t2.circle },
    { id: 'c3', side: 'left', xy: t3.circle },
    { id: 'c4', side: 'right', xy: t4.circle },
];

console.log('=== params ===');
console.log({ r, R, L, Rg, slope, y1, gap: R - r, midGap, viewBoxW, viewBoxH });

console.log('\n=== circle centers (--x, --y) ===');
centers.forEach((c) => {
    console.log(`${c.id} (${c.side}): --x: ${rnd(c.xy[0])}; --y: ${rnd(c.xy[1])}`);
});

console.log('\n=== CSS hints ===');
console.log(`viewBox="0 0 ${viewBoxW} ${viewBoxH}"`);
console.log(`--snake-w: ${viewBoxW};`);
console.log(`--snake-h: ${viewBoxH};`);
console.log(`--snake-r: ${r};`);

console.log('\n=== PATH (paste into .snake-line and .snake-line-bloom) ===');
console.log(d);
