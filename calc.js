/* Northeast Surf Blend scoring. Ported from the Claude dashboard (page5) with the Nov 17 changes:
   heights blend Surf Captain 50%, Surfline 25%, surf-forecast.com 25%, renormalized when a source is missing. */
const SBcalc = {
  title: 'Spot outlook by day and hour',
  description: 'Per spot and day: blended surf height, Surf Captain swell (plus any secondary swell), Surf Captain wind and clean/fair/choppy call stepped up where a headland blocks the wind, tide and daylight, hour by hour from 6am to 6pm, and the cleanest two-hour window.',
  fn: (spots, scRows, slRows, noaa, tides, model, alerts, sfRows) => {
    const POINTS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    const toDeg = (d) => { const i = POINTS.indexOf(String(d || '').toUpperCase()); return i < 0 ? null : i * 22.5; };
    const toPt = (deg) => POINTS[Math.round(((+deg % 360) + 360) % 360 / 22.5) % 16];
    const hr = (h) => h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`;
    const parseFt = (s) => { s = String(s || '').toLowerCase(); if (!s) return null; if (s.includes('flat')) return [0, 0];
      const m = s.match(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(\+)?/); if (!m) return null;
      const lo = +m[1]; let hi = m[2] ? +m[2] : lo; if (m[3]) hi += 0.5; return [lo, hi]; };
    const angle = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
    const fmt = (lo, hi) => { const a = Math.round(lo), b = Math.round(hi); return b <= 0 ? 'flat' : a === b ? `${a}` : `${a}-${b}`; };
    const LV = { c: 3, f: 2, x: 1 }, WORD = ['', 'choppy', 'fair', 'clean'];
    const parseSw = (s) => { const m = String(s || '').match(/^([\d.]+)@(\d+)([NSEW]+)$/); return m ? { ft: +m[1], s: +m[2], dir: m[3] } : null; };
    const parseW = (s) => { const m = String(s || '').match(/^([NSEW]{1,3})(\d+)$/); return m ? { dir: m[1], mph: +m[2] } : null; };
    const inArc = (deg, spec) => String(spec || '').split(';').map((r) => r.trim()).filter(Boolean).some((r) => { const [a, b] = r.split('@')[0].split('-').map(Number); return a <= b ? deg >= a && deg <= b : deg >= a || deg <= b; });
    /* clean/fair/choppy from wind against this spot's own offshore, for spots whose Surf Captain page is a neighboring town's */
    const ownLv = (w, s) => { if (!w) return null; const deg = toDeg(w.dir); if (w.mph <= 5 || deg == null) return 3; const d = angle(deg, +s.offshore_deg);
      if (w.mph >= 18 && d > 30) return 1; return d <= 60 ? 3 : d <= 100 ? 2 : 1; };
    const combo = (a, b) => !!(a && b && b.ft >= 0.5 && (b.ft >= 1 || b.ft >= 0.5 * a.ft));
    const tideOk = (pref, f) => { if (f == null) return true;
      switch (pref) { case 'low': return f <= 0.4; case 'low-mid': return f <= 0.6; case 'mid': return f >= 0.25 && f <= 0.75; case 'mid-high': return f >= 0.35; case 'high': return f >= 0.6; default: return true; } };
    const scBy = {}; scRows.forEach((r) => { const hs = String(r.hours || '6,10,14,18').split(',').map(Number);
      scBy[r.slug + '|' + r.date] = String(r.t || '').split(' ').map((tok, i) => { if (!tok || tok === '?') return null; const [h, c, w, s1, s2] = tok.split('|');
        return { hour: hs[i], raw: h, ft: parseFt(h === 'flat' ? 'flat' : h), lv: LV[c] || null, cond: ({ c: 'clean', f: 'fair', x: 'choppy' })[c] || '', w: parseW(w), s1: parseSw(s1), s2: parseSw(s2) }; }).filter(Boolean); });
    let dates = [...new Set(scRows.map((r) => r.date))].sort(); { const k = dates.filter((d) => !SBcalc.today || d >= SBcalc.today); if (k.length) dates = k; } dates = dates.slice(0, 5);
    const sfBy = {}; (sfRows || []).forEach((r) => { sfBy[r.spot] = r.days || {}; });
    const parseSf = (tok) => { const m = String(tok || '').match(/^([AP])([\d.]+)(?:@(\d+))?([NSEW]*)$/); return m ? { half: m[1], ft: +m[2], s: m[3] ? +m[3] : null, dir: m[4] } : null; };
    const slBy = {}; slRows.forEach((r) => { slBy[r.spot] = String(r.days || '').split(','); });
    const noaaBy = {}; noaa.forEach((r) => { noaaBy[r.zone + '|' + r.date] = { note: r.note || '', t: String(r.w || '').split(' ').map((x) => { const m = x.match(/^([NSEW]{1,3}|-)(\d+)([RXS]?)$/); return m ? { dir: m[1] === '-' ? '' : m[1], mph: +m[2], wx: m[3] } : null; }) }; });
    const modBy = {}; model.forEach((r) => { const hs = String(r.hours).split(',').map(Number); modBy[r.zone + '|' + r.date] = String(r.t).split(' ').map((x, i) => { const a = x.split(',').map(Number); return { hour: hs[i], swell_ft: a[0], swell_s: a[1], swell_deg: a[2], wave_ft: a[3], wind_deg: a[4], wind_mph: a[5], aqi: a[6] }; }); });
    const ev = {}; tides.forEach((r) => { ev[r.station] = String(r.ev).split(' ').map((x) => { const m = x.match(/^(\S{16})([HL])(-?[\d.]+)$/); return m ? { ms: Date.parse(m[1] + ':00Z'), type: m[2], ft: +m[3] } : null; }).filter(Boolean).sort((a, b) => a.ms - b.ms); });
    const KILL = /tornado|severe thunderstorm|flood|dense fog|hurricane|tropical storm|special marine|blizzard|ice storm/i;
    const al = alerts.filter((a) => a.event && KILL.test(a.event)).map((a) => ({ zone: a.zone, event: a.event, a: Date.parse(a.onset), b: Date.parse(a.ends) }));
    const cellMs = (date, h) => Date.parse(`${date}T${String(h).padStart(2, '0')}:00:00Z`);
    const tideAt = (station, date, h) => { const a = ev[station]; if (!a) return null; const ms = cellMs(date, h);
      for (let i = 0; i < a.length - 1; i++) { const p = a[i], n = a[i + 1]; if (ms >= p.ms && ms <= n.ms) {
        const x = (ms - p.ms) / (n.ms - p.ms), ft = p.ft + (n.ft - p.ft) * (1 - Math.cos(Math.PI * x)) / 2;
        const lo = Math.min(p.ft, n.ft), hi = Math.max(p.ft, n.ft); return { ft: Math.round(ft * 10) / 10, f: hi > lo ? (ft - lo) / (hi - lo) : 0.5, rising: n.ft > p.ft }; } }
      return null; };
    const tideOff = (s, date, h) => { if (!s.off_tide) return false; const want = s.off_tide === 'high' ? 'H' : 'L', a = ev[s.tide_station] || [], c0 = cellMs(date, h), c1 = c0 + 36e5;
      return a.some((e) => e.type === want && e.ms + 36e5 > c0 && e.ms - 36e5 < c1); };
    const sun = (lat, lon, date) => { const d = new Date(date + 'T12:00:00Z'), n = Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5), g = 2 * Math.PI / 365 * (n - 1);
      const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
      const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
      const la = lat * Math.PI / 180, ha = Math.acos(Math.cos(90.833 * Math.PI / 180) / (Math.cos(la) * Math.cos(dec)) - Math.tan(la) * Math.tan(dec)) * 180 / Math.PI;
      let off = -5; try { off = +new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(d) - 12; } catch (e) {}
      const noon = 720 - 4 * lon - eq; return { off, rise: (noon - 4 * ha) / 60 + off, set: (noon + 4 * ha) / 60 + off }; };
    const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    return spots.map((s) => {
      const proxy = !!s.sc_slug && !/^own|same stretch/.test(String(s.sc_source || 'own'));
      const hasAlt = s.alt_offshore_deg !== null && s.alt_offshore_deg !== undefined && s.alt_offshore_deg !== '';
      const row = { spot: s.spot, name: s.name, state: s.state, band: s.band, drive: s.drive, pick: String(s.pick) !== 'false', sc_proxy: proxy };
      dates.forEach((date, i) => {
        const p = `d${i}_`, slots = (s.sc_slug && scBy[s.sc_slug + '|' + date]) || [], slRaw = (slBy[s.spot] || [])[i] || '', sl = parseFt(slRaw);
        const sfDay = ((sfBy[s.spot] || {})[String(+date.slice(8))] || []).map(parseSf).filter(Boolean);
        const sfAt = (h) => { const want = h < 12 ? 'A' : 'P'; return (sfDay.find((x) => x.half === want) || sfDay[0] || null); };
        if (!slots.some((x) => x.ft) && !sl && !sfDay.length) { row[p + 'score'] = null; return; }
        const lf = +s.local_factor || 1, nd = noaaBy[s.wind_zone + '|' + date], mday = modBy[s.wind_zone + '|' + date] || [], sn = sun(+s.lat, +s.lon, date);
        const nearest = (arr, h) => arr.length ? arr.reduce((q, x) => Math.abs(x.hour - h) < Math.abs(q.hour - h) ? x : q) : null;
        const hours = HOURS.map((h) => {
          let A = null, B = null; slots.forEach((x) => { if (x.ft && x.hour <= h && (!A || x.hour > A.hour)) A = x; if (x.ft && x.hour >= h && (!B || x.hour < B.hour)) B = x; });
          A = A || B; B = B || A; const t = A && B && B.hour > A.hour ? (h - A.hour) / (B.hour - A.hour) : 0, N = nearest(slots, h);
          const scH = A ? [A.ft[0] + (B.ft[0] - A.ft[0]) * t, A.ft[1] + (B.ft[1] - A.ft[1]) * t] : null;
          const sfx = sfAt(h), sfH = sfx ? [sfx.ft, sfx.ft] : null;
          const wsc = scH ? 0.5 : 0, wsl = sl ? 0.25 : 0, wsf = sfH ? 0.25 : 0, tot = wsc + wsl + wsf || 1;
          const lo = ((scH ? scH[0] : 0) * wsc + (sl ? sl[0] : 0) * wsl + (sfH ? sfH[0] : 0) * wsf) / tot * lf;
          const hi = ((scH ? scH[1] : 0) * wsc + (sl ? sl[1] : 0) * wsl + (sfH ? sfH[1] : 0) * wsf) / tot * lf;
          const nw = nd ? nd.t[h - 5] : null, m = nearest(mday, h);
          const w = N && N.w ? N.w : nw && nw.dir ? { dir: nw.dir, mph: nw.mph } : null;
          let lv = proxy || !N || !N.lv ? ownLv(w, s) : N.lv; if (lv == null) lv = 2;
          const deg = w ? toDeg(w.dir) : null; let bump = '';
          if (lv < 3 && w && w.mph > 5 && deg != null) {
            if (hasAlt && angle(deg, +s.alt_offshore_deg) <= 60) { lv += 1; bump = `${s.alt_label} side offshore`; }
            else if (inArc(deg, s.shelter_from)) { lv += 1; bump = 'headland shelter'; } }
          const td = tideAt(s.tide_station, date, h), real = cellMs(date, h) - sn.off * 36e5;
          const alert = al.find((x) => x.zone === s.wind_zone && x.a < real + 36e5 && x.b > real);
          const dark = h + 1 <= sn.rise - 0.5 || h >= sn.set + 0.5, toff = tideOff(s, date, h), kill = (nw && nw.wx === 'X') || !!alert, flat = (lo + hi) / 2 < 0.75;
          const st = dark ? 'dark' : kill ? 'wx' : toff ? 'tide' : flat ? 'flat' : 'ok';
          const why = dark ? 'dark' : kill ? (alert ? alert.event : (nd.note || 'severe weather')) : toff ? `off within 1h of ${s.off_tide} tide` : flat ? 'flat' : '';
          const sw1 = N && N.s1 ? N.s1 : m ? { ft: m.swell_ft, s: m.swell_s, dir: toPt(m.swell_deg) } : null, sw2 = N ? N.s2 : null, cb = combo(sw1, sw2);
          return { h, lo, hi, ft: fmt(lo, hi), per: sw1 ? sw1.s : null, sdir: sw1 ? sw1.dir : '', combo: cb,
            swtxt: sw1 ? `${sw1.ft}@${sw1.s} ${sw1.dir}${cb ? ` + ${sw2.ft}@${sw2.s} ${sw2.dir}` : ''}` : '',
            dir: w ? w.dir : '', mph: w ? w.mph : null, wsrc: N && N.w ? 'Surf Captain' : 'NOAA',
            word: w && w.mph <= 5 ? 'light' : (WORD[lv] + (bump ? ` (${bump})` : '')), sccond: N ? N.cond : '', bump,
            tide: td ? td.ft : null, rising: td ? td.rising : null, inTide: tideOk(s.tide_pref, td ? td.f : null), st, why,
            rain: !!(nw && nw.wx === 'R'), smoke: !!((nw && nw.wx === 'S') || (m && m.aqi > 100)), wxnote: nd ? nd.note : '',
            noaa: nw ? `${nw.dir || 'calm'} ${nw.mph}` : '', m_wind: m ? `${toPt(m.wind_deg)} ${m.wind_mph}` : '', m_sw: m ? `${m.swell_ft} ft @ ${m.swell_s}s ${toPt(m.swell_deg)}` : '',
            score: st === 'ok' ? lv : 0 };
        });
        let best = -1, bi = -1;
        for (let k = 0; k < hours.length - 1; k++) { const a = hours[k], b = hours[k + 1]; if (a.st !== 'ok' || b.st !== 'ok') continue;
          const v = Math.min(a.score, b.score) * 1000 + (a.inTide + b.inTide) * 50 + (a.lo + a.hi + b.lo + b.hi); if (v > best) { best = v; bi = k; } }
        const on = bi >= 0; if (!on) bi = Math.max(0, hours.findIndex((x) => x.st !== 'dark')); if (bi > hours.length - 2) bi = 0;
        const h0 = hours[bi], h1 = hours[bi + 1], scMax = slots.map((x) => x.ft).filter(Boolean).sort((a, b) => b[1] - a[1])[0];
        const split = scMax && sl ? Math.abs((scMax[0] + scMax[1]) / 2 - (sl[0] + sl[1]) / 2) : 0;
        const pills = [[6, 9], [10, 13], [14, 18]].map(([a, b]) => { const lit = hours.filter((x) => x.h >= a && x.h <= b && x.st !== 'dark');
          if (!lit.length) return { st: 'dark', score: 0 }; const ok = lit.filter((x) => x.st === 'ok');
          return ok.length * 2 >= lit.length ? { st: 'ok', score: Math.round(ok.reduce((q, x) => q + x.score, 0) / ok.length) } : { st: 'off', score: 0 }; });
        const noon = hours[6];
        Object.assign(row, {
          [p + 'score']: on ? Math.min(h0.score, h1.score) : 0, [p + 'st']: on ? 'ok' : 'off', [p + 'why']: on ? '' : (() => { const c = {}; hours.filter((x) => x.st !== 'dark' && x.why).forEach((x) => { c[x.why] = (c[x.why] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || ''; })(),
          [p + 'ft']: fmt((h0.lo + h1.lo) / 2, (h0.hi + h1.hi) / 2), [p + 'mid']: Math.round((h0.lo + h1.lo + h0.hi + h1.hi) / 4 * 10) / 10,
          [p + 'per']: h0.per, [p + 'sdir']: h0.sdir, [p + 'sdeg']: toDeg(h0.sdir), [p + 'combo']: h0.combo, [p + 'swtxt']: h0.swtxt,
          [p + 'window']: on ? `${hr(h0.h)}–${hr(h0.h + 2)}` : 'off all day',
          [p + 'wind']: h0.dir ? `${h0.dir} ${h0.mph} ${h0.word}` : 'no wind data', [p + 'wdeg']: toDeg(h0.dir), [p + 'wmph']: h0.mph,
          [p + 'tide']: h0.tide == null ? '' : `${h0.tide} ft ${h0.rising ? 'rising' : 'falling'}`,
          [p + 'rain']: on && (h0.rain || h1.rain), [p + 'smoke']: on && (h0.smoke || h1.smoke), [p + 'wx']: h0.rain || h0.smoke ? h0.wxnote : '',
          [p + 'cond']: slots.map((x) => x.cond).filter(Boolean).join(' → '),
          [p + 'sc']: slots.length ? slots.map((x) => x.raw || '—').join(' / ') + ' ft' : 'n/a',
          [p + 'sw']: noon.swtxt || '—', [p + 'msw']: noon.m_sw || '—',
          [p + 'sl']: sl ? (/flat/i.test(slRaw) ? 'flat' : slRaw.replace(/ft$/, '') + ' ft') : 'n/a',
          [p + 'sf']: sfDay.length ? sfDay.map((x) => `${x.half === 'A' ? 'am' : 'pm'} ${x.ft}${x.s ? '@' + x.s + 's' : ''}`).join(' / ') + ' ft' : 'n/a',
          [p + 'date']: date,
          [p + 'sc_win']: (() => { const N = slots.length ? slots.reduce((q, x) => Math.abs(x.hour - h0.h) < Math.abs(q.hour - h0.h) ? x : q) : null; return N && N.raw ? `${N.raw === 'flat' ? 'flat' : N.raw + 'f'}${N.s1 ? ' @' + N.s1.s + 's' : ''}` : ''; })(),
          [p + 'sl_win']: sl ? (/flat/i.test(slRaw) ? 'flat' : slRaw.replace(/\s*ft$/, '') + 'f') : '',
          [p + 'sf_win']: (() => { const x = sfAt(h0.h); return x ? `${x.ft}f${x.s ? ' @' + x.s + 's' : ''}` : ''; })(),
          [p + 'sw1']: (() => { const N = slots.length ? slots.reduce((q, x) => Math.abs(x.hour - h0.h) < Math.abs(q.hour - h0.h) ? x : q) : null; return N && N.s1 ? `${N.s1.ft} ft @ ${N.s1.s}s ${N.s1.dir}` : ''; })(),
          [p + 'sw2']: (() => { const N = slots.length ? slots.reduce((q, x) => Math.abs(x.hour - h0.h) < Math.abs(q.hour - h0.h) ? x : q) : null; return N && N.s2 ? `${N.s2.ft} ft @ ${N.s2.s}s ${N.s2.dir}` : ''; })(),
          [p + 'split_ft']: Math.round(split * 2) / 2, [p + 'pills']: pills, [p + 'hours']: hours });
      });
      return row;
    });
  }
};
