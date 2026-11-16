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
const INFO = '<svg class="ap-ico" width="16" height="16" viewBox="0 0 24 24" style="color:var(--ink-blue-5)"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
const T = { click: 1.75, saved: 2.35, end: 5.4 };
const SWITCH = [1388, 13.5, 32, 20];
const NOTICE = [404.3, 68, 856, 63.6];
// Ring [from, to, x, y, w, h, r]
const RINGS = [
  [1.3, T.click + 0.15, SWITCH[0] - 5, SWITCH[1] - 5, SWITCH[2] + 10, SWITCH[3] + 10, 15],
  [T.saved + 0.15, 99, NOTICE[0] - 5, NOTICE[1] - 5, NOTICE[2] + 10, NOTICE[3] + 10, 15],
];
kit.scene('pause-bookings', {
  init(kit) {
    const action =
      '<div class="ap-text" style="left:1240.8px;top:15.5px;color:var(--ink-gray-7)">Accepting bookings</div>' +
      '<div class="ap-switch pb-switch" style="left:' + SWITCH[0] + 'px;top:' + SWITCH[1] + 'px;width:' + SWITCH[2] + 'px;height:' + SWITCH[3] + 'px"><span class="ap-knob pb-knob" style="width:16px;height:16px"></span></div>';
    const notice =
      '<div class="ap-abs pb-notice" style="left:' + NOTICE[0] + 'px;top:' + NOTICE[1] + 'px;width:' + NOTICE[2] + 'px;height:' + NOTICE[3] + 'px;border-radius:12px;background:var(--surface-gray-1);visibility:hidden">' +
      '<div class="ap-abs" style="left:14px;top:13px">' + INFO + '</div>' +
      '<div class="ap-text" style="left:40px;top:12px;font-weight:500">Your booking page is off</div>' +
      '<div class="ap-small" style="left:40px;top:34.1px;line-height:19.5px;letter-spacing:.195px;color:var(--ink-gray-7)">People can\'t book you right now. Group meetings you\'re part of still work.</div></div>';
    const page = SHELL('home', 'Home', action) + '<div class="ap-abs pb-body" style="left:0;top:0;width:1440px;height:900px">' + homeBody() + '</div>' + notice;
    kit.stage.append(kit.h('<div class="ground"><div class="ap-cam pb-cam"><div class="ap-win">' + page + '<div class="ap-ring pb-ring"></div></div></div></div>'));
    const q = (c) => kit.stage.querySelector('.pb-' + c);
    for (const k of ['cam', 'switch', 'knob', 'notice', 'body', 'ring']) this[k] = q(k);
    this.link = this.body.querySelector('.ap-linkbar');
    this.camera = new kit.Camera(this.cam);
    this.camera.set([
      { t: 0, cx: 960, cy: 540, z: 1.1, hold: 0.5 },
      { t: 1.3, cx: 1058, cy: 440, z: 1.55, hold: 9, drift: [-2, 0, 0.004] },
    ]);
    const SW = W(SWITCH[0] + 16, SWITCH[1] + 10);
    this.cur = kit.cursor();
    this.cam.appendChild(this.cur.el);
    this.cur.keys = [
      { t: 0, at: W(760, 520) }, { t: 0.6, at: W(760, 520) }, { t: 1.35, at: SW }, { t: 2.1, at: SW }, { t: 2.8, at: [SW[0] - 40, SW[1] + 190] }, { t: T.end, at: [SW[0] - 44, SW[1] + 194] },
    ];
    this.cur.clicks = [T.click];
  },
  render(t) {
    this.camera.apply(t);
    const z = this.camera.at(t).z;
    const off = t >= T.click;
    this.switch.style.background = off ? 'var(--surface-gray-4)' : 'var(--surface-gray-10)';
    this.knob.style.transform = 'translateX(' + 12 * (1 - eo(seg(t, T.click, T.click + 0.15))) + 'px)';
    this.switch.style.opacity = off && t < T.saved ? 0.5 : 1;
    const saved = t >= T.saved;
    this.notice.style.visibility = saved ? 'visible' : 'hidden';
    this.body.style.transform = saved ? 'translateY(91.6px)' : 'none';
    this.link.style.opacity = saved ? 0.55 : 1;
    let r = null;
    for (const ring of RINGS) if (t >= ring[0] && t < ring[1]) r = ring;
    if (r) {
      const s = this.ring.style;
      s.left = r[2] + 'px'; s.top = r[3] + 'px'; s.width = r[4] + 'px'; s.height = r[5] + 'px'; s.borderRadius = r[6] + 'px';
      s.opacity = Math.min(eo(seg(t, r[0], r[0] + 0.25)), 1 - seg(t, r[1] - 0.15, r[1]));
    } else this.ring.style.opacity = 0;
    this.cur.render(t);
    this.cur.el.style.transform += ' scale(' + (1.1 / z).toFixed(4) + ')';
  },
});
