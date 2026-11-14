// FCZ Radar — inoffizielle Fan-App. Vanilla JS, keine Abhängigkeiten, keine Keys.
// Daten: data/*.json (per GitHub Action aus dbFCZ, FCZforum, FotMob gebaut) + live: Mastodon @dbFCZ, Wikipedia.

const FCZ = 1; // dbFCZ team id
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const S = { db: null, home: null, forum: null, arch: null, fm: null, meta: null, ps: null };
const IX = { prov: new Map() };
let routeSeq = 0; // guards async renders against fast navigation

// ---------------------------------------------------------------- utils
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MARKS = /[̀-ͯ]/g;
const foldChar = (ch) => ch.normalize('NFD').replace(MARKS, '').toLowerCase().replace(/ß/g, 'ss').replace(/đ/g, 'd').replace(/[«»"'`´.,()\-\/]/g, ' ');
const norm = (s) => [...String(s ?? '')].map(foldChar).join('').replace(/\s+/g, ' ').trim();
const fmtD = (iso) => (iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '–');
const nf = new Intl.NumberFormat('de-CH');
const fmtN = (n) => (n == null ? '–' : nf.format(n));
const zurichISO = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }); // YYYY-MM-DD
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s; };
const store = {
  get(k, d) { try { const v = localStorage.getItem('fczr:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fczr:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
function rel(iso) {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'gerade eben';
  if (d < 3600) return `vor ${Math.round(d / 60)} Min.`;
  if (d < 86400) return `vor ${Math.round(d / 3600)} Std.`;
  if (d < 86400 * 30) return `vor ${Math.round(d / 86400)} Tagen`;
  return new Date(iso).toLocaleDateString('de-CH');
}
const initials = (n) => String(n || '?').replace(/[«»"]/g, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
function hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
const avatar = (n) => `<span class="avatar">${esc(initials(n))}</span>`;
const isFczFm = (id) => S.fm && id === S.fm.teamId;
// no club logos anywhere (trademarks + no third-party image requests): neutral monograms
const FMNAME = {};
const mono = (name, big, fcz) => `<span class="mono${big ? ' big' : ''}${fcz ? ' fcz' : ''}" aria-hidden="true">${esc(fcz ? 'Z' : initials(String(name || '?').replace(/^(FC|BSC|SC|FK)\s+/i, '')).slice(0, big ? 2 : 1))}</span>`;
const crest = (id, name) => mono(name || FMNAME[id], false, isFczFm(id));
const crestBig = (id, name) => mono(name || FMNAME[id], true, isFczFm(id));
const COMP = { L: 'Liga', C: 'Cup', I: 'Europa', F: 'Test', LC: 'Ligacup', P: 'Pflicht', O: 'Andere' };
const dbfczUrl = (kind, id) => `https://www.dbfcz.ch/${kind}.php?${kind}_id=${id}`;
const forumTopic = (slug) => `https://fczforum.ch/forum/thema/${encodeURIComponent(slug)}/letzter-beitrag`;
const googleForum = (q) => `https://www.google.com/search?q=${encodeURIComponent('site:fczforum.ch ' + q)}`;
const ICON = {
  ext: '<svg class="i" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chev: '<svg class="i" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  cal: '<svg class="i" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  share: '<svg class="i" viewBox="0 0 24 24"><path d="M12 15V3m0 0L8 7m4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chat: '<svg class="i" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  db: '<svg class="i" viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  book: '<svg class="i" viewBox="0 0 24 24"><path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  flame: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3s5 4.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 1.5-4S9 12 11 12c0-4 1-9 1-9z" fill="currentColor"/></svg>',
};

// ---------------------------------------------------------------- data
async function getJSON(p) {
  const r = await fetch(p, { cache: 'no-cache' });
  if (!r.ok) throw new Error(p + ' ' + r.status);
  return r.json();
}
let dbReady = null;
async function loadSmall() {
  const keys = ['home', 'forum', 'arch', 'fm', 'meta'];
  const got = await Promise.all(
    ['data/dbfcz_home.json', 'data/forum.json', 'data/forum_archive.json', 'data/fotmob.json', 'data/meta.json']
      .map((p) => getJSON(p).catch(() => null)));
  keys.forEach((k, i) => { if (got[i]) S[k] = got[i]; }); // a failed refetch never blanks good data
  fmNames();
}
function loadDb() {
  dbReady = getJSON('data/db.json').then((db) => { S.db = db; S.dbFailed = false; buildIndexes(); }).catch(() => { S.db = null; S.dbFailed = true; });
  return dbReady;
}
function integrate() { // needs db + fotmob; safe to call repeatedly
  if (!S.db) return;
  addProvisional(); buildIndexes(); searchIndex = null;
}
async function playerSeasons() {
  if (!S.ps) S.ps = await getJSON('data/player_seasons.json').catch(() => ({}));
  return S.ps;
}

function res(m) { // FCZ perspective; shoot-outs stay draws (official stats) but carry a pill
  const home = m[3] === FCZ;
  const gf = home ? m[5] : m[6], ga = home ? m[6] : m[5];
  const opp = home ? m[4] : m[3];
  const r = gf == null ? 'N' : gf > ga ? 'W' : gf < ga ? 'L' : 'D';
  return { home, gf, ga, opp, r };
}
function buildIndexes() {
  const db = S.db; if (!db) return;
  IX.team = db.teams; IX.season = {}; IX.player = {}; IX.byOpp = {};
  db.seasons.forEach((s, i) => { IX.season[s.id] = { ...s, i }; });
  db.players.forEach((p) => { IX.player[p[0]] = p; });
  for (const m of db.matches) { const o = res(m).opp; (IX.byOpp[o] ||= []).push(m); }
  IX.matchById = new Map(db.matches.map((m) => [m[0], m]));
  IX.oppSorted = Object.entries(IX.byOpp).map(([id, ms]) => [+id, ms.length]).sort((a, b) => b[1] - a[1]);
  IX.teamByNorm = Object.entries(db.teams).map(([id, n]) => [+id, norm(n)]);
}
const FAKE = { n: -1000 };
// dbFCZ lags a few weeks behind: bridge with finished FotMob results, flagged "vorläufig"
function addProvisional() {
  if (!S.fm || !S.db) return;
  const last = S.db.matches[S.db.matches.length - 1]?.[1] || '';
  const cur = S.db.seasons[S.db.seasons.length - 1]?.id;
  const compOf = (t = '') => (/super league|challenge/i.test(t) ? 'L' : /cup/i.test(t) && !/europa|conference|champions|uefa/i.test(t) ? 'C' : /friendl|test/i.test(t) ? 'F' : 'I');
  for (const f of S.fm.fixtures) {
    if (!f.finished || f.hs == null || IX.prov.has(-f.id)) continue;
    const d = zurichISO(new Date(f.utc));
    if (d <= last) continue;
    const tid = (fid, name) => { if (isFczFm(fid)) return FCZ; const t = findTeam(name); if (t) return t; const id = FAKE.n--; S.db.teams[id] = name; return id; };
    const row = [-f.id, d, cur, tid(f.homeId, f.home), tid(f.awayId, f.away), f.hs, f.as, compOf(f.tournament), `${f.tournament || ''}`, 'vorläufig'];
    S.db.matches.push(row); IX.prov.set(row[0], f);
  }
}
const teamName = (id) => (id === FCZ ? 'FCZ' : IX.team?.[id] || '?');
const seasonLabel = (sid) => IX.season?.[sid]?.label || '';
const ALIAS = { gc: 'grasshoppers', yb: 'young boys', fcb: 'basel', fcsg: 'st gallen', fcl: 'luzern', fcl2: 'lugano', ls: 'lausanne sports', sfc: 'servette fc', fcw: 'winterthur' };

function findTeam(name) { // FotMob/free text -> dbFCZ team id (most-played wins)
  const n = norm(ALIAS[norm(name)] || name).replace(/\b(fc|sc|bsc|fk|ac)\b/g, '').replace(/sports?$/, '').trim();
  if (!n) return null;
  let best = null;
  for (const [id, cnt] of IX.oppSorted || []) {
    const t = norm(IX.team[id]).replace(/\b(fc|sc|bsc|fk|ac)\b/g, '').replace(/sports?$/, '').trim();
    if (t === n || t.startsWith(n) || n.startsWith(t)) { if (!best || cnt > best[1]) best = [id, cnt]; }
  }
  return best ? best[0] : null;
}
function findPlayerByName(name) {
  const n = norm(name);
  let best = null;
  for (const p of S.db?.players || []) if (norm(p[1]) === n && (!best || IX.season[p[8]]?.i > IX.season[best[8]]?.i)) best = p;
  if (best) return best;
  const parts = n.split(' '); const last = parts[parts.length - 1];
  for (const p of S.db?.players || []) {
    const pn = norm(p[1]);
    if (pn.endsWith(' ' + last) && pn.startsWith(parts[0][0]) && IX.season[p[8]]?.i >= S.db.seasons.length - 3) return p;
  }
  return null;
}
function summarize(ms) {
  const o = { n: 0, W: 0, D: 0, L: 0, gf: 0, ga: 0 };
  for (const m of ms) { const r = res(m); if (r.r === 'N') continue; o.n++; o[r.r]++; o.gf += r.gf; o.ga += r.ga; }
  return o;
}
function wdlBar(o, compact) {
  if (!o.n) return '<div class="empty">Keine Spiele</div>';
  const p = (x) => (100 * x / o.n).toFixed(1);
  return `<div class="wdl" role="img" aria-label="${o.W} Siege, ${o.D} Remis, ${o.L} Niederlagen"><i class="W" style="width:${p(o.W)}%"></i><i class="D" style="width:${p(o.D)}%"></i><i class="L" style="width:${p(o.L)}%"></i></div>
  <div class="legend num"><span><b>${o.W}</b> S</span><span><b>${o.D}</b> U</span><span><b>${o.L}</b> N</span>${compact ? '' : `<span class="muted">${o.gf}:${o.ga} Tore</span>`}<span class="muted">${o.n} Sp.</span></div>`;
}
const LET = { W: 'S', D: 'U', L: 'N', N: '·' };
const fmScore = (f) => String(f.score || '').replace(/\s*-\s*/, ':');
const SIG = { I: 0, C: 1, L: 2, P: 3, LC: 3, O: 4, F: 5 };
const wdlRow = (label, o) => `<div class="wrow"><span class="wl">${label}</span><div class="wb">${wdlBar(o, true)}</div></div>`;
function matchItem(m, { showSeason = true, pre = '' } = {}) {
  const r = res(m);
  const extra = m[9] ? ` <span class="pill${m[9] === 'vorläufig' ? ' warn' : ''}">${esc(m[9])}</span>` : '';
  return `<li><a class="item" href="#/spiel/${m[0]}">
    <span class="badge ${r.r}">${LET[r.r]}</span>
    <span class="grow">${pre}<div class="t">${esc(teamName(m[3]))} – ${esc(teamName(m[4]))}</div>
    <div class="s">${fmtD(m[1])} · ${esc(m[8] || COMP[m[7]])}${showSeason ? ' · ' + esc(seasonLabel(m[2])) : ''}</div></span>
    <span class="score">${m[5] ?? '–'}:${m[6] ?? '–'}</span>${extra}</a></li>`;
}
const card = (title, body, link = '', cls = '') => `<section class="card ${cls}"><h2><span>${title}</span>${link}</h2>${body}</section>`;
const group = (t) => `<h3 class="grp">${t}</h3>`;
const errCard = (t) => card(t, '<div class="hint">Archiv gerade nicht erreichbar (offline?).</div><button class="btn morebtn" type="button" onclick="location.reload()">Neu laden</button>');
const loadingCard = (t) => S.dbFailed ? errCard(t) : card(t, '<div class="skel"></div><div class="skel"></div><div class="skel short"></div>');
function themeBtn() {
  const t = store.get('theme', 'auto');
  return `<button class="ghost small" data-theme-toggle>Design: ${{ auto: 'automatisch', light: 'hell', dark: 'dunkel' }[t]}</button>`;
}
const foot = () => `<p class="foot">Inoffizielle Fan-App, nicht mit dem FC Zürich verbunden.<br>
  Daten aufbereitet und ergänzt aus <a href="https://www.dbfcz.ch" target="_blank" rel="noopener">dbFCZ</a>
  (<a href="https://creativecommons.org/licenses/by/4.0/deed.de" target="_blank" rel="noopener">CC BY 4.0</a>), der Startseite von
  <a href="https://fczforum.ch/forum" target="_blank" rel="noopener">FCZforum</a>, <a href="https://www.fotmob.com/teams/10243/overview/fc-zurich" target="_blank" rel="noopener">FotMob</a>
  (Spielplan, Tabelle, Kader, neueste Resultate), <a href="https://mastodon.social/@dbfcz" target="_blank" rel="noopener">@dbFCZ</a> und Wikipedia.<br>
  Keine Cookies, kein Tracking. Gespeichert wird nur lokal auf deinem Gerät (Suchverlauf, Quiz, Design). Beim Öffnen lädt die Seite Inhalte von GitHub Pages, Mastodon und Wikipedia.<br>
  Forum-Stand ${S.forum?.fetched ? rel(S.forum.fetched) : '–'} · <a href="https://github.com/ginlennon/fcz-radar" target="_blank" rel="noopener">Quellcode</a> ·
  <a href="https://github.com/ginlennon/fcz-radar/issues" target="_blank" rel="noopener">Fehler melden / Entfernung beantragen</a><br>${themeBtn()}</p>`;

// ---------------------------------------------------------------- Heute
let timer = null;
function fmNames() { for (const f of S.fm?.fixtures || []) { FMNAME[f.homeId] = f.home; FMNAME[f.awayId] = f.away; } for (const r of S.fm?.table || []) FMNAME[r.id] = r.shortName || r.name; }
function nextFixture() {
  const now = Date.now();
  return (S.fm?.fixtures || []).find((f) => !f.finished && !f.cancelled && new Date(f.utc).getTime() > now - 3 * 3600e3);
}
const lastFixtures = (n) => (S.fm?.fixtures || []).filter((f) => f.finished).slice(-n);
function fmRes(f) {
  const z = f.homeId === S.fm.teamId; const gf = z ? f.hs : f.as, ga = z ? f.as : f.hs;
  return gf > ga ? 'W' : gf < ga ? 'L' : 'D';
}
function heroNext() {
  const f = nextFixture();
  if (!f) return '';
  const oppName = f.homeId === S.fm.teamId ? f.away : f.home;
  const fczHome = f.homeId === S.fm.teamId;
  const d = new Date(f.utc);
  const thread = matchThread(oppName);
  let brief = '<div class="skel light"></div>';
  let oppId = null;
  if (S.db) {
    oppId = findTeam(oppName);
    const ms = oppId ? (IX.byOpp[oppId] || []).filter((m) => m[7] !== 'F') : [];
    const lastHome = ms.filter((m) => (fczHome ? m[3] === FCZ : m[4] === FCZ)).slice(-1)[0];
    brief = ms.length ? `<div class="brief">${wdlBar(summarize(ms), true)}
      <div class="row between small"><span>Letzte Duelle</span><span class="form">${ms.slice(-5).map((m) => `<a class="badge ${res(m).r}" href="#/spiel/${m[0]}" title="${fmtD(m[1])} ${m[5]}:${m[6]}">${LET[res(m).r]}</a>`).join('')}</span></div>
      ${lastHome ? `<div class="small" style="opacity:.85;margin-top:4px">Zuletzt ${fczHome ? 'zuhause' : 'auswärts'}: ${esc(teamName(lastHome[3]))} ${lastHome[5]}:${lastHome[6]} ${esc(teamName(lastHome[4]))} (${fmtD(lastHome[1])})</div>` : ''}</div>` : '';
  }
  return `<section class="card hero"><h2><span>Nächstes Spiel · ${esc(f.tournament || '')}</span></h2>
    <div class="teams"><div class="team">${crestBig(f.homeId)}<span>${esc(f.home)}</span></div><div class="vs">vs</div>
    <div class="team">${crestBig(f.awayId)}<span>${esc(f.away)}</span></div></div>
    <div class="countdown" id="cd" data-t="${d.getTime()}"></div>
    <div class="meta">${d.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Zurich' })}, ${d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })}${S.fm.venue?.name && fczHome ? ' · ' + esc(S.fm.venue.name) : ''}</div>
    ${brief}
    <div class="actions">${oppId ? `<a class="btn" href="#/gegner/${oppId}">Bilanz</a>` : ''}
    ${thread ? `<a class="btn" target="_blank" rel="noopener" href="${forumTopic(thread)}">${ICON.chat} Matchthread</a>` : ''}
    <a class="btn" href="${S.fm.ics.replace(/^https:/, 'webcal:')}">${ICON.cal} Kalender</a></div></section>`;
}
function matchThread(opp) {
  const stop = new Set(['fc', 'sc', 'sports', 'sport', 'young', 'st', 'sankt', 'grasshopper']);
  const words = norm(opp).split(' ').filter((w) => w.length > 3 && !stop.has(w));
  if (!words.length) words.push(...norm(opp).split(' ').filter((w) => w.length > 2));
  const recent = Date.now() - 10 * 86400e3;
  let best = null;
  for (const [slug, t] of Object.entries(S.arch?.topics || {})) {
    const tn = norm(t.title);
    if (!/zurich|fcz/.test(tn) || !words.some((w) => new RegExp(`\\b${w}\\b`).test(tn))) continue;
    const ts = new Date(t.last || t.first || 0).getTime();
    if (ts < recent) continue;
    if (!best || ts > best[1]) best = [slug, ts];
  }
  return best?.[0];
}
function tickCountdown() {
  const el = $('#cd'); if (!el) return;
  let s = Math.max(0, Math.floor((+el.dataset.t - Date.now()) / 1000));
  if (s === 0) { el.innerHTML = '<div class="wide"><b>Anpfiff</b><span>läuft oder vorbei</span></div>'; return; }
  if (s > 48 * 3600) { el.innerHTML = `<div class="wide"><b>in ${Math.round(s / 86400)} Tagen</b></div>`; return; }
  const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
  el.innerHTML = [[h, 'Std'], [m, 'Min'], [s, 'Sek']].map(([v, l]) => `<div><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`).join('');
}
function tableHTML(rows, mini) {
  return `<table class="t${mini ? ' mini' : ''}"><thead><tr><th>#</th><th>Team</th><th>Sp</th><th class="hm">S</th><th class="hm">U</th><th class="hm">N</th><th class="hm">Tore</th><th>Diff</th><th>Pkt</th></tr></thead><tbody>
  ${rows.map((r) => `<tr class="${isFczFm(r.id) ? 'me' : ''}"><td><span class="qual" style="background:${r.qualColor || 'transparent'}"></span>${r.idx}</td>
  <td><span class="row tight">${crest(r.id)}<span class="ell">${esc(r.shortName || r.name)}</span></span></td><td>${r.played}</td><td class="hm">${r.wins}</td><td class="hm">${r.draws}</td><td class="hm">${r.losses}</td>
  <td class="hm">${esc(r.scoresStr)}</td><td>${r.goalConDiff > 0 ? '+' : ''}${r.goalConDiff}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table>`;
}
function miniTable() {
  const t = S.fm?.table || []; if (!t.length) return '';
  const i = t.findIndex((r) => isFczFm(r.id));
  const lo = Math.max(0, Math.min(i - 2, t.length - 5));
  return card('Tabelle', tableHTML(t.slice(lo, lo + 5), true), '<a href="#/saison">ganze Tabelle</a>');
}
function histItem(m) {
  const r = res(m);
  return `<li><a class="item hist e${r.r}" href="#/spiel/${m[0]}"><span class="yr num">${m[1].slice(0, 4)}</span>
    <span class="grow"><div class="t">${esc(teamName(m[3]))} – ${esc(teamName(m[4]))}</div><div class="s">${esc(m[8] || COMP[m[7]])}${m[9] ? ' · ' + esc(m[9]) : ''}</div></span>
    <span class="score">${m[5] ?? '–'}:${m[6] ?? '–'}</span></a></li>`;
}
function onThisDay() {
  if (!S.db) return loadingCard('An diesem Tag');
  const today = zurichISO(); const md = today.slice(4); const yr = +today.slice(0, 4);
  let ms = S.db.matches.filter((m) => m[1]?.endsWith(md) && +m[1].slice(0, 4) < yr);
  const dl = new Date(today + 'T12:00:00').toLocaleDateString('de-CH', { day: 'numeric', month: 'long' });
  let title = `${dl} in der Geschichte`;
  if (!ms.length) {
    const days = new Set([-3, -2, -1, 1, 2, 3].map((k) => zurichISO(new Date(Date.now() + k * 86400e3)).slice(4)));
    ms = S.db.matches.filter((m) => m[1] && days.has(m[1].slice(4)));
    title = 'Diese Woche in der Geschichte';
  }
  ms = ms.slice().sort((a, b) => (SIG[a[7]] ?? 9) - (SIG[b[7]] ?? 9) || (a[1] < b[1] ? -1 : 1));
  const cur = S.home?.today;
  if (cur?.spiel_id) ms = ms.filter((m) => m[0] !== cur.spiel_id);
  const lead = cur?.text ? `<a class="lead" href="${cur.spiel_id && IX.matchById.get(cur.spiel_id) ? '#/spiel/' + cur.spiel_id : dbfczUrl('spiel', cur.spiel_id)}"><b>${esc(cur.title)} · Tipp von dbFCZ</b>${esc(cur.text)}</a>` : '';
  return card(title, `${lead}<ul class="list">${ms.slice(0, 5).map(histItem).join('')}</ul>
    ${ms.length > 5 ? `<a class="ghost morebtn" href="#/archiv?tag=${md.slice(1)}">alle ${ms.length} Spiele an diesem Tag</a>` : ''}`);
}
function birthdays() {
  const b = S.home?.birthdays || []; const dd = S.home?.deaths || [];
  if (!b.length && !dd.length) return '';
  const today = zurichISO().slice(5);
  const li = (p, dead) => `<li><a class="item" href="${IX.player?.[p.id] ? '#/spieler/' + p.id : dbfczUrl('spieler', p.id)}">
    ${avatar(p.name)}<span class="grow"><div class="t">${esc(p.name)}${p.date?.slice(5) === today && !dead && p.years <= 100 ? ' <span class="pill ok">heute</span>' : ''}</div><div class="s">${dead ? `† ${fmtD(p.date)} · vor ${p.years} Jahren` : p.years > 100 ? `* ${fmtD(p.date)} · vor ${p.years} Jahren geboren` : `* ${fmtD(p.date)} · wird ${p.years}`}${IX.player?.[p.id] ? ' · ' + IX.player[p.id][2] + (IX.player[p.id][2] === 1 ? ' Pflichtspiel' : ' Pflichtspiele') : ''}</div></span>${ICON.chev}</a></li>`;
  return card('Geburtstage & Gedenktage', `<ul class="list">${b.slice(0, 6).map((p) => li(p)).join('')}${dd.slice(0, 3).map((p) => li(p, true)).join('')}</ul>`);
}
function forumPulse() {
  const f = S.forum; if (!f) return '';
  const mood = f.matchMood;
  const tr = (f.trending || []).slice(0, 3);
  const top = (f.mostLiked || [])[0];
  return card('Forum-Puls', `${mood ? `<div class="row" style="margin-bottom:6px"><span class="mood">${esc(mood.emoji)}</span><div><b>Stimmung: ${esc(mood.label)}</b><div class="s muted">${mood.score}/100 · letzte ${mood.matches} Spielthreads</div></div></div>` : ''}
    <ul class="list">${tr.map((t) => `<li><a class="item" target="_blank" rel="noopener" href="${forumTopic(t.slug)}"><span class="pill heat">${ICON.flame}${t.recentPostsCount}</span><span class="grow"><div class="t">${esc(t.title)}</div><div class="s">${esc(t.forumName)}</div></span>${ICON.ext}</a></li>`).join('')}</ul>
    ${top ? `<a class="quote" target="_blank" rel="noopener" href="${esc(top.url)}">${esc(clip(top.excerpt, 200))}<div class="s muted">${esc(top.authorName)} · ♥ ${top.likes} · ${esc(top.topicTitle)}</div></a>` : ''}`, '<a href="#/forum">Forum</a>');
}
function lastResult() {
  const l = lastFixtures(5); if (!l.length) return '';
  const f = l[l.length - 1];
  const dots = `<span class="dots" title="Form, neueste rechts">${l.map((x) => `<i class="${fmRes(x)}" title="${esc(x.home + ' ' + fmScore(x) + ' ' + x.away)}"></i>`).join('')}</span>`;
  return card('Letztes Spiel', `<a class="item" target="_blank" rel="noopener" href="${esc(f.url)}">${crest(f.homeId)}<span class="grow"><div class="t">${esc(f.home)} – ${esc(f.away)}</div><div class="s">${new Date(f.utc).toLocaleDateString('de-CH')} · ${esc(f.tournament || '')}</div></span><span class="score big">${esc(fmScore(f))}</span>${crest(f.awayId)}</a>`, dots);
}
async function mastodon(seq) {
  try {
    const r = await fetch('https://mastodon.social/api/v1/accounts/109245736019387633/statuses?limit=3&exclude_replies=true&exclude_reblogs=true');
    const st = await r.json();
    if (seq !== routeSeq) return;
    const el = $('#toots'); if (!el) return;
    el.innerHTML = st.map((s) => {
      const txt = new DOMParser().parseFromString(s.content.replace(/<br\s*\/?>|<\/p>/g, ' '), 'text/html').body.textContent;
      return `<div class="toot"><p>${esc(clip(txt, 260))}</p><a class="small" href="${esc(s.url)}" target="_blank" rel="noopener">${rel(s.created_at)} ${ICON.ext}</a></div>`;
    }).join('') || '<div class="empty">Keine Toots</div>';
  } catch { const el = $('#toots'); if (el) el.innerHTML = '<div class="empty">Mastodon gerade nicht erreichbar</div>'; }
}
function renderHeute(seq) {
  if (!S.fm && !S.forum && !S.home && S.dbFailed) { view.innerHTML = errCard('Keine Verbindung') + foot(); return; }
  view.innerHTML = heroNext() + lastResult() + miniTable() + quizCard()
    + group('Geschichte') + onThisDay() + birthdays()
    + group('Community') + forumPulse()
    + card('Neu bei @dbFCZ', '<div id="toots"><div class="skel"></div><div class="skel short"></div></div>', `<a href="https://mastodon.social/@dbfcz" target="_blank" rel="noopener">Mastodon</a>`) + foot();
  tickCountdown(); timer = setInterval(tickCountdown, 1000);
  mastodon(seq);
}

// ---------------------------------------------------------------- Tagesquiz (same quiz for everyone, seeded by date)
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let QUIZ = null;
function buildQuiz() {
  const today = zurichISO();
  if (QUIZ?.date === today) return QUIZ;
  const rnd = mulberry32(+today.replace(/-/g, ''));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cutoff = `${+today.slice(0, 4) - 1}${today.slice(4)}`;
  const pool = S.db.matches.filter((m) => m[0] > 0 && m[7] !== 'F' && m[5] != null && m[1] < cutoff);
  const qs = [];
  // 1) result of a match from this day in history
  const days = new Set([-3, -2, -1, 1, 2, 3].map((k) => zurichISO(new Date(Date.now() + k * 86400e3)).slice(5)));
  let cand = pool.filter((m) => days.has(m[1].slice(5)));
  if (!cand.length) cand = pool;
  const m = pick(cand); const truth = `${m[5]}:${m[6]}`;
  const opts = new Set([truth]);
  while (opts.size < 4) { const o = pick(pool); opts.add(`${o[5]}:${o[6]}`); }
  qs.push({ q: `${teamName(m[3])} – ${teamName(m[4])} am ${fmtD(m[1])}, ${m[8] || COMP[m[7]]}: Wie ging's aus?`, opts: shuffle([...opts]), a: truth, link: `#/spiel/${m[0]}` });
  // 2) who played more competitive matches
  const curSid = S.db.seasons[S.db.seasons.length - 1].id;
  const top = S.db.players.filter((p) => p[8] !== curSid).slice(0, 200);
  let A, B;
  for (let i = 0; i < 200; i++) { A = pick(top); B = pick(top); const r = Math.min(A[2], B[2]) / Math.max(A[2], B[2]); if (A !== B && r > 0.6 && r < 0.95) break; }
  const more = A[2] > B[2] ? A : B;
  qs.push({ q: 'Wer hat mehr Pflichtspiele für den FCZ?', opts: [A[1], B[1]], a: more[1], link: `#/spieler/${more[0]}`, note: `${A[1]} ${A[2]} · ${B[1]} ${B[2]}` });
  // 3) all-time balance against an opponent
  const opp = pick(IX.oppSorted.filter(([id]) => id > 0).slice(0, 40))[0];
  const o = summarize(IX.byOpp[opp].filter((x) => x[0] > 0 && x[7] !== 'F' && x[1] < cutoff));
  const verdict = o.W > o.L ? 'positiv' : o.W < o.L ? 'negativ' : 'ausgeglichen';
  qs.push({ q: `Pflichtspiel-Bilanz gegen ${teamName(opp)}?`, opts: ['positiv', 'ausgeglichen', 'negativ'], a: verdict, link: `#/gegner/${opp}`, note: `${o.W}S ${o.D}U ${o.L}N` });
  QUIZ = { date: today, qs };
  return QUIZ;
}
function quizState() {
  const st = store.get('quiz', { date: null, answers: [], streak: 0, best: 0, lastDone: null });
  if (st.date !== zurichISO()) { st.date = zurichISO(); st.answers = []; }
  return st;
}
function quizCard() {
  if (!S.db) return loadingCard('Tagesquiz');
  const Q = buildQuiz(); const st = quizState();
  const n = st.answers.length; const right = st.answers.filter((a, i) => a === Q.qs[i].a).length;
  const rows = Q.qs.map((q, i) => {
    const ans = st.answers[i]; const done = ans != null;
    if (!done && i !== n) return '';
    return `<div class="qz"><div class="qq"><span class="pill">${i + 1}/3</span> ${esc(q.q)}</div><div class="qo">${q.opts.map((o) => {
      const cls = done ? (o === q.a ? 'ok' : o === ans ? 'bad' : 'dim') : '';
      return `<button type="button" class="qbtn ${cls}" ${done ? 'disabled' : `data-quiz="${i}" data-a="${esc(o)}"`}>${esc(o)}</button>`; }).join('')}</div>
      ${done ? `<div class="s">${ans === q.a ? 'Richtig!' : 'Leider nein.'}${q.note ? ' ' + esc(q.note) + '.' : ''} <a href="${q.link}">mehr</a></div>` : ''}</div>`;
  }).join('');
  const fin = n === 3 ? `<div class="row between qfin"><b>${right}/3 · Serie ${st.streak} ${st.streak > 1 ? 'Tage' : 'Tag'}</b><button type="button" class="btn" data-quiz-share>${ICON.share} Teilen</button></div><div class="s muted">Morgen gibt es ein neues Quiz.</div>` : '';
  return `<section class="card quiz" id="quiz"><h2><span>Tagesquiz</span><span class="pill">${n}/3</span></h2>${rows}${fin}</section>`;
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-quiz]');
  if (b) {
    const st = quizState(); const i = +b.dataset.quiz;
    if (st.answers.length !== i) return;
    st.answers.push(b.dataset.a);
    if (st.answers.length === 3) {
      const y = zurichISO(new Date(Date.now() - 86400e3));
      st.streak = st.lastDone === y ? st.streak + 1 : st.lastDone === st.date ? st.streak : 1;
      st.lastDone = st.date; st.best = Math.max(st.best || 0, st.streak);
    }
    store.set('quiz', st);
    const el = $('#quiz'); if (el) el.outerHTML = quizCard();
    return;
  }
  if (e.target.closest('[data-quiz-share]')) {
    const st = quizState(); const Q = buildQuiz();
    const sq = Q.qs.map((q, i) => (st.answers[i] === q.a ? '🟦' : '⬜')).join('');
    const text = `FCZ Radar Tagesquiz ${fmtD(st.date).slice(0, 6)} ${sq} · Serie ${st.streak}`;
    try { if (navigator.share) await navigator.share({ text, url: location.origin + location.pathname }); else { await navigator.clipboard.writeText(text + ' ' + location.origin + location.pathname); e.target.closest('button').textContent = 'kopiert'; } } catch { /* cancelled */ }
  }
});

// ---------------------------------------------------------------- Saison (FotMob)
function renderSaison(q) {
  const tab = q.get('t') || 'tabelle';
  const fm = S.fm;
  if (tab === 'statistik') { const cur = S.db?.seasons[S.db.seasons.length - 1]; if (cur) { location.replace('#/saisonarchiv/' + cur.id); return; } }
  const chips = [['tabelle', 'Tabelle'], ['spiele', 'Spielplan'], ['kader', 'Kader'], ['statistik', 'Saison-Archiv']]
    .map(([k, l]) => `<a class="chip ${tab === k ? 'on' : ''}" href="#/saison?t=${k}">${l}</a>`).join('');
  let body = '';
  if (!fm) body = '<div class="empty">Keine Saisondaten</div>';
  else if (tab === 'tabelle') {
    body = card(esc(fm.league || 'Tabelle'), tableHTML(fm.table) + `<div class="legend wrap" style="margin-top:10px">${(fm.legend || []).map((l) => `<span><span class="qual" style="background:${l.color}"></span> ${esc(l.title)}</span>`).join('')}</div>`);
  } else if (tab === 'spiele') {
    const up = fm.fixtures.filter((f) => !f.finished), done = fm.fixtures.filter((f) => f.finished).reverse();
    const li = (f) => `<li><a class="item" target="_blank" rel="noopener" href="${esc(f.url)}">${f.finished ? `<span class="badge ${fmRes(f)}">${LET[fmRes(f)]}</span>` : `<span class="pill">${new Date(f.utc).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}</span>`}
      <span class="grow"><div class="t">${esc(f.home)} – ${esc(f.away)}</div><div class="s">${new Date(f.utc).toLocaleString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })} · ${esc(f.tournament || '')}</div></span>
      <span class="score">${f.finished ? esc(fmScore(f)) : ''}</span>${ICON.ext}</a></li>`;
    body = card('Kommende Spiele', `<ul class="list">${up.map(li).join('') || '<div class="empty">Keine</div>'}</ul><a class="btn primary morebtn" href="${fm.ics.replace(/^https:/, 'webcal:')}">${ICON.cal} Spielplan im Kalender abonnieren</a>
      <div class="row wrap small" style="justify-content:center;margin-top:6px"><a href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(fm.ics.replace(/^https:/, 'webcal:'))}" target="_blank" rel="noopener">in Google Kalender</a><span class="muted">·</span><a href="${esc(fm.ics)}">.ics-Datei</a></div>`)
      + card('Gespielt', `<ul class="list">${done.map(li).join('')}</ul>`);
  } else if (tab === 'kader') {
    const groups = {};
    fm.squad.forEach((p) => (groups[p.group] ||= []).push(p));
    const gl = { coach: 'Trainer', keepers: 'Torhüter', defenders: 'Verteidigung', midfielders: 'Mittelfeld', attackers: 'Angriff' };
    body = Object.entries(groups).map(([g, ps]) => card(gl[g] || g, `<ul class="list">${ps.map((p) => {
      const db = S.db && findPlayerByName(p.name);
      const href = db ? '#/spieler/' + db[0] : `https://www.fotmob.com/players/${p.id}`;
      return `<li><a class="item" href="${href}" ${db ? '' : 'target="_blank" rel="noopener"'}><span class="avatar no">${p.no ?? '–'}</span>
      <span class="grow"><div class="t">${esc(p.name)}${p.injury ? ' <span class="pill warn">verletzt</span>' : ''}</div><div class="s">${[p.pos, p.age ? p.age + ' J.' : '', land(p.country)].filter(Boolean).map(esc).join(' · ')}${db ? ` · ${db[2]} FCZ-Spiele` : ''}</div></span>
      ${g !== 'coach' && g !== 'keepers' && (p.goals || p.assists) ? `<span class="kpi num"><b>${p.goals ?? 0}</b> Tore<br><b>${p.assists ?? 0}</b> Assists</span>` : ''}</a></li>`;
    }).join('')}</ul>`)).join('');
  }
  view.innerHTML = `<h1 class="page-title">Saison</h1><div class="chips">${chips}</div>${body}${foot()}`;
}

const LAND = { Switzerland: 'Schweiz', Austria: 'Österreich', Germany: 'Deutschland', France: 'Frankreich', Italy: 'Italien', Spain: 'Spanien', Netherlands: 'Niederlande', Belgium: 'Belgien', Albania: 'Albanien', 'North Macedonia': 'Nordmazedonien', Croatia: 'Kroatien', Serbia: 'Serbien', 'Bosnia and Herzegovina': 'Bosnien-Herzegowina', 'Ivory Coast': 'Elfenbeinküste', "Côte d'Ivoire": 'Elfenbeinküste', Cameroon: 'Kamerun', Brazil: 'Brasilien', Denmark: 'Dänemark', Sweden: 'Schweden', Norway: 'Norwegen', Turkey: 'Türkei', 'Türkiye': 'Türkei', Greece: 'Griechenland', Slovenia: 'Slowenien', Hungary: 'Ungarn', Czechia: 'Tschechien', 'Czech Republic': 'Tschechien', Poland: 'Polen', Morocco: 'Marokko', Tunisia: 'Tunesien', Algeria: 'Algerien', 'DR Congo': 'DR Kongo', Congo: 'Kongo', Colombia: 'Kolumbien', Argentina: 'Argentinien', 'United States': 'USA', USA: 'USA', Ireland: 'Irland', Scotland: 'Schottland', Iceland: 'Island', Finland: 'Finnland', Ukraine: 'Ukraine', Russia: 'Russland', Romania: 'Rumänien', Bulgaria: 'Bulgarien', Slovakia: 'Slowakei', Lithuania: 'Litauen', Georgia: 'Georgien', Armenia: 'Armenien', Egypt: 'Ägypten', 'South Africa': 'Südafrika', Japan: 'Japan', 'South Korea': 'Südkorea', Australia: 'Australien', Mexico: 'Mexiko', Chile: 'Chile', Uruguay: 'Uruguay', Peru: 'Peru', Venezuela: 'Venezuela', Ecuador: 'Ecuador', Paraguay: 'Paraguay', 'Cape Verde': 'Kap Verde', Guinea: 'Guinea', 'Equatorial Guinea': 'Äquatorialguinea' };
const land = (c) => (c ? LAND[c] || c : '');

// ---------------------------------------------------------------- Archiv
function filterMatches(f) {
  let ms = S.db.matches;
  if (f.c) ms = ms.filter((m) => m[7] === f.c || (f.c === 'P' && m[7] !== 'F'));
  if (f.d) ms = ms.filter((m) => m[1] && m[1].slice(0, 3) === String(f.d).slice(0, 3));
  if (f.y) ms = ms.filter((m) => m[1]?.startsWith(f.y));
  if (f.o) ms = ms.filter((m) => res(m).opp === +f.o);
  if (f.v) ms = ms.filter((m) => (f.v === 'h' ? m[3] === FCZ : m[4] === FCZ));
  if (f.s) { const [a, b] = f.s.split(':').map(Number); ms = ms.filter((m) => { const r = res(m); return r.gf === a && r.ga === b; }); }
  if (f.tag) ms = ms.filter((m) => m[1]?.slice(5) === f.tag);
  return ms;
}
function renderArchiv(q) {
  const mode = q.get('m') || 'spiele';
  const modeChips = [['spiele', 'Spiele'], ['saisons', 'Saisons'], ['rekorde', 'Rekorde'], ['gegner', 'Gegner']]
    .map(([k, l]) => `<a class="chip ${mode === k ? 'on' : ''}" href="#/archiv?m=${k}">${l}</a>`).join('');
  let body = '';
  if (mode === 'saisons') body = seasonsList();
  else if (mode === 'rekorde') body = records();
  else if (mode === 'gegner') body = opponentsList();
  else {
    const f = Object.fromEntries(['c', 'd', 'y', 'o', 'v', 's', 'tag'].map((k) => [k, q.get(k) || '']));
    if (f.s && !/^\d{1,2}:\d{1,2}$/.test(f.s)) f.s = '';
    if (f.tag && !/^\d\d-\d\d$/.test(f.tag)) f.tag = '';
    if (f.y && !/^\d{4}$/.test(f.y)) f.y = '';
    const page = Math.max(1, +q.get('p') || 1);
    const ms = filterMatches(f).slice().reverse();
    const set = (k, v) => { const p = new URLSearchParams(q); v ? p.set(k, v) : p.delete(k); p.delete('p'); return '#/archiv?' + p; };
    const decs = [...new Set(S.db.matches.map((m) => m[1]?.slice(0, 3)).filter(Boolean))].sort().reverse();
    const active = [
      f.y && [`Jahr ${f.y}`, 'y'], f.s && [`Resultat ${f.s}`, 's'], f.tag && [`${f.tag.slice(3)}.${f.tag.slice(0, 2)}.`, 'tag'],
    ].filter(Boolean).map(([l, k]) => `<a class="chip on" href="${set(k, '')}">${esc(l)} ✕</a>`).join('');
    body = `<div class="chips">${[['', 'Alle'], ['P', 'Pflicht'], ['L', 'Liga'], ['C', 'Cup'], ['I', 'Europa'], ['F', 'Test']].map(([k, l]) => `<a class="chip ${f.c === k ? 'on' : ''}" href="${set('c', k)}">${l}</a>`).join('')}
        <span class="sep"></span>${[['', 'Heim+Ausw.'], ['h', 'Heim'], ['a', 'Auswärts']].map(([k, l]) => `<a class="chip ${f.v === k ? 'on' : ''}" href="${set('v', k)}">${l}</a>`).join('')}</div>
      <div class="row wrap" style="margin-bottom:12px">
        <select aria-label="Jahrzehnt" onchange="location.hash=this.value"><option value="${set('d', '')}">Alle Jahrzehnte</option>${decs.map((d) => `<option value="${set('d', d + '0')}" ${f.d.slice(0, 3) === d ? 'selected' : ''}>${d}0er</option>`).join('')}</select>
        <select aria-label="Gegner" onchange="location.hash=this.value" style="flex:1;min-width:0"><option value="${set('o', '')}">Alle Gegner</option>${IX.oppSorted.filter(([id]) => id > 0).slice(0, 150).map(([id, n]) => `<option value="${set('o', id)}" ${+f.o === id ? 'selected' : ''}>${esc(teamName(id))} (${n})</option>`).join('')}</select>
        ${active}
      </div>
      ${card(`${fmtN(ms.length)} Spiele`, wdlBar(summarize(ms)) + (f.o ? `<a class="ghost" href="#/gegner/${+f.o}">Detail-Bilanz gegen ${esc(teamName(+f.o))} ›</a>` : ''))}
      <section class="card"><ul class="list">${ms.slice(0, page * 40).map((m) => matchItem(m)).join('') || '<div class="empty">Keine Spiele für diese Filter</div>'}</ul>
      ${ms.length > page * 40 ? `<a class="btn morebtn" href="${(() => { const p = new URLSearchParams(q); p.set('p', page + 1); return '#/archiv?' + p; })()}">mehr laden</a>` : ''}</section>`;
  }
  view.innerHTML = `<h1 class="page-title">Archiv</h1><p class="sub gap">${fmtN(S.db.matches.length)} Spiele seit ${fmtD(S.db.matches[0][1])} · Quelle dbFCZ, neueste Resultate vorläufig via FotMob</p><div class="chips" style="margin-top:10px">${modeChips}</div>${body}${foot()}`;
}
function rankTimeline() {
  const ss = S.db.seasons.filter((s) => s.rank);
  const W = 1000, H = 150, n = S.db.seasons.length, bw = W / n;
  const maxR = 16;
  const bars = S.db.seasons.map((s, i) => {
    if (!s.rank) return '';
    const champ = s.rank === 1 && /meister/i.test(s.note || '');
    const top = /challenge|nationalliga b|nlb|1\. liga/i.test(s.league || '') ? 'low' : '';
    const h = Math.max(6, H * (1 - (Math.min(s.rank, maxR) - 1) / maxR));
    return `<a href="#/saisonarchiv/${s.id}"><rect x="${i * bw + 1}" y="${H - h}" width="${bw - 2}" height="${h}" class="${champ ? 'champ' : top || 'rk'}"><title>${esc(s.label)}: Rang ${s.rank}${s.note ? ' · ' + esc(s.note) : ''} (${esc(s.league || '')})</title></rect></a>`;
  }).join('');
  const dec = S.db.seasons.map((s, i) => (/^\d{3}0\//.test(s.label) ? `<text x="${i * bw}" y="${H + 16}">${s.label.slice(0, 4)}</text>` : '')).join('');
  return card('Platzierungen 1920 – heute', `<svg class="timeline" viewBox="0 0 ${W} ${H + 20}" preserveAspectRatio="none" role="img" aria-label="Schlussrang pro Saison">${bars}${dec}</svg>
    <div class="legend wrap small"><span><i class="lg champ"></i> Meister</span><span><i class="lg rk"></i> Rang (höher = besser)</span><span><i class="lg low"></i> 2. Liga</span><span class="muted">${ss.filter((s) => s.rank === 1 && /meister/i.test(s.note || '')).length} Titel in der Datenbank</span></div>`);
}
function seasonsList() {
  const ss = S.db.seasons.slice().reverse();
  return rankTimeline() + `<section class="card"><ul class="list">${ss.map((s) => `<li><a class="item" href="#/saisonarchiv/${s.id}">
    <span class="badge ${s.rank === 1 ? 'W' : s.rank && s.rank <= 3 ? 'D' : 'N'}">${s.rank ?? '–'}</span>
    <span class="grow"><div class="t">${esc(s.label)}${s.note ? ` <span class="pill">${esc(s.note)}</span>` : ''}</div><div class="s">${esc(s.league || '')} · ${s.n} Spiele</div></span>${ICON.chev}</a></li>`).join('')}</ul></section>`;
}
function opponentsList() {
  return `<section class="card"><ul class="list">${IX.oppSorted.filter(([id]) => id > 0).slice(0, 150).map(([id, n]) => { const o = summarize(IX.byOpp[id]);
    return `<li><a class="item" href="#/gegner/${id}">${avatar(teamName(id))}<span class="grow"><div class="t">${esc(teamName(id))}</div><div class="s num">${n} Spiele · ${o.W}S ${o.D}U ${o.L}N · ${o.gf}:${o.ga}</div></span>${ICON.chev}</a></li>`; }).join('')}</ul></section>`;
}
function records() {
  const comp = S.db.matches.filter((m) => m[5] != null && m[7] !== 'F' && m[0] > 0);
  const diff = (m) => { const r = res(m); return r.gf - r.ga; };
  const wins = comp.slice().sort((a, b) => diff(b) - diff(a) || (res(b).gf - res(a).gf)).slice(0, 8);
  const losses = comp.slice().sort((a, b) => diff(a) - diff(b)).slice(0, 8);
  const goals = comp.slice().sort((a, b) => (b[5] + b[6]) - (a[5] + a[6])).slice(0, 8);
  let best = { len: 0 }, cur = { len: 0 }, bestW = { len: 0 }, curW = { len: 0 };
  for (const m of comp) {
    const r = res(m).r;
    if (r !== 'L') { if (!cur.len++) cur.start = m; cur.end = m; if (cur.len > best.len) best = { ...cur }; } else cur = { len: 0 };
    if (r === 'W') { if (!curW.len++) curW.start = m; curW.end = m; if (curW.len > bestW.len) bestW = { ...curW }; } else curW = { len: 0 };
  }
  const gcId = findTeam('Grasshoppers');
  const derby = summarize((IX.byOpp[gcId] || []).filter((m) => m[7] !== 'F'));
  const rnd = comp[Math.floor(Math.random() * comp.length)];
  return card('Zeitmaschine', `<ul class="list">${matchItem(rnd)}</ul><a class="btn morebtn" href="#/archiv?m=rekorde&r=${Math.random().toString(36).slice(2, 6)}">nochmal würfeln</a>`)
    + card('Stadtderby vs GC (Pflichtspiele)', wdlBar(derby), gcId ? `<a href="#/gegner/${gcId}">Detail</a>` : '')
    + card('Serien (Pflichtspiele)', `<div class="grid2"><div class="stat"><b>${best.len}</b><span>ungeschlagen in Folge<br>${fmtD(best.start?.[1])} – ${fmtD(best.end?.[1])}</span></div>
      <div class="stat"><b>${bestW.len}</b><span>Siege in Folge<br>${fmtD(bestW.start?.[1])} – ${fmtD(bestW.end?.[1])}</span></div></div>`)
    + card('Höchste Siege', `<ul class="list">${wins.map((m) => matchItem(m)).join('')}</ul>`)
    + card('Höchste Niederlagen', `<ul class="list">${losses.map((m) => matchItem(m)).join('')}</ul>`)
    + card('Torreichste Spiele', `<ul class="list">${goals.map((m) => matchItem(m)).join('')}</ul>`);
}

// ---------------------------------------------------------------- Gegner
function renderGegner(id) {
  const ms = (IX.byOpp[id] || []).slice();
  if (!ms.length) { view.innerHTML = '<div class="empty">Unbekannter Gegner</div>'; return; }
  const P = ms.filter((m) => m[7] !== 'F');
  const home = summarize(P.filter((m) => m[3] === FCZ)), away = summarize(P.filter((m) => m[4] === FCZ));
  const sc = P.filter((m) => m[5] != null);
  const d = (m) => res(m).gf - res(m).ga;
  const bw = sc.slice().sort((a, b) => d(b) - d(a))[0], bl = sc.slice().sort((a, b) => d(a) - d(b))[0];
  const byDec = {};
  ms.forEach((m) => { const k = m[1]?.slice(0, 3) + '0'; (byDec[k] ||= []).push(m); });
  const decRows = Object.entries(byDec).sort().map(([k, v]) => { const o = summarize(v); return `<tr><td></td><td>${k}er</td><td>${o.n}</td><td>${o.W}</td><td>${o.D}</td><td>${o.L}</td><td>${o.gf}:${o.ga}</td></tr>`; }).join('');
  const name = teamName(id);
  const nf2 = (S.fm?.fixtures || []).find((f) => !f.finished && findTeam(isFczFm(f.homeId) ? f.away : f.home) === id);
  view.innerHTML = `<h1 class="page-title">FCZ vs ${esc(name)}</h1><p class="sub gap">${ms.length} Spiele · erstes ${fmtD(ms[0][1])} · letztes ${fmtD(ms[ms.length - 1][1])}${nf2 ? ` · <b>nächstes am ${new Date(nf2.utc).toLocaleDateString('de-CH')}</b>` : ''}</p>
    ${card('Bilanz in Pflichtspielen', wdlRow('Total', summarize(P)) + wdlRow('Heim', home) + wdlRow('Auswärts', away))}
    ${card('Höchster Sieg', `<ul class="list">${bw && res(bw).r === 'W' ? matchItem(bw) : '<div class="empty">noch keiner</div>'}</ul>`) + card('Höchste Niederlage', `<ul class="list">${bl && res(bl).r === 'L' ? matchItem(bl) : '<div class="empty">noch keine</div>'}</ul>`)}
    ${card('Nach Jahrzehnt (alle Spiele)', `<table class="t"><thead><tr><th></th><th>Jahrzehnt</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Tore</th></tr></thead><tbody>${decRows}</tbody></table>`)}
    ${card('Letzte Duelle', `<ul class="list">${ms.slice(-10).reverse().map((m) => matchItem(m)).join('')}</ul><a class="ghost morebtn" href="#/archiv?o=${id}">alle ${ms.length} Spiele</a>`, id > 0 ? `<a href="${dbfczUrl('team', id)}" target="_blank" rel="noopener">dbFCZ</a>` : '')}
    ${foot()}`;
}

// ---------------------------------------------------------------- Saison-Archiv (dbFCZ)
async function renderSaisonArchiv(sid, seq) {
  const s = IX.season[sid]; if (!s) { view.innerHTML = '<div class="empty">Saison unbekannt</div>'; return; }
  const ms = S.db.matches.filter((m) => m[2] === sid);
  const prev = S.db.seasons[s.i - 1], next = S.db.seasons[s.i + 1];
  const st = s.standings || [];
  const stand = st.length ? `<table class="t"><thead><tr><th>#</th><th>Team</th><th>Sp</th><th class="hm">S</th><th class="hm">U</th><th class="hm">N</th><th>Tore</th><th>Pkt</th></tr></thead><tbody>
    ${st.map((r) => `<tr class="${r[1] === FCZ ? 'me' : ''}"><td>${r[0] ?? ''}</td><td><span class="ell">${r[1] === FCZ ? 'FCZ' : `<a href="#/gegner/${r[1]}">${esc(teamName(r[1]))}</a>`}</span>${r[8] ? ` <span class="pill">${esc(r[8])}</span>` : ''}</td><td>${r[2]}</td><td class="hm">${r[3]}</td><td class="hm">${r[4]}</td><td class="hm">${r[5]}</td><td>${esc(r[6])}</td><td><b>${r[7]}</b></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Keine Tabelle erfasst</div>';
  view.innerHTML = `<div class="row between"><a class="ghost" href="${prev ? '#/saisonarchiv/' + prev.id : '#/archiv?m=saisons'}">‹ ${esc(prev?.label || 'Saisons')}</a><a class="ghost" href="${next ? '#/saisonarchiv/' + next.id : '#/archiv?m=saisons'}">${esc(next?.label || 'Saisons')} ›</a></div>
    <h1 class="page-title">Saison ${esc(s.label)}</h1><p class="sub gap">${esc(s.league || '')}${s.rank ? ` · Rang ${s.rank}` : ''}${s.note ? ` · ${esc(s.note)}` : ''}</p>
    ${card('Bilanz (ohne Testspiele)', wdlBar(summarize(ms.filter((m) => m[7] !== 'F'))))}
    ${card('Tabelle', stand)}
    <div id="sq">${loadingCard('Eingesetzte Spieler')}</div>
    ${card(`Spiele (${ms.length})`, `<ul class="list">${ms.map((m) => matchItem(m, { showSeason: false })).join('')}</ul>`, `<a href="${dbfczUrl('saison', sid)}" target="_blank" rel="noopener">dbFCZ</a>`)}${foot()}`;
  const ps = await playerSeasons();
  if (seq !== routeSeq) return;
  const rows = [];
  for (const [pid, arr] of Object.entries(ps)) for (const r of arr) if (r[0] === sid) rows.push([+pid, r]);
  rows.sort((a, b) => b[1][1] - a[1][1] || b[1][6] - a[1][6]);
  const el = $('#sq'); if (!el) return;
  el.innerHTML = card(`Eingesetzte Spieler (${rows.length})`, `<table class="t"><thead><tr><th></th><th>Spieler</th><th>Pfl.</th><th class="hm">Liga</th><th>Test</th><th>Tore</th></tr></thead><tbody>
    ${rows.map(([pid, r], i) => `<tr><td>${i + 1}</td><td><a class="ell" href="#/spieler/${pid}">${esc(IX.player[pid]?.[1] || pid)}</a></td><td>${r[1]}</td><td class="hm">${r[2]}</td><td>${r[5]}</td><td><b>${r[6]}</b></td></tr>`).join('')}</tbody></table>`);
}

// ---------------------------------------------------------------- Spieler
const SORTS = { apps: [2, 'Spiele'], goals: [4, 'Tore'], liga: [3, 'Liga'], seasons: [9, 'Saisons'] };
function playerList(sort, f, page) {
  const col = SORTS[sort][0];
  let ps = S.db.players.slice();
  if (f) { const n = norm(f); ps = ps.filter((p) => norm(p[1]).includes(n)); }
  ps.sort((a, b) => b[col] - a[col] || b[2] - a[2]);
  return `<ul class="list">${ps.slice(0, page * 50).map((p, i) => `<li><a class="item" href="#/spieler/${p[0]}"><span class="rank num">${i + 1}</span>
   <span class="grow"><div class="t">${esc(p[1])}</div><div class="s num">${seasonLabel(p[7]).slice(0, 4)}–${seasonLabel(p[8]).slice(-4)} · ${p[9]} Saisons</div></span>
   <span class="kpi num"><b>${p[col]}</b><br>${SORTS[sort][1]}</span></a></li>`).join('') || '<div class="empty">Kein Spieler gefunden</div>'}</ul>
   ${ps.length > page * 50 ? `<a class="btn morebtn" href="#/spieler?s=${sort}&p=${page + 1}${f ? '&f=' + encodeURIComponent(f) : ''}">mehr laden</a>` : ''}`;
}
function renderSpieler(q) {
  const sort = SORTS[q.get('s')] ? q.get('s') : 'apps', page = Math.max(1, +q.get('p') || 1), f = q.get('f') || '';
  const chips = Object.entries(SORTS).map(([k, [, l]]) => `<a class="chip ${sort === k ? 'on' : ''}" href="#/spieler?s=${k}${f ? '&f=' + encodeURIComponent(f) : ''}">${l === 'Spiele' ? 'Pflichtspiele' : l === 'Liga' ? 'Ligaspiele' : l}</a>`).join('');
  const hof = (S.home?.hall_of_fame || []).filter((h) => IX.player[h.id]);
  view.innerHTML = `<h1 class="page-title">Spieler</h1><p class="sub gap">${fmtN(S.db.players.length)} Spieler mit Einsätzen im Archiv · Quelle dbFCZ</p>
  ${hof.length ? card('Hall of Fame (FCZ-Museum)', `<div class="chips">${hof.map((h) => `<a class="chip" href="#/spieler/${h.id}">${esc(h.name)}</a>`).join('')}</div>`) : ''}
  <input type="search" id="pf" placeholder="Name filtern …" value="${esc(f)}" aria-label="Spieler filtern" style="width:100%;margin-bottom:10px">
  <div class="chips">${chips}</div>
  <section class="card" id="plist">${playerList(sort, f, page)}</section>${foot()}`;
  const inp = $('#pf'); let tmo;
  inp.addEventListener('input', () => {
    clearTimeout(tmo);
    tmo = setTimeout(() => { history.replaceState(null, '', `#/spieler?s=${sort}${inp.value ? '&f=' + encodeURIComponent(inp.value) : ''}`); lastHash = location.hash; $('#plist').innerHTML = playerList(sort, inp.value, 1); }, 200);
  });
}
async function renderPlayer(id, seq) {
  const p = IX.player[id];
  if (!p) { view.innerHTML = `<div class="empty">Spieler nicht im Archiv. <a href="${dbfczUrl('spieler', id)}" target="_blank" rel="noopener">bei dbFCZ ansehen</a></div>`; return; }
  const sq = (S.fm?.squad || []).find((x) => norm(x.name) === norm(p[1]));
  const rank = S.db.players.filter((x) => x[2] > p[2]).length + 1;
  const grank = S.db.players.filter((x) => x[4] > p[4]).length + 1;
  const thread = Object.entries(S.arch?.topics || {}).find(([, t]) => norm(t.title) === norm(p[1]));
  const hof = (S.home?.hall_of_fame || []).some((h) => h.id === id);
  view.innerHTML = `<div class="row" style="align-items:flex-start">${avatar(p[1])}<div><h1 class="page-title">${esc(p[1])}</h1><p class="sub">${esc(seasonLabel(p[7]))} – ${esc(seasonLabel(p[8]))}${sq ? ` · aktuell #${sq.no ?? '–'} · ${esc(sq.pos || '')}` : ''}${hof ? ' · <span class="pill ok">Hall of Fame</span>' : ''}</p></div></div>
    <div class="grid3 keep" style="margin-top:12px">
      <div class="stat"><b>${p[2]}</b><span>Pflichtspiele</span> <span class="pill">#${rank}</span></div>
      <div class="stat"><b>${p[4]}</b><span>Tore</span> <span class="pill">#${grank}</span></div>
      <div class="stat"><b>${p[9]}</b><span>Saisons</span></div>
    </div>
    <p class="sub gap">Liga: ${p[3]} Spiele, ${p[5]} Tore · ${p[2] ? (p[4] / p[2]).toFixed(2) : '–'} Tore pro Pflichtspiel · ${p[6]} Testspiele</p>
    <div id="pseas">${loadingCard('Karriere beim FCZ')}</div>
    ${sq ? card('Aktuelle Saison', `<div class="grid3 keep"><div class="stat"><b>${sq.goals ?? 0}</b><span>Tore</span></div><div class="stat"><b>${sq.assists ?? 0}</b><span>Assists</span></div><div class="stat"><b>${sq.age ?? '–'}</b><span>Alter</span></div></div>`) : ''}
    <div id="wiki">${loadingCard('Wikipedia')}</div>
    ${card('Mehr', `<div class="ext">
      <a href="${dbfczUrl('spieler', id)}" target="_blank" rel="noopener">${ICON.db} dbFCZ-Profil</a>
      <a href="${thread ? forumTopic(thread[0]) : googleForum(p[1])}" target="_blank" rel="noopener">${ICON.chat} ${thread ? 'Spielerthread' : 'Im Forum suchen'}</a>
      ${sq ? `<a href="https://www.fotmob.com/players/${sq.id}" target="_blank" rel="noopener">${ICON.ext} FotMob</a>` : ''}
      <button type="button" data-share>${ICON.share} Teilen</button></div>`)}${foot()}`;
  wikiCard(p[1], seq);
  const ps = (await playerSeasons())[id] || [];
  if (seq !== routeSeq) return;
  const max = Math.max(1, ...ps.map((r) => r[1]));
  const el = $('#pseas'); if (!el) return;
  el.innerHTML = card('Karriere beim FCZ', `<div class="bars" aria-label="Pflichtspiele pro Saison">${ps.map((r, i) => `${i && IX.season[r[0]]?.i - IX.season[ps[i - 1][0]]?.i > 1 ? '<span class="gapbar" title="Pause"></span>' : ''}<a href="#/saisonarchiv/${r[0]}" style="height:${Math.max(2, 100 * r[1] / max)}%" title="${esc(seasonLabel(r[0]))}: ${r[1]} Pflichtspiele, ${r[6]} Tore"></a>`).join('')}</div>
    <div class="row between small muted"><span>${esc(seasonLabel(ps[0]?.[0]))}</span><span>Pflichtspiele pro Saison</span><span>${esc(seasonLabel(ps[ps.length - 1]?.[0]))}</span></div>
    <table class="t" style="margin-top:10px"><thead><tr><th></th><th>Saison</th><th>Pfl.</th><th class="hm">Liga</th><th class="hm">Cup</th><th class="hm">Eur.</th><th>Test</th><th>Tore</th></tr></thead><tbody>
    ${ps.slice().reverse().map((r) => `<tr><td></td><td><a href="#/saisonarchiv/${r[0]}">${esc(seasonLabel(r[0]))}</a></td><td>${r[1]}</td><td class="hm">${r[2]}</td><td class="hm">${r[3]}</td><td class="hm">${r[4]}</td><td>${r[5]}</td><td><b>${r[6]}</b></td></tr>`).join('')}</tbody></table>`);
}
async function wikiCard(name, seq) {
  const link = `https://de.wikipedia.org/w/index.php?search=${encodeURIComponent(name + ' Fussballspieler')}`;
  let html;
  try {
    const r = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, '_'))}`);
    if (!r.ok) throw 0;
    const w = await r.json();
    const txt = (w.description || '') + ' ' + (w.extract || '');
    if (w.type === 'disambiguation' || !/fu(ss|ß)ball/i.test(txt)) throw 0;
    html = card('Wikipedia', `<div class="wiki">${w.thumbnail ? `<img src="${esc(w.thumbnail.source)}" alt="">` : ''}<div><div class="s muted">${esc(w.description || '')}</div><p style="margin:4px 0">${esc(clip(w.extract, 420))}</p>
      <a href="${esc(w.content_urls?.mobile?.page || link)}" target="_blank" rel="noopener">weiterlesen ${ICON.ext}</a></div></div>`);
  } catch { html = card('Wikipedia', `<div class="hint">Kein eindeutiger Artikel gefunden. <a href="${link}" target="_blank" rel="noopener">Auf Wikipedia suchen</a></div>`); }
  if (seq !== routeSeq) return;
  const el = $('#wiki'); if (el) el.innerHTML = html;
}

// ---------------------------------------------------------------- Forum
function topicList(filt) {
  let topics = Object.entries(S.arch?.topics || {}).sort((x, y) => (y[1].last || '').localeCompare(x[1].last || ''));
  if (filt) { const n = norm(filt); topics = topics.filter(([, t]) => norm(t.title).includes(n)); }
  return `<ul class="list">${topics.slice(0, 60).map(([slug, t]) => `<li><a class="item" target="_blank" rel="noopener" href="${forumTopic(slug)}"><span class="grow"><div class="t">${esc(t.title)}</div><div class="s">${esc(t.forum || '')} · zuletzt ${rel(t.lastPost || t.last)}</div></span>${ICON.ext}</a></li>`).join('') || '<div class="empty">Kein Thema gefunden</div>'}</ul>`;
}
function renderForum(q) {
  const f = S.forum, a = S.arch; if (!f) { view.innerHTML = '<div class="empty">Keine Forumsdaten</div>'; return; }
  const filt = q.get('f') || '';
  const mood = (a?.mood || []).slice(-60);
  const liked = (f.mostLiked || []).slice(0, 8); // only what the forum shows right now; nothing archived
  const nTopics = Object.keys(a?.topics || {}).length;
  view.innerHTML = `<h1 class="page-title">Forum</h1><p class="sub gap">Live-Übersicht von fczforum.ch. Zum Lesen der Beiträge braucht es ein Forum-Login.</p>
  ${f.matchMood ? card('Matchstimmung', `<div class="row"><span class="mood">${esc(f.matchMood.emoji)}</span><div class="grow"><b>${esc(f.matchMood.label)}</b> · ${f.matchMood.score}/100<div class="s muted">aus den letzten ${f.matchMood.matches} Spielthreads</div></div></div>
    ${mood.length > 2 ? `<div class="bars thin">${mood.map((m) => `<i style="height:${m[1]}%" title="${new Date(m[0]).toLocaleString('de-CH')}: ${m[1]}"></i>`).join('')}</div><div class="s muted small">Verlauf seit ${new Date(mood[0][0]).toLocaleDateString('de-CH')}</div>` : ''}`) : ''}
  ${card('Trending', `<ul class="list">${(f.trending || []).map((t) => `<li><a class="item" target="_blank" rel="noopener" href="${forumTopic(t.slug)}"><span class="pill heat">${ICON.flame}${t.recentPostsCount}</span><span class="grow"><div class="t">${esc(t.title)}</div><div class="s">${esc(t.forumName)} · von ${esc(t.starterName)}</div></span>${ICON.ext}</a></li>`).join('') || '<div class="empty">ruhig gerade</div>'}</ul>`)}
  <div class="grid3 keep" style="margin-bottom:12px"><div class="stat"><b>${fmtN(f.stats?.posts)}</b><span>Beiträge</span></div><div class="stat"><b>${fmtN(f.stats?.topics)}</b><span>Themen</span></div><div class="stat"><b>${fmtN(f.stats?.members)}</b><span>Mitglieder</span></div></div>
  ${card('Bereiche', `<ul class="list">${f.forums.map((x) => `<li><a class="item" target="_blank" rel="noopener" href="${x.latest ? esc(x.latest.url) : 'https://fczforum.ch/forum'}">${avatar(x.name)}<span class="grow"><div class="t">${esc(x.name)}${x.membersOnly ? ' <span class="pill">nur Mitglieder</span>' : ''}</div>
    <div class="s">${fmtN(x.topics)} Themen · ${fmtN(x.posts)} Beiträge</div>${x.latest ? `<div class="s">↳ ${esc(x.latest.topicTitle)} · ${esc(x.latest.authorName)} · ${rel(x.latest.createdAt)}</div>` : ''}</span></a></li>`).join('')}</ul>`)}
  ${card('Meistgeliked', liked.map((l) => `<a class="quote" target="_blank" rel="noopener" href="${esc(l.url)}">${esc(clip(l.excerpt, 240))}<div class="s muted">${esc(l.authorName)} · ♥ ${l.likes} · ${esc(l.topicTitle)}</div></a>`).join(''))}
  ${card(`Themen-Radar (${nTopics})`, `<div class="hint" style="margin-bottom:8px">Jedes Thema, das seit dem Start dieser App auf der Forum-Startseite aufgetaucht ist. Die Liste wächst stündlich.</div>
    <input type="search" id="tf" placeholder="Themen filtern …" value="${esc(filt)}" aria-label="Themen filtern" style="width:100%;margin-bottom:6px"><div id="tlist">${topicList(filt)}</div>`)}
  ${(f.announcements || []).length ? card('Ankündigungen', `<ul class="list">${f.announcements.map((x) => `<li><a class="item" target="_blank" rel="noopener" href="${forumTopic(x.slug)}"><span class="grow"><div class="t">${esc(x.title)}</div><div class="s">${esc(x.starterName)} · ${rel(x.createdAt)}</div></span>${ICON.ext}</a></li>`).join('')}</ul>`) : ''}
  ${foot()}`;
  const inp = $('#tf'); let tmo;
  inp.addEventListener('input', () => { clearTimeout(tmo); tmo = setTimeout(() => { history.replaceState(null, '', '#/forum' + (inp.value ? '?f=' + encodeURIComponent(inp.value) : '')); lastHash = location.hash; $('#tlist').innerHTML = topicList(inp.value); }, 200); });
}

// ---------------------------------------------------------------- Match sheet
function openMatch(id) {
  const m = IX.matchById.get(id);
  if (!m) { sheet('<div class="empty">Spiel nicht gefunden</div>'); return; }
  const r = res(m); const opp = IX.byOpp[r.opp] || [];
  const s = summarize(opp.filter((x) => x[1] < m[1]));
  const prov = IX.prov.get(id);
  sheet(`<div class="s muted">${fmtD(m[1])} · ${esc(seasonLabel(m[2]))} · ${esc(m[8] || COMP[m[7]])}</div>
    <h2 class="sheet-score">${esc(teamName(m[3]))} <span class="score">${m[5] ?? '–'}:${m[6] ?? '–'}</span> ${esc(teamName(m[4]))}</h2>
    ${m[9] ? `<span class="pill${prov ? ' warn' : ''}">${esc(m[9])}</span>${prov ? ' <span class="s muted">noch nicht in dbFCZ erfasst</span>' : ''}` : ''}
    <p class="sub">Vor diesem Spiel stand es gegen ${esc(teamName(r.opp))} ${s.W}S ${s.D}U ${s.L}N (${s.n} Spiele).</p>
    <div class="ext">${prov ? `<a href="${esc(prov.url)}" target="_blank" rel="noopener">${ICON.ext} Details (FotMob)</a>` : `<a href="${dbfczUrl('spiel', id)}" target="_blank" rel="noopener">${ICON.db} Aufstellung & Tore</a>`}
    <a href="#/gegner/${r.opp}">Bilanz vs ${esc(teamName(r.opp))}</a>
    <a href="#/saisonarchiv/${m[2]}">Saison ${esc(seasonLabel(m[2]))}</a>
    <a href="${googleForum(teamName(r.opp) + ' ' + m[1].slice(0, 4))}" target="_blank" rel="noopener">${ICON.chat} Im Forum suchen</a></div>`);
}
function sheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; document.body.classList.add('locked'); }
function closeSheet() { $('#sheet').hidden = true; document.body.classList.remove('locked'); }
function leaveOverlay() { // back if we navigated here inside the app, else go to the page underneath
  if (navDepth > 0) history.back(); else location.hash = lastHash && !/^#\/(spiel|suche)/.test(lastHash) ? lastHash : '#/heute';
}
$('#sheet').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) leaveOverlay();
});

// ---------------------------------------------------------------- Search
let searchIndex = null;
function buildSearch() {
  const E = []; const byPid = {};
  for (const p of S.db.players) { const e = { g: 'Spieler', t: p[1], s: `${p[2]} Pflichtspiele · ${p[4]} Tore · ${seasonLabel(p[7]).slice(0, 4)}–${seasonLabel(p[8]).slice(-4)}`, h: '#/spieler/' + p[0], k: norm(p[1]), w: Math.log(2 + p[2]), pid: p[0] }; byPid[p[0]] = e; E.push(e); }
  for (const p of S.fm?.squad || []) {
    if (p.group === 'coach') continue;
    const db = findPlayerByName(p.name);
    if (db && byPid[db[0]]) { const e = byPid[db[0]]; e.w += 4; e.s = `Kader #${p.no ?? '–'} · ${p.pos || ''} · ` + e.s; e.squad = p; continue; }
    E.push({ g: 'Spieler', t: p.name, s: `Kader #${p.no ?? '–'} · ${p.pos || ''} · ${p.age ?? ''} J. · neu, noch nicht im Archiv`, h: `https://www.fotmob.com/players/${p.id}`, ext: true, k: norm(p.name), w: 4 });
  }
  for (const [id, n] of IX.oppSorted) if (id > 0) E.push({ g: 'Gegner', t: teamName(id), s: `${n} Spiele gegen den FCZ`, h: '#/gegner/' + id, k: norm(teamName(id)), w: Math.log(2 + n) + 1, tid: id });
  for (const s of S.db.seasons) E.push({ g: 'Saisons', t: 'Saison ' + s.label, s: [s.league, s.rank ? 'Rang ' + s.rank : '', s.note].filter(Boolean).join(' · '), h: '#/saisonarchiv/' + s.id, k: norm(s.label + ' ' + s.label.replace(/(\d{2})(\d{2})\/(\d{2})(\d{2})/, '$2/$4') + ' ' + (s.note || '')), w: 2 });
  for (const [slug, t] of Object.entries(S.arch?.topics || {})) E.push({ g: 'Forum-Themen', t: t.title, s: `${t.forum || ''} · ${rel(t.lastPost || t.last)}`, h: forumTopic(slug), ext: true, k: norm(t.title), w: 1.5 });
  const gc = findTeam('Grasshoppers');
  const pages = [['Tabelle', '#/saison?t=tabelle', 'tabelle rangliste'], ['Spielplan', '#/saison?t=spiele', 'spielplan fixtures kalender termine'], ['Kader', '#/saison?t=kader', 'kader team squad'], ['Rekorde & Serien', '#/archiv?m=rekorde', 'rekorde serien hoechste siege zeitmaschine'], ['Platzierungen aller Saisons', '#/archiv?m=saisons', 'saisons platzierungen meister titel'], ['Stadtderby FCZ – GC', '#/gegner/' + gc, 'derby stadtderby'], ['Tagesquiz', '#/heute', 'quiz tagesquiz raten'], ['Forum-Puls', '#/forum', 'forum stimmung trending']];
  for (const [t, h, k] of pages) E.push({ g: 'Seiten', t, s: 'Bereich der App', h, k, w: 3 });
  searchIndex = E;
}
function hl(text, q) {
  const words = norm(q).split(' ').filter((w) => w.length > 1);
  if (!words.length) return esc(text);
  const chars = [...text]; let nt = ''; const map = [];
  chars.forEach((ch, i) => { for (const c of foldChar(ch)) { nt += c; map.push(i); } });
  const on = new Array(chars.length).fill(false);
  for (const w of words) { let i = nt.indexOf(w); while (i >= 0) { for (let k = i; k < i + w.length; k++) on[map[k]] = true; i = nt.indexOf(w, i + w.length); } }
  let out = '', open = false;
  chars.forEach((ch, i) => { if (on[i] && !open) { out += '<mark>'; open = true; } if (!on[i] && open) { out += '</mark>'; open = false; } out += esc(ch); });
  return out + (open ? '</mark>' : '');
}
function lev1(a, b) { // edit distance <= 1
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return e + (a.length - i) + (b.length - j) <= 1;
}
const COMPWORDS = { liga: 'L', meisterschaft: 'L', cup: 'C', pokal: 'C', europa: 'I', europacup: 'I', international: 'I', uefa: 'I', test: 'F', testspiel: 'F', freundschaft: 'F', freundschaftsspiel: 'F', pflicht: 'P', pflichtspiel: 'P' };
const VENUE = { heim: 'h', home: 'h', zuhause: 'h', letzi: 'h', auswarts: 'a', auswaerts: 'a', away: 'a', ausw: 'a' };
function parseCombo(q) {
  const f = {}; const rest = [];
  for (const raw of q.trim().split(/\s+/)) {
    const t = norm(raw);
    if (/^\d{1,2}[:\-]\d{1,2}$/.test(raw)) f.s = raw.replace('-', ':');
    else if (/^(18|19|20)\d\d$/.test(raw)) f.y = raw;
    else if (/^(\d0)er$/.test(t) || /^(19|20)\d0er$/.test(t)) { const d = t.length === 4 ? (+t.slice(0, 2) >= 30 ? '19' : '20') + t.slice(0, 2) : t.slice(0, 4); f.d = d; }
    else if (COMPWORDS[t]) f.c = COMPWORDS[t];
    else if (VENUE[t]) f.v = VENUE[t];
    else if (!['gegen', 'vs', 'v', 'fcz', 'zurich', 'fc'].includes(t)) rest.push(t);
  }
  if (rest.length) { const o = findTeam(rest.join(' ')); if (o) { f.o = o; rest.length = 0; } }
  return { f, rest };
}
function oppAnswer(tid) {
  const ms = IX.byOpp[tid].filter((x) => x[7] !== 'F');
  const nx = (S.fm?.fixtures || []).find((x) => !x.finished && findTeam(isFczFm(x.homeId) ? x.away : x.home) === tid);
  return card(`FCZ vs ${esc(teamName(tid))} · Pflichtspiele`, wdlBar(summarize(ms)) + `<div class="form" style="margin-top:6px">${ms.slice(-8).map((x) => `<a class="badge ${res(x).r}" href="#/spiel/${x[0]}" title="${fmtD(x[1])}">${LET[res(x).r]}</a>`).join('')}</div>${nx ? `<div class="s" style="margin-top:6px">Nächstes Duell: ${new Date(nx.utc).toLocaleDateString('de-CH')}</div>` : ''}`, `<a href="#/gegner/${tid}">Bilanz</a>`, 'answer');
}
function playerAnswer(p, q) {
  const rank = S.db.players.filter((x) => x[2] > p[2]).length + 1;
  const thread = Object.entries(S.arch?.topics || {}).find(([, t]) => norm(t.title) === norm(p[1]));
  return `<section class="card answer"><a class="row" href="#/spieler/${p[0]}">${avatar(p[1])}<div class="grow"><b>${hl(p[1], q)}</b><div class="s">${esc(seasonLabel(p[7]))} – ${esc(seasonLabel(p[8]))}</div></div>${ICON.chev}</a>
    <div class="grid3" style="margin-top:10px"><div class="stat"><b>${p[2]}</b><span>Pflichtsp. · #${rank}</span></div><div class="stat"><b>${p[4]}</b><span>Tore</span></div><div class="stat"><b>${p[9]}</b><span>Saisons</span></div></div>
    <div class="ext"><a href="${dbfczUrl('spieler', p[0])}" target="_blank" rel="noopener">${ICON.db} dbFCZ</a><a href="${thread ? forumTopic(thread[0]) : googleForum(p[1])}" target="_blank" rel="noopener">${ICON.chat} ${thread ? 'Spielerthread' : 'Forum'}</a></div></section>`;
}
function comboOut(f, ms) {
  const p = new URLSearchParams(Object.entries(f).filter(([k]) => k !== 'w' && k !== 'q').map(([k, v]) => [k, String(v)]));
  const label = f.w ? `Wettbewerb: „${f.q || f.w}“` : [f.o && 'vs ' + teamName(f.o), f.c && COMP[f.c], f.v && (f.v === 'h' ? 'Heim' : 'Auswärts'), f.y, f.d && f.d + 'er', f.s && 'Resultat ' + f.s].filter(Boolean).join(' · ');
  return { g: label, answer: card(`${fmtN(ms.length)} Spiele`, wdlBar(summarize(ms)), f.w ? '' : `<a href="#/archiv?${p}">alle zeigen</a>`, 'answer'), items: ms.slice(-8).reverse().map((x) => ({ match: x })) };
}
function search(qs) {
  if (!searchIndex) buildSearch();
  const q = qs.trim(); const out = [];
  // dates: 14.11. / 14.11 / 14.11.1967
  let m = q.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?$/);
  if (m) {
    const md = `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const y = m[3] ? (m[3].length === 2 ? (+m[3] > 30 ? '19' : '20') + m[3] : m[3]) : null;
    const ms = S.db.matches.filter((x) => x[1]?.slice(5) === md && (!y || x[1].startsWith(y)));
    out.push({ g: y ? `Spiele am ${q}` : `Spiele an einem ${m[1]}.${m[2]}.`, items: ms.slice(-12).reverse().map((x) => ({ match: x })), all: ms.length > 12 ? `#/archiv?tag=${md}` : null, n: ms.length });
    return out;
  }
  // combos: opponent + year/decade + score + competition + venue (+ leftover words matched against competition names)
  const { f, rest } = parseCombo(q);
  const filt = Object.keys(f);
  if (filt.length === 1 && f.o && !rest.length) {
    out.push({ g: 'Gegner', answer: oppAnswer(f.o), items: IX.byOpp[f.o].slice(-6).reverse().map((x) => ({ match: x })), all: `#/archiv?o=${f.o}`, n: IX.byOpp[f.o].length });
    return out;
  }
  if (filt.length) {
    let ms = filterMatches(f);
    if (rest.length) { ms = ms.filter((x) => { const d = norm(x[8]); return rest.every((w) => d.includes(w)); }); f.w = rest.join(' '); f.q = q; }
    if (ms.length) { out.push(comboOut(f, ms)); return out; }
  }
  const words = norm(q.replace(/^(gegen|vs\.?)\s+/i, '')).split(' ').filter(Boolean);
  if (!words.length) return out;
  const scoreIt = (e, ws, fuzzy) => {
    let sc = 0; const kw = e.k.split(' ');
    for (const w of ws) {
      const i = e.k.indexOf(w);
      if (i === 0) sc += 3; else if (i > 0 && e.k[i - 1] === ' ') sc += 2; else if (i > 0 && w.length >= 3) sc += 0.5;
      else if (fuzzy && w.length >= 4 && kw.some((x) => lev1(x.slice(0, w.length + 1), w) || lev1(x, w))) sc += 1;
      else return -1;
    }
    if (e.k === ws.join(' ')) sc += 4;
    return sc + e.w;
  };
  let hits = searchIndex.map((e) => [scoreIt(e, words), e]).filter((h) => h[0] >= 0);
  let fuzzy = false;
  if (!hits.length) {
    // competition names in the archive ("Europa League", "Messestädte", "Alpencup")
    const ms = S.db.matches.filter((x) => { const d = norm(x[8]); return words.every((w) => d.includes(w)); });
    if (ms.length) { out.push(comboOut({ w: q, q }, ms)); return out; }
    hits = searchIndex.map((e) => [scoreIt(e, words, true), e]).filter((h) => h[0] >= 0); fuzzy = hits.length > 0;
  }
  hits.sort((a, b) => b[0] - a[0]);
  const top = hits[0]?.[1];
  if (top && (hits.length === 1 || hits[0][0] - hits[1][0] > 1.5 || top.k === words.join(' '))) {
    if (top.pid) { out.push({ g: 'Treffer', answer: playerAnswer(IX.player[top.pid], q), items: [] }); hits.shift(); }
    else if (top.tid) { out.push({ g: 'Treffer', answer: oppAnswer(top.tid), items: [] }); hits.shift(); }
  }
  const groups = {};
  for (const [, e] of hits) (groups[e.g] ||= []).push(e);
  for (const g of ['Seiten', 'Gegner', 'Spieler', 'Saisons', 'Forum-Themen']) if (groups[g]) out.push({ g: g + (fuzzy ? ' (ähnlich)' : ''), items: groups[g].slice(0, g === 'Spieler' ? 10 : 6), n: groups[g].length });
  return out;
}
function emptySearch() {
  const recent = store.get('recent', []);
  const nf = nextFixture();
  const next = nf ? (isFczFm(nf.homeId) ? nf.away : nf.home) : null;
  const tr = (S.forum?.trending || []).slice(0, 3).map((t) => t.title);
  const sugg = [next, 'gegen GC', 'Cup Basel', 'auswärts YB 2022', 'Europa League', '5:0', '1981', 'Kuhn', zurichISO().slice(8) + '.' + zurichISO().slice(5, 7) + '.', ...tr].filter(Boolean);
  return `${recent.length ? `<div class="group-h">Zuletzt gesucht</div><div class="chips flush">${recent.map((r) => `<button class="chip" data-q="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}
    <div class="group-h">Probier mal</div><div class="chips flush">${sugg.map((x) => `<button class="chip" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>
    <p class="hint" style="margin-top:16px">Eine Suche für alles: <b>${fmtN(S.db.players.length)} Spieler</b>, <b>${fmtN(S.db.matches.length)} Spiele</b>, ${S.db.seasons.length} Saisons, alle Gegner, der aktuelle Kader und die Forum-Themen.<br>
    Kombinieren geht auch: <code>Basel 1981</code> · <code>Cup GC</code> · <code>auswärts YB</code> · <code>5:0</code> · <code>70er Servette</code> · <code>14.11.</code></p>`;
}
function renderResults(qs) {
  const el = $('#results');
  if (!S.db) { el.innerHTML = S.dbFailed ? '<div class="empty">Archiv nicht erreichbar. Bitte später nochmals.</div>' : '<div class="empty">Archiv lädt …</div>'; return; }
  const q = qs.trim();
  if (!q) { el.innerHTML = emptySearch(); return; }
  const groups = search(q);
  const item = (e) => e.match ? matchItem(e.match) : `<li><a class="item" href="${esc(e.h)}" ${e.ext ? 'target="_blank" rel="noopener"' : ''}><span class="grow"><div class="t">${hl(e.t, q)}</div><div class="s">${esc(e.s || '')}</div></span>${e.ext ? ICON.ext : ICON.chev}</a></li>`;
  el.innerHTML = (groups.map((g) => `<div class="group-h">${esc(g.g)}${g.n > g.items.length ? ` · ${g.n}` : ''}</div>${g.answer || ''}${g.items.length ? `<section class="card tight"><ul class="list">${g.items.map(item).join('')}</ul>${g.all ? `<a class="ghost morebtn" href="${g.all}">alle ${g.n}</a>` : ''}</section>` : (g.answer ? '' : '<div class="empty">nichts</div>')}`).join('')
    || '<div class="empty">Nichts lokal gefunden. Probier die Quellen unten.</div>')
    + `<div class="group-h">Direkt in den Quellen suchen</div><div class="ext">
      <button type="button" data-db="suche_spieler">${ICON.db} dbFCZ: Spieler</button><button type="button" data-db="suche_volltext">${ICON.db} dbFCZ: Volltext</button>
      <a href="${googleForum(q)}" target="_blank" rel="noopener">${ICON.chat} Forum (via Google)</a>
      <a href="https://de.wikipedia.org/w/index.php?search=${encodeURIComponent(q + ' FC Zürich')}" target="_blank" rel="noopener">${ICON.book} Wikipedia</a></div>`;
}
const layer = $('#searchLayer'), qi = $('#q');
function remember(q) { q = q.trim(); if (q.length < 2) return; const r = store.get('recent', []).filter((x) => x !== q); r.unshift(q); store.set('recent', r.slice(0, 8)); }
$('#searchOpen').addEventListener('click', () => { location.hash = '#/suche'; });
$('#searchClose').addEventListener('click', leaveOverlay);
let st; qi.addEventListener('input', () => {
  clearTimeout(st);
  st = setTimeout(() => { history.replaceState(null, '', '#/suche' + (qi.value ? '?q=' + encodeURIComponent(qi.value) : '')); renderResults(qi.value); }, 120);
});
qi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { remember(qi.value); qi.blur(); } if (e.key === 'Escape') leaveOverlay(); });
$('#results').addEventListener('click', (e) => {
  const c = e.target.closest('[data-q]'); if (c) { qi.value = c.dataset.q; qi.dispatchEvent(new Event('input')); return; }
  const d = e.target.closest('[data-db]');
  if (d) { const f = $('#dbfczForm'); f.suche_string.value = qi.value; f.suche_radio.value = d.dataset.db; f.submit(); remember(qi.value); return; }
  if (e.target.closest('a')) remember(qi.value);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#sheet').hidden) leaveOverlay();
  if (e.key === '/' && layer.hidden && !/input|select|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); location.hash = '#/suche'; }
});
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-theme-toggle]');
  if (t) { const order = ['auto', 'light', 'dark']; const cur = store.get('theme', 'auto'); const nx = order[(order.indexOf(cur) + 1) % 3]; store.set('theme', nx); applyTheme(); t.outerHTML = themeBtn(); return; }
  const b = e.target.closest('[data-share]'); if (!b) return;
  const data = { title: document.title, url: location.href };
  try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(location.href); b.textContent = 'Link kopiert'; } } catch { /* cancelled */ }
});
function applyTheme() { const t = store.get('theme', 'auto'); if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; }

// ---------------------------------------------------------------- router
let lastHash = null, navDepth = 0;
const NEEDS_DB = new Set(['archiv', 'gegner', 'saisonarchiv', 'spieler', 'spiel', 'suche']);
function route() {
  const h = location.hash.slice(2) || 'heute';
  const [path, qs] = h.split('?');
  const q = new URLSearchParams(qs || '');
  const [a, b] = path.split('/');
  const tab = { heute: 'heute', saison: 'saison', archiv: 'archiv', gegner: 'archiv', saisonarchiv: 'archiv', spieler: 'spieler', forum: 'forum' }[a];
  if (a === 'suche') {
    closeSheet(); layer.hidden = false; document.body.classList.add('locked');
    if (qi.value !== (q.get('q') || '')) qi.value = q.get('q') || '';
    renderResults(qi.value); if (!qi.value) setTimeout(() => qi.focus(), 30);
    return;
  }
  layer.hidden = true;
  if (a === 'spiel') {
    if (!lastHash || /^#\/(spiel|suche)/.test(lastHash)) { renderMain('archiv', null, new URLSearchParams(), 'archiv'); lastHash = '#/archiv'; }
    if (!S.db) { sheet('<div class="empty">Archiv lädt …</div>'); dbReady.then(() => { if (location.hash.startsWith('#/spiel/')) openMatch(+b); }); return; }
    openMatch(+b); return;
  }
  closeSheet();
  if (location.hash === lastHash && view.dataset.r) return; // returning from an overlay: keep page + scroll
  lastHash = location.hash;
  renderMain(a, b, q, tab);
}
function renderMain(a, b, q, tab) {
  clearInterval(timer);
  const seq = ++routeSeq;
  document.querySelectorAll('#tabs a').forEach((x) => x.classList.toggle('on', x.dataset.tab === (tab || 'heute')));
  const titles = { heute: 'Heute', saison: 'Saison', archiv: 'Archiv', spieler: 'Spieler', forum: 'Forum', gegner: 'Gegner', saisonarchiv: 'Saison' };
  document.title = `FCZ Radar · ${titles[a] || 'Heute'}`;
  view.dataset.r = a || 'heute';
  if (NEEDS_DB.has(a) && !S.db) { view.innerHTML = loadingCard('Archiv lädt …'); dbReady.then(() => { if (seq === routeSeq) { if (S.db) renderMain(a, b, q, tab); else view.innerHTML = errCard('Archiv'); } }); return; }
  if (a === 'saison') renderSaison(q);
  else if (a === 'archiv') renderArchiv(q);
  else if (a === 'gegner') renderGegner(+b);
  else if (a === 'saisonarchiv') renderSaisonArchiv(+b, seq);
  else if (a === 'spieler' && b) renderPlayer(+b, seq);
  else if (a === 'spieler') renderSpieler(q);
  else if (a === 'forum') renderForum(q);
  else renderHeute(seq);
  if (!q.get('p')) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => { navDepth++; route(); });
applyTheme();
loadDb();
const smallReady = loadSmall();
smallReady.then(() => {
  route();
  dbReady.then(() => {
    integrate();
    if (!layer.hidden) renderResults(qi.value);
    else if (view.dataset.r === 'heute' || view.dataset.r === 'saison') { const y = scrollY; renderMain(view.dataset.r, null, new URLSearchParams(location.hash.split('?')[1] || ''), view.dataset.r); scrollTo(0, y); }
  });
});
// installed PWAs stay open for days: refresh small data when coming back after a while
let hiddenAt = 0;
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (Date.now() - hiddenAt < 10 * 60e3) return;
  await loadSmall(); integrate();
  if (['heute', 'saison', 'forum'].includes(view.dataset.r) && layer.hidden && $('#sheet').hidden) { const y = scrollY; lastHash = null; route(); scrollTo(0, y); }
});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
