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
const box = (x, y, w, h, r, extra) => '<div style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;border-radius:' + r + 'px;box-sizing:border-box;' + (extra || '') + '"></div>';
const line = (x, y, w) => '<div style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:1px;background:var(--outline-gray-1)"></div>';
const at = (x, y, cls, html, extra) => '<div class="' + cls + '" style="left:' + x + 'px;top:' + y + 'px;' + (extra || '') + '">' + html + '</div>';
const ICON = (size, paths, extra) => '<svg class="ap-ico" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" style="' + (extra || '') + '">' + paths + '</svg>';
const PLUS = ICON(16, '<path d="M5 12h14"/><path d="M12 5v14"/>');
const X16 = ICON(16, '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');
const X12 = ICON(12, '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');
const SEARCH = ICON(14, '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 'color:var(--ink-gray-5)');
const LOADER = ICON(16, '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>');
const LINK_ICON = ICON(14, '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>');
const COPY = ICON(14, '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>');
const CHECK = (size, w) => ICON(size, '<path d="M20 6 9 17l-5-5"/>', 'stroke-width:' + w);
const TINT = { blue: 'background:var(--surface-blue-2);color:var(--ink-blue-7)', green: 'background:var(--surface-green-2);color:var(--ink-green-7)', amber: 'background:var(--surface-amber-2);color:var(--ink-amber-7)', gray: 'background:var(--surface-gray-3);color:var(--ink-gray-7)' };
const PEOPLE = [
  { name: 'Ananya Bharadwaj', email: 'ananya@example.com', tint: 'blue' },
  { name: 'Frank Martinez', email: 'frank@example.com', tint: 'green' },
  { name: 'Henry Johnson', email: 'henry@example.com', tint: 'amber' },
  { name: 'Shanthi Priya', email: 'shanthi@example.com', tint: 'gray' },
];
const initial = (x, y, p, size) => at(x, y, 'ap-initial', p.name[0], 'width:' + size + 'px;height:' + size + 'px;font-size:' + (size === 22 ? 11 : 12) + 'px;' + TINT[p.tint]);
const NAME = 'Hiring panel';
const SLUG = (s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const T = { open: 1.6, type: 2.5, people: 4.0, pickA: 4.9, pickF: 5.7, add: 6.7, optional: 7.6, step2: 8.7, step3: 9.8, create: 10.9, saved: 11.5, end: 15 };
const typed = kit.typist(NAME, T.type, 18);
// The dialog's top and height for each state; it's centred, so it moves when its height changes.
const D = { a: [155.6, 588.9], b: [115.6, 668.9], s2: [208.4, 483.2], s3: [153.9, 592.2] };
const STEP_X = [[20, 48, 44.3, 'People'], [258.4, 286.4, 51.9, 'Meeting'], [504.5, 532.5, 87.5, 'Booking rules']];
const stepper = (step) => {
  let s = '';
  [[102.3, 146.1], [348.4, 146.1]].forEach(([x, w], i) => {
    s += '<div style="position:absolute;left:' + x + 'px;top:81.5px;width:' + w + 'px;height:1px;background:var(--' + (i + 1 <= step ? 'outline-gray-4' : 'outline-gray-2') + ')"></div>';
  });
  STEP_X.forEach(([mx, lx, , label], i) => {
    const cur = i === step, done = i < step;
    if (done) s += at(mx, 72, 'ap-abs', CHECK(12, 3), 'width:20px;height:20px;border-radius:9999px;display:grid;place-items:center;background:var(--surface-gray-10);color:var(--ink-base)');
    else s += at(mx, 72, 'ap-abs', String(i + 1), 'width:20px;height:20px;border-radius:9999px;box-sizing:border-box;display:grid;place-items:center;font-size:12px;letter-spacing:.24px;border:1.5px solid var(--' + (cur ? 'ink-gray-9' : 'outline-gray-3') + ');color:var(--' + (cur ? 'ink-gray-9' : 'ink-gray-5') + ');font-weight:' + (cur ? 500 : 420));
    s += at(lx, 74.5, 'ap-small', label, 'color:var(--' + (cur ? 'ink-gray-9' : done ? 'ink-gray-6' : 'ink-gray-5') + ');font-weight:' + (cur ? 500 : 420));
  });
  return s;
};
const heading = (text) => at(20, 120, 'ap-abs', text, 'font-size:24px;font-weight:600;line-height:28.8px;letter-spacing:-.24px;color:var(--ink-gray-9);white-space:nowrap');
const btnMd = (x, y, label, cls, extra) => at(x, y, 'ap-btn ap-btn-md ' + cls, label, extra);
const dialog = (cls, state, step, body, footer) => {
  const [top, h] = D[state];
  return '<div class="ap-abs ' + cls + '" style="left:400px;top:' + top + 'px;width:640px;height:' + h + 'px;border-radius:16px;background:var(--surface-elevation-1);box-shadow:var(--elevation-2xl);overflow:hidden;visibility:hidden">' +
    at(20, 16.3, 'ap-abs', 'New group', 'font-size:16px;font-weight:600;line-height:18.4px;letter-spacing:.24px;color:var(--ink-gray-9);white-space:nowrap') +
    at(521, 18, 'ap-small', 'Step ' + (step + 1) + ' of 3', 'color:var(--ink-gray-5)') + at(606, 17.5, 'ap-abs', X16, 'color:var(--ink-gray-7)') +
    line(0, 51, 640) + stepper(step) + body + line(0, h - 57, 640) + footer + '</div>';
};
const field = (x, y, w, label) => sub(x, y + 7.5, label) + g(x, y + 20.9, w, 28, 8);
// Step 1. withPeople: after Ananya and Frank are added (state b).
const step1 = (cls, withPeople) => {
  const dy = withPeople ? 80 : 0;
  let s = heading("Who's in this group?") + txt(20, 167.3, 560) + txt(20, 188.3, 30);
  s += at(20, 226.8, 'ap-small', 'Group name', 'color:var(--ink-gray-6)');
  s += '<div class="ap-abs gl-input" style="left:20px;top:247.7px;width:600px;height:28px;border-radius:8px;box-sizing:border-box;display:flex;align-items:center;padding:0 8px;font-size:14px;letter-spacing:.28px;' + (withPeople ? 'background:var(--surface-gray-2);border:1px solid transparent' : 'background:var(--surface-base);border:1px solid var(--outline-gray-4);box-shadow:var(--focus-ring)') + '">' +
    (withPeople ? NAME : '<span class="gl-typed"></span><span class="gl-caret" style="width:1px;height:16px;background:var(--ink-gray-8);margin-left:1px"></span><span class="gl-placeholder" style="color:var(--ink-gray-4);margin-left:-2px">Design review</span>') + '</div>';
  s += at(20, 303.7, 'ap-small', 'Link', 'color:var(--ink-gray-6)');
  s += at(20, 322.6, 'ap-text', withPeople ? 'example.com/schedule/gr/' + SLUG(NAME) : '<span class="gl-link">example.com/schedule/gr/…</span>');
  s += txt(20, 352.4, 478);
  s += at(20, 390.2, 'ap-text', 'People', 'font-weight:500');
  s += g(20, 420.3, 28, 28, 14) + txt(58, 425.9, 116) + sub(58, 443.4, 166);
  if (withPeople) {
    PEOPLE.slice(0, 2).forEach((p, i) => {
      const y = 456.3 + 40 * i;
      s += initial(20, y + 4, p, 28) + at(58, y + 1.5, 'ap-text', p.name);
      s += at(58, y + 19.6, 'ap-small ' + (i ? 'gl-req' : ''), 'Required', 'color:var(--ink-gray-5)');
      s += '<div class="ap-switch ' + (i ? 'gl-sw' : '') + '" style="left:556px;top:' + (y + 10) + 'px;width:26px;height:16px"><span class="ap-knob ' + (i ? 'gl-knob' : '') + '" style="width:12px;height:12px;transform:translateX(10px)"></span></div>';
      s += at(598, y + 10, 'ap-abs', X16, 'color:var(--ink-gray-5)');
    });
  }
  s += at(20, 460.3 + dy, 'ap-btn ap-ghost-btn', PLUS + 'Add people');
  s += txt(20, 502 + dy, 566);
  const footer = g(20, 544.8 + dy, 72.2, 32, 8) + btnMd(533.3, 544.8 + dy, 'Continue', 'ap-solid ' + (withPeople ? 'gl-cont1' : ''));
  return dialog(cls, withPeople ? 'b' : 'a', 0, s, footer);
};
const step2 = () => {
  let s = heading("What's the meeting like?") + txt(20, 167.3, 422);
  [[20, 205.8, 44], [328, 205.8, 158], [20, 270.7, 70], [328, 270.7, 121]].forEach(([x, y, w]) => { s += field(x, y, 292, w); });
  s += sub(20, 355.2, 150) + txt(20, 374.6, 333) + sub(20, 396.5, 391);
  return dialog('gl-d2', 's2', 1, s, g(20, 439.2, 58.2, 32, 8) + btnMd(533.3, 439.2, 'Continue', 'ap-solid gl-cont2'));
};
const step3 = () => {
  let s = heading('When can guests book?') + txt(20, 167.3, 462);
  s += field(20, 205.8, 292, 103) + sub(20, 270.5, 178) + field(328, 205.8, 292, 69) + sub(328, 270.5, 81) + field(20, 296.2, 292, 79);
  s += txt(20, 381.2, 153) + sub(20, 402.5, 340) + g(594, 385, 26, 16, 8);
  s += field(20, 440.8, 300, 116) + sub(20, 505.5, 166);
  const create = '<div class="ap-btn ap-btn-md ap-solid gl-create" style="right:20px;top:548.2px"><span class="gl-spin" style="display:none">' + LOADER + '</span>Create group</div>';
  return dialog('gl-d3', 's3', 2, s, g(20, 548.2, 58.2, 32, 8) + create);
};
// Add people popover: opens above its trigger, so it grows upward as people are picked.
const popover = () => {
  let s = '<div class="ap-abs gl-pop" style="left:420px;bottom:290px;width:400px;display:none;flex-direction:column;border-radius:12px;border:1px solid var(--outline-gray-1);background:var(--surface-elevation-2);box-shadow:var(--elevation-2xl);z-index:20">';
  s += '<div style="position:relative;height:40px">' + at(12, 12.5, 'ap-small', 'Add people', 'font-weight:500') + at(370, 12, 'ap-abs', X16, 'color:var(--ink-gray-6)') + '</div>';
  s += '<div class="gl-chips" style="display:none;gap:6px;padding:0 12px 8px;height:24px">' + PEOPLE.slice(0, 2).map((p, i) =>
    '<span class="gl-chip' + i + '" style="display:none;align-items:center;gap:6px;height:24px;padding:0 2px;border-radius:9999px;background:var(--surface-gray-2)"><span style="position:relative;width:22px;height:22px">' + initial(0, 0, p, 22) + '</span><span style="font-size:13px;letter-spacing:.26px;white-space:nowrap">' + p.name + '</span><span style="display:grid;place-items:center;width:20px;height:20px;color:var(--ink-gray-5)">' + X12 + '</span></span>').join('') + '</div>';
  s += '<div style="padding:0 8px 8px"><div style="display:flex;align-items:center;gap:8px;height:32px;padding:0 8px;border-radius:8px;background:var(--surface-gray-2)">' + SEARCH +
    '<span class="gl-scaret" style="width:1px;height:16px;background:var(--ink-gray-8)"></span><span style="font-size:14px;letter-spacing:.28px;color:var(--ink-gray-4);margin-left:-8px;white-space:nowrap">Search by name or email</span></div></div>';
  s += '<div style="position:relative;height:226px">';
  s += '<div style="position:absolute;left:6px;top:0;width:386px;height:44px">' + g(8, 15, 14, 14, 3) + g(32, 8, 28, 28, 14) + txt(70, 14.5, 77) + sub(70, 30.5, 150) + '</div>';
  PEOPLE.forEach((p, i) => {
    s += '<div class="gl-row' + i + '" style="position:absolute;left:6px;top:' + 44 * (i + 1) + 'px;width:386px;height:44px;border-radius:8px">' +
      '<span class="gl-box' + i + '" style="position:absolute;left:8px;top:15px;width:14px;height:14px;border-radius:3px;box-sizing:border-box;border:1px solid var(--outline-gray-4);background:var(--surface-base);display:grid;place-items:center;color:var(--ink-base)"></span>' +
      initial(32, 8, p, 28) + at(70, 6.5, 'ap-text', p.name, 'font-weight:500') + at(70, 23.6, 'ap-abs', p.email, 'font-size:12px;line-height:13.8px;letter-spacing:.24px;color:var(--ink-gray-5);white-space:nowrap') + '</div>';
  });
  s += '</div>';
  s += '<div style="position:relative;height:44px;border-top:1px solid var(--outline-gray-1)">' + at(12, 12.3, 'ap-small gl-pick', 'Pick one or more.', 'line-height:19.5px;color:var(--ink-gray-5)') +
    at(6, 8, 'ap-btn ap-ghost-btn gl-clear', 'Clear', 'height:24px;padding:0 6px;font-size:13px;color:var(--ink-gray-6);display:none') +
    '<div class="ap-btn gl-add" style="right:8px;top:8px">Add people</div></div>';
  return s + '</div>';
};
const groupsPage = () => {
  const action = '<div class="ap-btn ap-solid gl-new" style="left:1306.6px;top:9.5px">' + PLUS + 'New group</div>';
  let s = SHELL('groups', 'Group meetings', action);
  s += txt(404.3, 78.5, 420) + txt(404.3, 126.2, 96) + box(404.3, 147.4, 856, 185.1, 12, 'border:1px solid var(--outline-gray-1)');
  s += txt(728.9, 196.5, 207) + sub(642.3, 224, 380) + sub(729, 243.5, 206) + g(786.6, 263.5, 91.4, 28, 8);
  s += txt(404.3, 369.7, 130) + sub(404.3, 392.6, 520) + box(404.3, 414.4, 422, 182, 12, 'border:1px solid var(--outline-gray-1)');
  s += txt(421.3, 439.5, 60) + sub(421.3, 461, 262) + g(735.8, 431.4, 73.5, 20, 10) + g(421.3, 499.3, 28, 28, 14) + sub(459.3, 513.4, 232) + g(421.3, 543.3, 388, 36, 10);
  return s;
};
const groupPage = () => {
  let s = SHELL('groups', ['Group meetings', NAME], g(1377.8, 9.5, 42.2, 28, 8));
  s += box(404.3, 68, 524, 40, 12, 'background:var(--surface-gray-1)') + at(416.3, 80, 'ap-text', 'example.com/schedule/gr/' + SLUG(NAME));
  s += at(739.2, 74, 'ap-btn ap-ghost-btn', LINK_ICON + 'Open') + at(820.1, 74, 'ap-btn', COPY + 'Copy link', 'width:102.1px;background:var(--surface-base);border:1px solid var(--outline-gray-2);box-shadow:var(--elevation-sm)');
  s += txt(404.3, 150, 73) + g(789.2, 136, 139.1, 28, 8) + line(404.3, 172, 524) + sub(404.3, 194.5, 398) + line(404.3, 216.5, 524) + sub(404.3, 236, 487) + sub(404.3, 255.5, 220);
  s += txt(960.3, 77.2, 54) + g(960.3, 98.4, 28, 28, 14) + txt(998.3, 104, 116) + sub(998.3, 121.5, 166);
  PEOPLE.slice(0, 2).forEach((p, i) => {
    const y = 134.4 + 40 * i;
    s += initial(960.3, y + 4, p, 28) + at(998.3, y + 1.5, 'ap-text', p.name) + at(998.3, y + 19.6, 'ap-small', i ? 'Optional' : 'Required', 'color:var(--ink-gray-5)');
    s += '<div class="ap-switch" style="left:1196.3px;top:' + (y + 10) + 'px;width:26px;height:16px;background:var(--' + (i ? 'surface-gray-4' : 'surface-gray-10') + ')"><span class="ap-knob" style="width:12px;height:12px;transform:translateX(' + (i ? 0 : 10) + 'px)"></span></div>';
    s += at(1238.3, y + 10, 'ap-abs', X16, 'color:var(--ink-gray-5)');
  });
  s += g(960.3, 214.4, 116.9, 28, 8) + sub(960.3, 256, 282) + sub(960.3, 275.5, 120);
  s += txt(960.3, 406.6, 60);
  for (let i = 0; i < 8; i++) s += sub(960.3, 441 + 24 * i, 64) + sub(1060, 441 + 24 * i, 90 + (i * 37) % 70);
  return s;
};
// Ring [from, to, x, y, w, h, r] in window coordinates; 'add' and 'create' use the button's own width. Rings on controls that go away end at the click.
const RINGS = [
  [0.95, T.open + 0.15, 1301.6, 4.5, 123.4, 38, 13],
  [3.55, T.people + 0.15, 415, 610.9, 126.9, 38, 13],
  [4.45, T.pickA + 0.15, 422, 377, 396, 54, 13],
  [5.25, T.pickF + 0.15, 422, 421, 396, 54, 13],
  [6.25, T.add, 'add'],
  [7.15, T.optional + 0.15, 951, 616.9, 36, 26, 13],
  [8.25, T.step2, 928.3, 735.4, 96.8, 42, 13],
  [9.35, T.step3, 928.3, 642.6, 96.8, 42, 13],
  [10.45, T.create + 0.15, 'create'],
  [T.saved + 0.8, 99, 399.3, 63, 534, 50, 17],
];
kit.scene('group-link', {
  init(kit) {
    const before = '<div class="ap-abs gl-before" style="left:0;top:0;width:1440px;height:900px">' + groupsPage() + '</div>';
    const after = '<div class="ap-abs gl-after" style="left:0;top:0;width:1440px;height:900px;visibility:hidden">' + groupPage() + '</div>';
    const shade = '<div class="ap-abs gl-shade" style="left:0;top:0;width:1440px;height:900px;background:rgba(0,0,0,.3);visibility:hidden"></div>';
    const page = before + after + shade + step1('gl-d1a', false) + step1('gl-d1b', true) + step2() + step3() + popover();
    kit.stage.append(kit.h('<div class="ground"><div class="ap-cam gl-cam"><div class="ap-win">' + page + '<div class="ap-ring gl-ring"></div></div></div></div>'));
    const q = (c) => kit.stage.querySelector('.gl-' + c);
    for (const k of ['cam', 'before', 'after', 'shade', 'd1a', 'd1b', 'd2', 'd3', 'pop', 'typed', 'caret', 'placeholder', 'link', 'chips', 'chip0', 'chip1', 'scaret', 'pick', 'clear', 'add', 'row0', 'row1', 'box0', 'box1', 'sw', 'knob', 'req', 'cont1', 'cont2', 'create', 'spin', 'new', 'ring']) this[k] = q(k);
    // The Add button's width once two people are picked, measured while the popover is briefly shown: it's hidden when its ring fades.
    this.pop.style.display = 'flex';
    this.add.textContent = 'Add 2 people';
    this.addW2 = this.add.offsetWidth;
    this.pop.style.display = 'none';
    this.camera = new kit.Camera(this.cam);
    this.camera.set([
      { t: 0, cx: 960, cy: 540, z: 1.1, hold: 0.5 },
      { t: 1.25, cx: 1080, cy: 430, z: 1.6, hold: 0.5 },
      { t: 2.4, cx: 960, cy: 540, z: 1.55, hold: T.saved + 0.1 - 2.4 },
      { t: T.saved + 0.9, cx: 1060, cy: 420, z: 1.65, hold: 9, drift: [0, 0, 0.004] },
    ]);
    this.cur = kit.cursor();
    this.cam.appendChild(this.cur.el);
    const hold = (t, p) => [{ t, at: p }];
    this.cur.keys = [
      { t: 0, at: W(760, 420) }, { t: 0.6, at: W(760, 420) }, { t: 1.3, at: W(1363.3, 23.5) }, { t: 1.9, at: W(1363.3, 23.5) },
      { t: 2.7, at: W(700, 700) }, { t: 3.0, at: W(700, 700) }, { t: 3.6, at: W(478.5, 629.9) }, { t: 4.1, at: W(478.5, 629.9) },
      { t: 4.5, at: W(442, 404) }, { t: 4.95, at: W(442, 404) }, { t: 5.35, at: W(442, 448) }, { t: 5.75, at: W(442, 448) },
      { t: 6.3, at: W(757, 587) }, { t: 6.75, at: W(757, 587) }, { t: 7.25, at: W(969, 629.9) }, { t: 7.65, at: W(969, 629.9) },
      { t: 8.3, at: W(976.7, 756.4) }, { t: 8.75, at: W(976.7, 756.4) }, { t: 9.35, at: W(976.7, 663.6) }, { t: 9.85, at: W(976.7, 663.6) },
      { t: 10.45, at: W(964, 718.1) }, { t: 11.6, at: W(964, 718.1) }, { t: 12.3, at: W(880, 380) }, ...hold(T.end, W(884, 384)),
    ];
    this.cur.clicks = [T.open, T.people, T.pickA, T.pickF, T.add, T.optional, T.step2, T.step3, T.create];
  },
  render(t) {
    this.camera.apply(t);
    const z = this.camera.at(t).z;
    const [cx, cy] = this.cur.position(t);
    const over = (x, y, w, h) => cx > x + 240 && cx < x + 240 + w && cy > y + 90 && cy < y + 90 + h;
    const vis = (el, on) => (el.style.visibility = on ? 'visible' : 'hidden');
    const saved = t >= T.saved;
    const open = t >= T.open && !saved;
    vis(this.before, !saved);
    vis(this.after, saved);
    vis(this.shade, open);
    vis(this.d1a, open && t < T.add);
    vis(this.d1b, open && t >= T.add && t < T.step2);
    vis(this.d2, open && t >= T.step2 && t < T.step3);
    vis(this.d3, open && t >= T.step3);
    this.new.style.background = !open && !saved && over(1306.6, 9.5, 113.4, 28) ? 'var(--surface-gray-9)' : 'var(--surface-gray-10)';
    // Group name: caret before the placeholder until the first character, blinking only while idle.
    const text = typed.at(t);
    this.typed.textContent = text;
    this.placeholder.style.display = text ? 'none' : 'inline';
    const idle = t < T.type || t > typed.end + 0.1;
    const since = t < T.type ? t - T.open : t - typed.end;
    this.caret.style.visibility = open && t < T.people && (!idle || Math.floor(since * 2) % 2 === 0) ? 'visible' : 'hidden';
    this.link.textContent = 'example.com/schedule/gr/' + (SLUG(text) || '…');
    // Add people popover.
    const popOpen = t >= T.people && t < T.add;
    this.pop.style.display = popOpen ? 'flex' : 'none';
    const a = t >= T.pickA, f = t >= T.pickF;
    this.chips.style.display = a ? 'flex' : 'none';
    this.chip0.style.display = a ? 'inline-flex' : 'none';
    this.chip1.style.display = f ? 'inline-flex' : 'none';
    this.scaret.style.visibility = Math.floor((t - T.people) * 2) % 2 === 0 ? 'visible' : 'hidden';
    [[this.box0, a], [this.box1, f]].forEach(([b, on]) => {
      b.style.background = on ? 'var(--ink-gray-9)' : 'var(--surface-base)';
      b.style.borderColor = on ? 'var(--ink-gray-9)' : 'var(--outline-gray-4)';
      b.innerHTML = on ? '<svg class="ap-ico" width="10" height="10" viewBox="0 0 24 24" style="stroke-width:4"><path d="M20 6 9 17l-5-5"/></svg>' : '';
    });
    this.row0.style.background = popOpen && over(427, 382, 386, 44) ? 'var(--surface-gray-2)' : 'transparent';
    this.row1.style.background = popOpen && over(427, 426, 386, 44) ? 'var(--surface-gray-2)' : 'transparent';
    this.pick.style.display = a ? 'none' : 'block';
    this.clear.style.display = a ? 'flex' : 'none';
    this.add.textContent = f ? 'Add 2 people' : a ? 'Add 1 person' : 'Add people';
    const addW = f ? this.addW2 : this.add.offsetWidth;
    const addX = 810.9 - addW;
    this.add.style.background = !a ? 'var(--surface-gray-2)' : over(addX, 573, addW, 28) ? 'var(--surface-gray-9)' : 'var(--surface-gray-10)';
    this.add.style.color = a ? 'var(--ink-base)' : 'var(--ink-gray-4)';
    // Frank becomes optional.
    const optional = t >= T.optional;
    this.sw.style.background = optional ? 'var(--surface-gray-4)' : 'var(--surface-gray-10)';
    this.knob.style.transform = 'translateX(' + 10 * (1 - eo(seg(t, T.optional, T.optional + 0.15))) + 'px)';
    this.req.textContent = optional ? 'Optional' : 'Required';
    this.cont1.style.background = over(933.3, 740.4, 86.8, 32) ? 'var(--surface-gray-9)' : 'var(--surface-gray-10)';
    this.cont2.style.background = over(933.3, 647.6, 86.8, 32) ? 'var(--surface-gray-9)' : 'var(--surface-gray-10)';
    // Create group: a spinner while it saves.
    const saving = t >= T.create;
    const createW = this.create.offsetWidth;
    this.spin.style.display = saving ? 'block' : 'none';
    this.spin.style.transform = 'rotate(' + ((t - T.create) * 360) % 360 + 'deg)';
    this.create.style.background = saving ? 'var(--surface-gray-2)' : over(1020 - createW, 702.1, createW, 32) ? 'var(--surface-gray-9)' : 'var(--surface-gray-10)';
    this.create.style.color = saving ? 'var(--ink-gray-4)' : 'var(--ink-base)';
    let r = null;
    for (const ring of RINGS) if (t >= ring[0] && t < ring[1]) r = ring;
    if (r && r[2] === 'add') r = [r[0], r[1], addX - 5, 568, addW + 10, 38, 13];
    if (r && r[2] === 'create') r = [r[0], r[1], 1020 - createW - 5, 697.1, createW + 10, 42, 13];
    if (r) {
      const s = this.ring.style;
      s.left = r[2] + 'px'; s.top = r[3] + 'px'; s.width = r[4] + 'px'; s.height = r[5] + 'px'; s.borderRadius = r[6] + 'px';
      s.opacity = Math.min(eo(seg(t, r[0], r[0] + 0.25)), 1 - seg(t, r[1] - 0.15, r[1]));
    } else this.ring.style.opacity = 0;
    this.cur.render(t);
    this.cur.el.style.transform += ' scale(' + (1.1 / z).toFixed(4) + ')';
  },
});
