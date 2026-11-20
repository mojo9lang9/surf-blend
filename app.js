/* Northeast Surf Blend: page rendering. Data comes from data/*.json, refreshed each morning. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const BUOYS = ['44098', '44007', '44013', '44097'];
  const POINTS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const toDeg = (d) => { const i = POINTS.indexOf(String(d || '').toUpperCase()); return i < 0 ? null : i * 22.5; };
  const TRI = 'M0,-5.5 L4.8,4.6 L-4.8,4.6 Z'; /* one shape and size for wind and swell */
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, kids = []) => { const e = document.createElement(tag); for (const k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); } [].concat(kids).forEach((c) => c && e.append(c)); return e; };
  const sv = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const color = (s) => s == null ? 'var(--track)' : s >= 3 ? 'var(--q7)' : s >= 2 ? 'var(--q5)' : s >= 1 ? 'var(--q3)' : 'var(--q0)';
  const cellColor = (x) => x.st === 'dark' ? 'var(--dk)' : x.st !== 'ok' ? 'var(--q0)' : color(x.score);
  const mins = (d) => { const m = String(d || '').match(/(\d+)h(\d+)?/); return m ? +m[1] * 60 + +(m[2] || 0) : 999; };
  const dayLbl = (date, i, todayI) => i === todayI ? 'Today' : i === todayI + 1 ? 'Tmrw' : new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
  const km = (a, b) => { const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) * r / 2), y = (b.lat - a.lat) * r; return Math.sqrt(x * x + y * y) * 6371; };

  const state = { day: 0, spot: null, cam: 0 };
  let rows = [], spots = [], byId = {}, dates = [], todayI = 0;

  function tri(g, deg, fill, stroke, sw) { const p = sv('path', { d: TRI, fill, stroke, 'stroke-width': sw, 'stroke-linejoin': 'round', transform: `rotate(${(deg + 180) % 360})` }); g.append(p); return p; }

  /* ring: closed circle colored by conditions, feet inside, @period with swell triangle below, wind triangle on the ring */
  function ring(r, i, size) {
    const p = `d${i}_`, sc = r[p + 'score'], st = r[p + 'st'], R = 44, svg = sv('svg', { viewBox: '-56 -56 112 112', width: size, height: size, role: 'img' });
    const has = sc != null;
    svg.append(sv('circle', { r: R, fill: 'none', stroke: has ? (st === 'off' ? 'var(--q0)' : color(sc)) : 'var(--track)', 'stroke-width': 9 }));
    const ftc = r[p + 'rain'] ? 'var(--rain)' : r[p + 'smoke'] ? 'var(--smoke)' : 'currentColor';
    const ft = has ? r[p + 'ft'] : '–';
    const t = sv('text', { y: size >= 80 ? -2 : 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': size >= 80 ? (String(ft).length > 3 ? 22 : 28) : (String(ft).length > 3 ? 24 : 30), 'font-weight': 600, fill: ftc, 'font-family': 'Space Grotesk, Inter, sans-serif' });
    t.textContent = ft === 'flat' ? 'flat' : ft + (has ? 'f' : ''); svg.append(t);
    if (has && r[p + 'per'] && size >= 80) {
      const s = sv('text', { x: -4, y: 22, 'text-anchor': 'middle', 'font-size': 12, fill: 'currentColor', opacity: .75 }); s.textContent = `@${r[p + 'per']}s${r[p + 'combo'] ? '*' : ''}`; svg.append(s);
      if (r[p + 'sdeg'] != null) { const g = sv('g', { transform: `translate(${r[p + 'combo'] ? 24 : 20},18)` }); tri(g, r[p + 'sdeg'], '#fff', 'rgba(0,0,0,.65)', 1.2); svg.append(g); }
    }
    if (has && r[p + 'wdeg'] != null && r[p + 'wmph'] > 5) {
      const a = (r[p + 'wdeg'] - 90) * Math.PI / 180, g = sv('g', { transform: `translate(${(R * Math.cos(a)).toFixed(1)},${(R * Math.sin(a)).toFixed(1)}) scale(1.25)` });
      tri(g, r[p + 'wdeg'], '#111', '#fff', 1.4); svg.append(g);
    }
    svg.setAttribute('aria-label', has ? `${ft} ft at ${r[p + 'per'] || '?'} seconds, ${r[p + 'wind']}` : 'no data');
    return svg;
  }

  function buoys(list) {
    const box = $('buoys'); box.textContent = '';
    BUOYS.map((id) => list.find((b) => String(b.id) === id)).filter(Boolean).forEach((b) => {
      const v = el('div', { class: 'v num' }, [document.createTextNode(b.wave_ft != null ? `${b.wave_ft} ft` : '—'), el('small', { text: b.period_s ? `@ ${b.period_s}s` : '' })]);
      if (b.wave_deg != null) { const s = sv('svg', { viewBox: '-8 -8 16 16', width: 20, height: 20 }); const g = sv('g'); tri(g, +b.wave_deg, 'var(--fg)', 'none', 0); s.append(g); v.append(s); }
      const ago = b.time ? Math.round((Date.now() - Date.parse(b.time)) / 36e5) : null;
      box.append(el('a', { class: 'card buoy', href: b.url, target: '_blank', rel: 'noopener' }, [
        el('div', { class: 'lbl', text: `${b.name} · ${b.id}` }), v,
        el('div', { class: 'm', text: [b.wind_mph != null ? `wind ${b.wind_mph} mph` : '', b.water_f ? `water ${b.water_f}°F` : '', ago != null ? `${ago}h ago` : ''].filter(Boolean).join(' · ') })]));
    });
  }

  /* live cam: YouTube streams near the break (from surf-forecast.com's cam list) embed here; other cam sites block framing, so they get a link */
  function camPanel(s) {
    const box = $('cam'); box.textContent = '';
    const cams = s.cams || [], k = Math.min(state.cam || 0, Math.max(0, cams.length - 1)), c = cams[k];
    const own = s.cam_url && !/^nearby/i.test(s.cam_label || '') ? { url: s.cam_url, label: s.cam_label } : null;
    box.append(el('div', { class: 'cam-head' }, [el('h2', { text: c ? c.name.replace(/\s*[-–]\s*LIVE.*$/i, '') : 'Live cam' }), el('span', { class: 'sub', text: c ? `${c.km <= 2 ? 'At' : 'Nearest to'} ${s.name}${c.km > 2 ? ` · ${Math.round(c.km * 0.621)} mi` : ''}` : s.name })]));
    if (c) {
      const src = c.url.replace(/autoplay=1/, 'autoplay=1').replace('www.youtube.com/embed', 'www.youtube-nocookie.com/embed');
      box.append(el('div', { class: 'cam-frame' }, [el('iframe', { src, title: c.name, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '', referrerpolicy: 'strict-origin-when-cross-origin' })]));
      const under = el('div', { class: 'cam-under' });
      if (cams.length > 1) under.append(el('div', { class: 'days' }, cams.map((x, j) => { const b = el('button', { class: 'chip', 'aria-pressed': String(j === k), text: x.name.split(/[,\-–(]/)[0].trim().slice(0, 22) }); b.onclick = () => { state.cam = j; camPanel(s); }; return b; })));
      const id = (c.url.match(/embed\/([^?]+)/) || [])[1];
      const L = el('div', { class: 'links', style: 'margin-top:0' });
      if (id) L.append(el('a', { href: `https://www.youtube.com/watch?v=${id}`, target: '_blank', rel: 'noopener', text: 'YouTube ↗' }));
      if (own) L.append(el('a', { href: own.url, target: '_blank', rel: 'noopener', text: `${own.label} ↗` }));
      under.append(L); box.append(under);
    } else {
      const url = own ? own.url : s.cam_url;
      box.append(el('div', { class: 'cam-frame', style: 'display:grid;place-items:center;text-align:center;padding:20px' }, [el('div', {}, [
        el('p', { class: 'sub', style: 'margin:0 0 12px', text: own ? `${own.label} doesn't allow embedding, and there's no embeddable stream within 30 miles.` : 'No embeddable stream within 30 miles of this break.' }),
        url ? el('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener', text: own ? `Watch ${own.label} ↗` : 'Nearby cams ↗' }) : null])]));
    }
  }

  function hourStrip(r, i) {
    const hours = r[`d${i}_hours`] || [], g = el('div', { class: 'strip' });
    const hr = (h) => h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`;
    g.append(el('div', { class: 'rh', text: '' })); hours.forEach((x) => g.append(el('div', { class: 'c', style: 'color:var(--muted)', text: hr(x.h) })));
    g.append(el('div', { class: 'rh', text: 'Surf ft' }));
    hours.forEach((x) => { const c = el('div', { class: 'c cell', style: `background:${cellColor(x)}${x.rain ? ';color:#cfe9ff' : x.smoke ? ';color:#f3e3b0' : ''}`, title: `${x.ft} ft · ${x.word}${x.why ? ' · ' + x.why : ''}`, text: x.ft === 'flat' ? '–' : x.ft }); g.append(c); });
    g.append(el('div', { class: 'rh', text: 'Wind' }));
    hours.forEach((x) => { const c = el('div', { class: 'c', title: `${x.dir} ${x.mph} mph (${x.wsrc})` });
      if (x.mph != null && x.mph > 5 && toDeg(x.dir) != null) { const s = sv('svg', { viewBox: '-7 -7 14 14', width: 12, height: 12 }); const gg = sv('g'); tri(gg, toDeg(x.dir), 'var(--fg)', 'none', 0); s.append(gg); c.append(s, document.createTextNode(' ' + x.mph)); }
      else c.append(document.createTextNode(x.mph != null ? '≤5' : '')); g.append(c); });
    g.append(el('div', { class: 'rh', text: 'Tide ft' }));
    hours.forEach((x) => g.append(el('div', { class: 'c', style: x.st === 'tide' ? 'background:var(--track)' : x.inTide && x.tide != null ? 'background:color-mix(in srgb, var(--q7) 16%, transparent)' : '', title: x.st === 'tide' ? x.why : x.inTide ? 'in this break\'s tide window' : '', text: x.tide != null ? `${x.tide}${x.rising ? '↑' : '↓'}` : '' })));
    return el('div', { class: 'strip-wrap' }, [g]);
  }

  function pills(r, i) {
    const ps = r[`d${i}_pills`] || [];
    return el('div', {}, [el('div', { class: 'pills' }, ps.map((p) => el('div', { class: 'pill', style: `background:${p.st === 'dark' ? 'var(--dk)' : p.st === 'off' ? 'var(--q0)' : color(p.score)}` }))),
      el('div', { class: 'pill-lbls' }, ['am', 'mid', 'pm'].map((t) => el('span', { text: t })))]);
  }

  function selPanel() {
    const r = rows.find((x) => x.spot === state.spot) || rows[0], s = byId[r.spot], i = state.day, p = `d${i}_`, box = $('sel');
    box.textContent = '';
    const days = el('div', { class: 'days', role: 'group', 'aria-label': 'Day for this break' }, dates.map((d, k) => { const b = el('button', { class: 'chip', 'aria-pressed': String(k === i), text: dayLbl(d, k, todayI) }); b.onclick = () => { state.day = k; render(); }; return b; }));
    const has = r[p + 'score'] != null;
    const verdict = !has ? 'No forecast for this day.' : r[p + 'st'] === 'off' ? (w => w === 'flat' ? 'Flat all day' : 'Off: ' + w)(r[p + 'why'] || 'flat') : `Best ${r[p + 'window']} · ${r[p + 'wind']}${r[p + 'tide'] ? ' · tide ' + r[p + 'tide'] : ''}`;
    box.append(el('div', { class: 'sel-head' }, [ring(r, i, 150), el('div', {}, [
      el('div', { class: 'lbl', text: `${s.state} · ${s.drive} drive${s.sc_source && !/^own/.test(s.sc_source) ? ' · uses ' + s.sc_source : ''}` }),
      el('div', { class: 'sel-name', text: s.name }),
      el('div', { class: 'verdict', text: verdict }),
      has && r[p + 'swtxt'] ? el('div', { class: 'sub', text: `Swell ${r[p + 'swtxt']}` }) : null,
      has && r[p + 'wx'] ? el('div', { class: 'sub', text: r[p + 'wx'] }) : null,
      has ? pills(r, i) : null])]));
    box.append(el('div', { style: 'margin-top:14px' }, [days]));
    if (has) box.append(hourStrip(r, i));
    if (has) box.append(el('div', { class: 'src' }, [
      el('div', {}, [el('div', { class: 'lbl', text: 'Surf Captain 50%' }), el('div', { class: 'v', text: r[p + 'sc'] }), el('div', { class: 'sub', text: r[p + 'cond'] || '' })]),
      el('div', {}, [el('div', { class: 'lbl', text: 'Surfline 25%' }), el('div', { class: 'v', text: r[p + 'sl'] })]),
      el('div', {}, [el('div', { class: 'lbl', text: 'surf-forecast 25%' }), el('div', { class: 'v', text: r[p + 'sf'] })])]));
    const d = el('p', { class: 'desc' });
    if (s.shelter_note) d.append(el('b', { text: s.shelter_note + ' ' }));
    d.append(document.createTextNode(s.guide || ''));
    box.append(d);
    const L = [['Surf Captain', s.sc_page], ['Surfline', s.sl_page], ['surf-forecast', s.sf_page], ['Windy', s.windy_url]].filter((x) => x[1]);
    box.append(el('div', { class: 'links' }, L.map(([t, u]) => el('a', { href: u, target: '_blank', rel: 'noopener', text: t + ' ↗' }))));
    camPanel(s);
  }

  function ranked() {
    const p = `d${state.day}_`;
    return rows.slice().sort((a, b) => (b.pick - a.pick) || ((b[p + 'score'] ?? -1) - (a[p + 'score'] ?? -1)) || (mins(byId[a.spot].drive) - mins(byId[b.spot].drive)));
  }

  function list() {
    const box = $('list'), dbox = $('days'); box.textContent = ''; dbox.textContent = '';
    dates.forEach((d, k) => { const b = el('button', { class: 'chip', 'aria-pressed': String(k === state.day), text: dayLbl(d, k, todayI) }); b.onclick = () => { state.day = k; state.spot = null; render(); }; dbox.append(b); });
    ranked().forEach((r) => {
      const s = byId[r.spot], p = `d${state.day}_`;
      const meta = r[p + 'score'] == null ? 'no data' : r[p + 'st'] === 'off' ? 'off' : r[p + 'window'];
      const b = el('button', { class: 'row' + (r.pick ? '' : ' ref'), 'aria-current': String(r.spot === state.spot) }, [
        el('div', { class: 'r1' }, [el('span', { class: 'rname', text: `${s.name}, ${s.state}` }), el('span', { class: 'rmeta', text: `${s.drive} · ${meta}` })]),
        el('div', { class: 'rdesc', text: s.guide || '' }),
        el('div', { class: 'rdays' }, dates.map((d, k) => el('div', { class: 'rday' + (k === state.day ? ' on' : '') }, [ring(r, k, 46), el('span', { text: dayLbl(d, k, todayI) })])))]);
      b.onclick = () => { state.spot = r.spot; state.cam = 0; try { history.replaceState(null, '', '#' + r.spot); } catch (e) {} render(); $('sel').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      box.append(b);
    });
  }

  function render() { if (!state.spot) state.spot = ranked()[0].spot; selPanel(); list(); }

  const get = (n, opt) => fetch(`data/${n}.json?v=${Date.now() / 6e5 | 0}`).then((r) => r.ok ? r.json() : opt ? [] : Promise.reject(n)).catch((e) => { if (opt) return []; throw e; });
  Promise.all(['spots', 'sc', 'sl', 'wind', 'tides', 'model', 'alerts', 'buoys'].map((n) => get(n)).concat([get('sf', true)])).then(([sp, sc, sl, wind, tides, model, alerts, bu, sf]) => {
    spots = sp; spots.forEach((s) => { byId[s.spot] = s; });
    rows = SBcalc.fn(sp, sc, sl, wind, tides, model, alerts, sf).filter((r) => byId[r.spot]);
    dates = [...new Set(sc.map((r) => r.date))].sort().slice(0, 5);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    todayI = Math.max(0, dates.indexOf(today)); if (dates.indexOf(today) < 0 && dates[0] > today) todayI = -1;
    state.day = Math.max(0, todayI);
    const cap = sc.map((r) => r.captured_at).filter(Boolean).sort().pop();
    $('updated').textContent = cap ? `Updated ${new Date(cap).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET` + (dates.indexOf(today) < 0 ? ' · today’s refresh hasn’t run yet' : '') : '';
    const h = decodeURIComponent(location.hash.slice(1)); if (byId[h]) state.spot = h;
    buoys(bu); render();
    addEventListener('hashchange', () => { const k = decodeURIComponent(location.hash.slice(1)); if (byId[k] && k !== state.spot) { state.spot = k; state.cam = 0; render(); } });
  }).catch((e) => { $('updated').innerHTML = `<span class="err">Couldn’t load ${e}. The morning refresh may be mid-update; reload in a minute.</span>`; });
})();
