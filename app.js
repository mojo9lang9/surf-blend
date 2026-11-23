/* Northeast Surf Blend: page rendering. Data comes from data/*.json, refreshed each morning. */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const BUOYS = ['44098', '44007', '44013', '44097'];
  const POINTS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const toDeg = (d) => { const i = POINTS.indexOf(String(d || '').toUpperCase()); return i < 0 ? null : i * 22.5; };
  const TRI = 'M0,-7 L5,-1 L1.6,-1 L1.6,7 L-1.6,7 L-1.6,-1 L-5,-1 Z'; /* arrow with a tail, same for wind and swell */ /* one shape and size for wind and swell */
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, kids = []) => { const e = document.createElement(tag); for (const k in attrs) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); } [].concat(kids).forEach((c) => c && e.append(c)); return e; };
  const sv = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const color = (s) => s == null ? 'var(--track)' : s >= 3 ? 'var(--q7)' : s >= 2 ? 'var(--q5)' : s >= 1 ? 'var(--q3)' : 'var(--q0)';
  const cellColor = (x) => x.st === 'dark' ? 'var(--dk)' : x.st !== 'ok' ? 'var(--q0)' : color(x.score);
  const mins = (d) => { const m = String(d || '').match(/(\d+)h(\d+)?/); return m ? +m[1] * 60 + +(m[2] || 0) : 999; };
  const dayLbl = (date) => new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
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
    const t = sv('text', { y: size >= 70 ? -2 : 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': size >= 70 ? (String(ft).length > 3 ? 22 : 28) : (String(ft).length > 3 ? 24 : 30), 'font-weight': 600, fill: ftc, 'font-family': '-apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif' });
    t.textContent = ft === 'flat' ? 'flat' : ft + (has ? 'f' : ''); svg.append(t);
    if (has && r[p + 'per'] && size >= 70) {
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
    const hr = (h) => h > 12 ? `${h - 12}` : `${h}`;
    g.append(el('div', { class: 'rh', text: '' })); hours.forEach((x) => g.append(el('div', { class: 'c', style: 'color:var(--muted)', text: hr(x.h) })));
    g.append(el('div', { class: 'rh', text: 'Surf ft' }));
    hours.forEach((x) => { const c = el('div', { class: 'c cell', style: `background:${cellColor(x)}${x.rain ? ';color:#cfe9ff' : x.smoke ? ';color:#f3e3b0' : ''}`, title: `${x.ft} ft · ${x.word}${x.why ? ' · ' + x.why : ''}`, text: x.ft === 'flat' ? '–' : x.ft }); g.append(c); });
    g.append(el('div', { class: 'rh', text: 'Period' }));
    hours.forEach((x) => g.append(el('div', { class: 'c', style: 'color:var(--muted)', title: x.swtxt || '', text: x.per ? `${x.per}s${x.combo ? '*' : ''}` : '' })));
    g.append(el('div', { class: 'rh', text: 'Wind' }));
    hours.forEach((x) => { const c = el('div', { class: 'c', title: `${x.dir} ${x.mph} mph (${x.wsrc})` });
      if (x.mph != null && x.mph > 5 && toDeg(x.dir) != null) { const s = sv('svg', { viewBox: '-7 -7 14 14', width: 12, height: 12 }); const gg = sv('g'); tri(gg, toDeg(x.dir), 'var(--fg)', 'none', 0); s.append(gg); c.append(s, document.createTextNode(' ' + x.mph)); }
      else c.append(document.createTextNode(x.mph != null ? '≤5' : '')); g.append(c); });
    /* tide curve under the hours: green = this break's tide window, grey = tide rule turns it off */
    g.append(el('div', { class: 'rh', text: 'Tide' }));
    const tv = hours.filter((x) => x.tide != null), tc = el('div', { class: 'tide' });
    if (tv.length > 1) {
      const n = hours.length, W = n * 40, H = 70, lo = Math.min(...tv.map((x) => x.tide)) - 0.4, hi = Math.max(...tv.map((x) => x.tide)) + 0.4;
      const X = (k) => (k + 0.5) * 40, Y = (v) => 8 + (H - 20) * (1 - (v - lo) / (hi - lo || 1));
      const t = sv('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', width: '100%', height: H, role: 'img', 'aria-label': 'Tide through the day' });
      hours.forEach((x, k) => { if (x.st === 'tide') t.append(sv('rect', { x: k * 40 + 1, y: 0, width: 38, height: H, rx: 5, fill: 'var(--q0)', opacity: .3 }));
        else if (x.inTide && x.tide != null) t.append(sv('rect', { x: k * 40 + 1, y: 0, width: 38, height: H, rx: 5, fill: 'var(--q7)', opacity: .14 })); });
      const pts = hours.map((x, k) => x.tide == null ? null : [X(k), Y(x.tide)]).filter(Boolean);
      let d = `M${pts[0][0]},${pts[0][1]}`; for (let k = 1; k < pts.length; k++) { const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], mx = (x0 + x1) / 2; d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`; }
      t.append(sv('path', { d: d + ` L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z`, fill: 'var(--rain)', opacity: .12, stroke: 'none' }));
      t.append(sv('path', { d, fill: 'none', stroke: 'var(--rain)', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
      tc.append(t);
      const lab = el('div', { class: 'tide-lbl' }); hours.forEach((x, k) => { const prev = hours[k - 1], next = hours[k + 1];
        const turn = x.tide != null && ((prev && next && prev.tide != null && next.tide != null && ((x.tide >= prev.tide && x.tide >= next.tide) || (x.tide <= prev.tide && x.tide <= next.tide))) || k === 0 || k === n - 1);
        lab.append(el('span', { text: turn ? x.tide.toFixed(1) : '' })); }); tc.append(lab);
    }
    g.append(tc);
    return el('div', { class: 'strip-wrap' }, [g]);
  }

  function pills(r, i, small) {
    const ps = r[`d${i}_pills`] || [];
    return el('div', { class: small ? 'pills sm' : 'pills' }, ps.map((p) => el('div', { class: 'pill', style: `background:${p.st === 'dark' ? 'var(--dk)' : p.st === 'off' ? 'var(--q0)' : color(p.score)}` })));
  }

  /* drive times: Joe's own numbers from Keene by default; real road times (OpenStreetMap routing) when a zip is entered */
  const driveMin = (sp) => state.drives && state.drives[sp.spot] != null ? state.drives[sp.spot] : mins(sp.drive);
  const fmtDrive = (m) => m >= 999 ? '' : `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}`;
  const alertsFor = (sp) => (state.alerts || []).filter((a) => a.zones.some((z) => (sp.nws_zones || []).includes(z)));

  function selPanel() {
    const r = rows.find((x) => x.spot === state.spot) || rows[0], s = byId[r.spot], i = state.day, p = `d${i}_`, box = $('sel');
    box.textContent = '';
    const days = el('div', { class: 'days', role: 'group', 'aria-label': 'Day for this break' }, dates.map((d, k) => { const b = el('button', { class: 'chip', 'aria-pressed': String(k === i), text: dayLbl(d) }); b.onclick = () => { state.day = k; render(); }; return b; }));
    const has = r[p + 'score'] != null;
    const verdict = el('div', { class: 'verdict' });
    if (!has) verdict.textContent = 'No forecast for this day.';
    else if (r[p + 'st'] === 'off') verdict.textContent = (w => w === 'flat' ? 'Flat all day' : 'Off: ' + w)(r[p + 'why'] || 'flat');
    else { verdict.append(document.createTextNode(`Best ${r[p + 'window']} · `));
      verdict.append(s.windy_url ? el('a', { href: s.windy_url, target: '_blank', rel: 'noopener', title: 'Wind on Windy', text: r[p + 'wind'] }) : document.createTextNode(r[p + 'wind']));
      if (r[p + 'tide']) verdict.append(document.createTextNode(' · tide ' + r[p + 'tide'])); }
    const src = [['Surf Captain', r[p + 'sc_win']], ['Surfline', r[p + 'sl_win']], ['surf-forecast', r[p + 'sf_win']]].filter((x) => x[1]);
    const srcs = has && src.length ? el('div', { class: 'srcline' }, src.map(([k, v]) => el('span', {}, [document.createTextNode(k + ' '), el('b', { text: v })]))) : null;
    const swell = has && r[p + 'sw1'] ? el('div', { class: 'swell' }, [el('span', { class: 'lbl', text: r[p + 'combo'] ? 'Combo swell' : 'Swell' }),
      el('span', { text: r[p + 'sw1'] }), r[p + 'sw2'] ? el('span', { class: r[p + 'combo'] ? '' : 'sub', text: ' + ' + r[p + 'sw2'] + (r[p + 'combo'] ? '' : ' (minor)') }) : null]) : null;
    const al = alertsFor(s);
    box.append(el('div', { class: 'sel-head' }, [el('div', { class: 'ringcol' }, [ring(r, i, 150), has ? pills(r, i) : null]), el('div', {}, [
      el('div', { class: 'lbl', text: `${s.state} · ${fmtDrive(driveMin(s))} drive${state.zip ? ' from ' + state.zip : ''}${s.sc_source && !/^own/.test(s.sc_source) ? ' · uses ' + s.sc_source : ''}` }),
      el('div', { class: 'sel-name', text: s.name }),
      verdict, swell,
      has && r[p + 'wx'] ? el('div', { class: 'sub', text: r[p + 'wx'] }) : null,
      ...al.map((a) => el('a', { class: 'alert-chip', href: a.url, target: '_blank', rel: 'noopener', text: `⚠ ${a.event}${a.ends ? ' until ' + a.ends : ''}` })),
      srcs])]));
    box.append(el('div', { style: 'margin-top:14px' }, [days]));
    if (has) box.append(hourStrip(r, i));
    const note = (state.slNotes || []).find((n) => n.region === s.sl_region);
    if (note) box.append(el('div', { class: 'slnote' }, [el('div', { class: 'lbl', text: `Surfline comments · ${new Date(note.captured_at).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })}` }),
      el('div', { class: 'slhead', text: note.headline }), ...String(note.body || '').split('\n').map((t) => el('div', { class: 'sub', text: t }))]));
    const ab = $('slbox'); ab.textContent = ''; ab.hidden = false;
    const d = el('p', { class: 'desc', style: 'margin-top:0' });
    if (s.shelter_note) d.append(el('b', { text: s.shelter_note + ' ' }));
    d.append(document.createTextNode(s.guide || ''));
    ab.append(el('div', { class: 'lbl', text: 'About this break', style: 'margin-bottom:6px' }), d);
    const L = [['Surf Captain', s.sc_page], ['Surfline', s.sl_page], ['surf-forecast', s.sf_page]].filter((x) => x[1]);
    ab.append(el('div', { class: 'links' }, L.map(([t, u]) => el('a', { href: u, target: '_blank', rel: 'noopener', text: t + ' ↗' }))));
    if (camShown !== s.spot) { camShown = s.spot; camPanel(s); }
  }
  let camShown = null;

  /* best = size × conditions: clean ×1, fair ×0.6, choppy ×0.3; flat, off or no data = 0. Ties go to the shorter drive. */
  const MULT = { 3: 1, 2: 0.6, 1: 0.3 };
  const value = (r, i) => { const p = `d${i}_`; if (r[p + 'score'] == null) return -1; if (r[p + 'st'] === 'off') return 0; return (r[p + 'mid'] || 0) * (MULT[r[p + 'score']] || 0); };
  function ranked(i = state.day) {
    return rows.slice().sort((a, b) => (b.pick - a.pick) || (value(b, i) - value(a, i)) || (driveMin(byId[a.spot]) - driveMin(byId[b.spot])));
  }

  function list() {
    const box = $('list'), dbox = $('days'); box.textContent = ''; dbox.textContent = '';
    dates.forEach((d, k) => { const b = el('button', { class: 'chip', 'aria-pressed': String(k === state.day), text: dayLbl(d) }); b.onclick = () => { state.day = k; render(); }; dbox.append(b); });
    ranked().forEach((r) => {
      const s = byId[r.spot], p = `d${state.day}_`;
            const others = dates.map((d, k) => k).filter((k) => k !== state.day);
      const al = alertsFor(s);
      const b = el('button', { class: 'tile' + (r.pick ? '' : ' ref'), 'aria-current': String(r.spot === state.spot) }, [
        el('div', { class: 'tname', text: s.name }),
        el('div', { class: 'rmeta tmeta', text: [s.state, fmtDrive(driveMin(s)), r[p + 'st'] === 'ok' ? r[p + 'window'] : r[p + 'st'] === 'off' && r[p + 'why'] && r[p + 'why'] !== 'flat' ? 'off at ' + r[p + 'why'].replace('off within 1h of ', '') : ''].filter(Boolean).join(' · ') }),
        al.length ? el('div', { class: 'alert-badge', title: al.map((a) => a.event).join(', '), text: '⚠ ' + al[0].event + (al.length > 1 ? ` +${al.length - 1}` : '') }) : null,
        el('div', { class: 'ringcol big' }, [ring(r, state.day, 77), r[p + 'score'] != null ? pills(r, state.day) : el('div', { class: 'pills' })]),
        el('div', { class: 'rdays' }, others.map((k) => el('div', { class: 'rday' }, [ring(r, k, 42), r[`d${k}_score`] != null ? pills(r, k, true) : el('div', { class: 'pills sm' }), el('span', { text: dayLbl(dates[k]) })])))]);
      b.onclick = () => { state.spot = r.spot; state.cam = 0; try { history.replaceState(null, '', '#' + r.spot); } catch (e) {} render(); };
      box.append(b);
    });
  }

  /* live NWS alerts: land zones for each break plus its coastal waters (Atlantic marine region) */
  function loadAlerts() {
    const want = /gale|storm|hurricane|tropical|small craft|high surf|rip current|coastal flood|flood|thunderstorm|tornado|fog|marine|hazardous seas|high wind|wind advisory|blizzard|tsunami/i;
    const zonesOf = (f) => (f.properties.affectedZones || []).map((u) => u.split('/').pop()).concat((f.properties.geocode && f.properties.geocode.UGC) || []);
    const q = (u) => fetch(u, { headers: { Accept: 'application/geo+json' } }).then((r) => r.ok ? r.json() : { features: [] }).catch(() => ({ features: [] }));
    Promise.all([q('https://api.weather.gov/alerts/active?area=ME,NH,MA,RI'), q('https://api.weather.gov/alerts/active?region=AT')]).then(([a, b]) => {
      const seen = new Set(), mine = new Set(spots.flatMap((sp) => sp.nws_zones || []));
      state.alerts = a.features.concat(b.features).filter((f) => { const id = f.properties.id; if (seen.has(id)) return false; seen.add(id); return want.test(f.properties.event); })
        .map((f) => ({ event: f.properties.event, zones: zonesOf(f), url: f.properties['@id'] || 'https://www.weather.gov/', area: f.properties.areaDesc || '',
          ends: (f.properties.ends || f.properties.expires) ? new Date(f.properties.ends || f.properties.expires).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', timeZone: 'America/New_York' }) : '' }))
        .filter((x) => x.zones.some((z) => mine.has(z)));
      const bar = $('alerts'); bar.textContent = '';
      const groups = {}; state.alerts.forEach((x) => { const names = spots.filter((sp) => x.zones.some((z) => (sp.nws_zones || []).includes(z)) && sp.pick !== false).map((sp) => sp.name); (groups[x.event] = groups[x.event] || { a: x, n: new Set() }); names.forEach((n) => groups[x.event].n.add(n)); });
      Object.values(groups).forEach(({ a, n }) => bar.append(el('a', { class: 'alert-row', href: a.url, target: '_blank', rel: 'noopener' }, [el('b', { text: '⚠ ' + a.event }), document.createTextNode(`${a.ends ? ' until ' + a.ends : ''} · ${[...n].slice(0, 6).join(', ')}${n.size > 6 ? ` +${n.size - 6} more` : ''}`)])));
      bar.hidden = !bar.childNodes.length;
      if (rows.length) render();
    });
  }

  /* zip → road drive times for every break */
  function setZip(zip) {
    const msg = $('zipmsg');
    if (!/^\d{5}$/.test(zip)) { state.zip = null; state.drives = null; try { localStorage.removeItem('sb-zip'); } catch (e) {} msg.textContent = 'from Keene'; render(); return; }
    msg.textContent = 'routing…';
    fetch(`https://api.zippopotam.us/us/${zip}`).then((r) => r.ok ? r.json() : Promise.reject('zip')).then((z) => {
      const pl = z.places[0], from = `${(+pl.longitude).toFixed(4)},${(+pl.latitude).toFixed(4)}`;
      const list = spots.filter((sp) => sp.lat && sp.lon);
      return fetch(`https://router.project-osrm.org/table/v1/driving/${from};${list.map((sp) => `${sp.lon},${sp.lat}`).join(';')}?sources=0&annotations=duration`).then((r) => r.ok ? r.json() : Promise.reject('route')).then((t) => {
        state.drives = {}; list.forEach((sp, k) => { const sec = t.durations[0][k + 1]; if (sec != null) state.drives[sp.spot] = sec / 60; });
        state.zip = zip; try { localStorage.setItem('sb-zip', zip); } catch (e) {}
        msg.textContent = `from ${pl['place name']}, ${pl['state abbreviation']}`; render(); });
    }).catch((e) => { msg.textContent = e === 'zip' ? 'zip not found' : 'routing unavailable, showing Keene'; state.drives = null; state.zip = null; render(); });
  }

  function render() { if (!rows.length) return; if (!state.spot || !byId[state.spot]) state.spot = ranked(Math.max(0, todayI))[0].spot; selPanel(); list(); }

  let hashHooked = false;
  function load(bust) {
    const v = bust ? Date.now() : Date.now() / 6e5 | 0;
    const get = (n, opt) => fetch(`data/${n}.json?v=${v}`, bust ? { cache: 'no-store' } : {}).then((r) => r.ok ? r.json() : opt ? [] : Promise.reject(n)).catch((e) => { if (opt) return []; throw e; });
    $('updated').textContent = bust ? 'Reloading…' : $('updated').textContent;
    return Promise.all(['spots', 'sc', 'sl', 'wind', 'tides', 'model', 'alerts', 'buoys'].map((n) => get(n)).concat([get('sf', true), get('sl_notes', true)])).then(([sp, sc, sl, wind, tides, model, alerts, bu, sf, sln]) => {
      state.slNotes = sln;
      spots = sp; byId = {}; spots.forEach((s) => { byId[s.spot] = s; });
      SBcalc.today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      rows = SBcalc.fn(sp, sc, sl, wind, tides, model, alerts, sf).filter((r) => byId[r.spot]);
      const prevDate = dates[state.day];
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      dates = [...new Set(sc.map((r) => r.date))].sort(); { const keep = dates.filter((d) => d >= today); if (keep.length) dates = keep; } dates = dates.slice(0, 5);
      todayI = dates.indexOf(today) >= 0 ? dates.indexOf(today) : 0;
      state.day = bust && dates.indexOf(prevDate) >= 0 ? dates.indexOf(prevDate) : todayI;
      const cap = sc.map((r) => r.captured_at).filter(Boolean).sort().pop();
      $('updated').textContent = cap ? `Updated ${new Date(cap).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET` + (dates.indexOf(today) < 0 ? ' · today’s refresh hasn’t run yet' : '') : '';
      if (!bust) { const h = decodeURIComponent(location.hash.slice(1)); if (byId[h]) state.spot = h; }
      buoys(bu); render();
      if (!hashHooked) { hashHooked = true; addEventListener('hashchange', () => { const k = decodeURIComponent(location.hash.slice(1)); if (byId[k] && k !== state.spot) { state.spot = k; state.cam = 0; render(); } }); }
    }).catch((e) => { $('updated').innerHTML = `<span class="err">Couldn’t load ${e}. The morning refresh may be mid-update; try again in a minute.</span>`; });
  }
  $('refresh').onclick = () => { load(true); loadAlerts(); };
  $('zipform').onsubmit = (e) => { e.preventDefault(); setZip($('zip').value.trim()); };
  load(false).then(() => { loadAlerts(); let z = null; try { z = localStorage.getItem('sb-zip'); } catch (e) {} if (z) { $('zip').value = z; setZip(z); } });
})();
