const { seg, lerp, eo, ei, eio } = kit;
// ==== Appointments shell v1 ====
// The /schedule app's sidebar and header, measured at 1440x900. All Ghost except the header title, a Landmark.
// SHELL(page, title, action): page is the active sidebar item, title a string or a breadcrumb array, action the header's right side.
const SHELL = (() => {
  const g = (x, y, w, h, r) => '<div style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;border-radius:' + r + 'px;background:var(--surface-gray-3)"></div>';
  const txt = (x, cy, w) => g(x, cy - 5, w, 10, 5);
  const sub = (x, cy, w) => g(x, cy - 4, w, 8, 4);
  const ico = (x, y) => g(x + 1, y + 1, 14, 14, 4);
  const NAV = [['home', 40.4], ['types', 98.5], ['availability', 74.2], ['groups', 109.6]];
  return (page, title, action) => {
    let s = '<div style="position:absolute;left:0;top:0;width:224.7px;height:900px;background:var(--surface-sidebar);border-right:1px solid var(--outline-gray-1);box-sizing:border-box">';
    s += g(10, 10, 28, 28, 6) + txt(46, 15.5, 97) + sub(46, 33, 70.8) + ico(197.7, 16);
    NAV.forEach(([key, w], i) => {
      const y = 52 + 30 * i;
      if (key === page) s += '<div style="position:absolute;left:8px;top:' + y + 'px;width:207.7px;height:28px;border-radius:8px;background:var(--surface-elevation-3);box-shadow:var(--elevation-sm)"></div>';
      s += ico(16, y + 6) + txt(40, y + 14, w);
    });
    [[834, 31.7], [864, 56]].forEach(([y, w]) => { s += ico(16, y + 6) + txt(40, y + 14, w); });
    s += '</div><div style="position:absolute;left:224.7px;right:0;top:47px;height:1px;background:var(--outline-gray-1)"></div>';
    const words = [].concat(title);
    s += '<div style="position:absolute;left:244.7px;top:14.3px;display:flex;gap:6px;font-size:16px;font-weight:600;line-height:18.4px;letter-spacing:.24px;color:var(--ink-gray-5);white-space:nowrap">' + words.map((w, i) => (i ? '<span>/</span>' : '') + '<span>' + w + '</span>').join('') + '</div>';
    return s + (action || '');
  };
})();
// ==== end shell ====
const W = (x, y) => [x + 240, y + 90];
const g = (x, y, w, h, r) => '<div style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;border-radius:' + r + 'px;background:var(--surface-gray-3)"></div>';
const txt = (x, cy, w) => g(x, cy - 5, w, 10, 5);
const sub = (x, cy, w) => g(x, cy - 4, w, 8, 4);
const ico = (x, y) => g(x, y, 14, 14, 4);
const box = (x, y, w, h, r, extra) => '<div style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;border-radius:' + r + 'px;box-sizing:border-box;' + (extra || '') + '"></div>';
// Home with the booking page on, below the header: booking link, meeting type cards, upcoming bookings.
const HOME = {
  link: [404.3, 98.4, 856, 40],
  cards: [404.3, 693.7, 983],
  cardTop: 196.8,
  titles: [74, 96, 118],
};
const homeLinkBar = () => '<div class="ap-abs ap-linkbar" style="left:0;top:0">' + box(404.3, 98.4, 856, 40, 12, 'background:var(--surface-gray-1)') + txt(416.3, 118.4, 255) + ico(1079.3, 111.4) + txt(1099.3, 118.4, 37) + g(1152.2, 104.4, 102.1, 28, 8) + '</div>';
const homeCard = (i, inner) => {
  const x = HOME.cards[i], y = HOME.cardTop;
  return box(x, y, 277.3, 113, 12, 'border:1px solid var(--outline-gray-1);background:var(--surface-base)') + (inner || (txt(x + 17, y + 25, HOME.titles[i]) + sub(x + 17, y + 46.5, 150) + g(x + 17, y + 68, 100.1, 28, 8)));
};
const homeBookings = () => {
  let s = '<div style="position:absolute;left:404.3px;top:368.2px;width:856px;height:1px;background:var(--outline-gray-1)"></div>';
  [[176, 96], [212, 104], [150, 96]].forEach(([w, w2], i) => {
    const y = 369.2 + 63 * i;
    s += g(404.3, y + 12, 44, 38, 8) + txt(459.3, y + 23, w) + sub(459.3, y + 41, w2);
    s += '<div style="position:absolute;left:404.3px;top:' + (y + 62) + 'px;width:856px;height:1px;background:var(--outline-gray-1)"></div>';
  });
  return s;
};
const homeBody = (cards) => txt(404.3, 77.2, 136) + homeLinkBar() + txt(404.3, 175.6, 117) + [0, 1, 2].map((i) => homeCard(i, cards && cards[i])).join('') + txt(404.3, 347, 150) + homeBookings();
const ICON = (paths) => '<svg class="ap-ico" width="14" height="14" viewBox="0 0 24 24">' + paths + '</svg>';
const CLOCK = ICON('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>');
const VIDEO = ICON('<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>');
const COPY = ICON('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>');
const CHECK = ICON('<path d="M20 6 9 17l-5-5"/>');
const CARD = 1;
const CX = HOME.cards[CARD] + 17, CY = HOME.cardTop + 17;
const BTN = [CX, CY + 68, 100.1, 28];
const T = { click: 2.2, end: 3.8 };
const card =
  '<div class="ap-text" style="left:' + CX + 'px;top:' + CY + 'px;font-weight:500">Product demo</div>' +
  '<div class="ap-small" style="left:' + CX + 'px;top:' + (CY + 21.7) + 'px;display:flex;align-items:center;gap:6px;color:var(--ink-gray-5)">' + CLOCK + '<span>45 minutes</span><span>·</span>' + VIDEO + '<span>Google Meet</span></div>' +
  '<div class="ap-btn ap-subtle mt-btn" style="left:' + BTN[0] + 'px;top:' + BTN[1] + 'px"><span class="mt-copy">' + COPY + '</span><span class="mt-check" style="display:none">' + CHECK + '</span><span class="mt-label">Copy link</span></div>';
kit.scene('meeting-type-link', {
  init(kit) {
    const action = txt(1240.8, 23.5, 137.2) + g(1388, 13.5, 32, 20, 10);
    const page = SHELL('home', 'Home', action) + homeBody({ [CARD]: card });
    kit.stage.append(kit.h('<div class="ground"><div class="ap-cam mt-cam"><div class="ap-win">' + page + '<div class="ap-ring mt-ring"></div></div></div></div>'));
    const q = (c) => kit.stage.querySelector('.mt-' + c);
    for (const k of ['cam', 'btn', 'copy', 'check', 'label', 'ring']) this[k] = q(k);
    this.camera = new kit.Camera(this.cam);
    this.camera.set([
      { t: 0, cx: 960, cy: 540, z: 1.1, hold: 0.5 },
      { t: 1.4, cx: 1072, cy: 372, z: 2, hold: 9, drift: [0, 0, 0.004] },
    ]);
    const ON = W(BTN[0] + 50, BTN[1] + 14);
    this.cur = kit.cursor();
    this.cam.appendChild(this.cur.el);
    this.cur.keys = [
      { t: 0, at: W(1000, 560) }, { t: 1.0, at: W(1000, 560) }, { t: 1.8, at: ON }, { t: 2.45, at: ON }, { t: 3.0, at: [ON[0] + 40, ON[1] + 56] }, { t: T.end, at: [ON[0] + 42, ON[1] + 58] },
    ];
    this.cur.clicks = [T.click];
  },
  render(t) {
    this.camera.apply(t);
    const z = this.camera.at(t).z;
    const copied = t >= T.click;
    this.copy.style.display = copied ? 'none' : 'block';
    this.check.style.display = copied ? 'block' : 'none';
    this.label.textContent = copied ? 'Copied' : 'Copy link';
    const [x, y] = this.cur.position(t);
    const [bx, by] = W(BTN[0], BTN[1]);
    const w = this.btn.offsetWidth;
    const over = x > bx && x < bx + w && y > by && y < by + BTN[3];
    this.btn.style.background = over ? 'var(--surface-gray-3)' : 'var(--surface-gray-2)';
    this.btn.style.transform = 'scale(' + (1 - 0.04 * seg(t, T.click - 0.05, T.click) * (1 - seg(t, T.click, T.click + 0.12))) + ')';
    const s = this.ring.style;
    s.left = BTN[0] - 5 + 'px'; s.top = BTN[1] - 5 + 'px'; s.width = w + 10 + 'px'; s.height = BTN[3] + 10 + 'px'; s.borderRadius = '11px';
    s.opacity = eo(seg(t, 1.4, 1.65));
    this.cur.render(t);
    this.cur.el.style.transform += ' scale(' + (1.1 / z).toFixed(4) + ')';
  },
});
