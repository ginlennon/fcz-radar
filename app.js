// FCZ Radar — inoffizielle Fan-App. Vanilla JS, keine Abhängigkeiten, keine Keys.
// Daten: data/*.json (per GitHub Action aus dbFCZ, FCZforum, FotMob gebaut) + live: Mastodon @dbFCZ, Wikipedia.

const FCZ = 1; // dbFCZ team id
const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const S = { db: null, home: null, forum: null, arch: null, fm: null, meta: null, ps: null };
const IX = {};

// ---------------------------------------------------------------- utils
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/ß/g, 'ss').replace(/[«»"'`´.,()\-\/]/g, ' ').replace(/\s+/g, ' ').trim();
const fmtD = (iso) => (iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '–');
const nf = new Intl.NumberFormat('de-CH');
const fmtN = (n) => (n == null ? '–' : nf.format(n));
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
const initials = (n) => String(n || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
function hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
const avatar = (n) => `<span class="avatar" style="background:hsl(${hue(n)} 55% 42%)">${esc(initials(n))}</span>`;
const crest = (id) => (id ? `<img class="crest" loading="lazy" alt="" src="https://images.fotmob.com/image_resources/logo/teamlogo/${id}_small.png" onerror="this.style.visibility='hidden'">` : '');
const COMP = { L: 'Liga', C: 'Cup', I: 'Europa', F: 'Test', LC: 'Ligacup', O: 'Andere' };
const dbfczUrl = (kind, id) => `https://www.dbfcz.ch/${kind}.php?${kind}_id=${id}`;
const forumTopic = (slug) => `https://fczforum.ch/forum/thema/${encodeURIComponent(slug)}/letzter-beitrag`;
const googleForum = (q) => `https://www.google.com/search?q=${encodeURIComponent('site:fczforum.ch ' + q)}`;

// ---------------------------------------------------------------- data
async function getJSON(p) {
  const r = await fetch(p, { cache: 'no-cache' });
  if (!r.ok) throw new Error(p + ' ' + r.status);
  return r.json();
}
async function loadAll() {
  const [db, home, forum, arch, fm, meta] = await Promise.all(
    ['data/db.json', 'data/dbfcz_home.json', 'data/forum.json', 'data/forum_archive.json', 'data/fotmob.json', 'data/meta.json']
      .map((p) => getJSON(p).catch(() => null)));
  Object.assign(S, { db, home, forum, arch, fm, meta });
  buildIndexes();
}
async function playerSeasons() {
  if (!S.ps) S.ps = await getJSON('data/player_seasons.json').catch(() => ({}));
  return S.ps;
}

function res(m) { // FCZ perspective
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
}
const teamName = (id) => (id === FCZ ? 'FCZ' : IX.team?.[id] || '?');
const seasonLabel = (sid) => IX.season?.[sid]?.label || '';

function findTeam(name) { // FotMob name -> dbFCZ team id
  const n = norm(name).replace(/\b(fc|sc|bsc|fk|ac|1)\b/g, '').replace(/sports?$/, '').trim();
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
  for (const p of S.db?.players || []) if (norm(p[1]) === n && (!best || p[8] > best[8])) best = p;
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
function wdlBar(o) {
  if (!o.n) return '<div class="empty">Keine Spiele</div>';
  const p = (x) => (100 * x / o.n).toFixed(1);
  return `<div class="wdl"><i class="W" style="width:${p(o.W)}%"></i><i class="D" style="width:${p(o.D)}%"></i><i class="L" style="width:${p(o.L)}%"></i></div>
  <div class="legend num"><span><b>${o.W}</b> Siege</span><span><b>${o.D}</b> Remis</span><span><b>${o.L}</b> Niederl.</span><span class="muted">${o.gf}:${o.ga}</span></div>`;
}
function matchItem(m, { showSeason = true } = {}) {
  const r = res(m);
  const extra = m[9] ? ` <span class="pill">${esc(m[9])}</span>` : '';
  return `<li><a class="item" href="#/spiel/${m[0]}">
    <span class="badge ${r.r}">${r.r === 'W' ? 'S' : r.r === 'D' ? 'U' : r.r === 'L' ? 'N' : '·'}</span>
    <span class="grow"><div class="t">${esc(teamName(m[3]))} – ${esc(teamName(m[4]))}</div>
    <div class="s">${fmtD(m[1])} · ${esc(m[8] || COMP[m[7]])}${showSeason ? ' · ' + esc(seasonLabel(m[2])) : ''}</div></span>
    <span class="score">${m[5] ?? '–'}:${m[6] ?? '–'}</span>${extra}</a></li>`;
}
const card = (title, body, link = '') => `<section class="card"><h2><span>${title}</span>${link}</h2>${body}</section>`;
const foot = () => `<p class="foot">Inoffizielle Fan-App, nicht mit dem FC Zürich verbunden.<br>
  Daten: <a href="https://www.dbfcz.ch" target="_blank" rel="noopener">dbFCZ</a> (CC-BY 4.0) ·
  <a href="https://fczforum.ch/forum" target="_blank" rel="noopener">FCZforum</a> ·
  <a href="https://www.fotmob.com/teams/10243/overview/fc-zurich" target="_blank" rel="noopener">FotMob</a> ·
  <a href="https://mastodon.social/@dbfcz" target="_blank" rel="noopener">@dbFCZ</a> · Wikipedia<br>
  Stand: ${S.meta?.forum ? rel(S.meta.forum) : '–'} · <a href="https://github.com/ginlennon/fcz-radar" target="_blank" rel="noopener">Quellcode</a></p>`;

// ---------------------------------------------------------------- views: Heute
let timer = null;
function nextFixture() {
  const now = Date.now();
  return (S.fm?.fixtures || []).find((f) => !f.finished && !f.cancelled && new Date(f.utc).getTime() > now - 3 * 3600e3);
}
function lastFixtures(n) {
  return (S.fm?.fixtures || []).filter((f) => f.finished).slice(-n);
}
function fmRes(f) {
  const z = f.homeId === S.fm.teamId; const gf = z ? f.hs : f.as, ga = z ? f.as : f.hs;
  return gf > ga ? 'W' : gf < ga ? 'L' : 'D';
}
function heroNext() {
  const f = nextFixture();
  if (!f) return '';
  const oppName = f.homeId === S.fm.teamId ? f.away : f.home;
  const oppId = findTeam(oppName);
  const h2h = oppId ? summarize(IX.byOpp[oppId] || []) : null;
  const d = new Date(f.utc);
  const thread = matchThread(oppName);
  return `<section class="card hero"><h2><span>Nächstes Spiel · ${esc(f.tournament || '')}</span></h2>
    <div class="teams"><div class="team">${crestBig(f.homeId)}<span>${esc(f.home)}</span></div><div class="vs">vs</div>
    <div class="team">${crestBig(f.awayId)}<span>${esc(f.away)}</span></div></div>
    <div class="countdown" id="cd" data-t="${d.getTime()}"></div>
    <div class="meta">${d.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}, ${d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
    ${h2h && h2h.n ? `<br>All-time vs ${esc(oppName)}: ${h2h.W}S ${h2h.D}U ${h2h.L}N in ${h2h.n} Spielen` : ''}</div>
    <div class="actions">${oppId ? `<a class="btn" href="#/gegner/${oppId}">Bilanz</a>` : ''}
    ${thread ? `<a class="btn" target="_blank" rel="noopener" href="${forumTopic(thread)}">Matchthread</a>` : ''}
    <a class="btn" href="${S.fm.ics.replace(/^https:/, 'webcal:')}">Kalender abonnieren</a></div></section>`;
}
const crestBig = (id) => `<img alt="" src="https://images.fotmob.com/image_resources/logo/teamlogo/${id}.png" onerror="this.style.visibility='hidden'">`;
function matchThread(opp) {
  const n = norm(opp).split(' ').filter((w) => w.length > 2 && !['fc', 'sports'].includes(w));
  const topics = Object.entries(S.arch?.topics || {}).filter(([, t]) => / vs |vs\.|–|-/.test(t.title));
  let best = null;
  for (const [slug, t] of topics) {
    const tn = norm(t.title);
    if (n.some((w) => tn.includes(w)) && tn.includes('zurich') && (!best || (t.last || '') > (best[1].last || ''))) best = [slug, t];
  }
  return best?.[0];
}
function tickCountdown() {
  const el = $('#cd'); if (!el) return;
  let s = Math.max(0, Math.floor((+el.dataset.t - Date.now()) / 1000));
  if (s === 0) { el.innerHTML = '<div><b>LIVE</b><span>oder vorbei</span></div>'; return; }
  const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
  el.innerHTML = [[d, 'Tage'], [h, 'Std'], [m, 'Min'], [s, 'Sek']].map(([v, l]) => `<div><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`).join('');
}
function miniTable() {
  const t = S.fm?.table || []; if (!t.length) return '';
  const i = t.findIndex((r) => r.id === S.fm.teamId);
  const lo = Math.max(0, Math.min(i - 2, t.length - 5));
  return card('Tabelle · ' + esc(S.fm.league || ''), tableHTML(t.slice(lo, lo + 5)), '<a href="#/saison">ganze Tabelle</a>');
}
function tableHTML(rows) {
  return `<div class="scroll-x"><table class="t"><thead><tr><th>#</th><th>Team</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Tore</th><th>Diff</th><th>Pkt</th></tr></thead><tbody>
  ${rows.map((r) => `<tr class="${r.id === S.fm.teamId ? 'me' : ''}"><td><span class="qual" style="background:${r.qualColor || 'transparent'}"></span> ${r.idx}</td>
  <td><span class="row" style="gap:6px">${crest(r.id)}${esc(r.shortName || r.name)}</span></td><td>${r.played}</td><td>${r.wins}</td><td>${r.draws}</td><td>${r.losses}</td>
  <td>${esc(r.scoresStr)}</td><td>${r.goalConDiff > 0 ? '+' : ''}${r.goalConDiff}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table></div>`;
}
function onThisDay() {
  const now = new Date(); const md = `-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let ms = S.db.matches.filter((m) => m[1]?.endsWith(md) && +m[1].slice(0, 4) < now.getFullYear());
  let title = 'Heute vor … Jahren';
  if (!ms.length) { // fall back to ±3 days
    const days = new Set([-3, -2, -1, 1, 2, 3].map((k) => { const d = new Date(now); d.setDate(d.getDate() + k); return `-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }));
    ms = S.db.matches.filter((m) => m[1] && days.has(m[1].slice(4)));
    title = 'Diese Woche in der Geschichte';
  }
  ms = ms.slice().sort((a, b) => (b[1] < a[1] ? -1 : 1));
  const yrs = (m) => now.getFullYear() - +m[1].slice(0, 4);
  return card(title, `<ul class="list">${ms.slice(0, 6).map((m) => matchItem(m).replace('<span class="grow">', `<span class="grow"><div class="s">vor ${yrs(m)} Jahren</div>`)).join('')}</ul>
    ${ms.length > 6 ? `<a class="ghost morebtn" href="#/archiv?tag=${md.slice(1)}">alle ${ms.length} Spiele an diesem Tag</a>` : ''}`);
}
function birthdays() {
  const b = S.home?.birthdays || []; if (!b.length) return '';
  const today = new Date().toISOString().slice(5, 10);
  return card('Geburtstage', `<ul class="list">${b.slice(0, 8).map((p) => `<li><a class="item" href="${IX.player[p.id] ? '#/spieler/' + p.id : dbfczUrl('spieler', p.id)}">
    ${avatar(p.name)}<span class="grow"><div class="t">${esc(p.name)}</div><div class="s">${fmtD(p.date)} · ${p.date?.slice(5) === today ? '🎂 heute ' : ''}${p.years} Jahre${IX.player[p.id] ? ' · ' + IX.player[p.id][2] + ' Pflichtspiele' : ''}</div></span><span class="chev">›</span></a></li>`).join('')}</ul>`);
}
function forumPulse() {
  const f = S.forum; if (!f) return '';
  const mood = f.matchMood;
  const tr = (f.trending || []).slice(0, 3);
  const top = (f.mostLiked || [])[0];
  return card('Forum-Puls', `${mood ? `<div class="row" style="margin-bottom:8px"><span class="mood">${esc(mood.emoji)}</span><div><b>Stimmung: ${esc(mood.label)}</b><div class="s muted">Score ${mood.score}/100 aus den letzten ${mood.matches} Spielen</div></div></div>` : ''}
    <ul class="list">${tr.map((t) => `<li><a class="item" target="_blank" rel="noopener" href="${forumTopic(t.slug)}"><span class="pill">🔥 ${t.recentPostsCount}</span><span class="grow"><div class="t">${esc(t.title)}</div><div class="s">${esc(t.forumName)}</div></span><span class="chev">↗</span></a></li>`).join('')}</ul>
    ${top ? `<div class="quote">${esc(top.excerpt)}<div class="s muted">— ${esc(top.authorName)} · ❤ ${top.likes} · ${esc(top.topicTitle)}</div></div>` : ''}`, '<a href="#/forum">Forum</a>');
}
function lastResult() {
  const l = lastFixtures(5); if (!l.length) return '';
  const f = l[l.length - 1];
  return card('Letztes Spiel', `<a class="item" target="_blank" rel="noopener" href="${esc(f.url)}">${crest(f.homeId)}<span class="grow"><div class="t">${esc(f.home)} – ${esc(f.away)}</div><div class="s">${new Date(f.utc).toLocaleDateString('de-CH')} · ${esc(f.tournament || '')}</div></span><span class="score" style="font-size:18px">${esc(f.score || '')}</span>${crest(f.awayId)}</a>
    <div class="row between" style="margin-top:6px"><span class="s muted">Form</span><span class="form">${l.map((x) => `<span class="badge ${fmRes(x)}" title="${esc(x.home + ' ' + x.score + ' ' + x.away)}">${{ W: 'S', D: 'U', L: 'N' }[fmRes(x)]}</span>`).join('')}</span></div>`);
}
async function mastodon() {
  const el = $('#toots'); if (!el) return;
  try {
    const r = await fetch('https://mastodon.social/api/v1/accounts/109245736019387633/statuses?limit=4&exclude_replies=true&exclude_reblogs=true');
    const st = await r.json();
    el.innerHTML = st.map((s) => {
      const txt = new DOMParser().parseFromString(s.content, 'text/html').body.textContent;
      return `<div class="toot"><p>${esc(txt).slice(0, 280)}</p><a class="small" href="${esc(s.url)}" target="_blank" rel="noopener">${rel(s.created_at)} ↗</a></div>`;
    }).join('') || '<div class="empty">Keine Toots</div>';
  } catch { el.innerHTML = '<div class="empty">Mastodon gerade nicht erreichbar</div>'; }
}
function renderHeute() {
  view.innerHTML = heroNext() + lastResult() + miniTable() + onThisDay() + birthdays() + forumPulse()
    + card('Neu bei @dbFCZ', '<div id="toots"><div class="empty">lade …</div></div>', '<a href="https://mastodon.social/@dbfcz" target="_blank" rel="noopener">Mastodon ↗</a>') + foot();
  tickCountdown(); timer = setInterval(tickCountdown, 1000);
  mastodon();
}

// ---------------------------------------------------------------- Saison (FotMob)
function renderSaison(q) {
  const tab = q.get('t') || 'tabelle';
  const fm = S.fm;
  const chips = [['tabelle', 'Tabelle'], ['spiele', 'Spielplan'], ['kader', 'Kader'], ['statistik', 'dbFCZ-Saison']]
    .map(([k, l]) => `<a class="chip ${tab === k ? 'on' : ''}" href="#/saison?t=${k}">${l}</a>`).join('');
  let body = '';
  if (!fm) body = '<div class="empty">Keine Saisondaten</div>';
  else if (tab === 'tabelle') {
    body = card(esc(fm.league || 'Tabelle'), tableHTML(fm.table) + `<div class="legend wrap" style="margin-top:10px">${(fm.legend || []).map((l) => `<span><span class="qual" style="background:${l.color}"></span> ${esc(l.title)}</span>`).join('')}</div>`);
  } else if (tab === 'spiele') {
    const up = fm.fixtures.filter((f) => !f.finished), done = fm.fixtures.filter((f) => f.finished).reverse();
    const li = (f) => `<li><a class="item" target="_blank" rel="noopener" href="${esc(f.url)}">${f.finished ? `<span class="badge ${fmRes(f)}">${{ W: 'S', D: 'U', L: 'N' }[fmRes(f)]}</span>` : `<span class="pill">${new Date(f.utc).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}</span>`}
      <span class="grow"><div class="t">${esc(f.home)} – ${esc(f.away)}</div><div class="s">${new Date(f.utc).toLocaleString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${esc(f.tournament || '')}</div></span>
      <span class="score">${f.finished ? esc(f.score) : '↗'}</span></a></li>`;
    body = card('Kommende Spiele', `<ul class="list">${up.map(li).join('') || '<div class="empty">Keine</div>'}</ul><a class="btn primary morebtn" style="justify-content:center" href="${fm.ics.replace(/^https:/, 'webcal:')}">📅 Spielplan im Kalender abonnieren</a>`)
      + card('Gespielt', `<ul class="list">${done.map(li).join('')}</ul>`);
  } else if (tab === 'kader') {
    const groups = {};
    fm.squad.forEach((p) => (groups[p.group] ||= []).push(p));
    const gl = { coach: 'Trainer', keepers: 'Torhüter', defenders: 'Verteidigung', midfielders: 'Mittelfeld', attackers: 'Angriff' };
    body = Object.entries(groups).map(([g, ps]) => card(gl[g] || g, `<ul class="list">${ps.map((p) => {
      const db = findPlayerByName(p.name);
      const href = db ? '#/spieler/' + db[0] : `https://www.fotmob.com/players/${p.id}`;
      return `<li><a class="item" href="${href}" ${db ? '' : 'target="_blank" rel="noopener"'}><span class="avatar" style="background:var(--brand)">${p.no ?? '–'}</span>
      <span class="grow"><div class="t">${esc(p.name)}${p.injury ? ' 🩹' : ''}</div><div class="s">${[p.pos, p.age ? p.age + ' J.' : '', p.country].filter(Boolean).map(esc).join(' · ')}${db ? ` · ${db[2]} FCZ-Pflichtspiele` : ''}</div></span>
      ${g !== 'coach' ? `<span class="s num" style="text-align:right">${p.goals ?? 0}⚽ ${p.assists ?? 0}🅰<br>${p.rating ? '★ ' + p.rating.toFixed(1) : ''}</span>` : ''}</a></li>`;
    }).join('')}</ul>`)).join('');
  } else {
    const cur = S.db.seasons[S.db.seasons.length - 1];
    location.hash = '#/saisonarchiv/' + cur.id; return;
  }
  view.innerHTML = `<h1 class="page-title">Saison</h1><div class="chips">${chips}</div>${body}${foot()}`;
}

// ---------------------------------------------------------------- Archiv
function renderArchiv(q) {
  const comp = q.get('c') || '', dec = q.get('d') || '', opp = +q.get('o') || 0, tag = q.get('tag') || '', page = +q.get('p') || 1, mode = q.get('m') || 'spiele';
  const modeChips = [['spiele', 'Spiele'], ['saisons', 'Saisons'], ['rekorde', 'Rekorde'], ['gegner', 'Gegner']]
    .map(([k, l]) => `<a class="chip ${mode === k ? 'on' : ''}" href="#/archiv?m=${k}">${l}</a>`).join('');
  let body = '';
  if (mode === 'saisons') body = seasonsList();
  else if (mode === 'rekorde') body = records();
  else if (mode === 'gegner') body = opponentsList();
  else {
    let ms = S.db.matches;
    if (comp) ms = ms.filter((m) => m[7] === comp);
    if (dec) ms = ms.filter((m) => m[1] && m[1].slice(0, 3) === dec.slice(0, 3));
    if (opp) ms = ms.filter((m) => res(m).opp === opp);
    if (tag) ms = ms.filter((m) => m[1]?.slice(5) === tag);
    ms = ms.slice().reverse();
    const set = (k, v) => { const p = new URLSearchParams(q); v ? p.set(k, v) : p.delete(k); p.delete('p'); return '#/archiv?' + p; };
    const decs = [...new Set(S.db.matches.map((m) => m[1]?.slice(0, 3)).filter(Boolean))].sort().reverse();
    const sum = summarize(ms);
    body = `<div class="chips">${[['', 'Alle'], ['L', 'Liga'], ['C', 'Cup'], ['I', 'Europa'], ['F', 'Test']].map(([k, l]) => `<a class="chip ${comp === k ? 'on' : ''}" href="${set('c', k)}">${l}</a>`).join('')}</div>
      <div class="row wrap" style="margin-bottom:12px">
        <select onchange="location.hash=this.value"><option value="${set('d', '')}">Alle Jahrzehnte</option>${decs.map((d) => `<option value="${set('d', d + '0')}" ${dec.slice(0, 3) === d ? 'selected' : ''}>${d}0er</option>`).join('')}</select>
        <select onchange="location.hash=this.value" style="flex:1"><option value="${set('o', '')}">Alle Gegner</option>${IX.oppSorted.slice(0, 120).map(([id, n]) => `<option value="${set('o', id)}" ${opp === id ? 'selected' : ''}>${esc(teamName(id))} (${n})</option>`).join('')}</select>
        ${tag ? `<a class="chip on" href="${set('tag', '')}">${tag.slice(3)}.${tag.slice(0, 2)}. ✕</a>` : ''}
      </div>
      ${card(`${fmtN(ms.length)} Spiele`, wdlBar(sum) + (opp ? `<a class="ghost" href="#/gegner/${opp}">Detail-Bilanz gegen ${esc(teamName(opp))} ›</a>` : ''))}
      <section class="card"><ul class="list">${ms.slice(0, page * 40).map((m) => matchItem(m)).join('')}</ul>
      ${ms.length > page * 40 ? `<a class="btn morebtn" style="justify-content:center" href="${(() => { const p = new URLSearchParams(q); p.set('p', page + 1); return '#/archiv?' + p; })()}">mehr laden</a>` : ''}</section>`;
  }
  view.innerHTML = `<h1 class="page-title">Archiv</h1><p class="sub">${fmtN(S.db.matches.length)} Spiele seit ${fmtD(S.db.matches[0][1])} · Quelle dbFCZ</p><div class="chips" style="margin-top:10px">${modeChips}</div>${body}${foot()}`;
}
function seasonsList() {
  const ss = S.db.seasons.slice().reverse();
  return `<section class="card"><ul class="list">${ss.map((s) => `<li><a class="item" href="#/saisonarchiv/${s.id}">
    <span class="badge ${s.rank === 1 ? 'W' : s.rank && s.rank <= 3 ? 'D' : 'N'}">${s.rank ?? '–'}</span>
    <span class="grow"><div class="t">${esc(s.label)}${s.note ? ` <span class="pill">${esc(s.note)}</span>` : ''}</div><div class="s">${esc(s.league || '')} · ${s.n} Spiele</div></span><span class="chev">›</span></a></li>`).join('')}</ul></section>`;
}
function opponentsList() {
  return `<section class="card"><ul class="list">${IX.oppSorted.slice(0, 150).map(([id, n]) => { const o = summarize(IX.byOpp[id]);
    return `<li><a class="item" href="#/gegner/${id}">${avatar(teamName(id))}<span class="grow"><div class="t">${esc(teamName(id))}</div><div class="s num">${n} Spiele · ${o.W}S ${o.D}U ${o.L}N · ${o.gf}:${o.ga}</div></span><span class="chev">›</span></a></li>`; }).join('')}</ul></section>`;
}
function records() {
  const comp = S.db.matches.filter((m) => m[5] != null && m[7] !== 'F');
  const diff = (m) => { const r = res(m); return r.gf - r.ga; };
  const wins = comp.slice().sort((a, b) => diff(b) - diff(a) || (res(b).gf - res(a).gf)).slice(0, 8);
  const losses = comp.slice().sort((a, b) => diff(a) - diff(b)).slice(0, 8);
  const goals = comp.slice().sort((a, b) => (b[5] + b[6]) - (a[5] + a[6])).slice(0, 8);
  // streaks in competitive matches
  let best = { len: 0 }, cur = { len: 0 }, bestW = { len: 0 }, curW = { len: 0 };
  for (const m of comp) {
    const r = res(m).r;
    if (r !== 'L') { cur.len++ || (cur.start = m); cur.end = m; if (cur.len > best.len) best = { ...cur }; } else cur = { len: 0 };
    if (r === 'W') { curW.len++ || (curW.start = m); curW.end = m; if (curW.len > bestW.len) bestW = { ...curW }; } else curW = { len: 0 };
  }
  const gc = IX.byOpp[Object.keys(IX.team).find((k) => IX.team[k] === 'Grasshoppers')] || [];
  const derby = summarize(gc.filter((m) => m[7] !== 'F'));
  const rnd = comp[Math.floor(Math.random() * comp.length)];
  return card('Zeitmaschine 🎲', `<ul class="list">${matchItem(rnd)}</ul><a class="btn morebtn" style="justify-content:center" href="#/archiv?m=rekorde&r=${Math.random().toString(36).slice(2, 6)}">nochmal würfeln</a>`)
    + card('Stadtderby vs GC (Pflichtspiele)', wdlBar(derby), gc.length ? '<a href="#/gegner/' + gc[0][3 + (gc[0][3] === FCZ ? 1 : 0)] + '">Detail</a>' : '')
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
  const all = summarize(ms), compet = summarize(ms.filter((m) => m[7] !== 'F'));
  const home = summarize(ms.filter((m) => m[3] === FCZ && m[7] !== 'F')), away = summarize(ms.filter((m) => m[4] === FCZ && m[7] !== 'F'));
  const comp = ms.filter((m) => m[5] != null);
  const d = (m) => res(m).gf - res(m).ga;
  const bw = comp.slice().sort((a, b) => d(b) - d(a))[0], bl = comp.slice().sort((a, b) => d(a) - d(b))[0];
  const byDec = {};
  ms.forEach((m) => { const k = m[1]?.slice(0, 3) + '0'; (byDec[k] ||= []).push(m); });
  const decRows = Object.entries(byDec).sort().map(([k, v]) => { const o = summarize(v); return `<tr><td></td><td>${k}er</td><td>${o.n}</td><td>${o.W}</td><td>${o.D}</td><td>${o.L}</td><td>${o.gf}:${o.ga}</td></tr>`; }).join('');
  const name = teamName(id);
  view.innerHTML = `<h1 class="page-title">FCZ vs ${esc(name)}</h1><p class="sub">${ms.length} Spiele · erstes ${fmtD(ms[0][1])} · letztes ${fmtD(ms[ms.length - 1][1])}</p>
    ${card('Pflichtspiele', wdlBar(compet))}
    <div class="grid2">${card('Heim', wdlBar(home))}${card('Auswärts', wdlBar(away))}</div>
    ${card('Extreme', `<ul class="list">${bw ? matchItem(bw) : ''}${bl && bl !== bw ? matchItem(bl) : ''}</ul>`)}
    ${card('Nach Jahrzehnt (alle Spiele)', `<div class="scroll-x"><table class="t"><thead><tr><th></th><th>Jahrzehnt</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Tore</th></tr></thead><tbody>${decRows}</tbody></table></div>`)}
    ${card('Letzte Duelle', `<ul class="list">${ms.slice(-10).reverse().map((m) => matchItem(m)).join('')}</ul><a class="ghost morebtn" href="#/archiv?o=${id}">alle ${ms.length} Spiele</a>`, `<a href="${dbfczUrl('team', id)}" target="_blank" rel="noopener">dbFCZ ↗</a>`)}
    ${card('Alle Spiele zusammen', wdlBar(all))}${foot()}`;
}

// ---------------------------------------------------------------- Saison-Archiv (dbFCZ)
async function renderSaisonArchiv(sid) {
  const s = IX.season[sid]; if (!s) { view.innerHTML = '<div class="empty">Saison unbekannt</div>'; return; }
  const ms = S.db.matches.filter((m) => m[2] === sid);
  const prev = S.db.seasons[s.i - 1], next = S.db.seasons[s.i + 1];
  const st = s.standings || [];
  const stand = st.length ? `<div class="scroll-x"><table class="t"><thead><tr><th>#</th><th>Team</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Tore</th><th>Pkt</th></tr></thead><tbody>
    ${st.map((r) => `<tr class="${r[1] === FCZ ? 'me' : ''}"><td>${r[0] ?? ''}</td><td>${r[1] === FCZ ? 'FCZ' : `<a href="#/gegner/${r[1]}">${esc(teamName(r[1]))}</a>`}${r[8] ? ` <span class="pill">${esc(r[8])}</span>` : ''}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td><td>${esc(r[6])}</td><td><b>${r[7]}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Keine Tabelle erfasst</div>';
  view.innerHTML = `<div class="row between"><a class="ghost" href="${prev ? '#/saisonarchiv/' + prev.id : '#/archiv?m=saisons'}">‹ ${esc(prev?.label || '')}</a><a class="ghost" href="${next ? '#/saisonarchiv/' + next.id : '#/archiv?m=saisons'}">${esc(next?.label || '')} ›</a></div>
    <h1 class="page-title">Saison ${esc(s.label)}</h1><p class="sub">${esc(s.league || '')}${s.rank ? ` · Rang ${s.rank}` : ''}${s.note ? ` · ${esc(s.note)}` : ''}</p><br>
    ${card('Bilanz', wdlBar(summarize(ms.filter((m) => m[7] !== 'F'))) + '<div class="s muted">ohne Testspiele</div>')}
    ${card('Tabelle', stand)}
    <div id="sq">${card('Kader', '<div class="empty">lade …</div>')}</div>
    ${card(`Spiele (${ms.length})`, `<ul class="list">${ms.map((m) => matchItem(m, { showSeason: false })).join('')}</ul>`, `<a href="${dbfczUrl('saison', sid)}" target="_blank" rel="noopener">dbFCZ ↗</a>`)}${foot()}`;
  const ps = await playerSeasons();
  const rows = [];
  for (const [pid, arr] of Object.entries(ps)) for (const r of arr) if (r[0] === sid) rows.push([+pid, r]);
  rows.sort((a, b) => b[1][1] - a[1][1] || b[1][6] - a[1][6]);
  const el = $('#sq'); if (!el) return;
  el.innerHTML = card(`Eingesetzte Spieler (${rows.length})`, `<div class="scroll-x"><table class="t"><thead><tr><th></th><th>Spieler</th><th>Pfl.</th><th>Liga</th><th>Test</th><th>Tore</th></tr></thead><tbody>
    ${rows.map(([pid, r], i) => `<tr><td>${i + 1}</td><td><a href="#/spieler/${pid}">${esc(IX.player[pid]?.[1] || pid)}</a></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[5]}</td><td><b>${r[6]}</b></td></tr>`).join('')}</tbody></table></div>`);
}

// ---------------------------------------------------------------- Spieler
function renderSpieler(q) {
  const sort = q.get('s') || 'apps', page = +q.get('p') || 1, f = q.get('f') || '';
  const col = { apps: 2, goals: 4, liga: 3, seasons: 9 }[sort];
  let ps = S.db.players.slice();
  if (f) { const n = norm(f); ps = ps.filter((p) => norm(p[1]).includes(n)); }
  ps.sort((a, b) => b[col] - a[col] || b[2] - a[2]);
  const chips = [['apps', 'Pflichtspiele'], ['goals', 'Tore'], ['liga', 'Ligaspiele'], ['seasons', 'Saisons']].map(([k, l]) => `<a class="chip ${sort === k ? 'on' : ''}" href="#/spieler?s=${k}${f ? '&f=' + encodeURIComponent(f) : ''}">${l}</a>`).join('');
  view.innerHTML = `<h1 class="page-title">Spieler</h1><p class="sub">${fmtN(S.db.players.length)} Spieler, die je für den FCZ aufliefen · Quelle dbFCZ</p>
  <div class="row" style="margin:10px 0"><input type="search" id="pf" placeholder="Name filtern …" value="${esc(f)}" style="flex:1"></div>
  <div class="chips">${chips}</div>
  <section class="card"><ul class="list">${ps.slice(0, page * 50).map((p, i) => `<li><a class="item" href="#/spieler/${p[0]}"><span class="pill num" style="min-width:34px;text-align:center">${i + 1}</span>
   <span class="grow"><div class="t">${esc(p[1])}</div><div class="s num">${seasonLabel(p[7]).slice(0, 4)}–${seasonLabel(p[8]).slice(-4)} · ${p[9]} Saisons</div></span>
   <span class="s num" style="text-align:right"><b style="color:var(--ink);font-size:15px">${p[col]}</b><br>${{ apps: 'Spiele', goals: 'Tore', liga: 'Liga', seasons: 'Saisons' }[sort]}</span></a></li>`).join('')}</ul>
   ${ps.length > page * 50 ? `<a class="btn morebtn" style="justify-content:center" href="#/spieler?s=${sort}&p=${page + 1}${f ? '&f=' + encodeURIComponent(f) : ''}">mehr laden</a>` : ''}</section>${foot()}`;
  const inp = $('#pf'); let tmo;
  inp.addEventListener('input', () => { clearTimeout(tmo); tmo = setTimeout(() => { history.replaceState(null, '', `#/spieler?s=${sort}&f=${encodeURIComponent(inp.value)}`); renderSpieler(new URLSearchParams(`s=${sort}&f=${inp.value}`)); const n = $('#pf'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
}
async function renderPlayer(id) {
  const p = IX.player[id];
  if (!p) { view.innerHTML = `<div class="empty">Spieler nicht im Archiv. <a href="${dbfczUrl('spieler', id)}" target="_blank">bei dbFCZ ansehen ↗</a></div>`; return; }
  const sq = (S.fm?.squad || []).find((x) => norm(x.name) === norm(p[1]));
  const rank = S.db.players.filter((x) => x[2] > p[2]).length + 1;
  const grank = S.db.players.filter((x) => x[4] > p[4]).length + 1;
  const thread = Object.entries(S.arch?.topics || {}).find(([, t]) => norm(t.title) === norm(p[1]));
  view.innerHTML = `<div class="row">${avatar(p[1])}<div><h1 class="page-title">${esc(p[1])}</h1><p class="sub">${esc(seasonLabel(p[7]))} – ${esc(seasonLabel(p[8]))}${sq ? ` · aktuell #${sq.no ?? '–'} · ${esc(sq.pos || '')}` : ''}</p></div></div><br>
    <div class="grid3">
      <div class="stat"><b>${p[2]}</b><span>Pflichtspiele<br>#${rank} all-time</span></div>
      <div class="stat"><b>${p[4]}</b><span>Pflichtspieltore<br>#${grank} all-time</span></div>
      <div class="stat"><b>${p[9]}</b><span>Saisons</span></div>
      <div class="stat"><b>${p[3]}</b><span>Ligaspiele</span></div>
      <div class="stat"><b>${p[5]}</b><span>Ligatore</span></div>
      <div class="stat"><b>${p[2] ? (p[4] / p[2]).toFixed(2) : '–'}</b><span>Tore/Spiel</span></div>
    </div><br>
    <div id="pseas">${card('Karriere beim FCZ', '<div class="empty">lade …</div>')}</div>
    ${sq ? card('Aktuelle Saison (FotMob)', `<div class="grid3"><div class="stat"><b>${sq.goals ?? 0}</b><span>Tore</span></div><div class="stat"><b>${sq.assists ?? 0}</b><span>Assists</span></div><div class="stat"><b>${sq.rating ? sq.rating.toFixed(2) : '–'}</b><span>Rating</span></div></div>`) : ''}
    <div id="wiki">${card('Wikipedia', '<div class="empty">lade …</div>')}</div>
    ${card('Mehr', `<div class="ext">
      <a href="${dbfczUrl('spieler', id)}" target="_blank" rel="noopener">📊 dbFCZ-Profil</a>
      <a href="${thread ? forumTopic(thread[0]) : googleForum(p[1])}" target="_blank" rel="noopener">💬 ${thread ? 'Spielerthread' : 'Im Forum suchen'}</a>
      ${sq ? `<a href="https://www.fotmob.com/players/${sq.id}" target="_blank" rel="noopener">📈 FotMob</a>` : ''}
      <button type="button" data-share>🔗 Teilen</button></div>`)}${foot()}`;
  wikiCard(p[1]);
  const ps = (await playerSeasons())[id] || [];
  const max = Math.max(1, ...ps.map((r) => r[1] + r[5]));
  const el = $('#pseas'); if (!el) return;
  el.innerHTML = card('Karriere beim FCZ', `<div class="bars" aria-label="Einsätze pro Saison">${ps.map((r) => `<i style="height:${100 * (r[1]) / max}%" title="${esc(seasonLabel(r[0]))}: ${r[1]} Pflichtspiele, ${r[6]} Tore"></i>`).join('')}</div>
    <div class="row between small muted"><span>${esc(seasonLabel(ps[0]?.[0]))}</span><span>Pflichtspiele pro Saison</span><span>${esc(seasonLabel(ps[ps.length - 1]?.[0]))}</span></div>
    <div class="scroll-x" style="margin-top:10px"><table class="t"><thead><tr><th></th><th>Saison</th><th>Pfl.</th><th>Liga</th><th>Cup</th><th>Eur.</th><th>Test</th><th>Tore</th></tr></thead><tbody>
    ${ps.slice().reverse().map((r) => `<tr><td></td><td><a href="#/saisonarchiv/${r[0]}">${esc(seasonLabel(r[0]))}</a></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td><td><b>${r[6]}</b></td></tr>`).join('')}</tbody></table></div>`);
}
async function wikiCard(name) {
  const el = $('#wiki'); if (!el) return;
  const link = `https://de.wikipedia.org/w/index.php?search=${encodeURIComponent(name + ' Fussballspieler')}`;
  try {
    const r = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, '_'))}`);
    if (!r.ok) throw 0;
    const w = await r.json();
    const txt = (w.description || '') + ' ' + (w.extract || '');
    if (w.type === 'disambiguation' || !/fu(ss|ß)ball/i.test(txt)) throw 0;
    el.innerHTML = card('Wikipedia', `<div class="wiki">${w.thumbnail ? `<img src="${esc(w.thumbnail.source)}" alt="">` : ''}<div><div class="s muted">${esc(w.description || '')}</div><p style="margin:4px 0">${esc(w.extract).slice(0, 420)}${w.extract.length > 420 ? ' …' : ''}</p>
      <a href="${esc(w.content_urls?.mobile?.page || link)}" target="_blank" rel="noopener">weiterlesen ↗</a></div></div>`);
  } catch { el.innerHTML = card('Wikipedia', `<div class="hint">Kein eindeutiger Artikel gefunden. <a href="${link}" target="_blank" rel="noopener">Auf Wikipedia suchen ↗</a></div>`); }
}

// ---------------------------------------------------------------- Forum
function renderForum(q) {
  const f = S.forum, a = S.arch; if (!f) { view.innerHTML = '<div class="empty">Keine Forumsdaten</div>'; return; }
  const filt = q.get('f') || '';
  let topics = Object.entries(a?.topics || {}).sort((x, y) => (y[1].last || '').localeCompare(x[1].last || ''));
  if (filt) { const n = norm(filt); topics = topics.filter(([, t]) => norm(t.title).includes(n)); }
  const mood = (a?.mood || []).slice(-60);
  const liked = Object.values(a?.liked || {}).sort((x, y) => y.likes - x.likes).slice(0, 10);
  view.innerHTML = `<h1 class="page-title">Forum</h1><p class="sub">Live-Übersicht von fczforum.ch · Beiträge lesen braucht ein Forum-Login</p><br>
  <div class="grid3"><div class="stat"><b>${fmtN(f.stats?.posts)}</b><span>Beiträge</span></div><div class="stat"><b>${fmtN(f.stats?.topics)}</b><span>Themen</span></div><div class="stat"><b>${fmtN(f.stats?.members)}</b><span>Mitglieder</span></div></div><br>
  ${f.matchMood ? card('Matchstimmung', `<div class="row"><span class="mood">${esc(f.matchMood.emoji)}</span><div class="grow"><b>${esc(f.matchMood.label)}</b> · ${f.matchMood.score}/100<div class="s muted">aus den letzten ${f.matchMood.matches} Spielthreads</div></div></div>
    ${mood.length > 1 ? `<div class="bars" style="height:40px">${mood.map((m) => `<i class="g" style="height:${m[1]}%" title="${new Date(m[0]).toLocaleString('de-CH')}: ${m[1]}"></i>`).join('')}</div><div class="s muted small">Verlauf seit ${new Date(mood[0][0]).toLocaleDateString('de-CH')}</div>` : ''}`) : ''}
  ${card('Trending', `<ul class="list">${(f.trending || []).map((t) => `<li><a class="item" target="_blank" rel="noopener" href="${forumTopic(t.slug)}"><span class="pill">🔥 ${t.recentPostsCount}</span><span class="grow"><div class="t">${esc(t.title)}</div><div class="s">${esc(t.forumName)} · von ${esc(t.starterName)}</div></span><span class="chev">↗</span></a></li>`).join('') || '<div class="empty">ruhig gerade</div>'}</ul>`)}
  ${card('Bereiche', `<ul class="list">${f.forums.map((x) => `<li><a class="item" target="_blank" rel="noopener" href="${x.latest ? esc(x.latest.url) : 'https://fczforum.ch/forum'}">${avatar(x.name)}<span class="grow"><div class="t">${esc(x.name)}${x.membersOnly ? ' 🔒' : ''}</div>
    <div class="s">${fmtN(x.topics)} Themen · ${fmtN(x.posts)} Beiträge</div>${x.latest ? `<div class="s">↳ ${esc(x.latest.topicTitle)} · ${esc(x.latest.authorName)} · ${rel(x.latest.createdAt)}</div>` : ''}</span></a></li>`).join('')}</ul>`)}
  ${card('Meistgeliked', liked.map((l) => `<a class="quote" style="display:block;color:inherit" target="_blank" rel="noopener" href="${esc(l.url)}">${esc(l.excerpt)}<div class="s muted">— ${esc(l.authorName)} · ❤ ${l.likes} · ${esc(l.topicTitle)}</div></a>`).join(''))}
  ${card(`Themen-Radar (${topics.length})`, `<div class="hint" style="margin-bottom:8px">Alle Themen, die auf der Forum-Startseite seit Start dieser App aufgetaucht sind.</div>
    <input type="search" id="tf" placeholder="Themen filtern …" value="${esc(filt)}" style="width:100%;margin-bottom:6px">
    <ul class="list">${topics.slice(0, 60).map(([slug, t]) => `<li><a class="item" target="_blank" rel="noopener" href="${forumTopic(slug)}"><span class="grow"><div class="t">${esc(t.title)}</div><div class="s">${esc(t.forum || '')} · zuletzt ${rel(t.lastPost || t.last)}</div></span><span class="chev">↗</span></a></li>`).join('')}</ul>`)}
  ${(f.announcements || []).length ? card('Ankündigungen', `<ul class="list">${f.announcements.map((x) => `<li><a class="item" target="_blank" rel="noopener" href="${forumTopic(x.slug)}"><span class="grow"><div class="t">📌 ${esc(x.title)}</div><div class="s">${esc(x.starterName)} · ${rel(x.createdAt)}</div></span></a></li>`).join('')}</ul>`) : ''}
  ${foot()}`;
  const inp = $('#tf'); let tmo;
  inp.addEventListener('input', () => { clearTimeout(tmo); tmo = setTimeout(() => { history.replaceState(null, '', '#/forum?f=' + encodeURIComponent(inp.value)); renderForum(new URLSearchParams('f=' + inp.value)); const n = $('#tf'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
}

// ---------------------------------------------------------------- Match sheet
function openMatch(id) {
  const m = IX.matchById.get(id);
  if (!m) return;
  const r = res(m); const opp = IX.byOpp[r.opp] || [];
  const before = opp.filter((x) => x[1] < m[1]); const s = summarize(before);
  sheet(`<div class="s muted">${fmtD(m[1])} · ${esc(seasonLabel(m[2]))} · ${esc(m[8] || COMP[m[7]])}</div>
    <h2 style="font-size:22px;margin:6px 0">${esc(teamName(m[3]))} <span class="score">${m[5] ?? '–'}:${m[6] ?? '–'}</span> ${esc(teamName(m[4]))}</h2>
    ${m[9] ? `<span class="pill">${esc(m[9])}</span>` : ''}
    <p class="sub">Vor diesem Spiel stand es gegen ${esc(teamName(r.opp))} ${s.W}S ${s.D}U ${s.L}N (${s.n} Spiele).</p>
    <div class="ext"><a href="${dbfczUrl('spiel', id)}" target="_blank" rel="noopener">📋 Aufstellung & Tore (dbFCZ)</a>
    <a href="#/gegner/${r.opp}">⚔️ Bilanz vs ${esc(teamName(r.opp))}</a>
    <a href="#/saisonarchiv/${m[2]}">📅 Saison ${esc(seasonLabel(m[2]))}</a>
    <a href="${googleForum(teamName(r.opp) + ' ' + fmtD(m[1]).slice(-4))}" target="_blank" rel="noopener">💬 Im Forum suchen</a></div>`);
}
function sheet(html) {
  const sh = $('#sheet'); $('#sheetBody').innerHTML = html; sh.hidden = false;
}
function closeSheet() { $('#sheet').hidden = true; }
$('#sheet').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) { closeSheet(); if (location.hash.startsWith('#/spiel/')) history.back(); }
  else if (e.target.closest('a[href^="#/"]')) closeSheet();
});

// ---------------------------------------------------------------- Search
let searchIndex = null;
function buildSearch() {
  const E = [];
  for (const p of S.db.players) E.push({ g: 'Spieler', t: p[1], s: `${p[2]} Pflichtspiele · ${p[4]} Tore · ${seasonLabel(p[7]).slice(0, 4)}–${seasonLabel(p[8]).slice(-4)}`, h: '#/spieler/' + p[0], k: norm(p[1]), w: Math.log(2 + p[2]) });
  for (const [id, n] of IX.oppSorted) E.push({ g: 'Gegner', t: teamName(id), s: `${n} Spiele gegen den FCZ`, h: '#/gegner/' + id, k: norm(teamName(id)), w: Math.log(2 + n) + 1 });
  for (const s of S.db.seasons) E.push({ g: 'Saisons', t: 'Saison ' + s.label, s: [s.league, s.rank ? 'Rang ' + s.rank : '', s.note].filter(Boolean).join(' · '), h: '#/saisonarchiv/' + s.id, k: norm(s.label + ' ' + s.label.replace(/(\d{2})(\d{2})\/(\d{2})(\d{2})/, '$2/$4') + ' ' + (s.note || '')), w: 2 });
  for (const [slug, t] of Object.entries(S.arch?.topics || {})) E.push({ g: 'Forum-Themen', t: t.title, s: `${t.forum || ''} · ${rel(t.lastPost || t.last)}`, h: forumTopic(slug), ext: true, k: norm(t.title), w: 1.5 });
  for (const p of S.fm?.squad || []) if (p.group !== 'coach') E.push({ g: 'Aktueller Kader', t: `${p.name}`, s: `#${p.no ?? '–'} · ${p.pos || ''} · ${p.age ?? ''} J.`, h: (findPlayerByName(p.name) ? '#/spieler/' + findPlayerByName(p.name)[0] : `https://www.fotmob.com/players/${p.id}`), k: norm(p.name), w: 4 });
  const pages = [['Tabelle', '#/saison?t=tabelle', 'tabelle rangliste'], ['Spielplan', '#/saison?t=spiele', 'spielplan fixtures kalender termine'], ['Kader', '#/saison?t=kader', 'kader team squad'], ['Rekorde & Serien', '#/archiv?m=rekorde', 'rekorde serien hoechste siege derby zeitmaschine'], ['Stadtderby vs GC', '#/archiv?m=rekorde', 'derby gc grasshoppers stadtderby'], ['Forum-Puls', '#/forum', 'forum stimmung trending']];
  for (const [t, h, k] of pages) E.push({ g: 'Seiten', t, s: 'Bereich der App', h, k, w: 3 });
  searchIndex = E;
}
function hl(text, q) {
  const words = norm(q).split(' ').filter(Boolean);
  let out = esc(text);
  if (!words.length) return out;
  const nt = norm(text);
  // highlight only when normalised text keeps index positions (no diacritic folding length change)
  if (nt.length !== text.length) return out;
  const marks = [];
  for (const w of words) { let i = nt.indexOf(w); if (i >= 0) marks.push([i, i + w.length]); }
  if (!marks.length) return out;
  marks.sort((a, b) => a[0] - b[0]);
  let res2 = '', pos = 0;
  for (const [a, b] of marks) { if (a < pos) continue; res2 += esc(text.slice(pos, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>'; pos = b; }
  return res2 + esc(text.slice(pos));
}
function search(qs) {
  if (!searchIndex) buildSearch();
  const q = qs.trim(); const out = [];
  // smart: date
  let m = q.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?$/);
  if (m) {
    const md = `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const y = m[3] ? (m[3].length === 2 ? (+m[3] > 30 ? '19' : '20') + m[3] : m[3]) : null;
    const ms = S.db.matches.filter((x) => x[1]?.slice(5) === md && (!y || x[1].startsWith(y)));
    out.push({ g: y ? 'Spiel am ' + q : 'Spiele an diesem Tag', items: ms.slice(-12).reverse().map((x) => ({ match: x })) });
  }
  m = q.match(/^(\d{1,2})\s*[:\-]\s*(\d{1,2})$/);
  if (m) {
    const ms = S.db.matches.filter((x) => { const r = res(x); return r.gf === +m[1] && r.ga === +m[2]; });
    out.push({ g: `FCZ-Resultat ${m[1]}:${m[2]} (${ms.length}×)`, items: ms.slice(-15).reverse().map((x) => ({ match: x })) });
  }
  m = q.match(/^(18|19|20)\d\d$/);
  if (m) {
    const ms = S.db.matches.filter((x) => x[1]?.startsWith(q));
    const o = summarize(ms.filter((x) => x[7] !== 'F'));
    out.push({ g: `Jahr ${q}`, items: [{ t: `${ms.length} Spiele im Jahr ${q}`, s: `${o.W}S ${o.D}U ${o.L}N · ${o.gf}:${o.ga} (Pflichtspiele)`, h: '#/archiv?d=' + q.slice(0, 3) + '0' }] });
  }
  const words = norm(q.replace(/^(gegen|vs\.?|v)\s+/i, '')).split(' ').filter(Boolean);
  if (words.length) {
    const hits = [];
    for (const e of searchIndex) {
      let sc = 0, ok = true;
      for (const w of words) {
        const i = e.k.indexOf(w);
        if (i < 0) { ok = false; break; }
        sc += i === 0 ? 3 : e.k[i - 1] === ' ' ? 2 : w.length >= 3 ? 0.5 : (ok = false, 0);
        if (!ok) break;
      }
      if (!ok) continue;
      if (e.k === words.join(' ')) sc += 4;
      hits.push([sc + e.w, e]);
    }
    hits.sort((a, b) => b[0] - a[0]);
    const groups = {};
    for (const [, e] of hits) (groups[e.g] ||= []).push(e);
    const order = ['Aktueller Kader', 'Seiten', 'Gegner', 'Spieler', 'Saisons', 'Forum-Themen'];
    for (const g of order) if (groups[g]) out.push({ g, items: groups[g].slice(0, g === 'Spieler' ? 10 : 6), more: groups[g].length });
  }
  return out;
}
function renderResults(qs) {
  const el = $('#results');
  const q = qs.trim();
  if (!q) {
    const recent = store.get('recent', []);
    el.innerHTML = `${recent.length ? `<div class="group-h">Zuletzt gesucht</div><div class="chips" style="margin:0">${recent.map((r) => `<button class="chip" data-q="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}
      <div class="group-h">Probier mal</div><div class="chips" style="margin:0">${['Kuhn', 'Basel', 'Grasshoppers', '6:2', '1976', '14.11.1967', 'Džemaili', 'Meister', 'Servette'].map((x) => `<button class="chip" data-q="${x}">${x}</button>`).join('')}</div>
      <p class="hint" style="margin-top:16px">Sucht gleichzeitig in <b>${fmtN(S.db.players.length)} Spielern</b>, <b>${fmtN(S.db.matches.length)} Spielen</b>, ${S.db.seasons.length} Saisons, allen Gegnern, dem aktuellen Kader und den Forum-Themen.<br>
      Tricks: Datum <code>14.11.</code> = alle Spiele an dem Tag · Resultat <code>5:0</code> · Jahr <code>1981</code> · <code>gegen Sion</code></p>`;
    return;
  }
  const groups = search(q);
  const item = (e) => e.match ? matchItem(e.match) : `<li><a class="item" href="${esc(e.h)}" ${e.ext ? 'target="_blank" rel="noopener"' : ''} data-pick><span class="grow"><div class="t">${hl(e.t, q)}</div><div class="s">${esc(e.s || '')}</div></span><span class="chev">${e.ext ? '↗' : '›'}</span></a></li>`;
  el.innerHTML = (groups.map((g) => `<div class="group-h">${esc(g.g)}${g.more > g.items.length ? ` · ${g.more}` : ''}</div><section class="card" style="padding:4px 12px"><ul class="list">${g.items.map(item).join('') || '<div class="empty">nichts</div>'}</ul></section>`).join('')
    || '<div class="empty">Nichts lokal gefunden – probier die Quellen unten.</div>')
    + `<div class="group-h">Direkt in den Quellen suchen</div><div class="ext">
      <button type="button" data-db="suche_spieler">📊 dbFCZ: Spieler</button><button type="button" data-db="suche_volltext">📊 dbFCZ: Volltext</button>
      <a href="${googleForum(q)}" target="_blank" rel="noopener">💬 Forum (via Google)</a>
      <a href="https://de.wikipedia.org/w/index.php?search=${encodeURIComponent(q + ' FC Zürich')}" target="_blank" rel="noopener">📚 Wikipedia</a></div>`;
}
const layer = $('#searchLayer'), qi = $('#q');
function openSearch(prefill) {
  layer.hidden = false; if (prefill != null) qi.value = prefill; renderResults(qi.value); setTimeout(() => qi.focus(), 30);
}
function closeSearch() { layer.hidden = true; }
function remember(q) { q = q.trim(); if (q.length < 2) return; const r = store.get('recent', []).filter((x) => x !== q); r.unshift(q); store.set('recent', r.slice(0, 8)); }
$('#searchOpen').addEventListener('click', () => openSearch());
$('#searchClose').addEventListener('click', closeSearch);
let st; qi.addEventListener('input', () => { clearTimeout(st); st = setTimeout(() => renderResults(qi.value), 120); });
qi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { remember(qi.value); const a = $('#results a.item'); if (a) a.click(); } if (e.key === 'Escape') closeSearch(); });
$('#results').addEventListener('click', (e) => {
  const c = e.target.closest('[data-q]'); if (c) { qi.value = c.dataset.q; renderResults(qi.value); return; }
  const d = e.target.closest('[data-db]');
  if (d) { const f = $('#dbfczForm'); f.suche_string.value = qi.value; f.suche_radio.value = d.dataset.db; f.submit(); remember(qi.value); return; }
  const a = e.target.closest('a'); if (a) { remember(qi.value); if (a.getAttribute('href').startsWith('#')) closeSearch(); }
});
document.addEventListener('keydown', (e) => { if (e.key === '/' && layer.hidden && !/input|select|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); } });
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-share]'); if (!b) return;
  const data = { title: document.title, url: location.href };
  try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(location.href); b.textContent = '✓ Link kopiert'; } } catch { /* cancelled */ }
});

// ---------------------------------------------------------------- router
function route() {
  clearInterval(timer);
  const h = location.hash.slice(2) || 'heute';
  const [path, qs] = h.split('?');
  const q = new URLSearchParams(qs || '');
  const [a, b] = path.split('/');
  const tab = { heute: 'heute', saison: 'saison', archiv: 'archiv', gegner: 'archiv', saisonarchiv: 'archiv', spieler: 'spieler', forum: 'forum', spiel: 'archiv' }[a] || 'heute';
  document.querySelectorAll('#tabs a').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
  if (!S.db) { view.innerHTML = '<div class="empty">Daten konnten nicht geladen werden.</div>'; return; }
  if (a === 'spiel') { if (!view.dataset.r) renderArchiv(new URLSearchParams()); openMatch(+b); return; }
  closeSheet(); closeSearch();
  const titles = { heute: 'Heute', saison: 'Saison', archiv: 'Archiv', spieler: 'Spieler', forum: 'Forum', gegner: 'Gegner', saisonarchiv: 'Saison' };
  document.title = `FCZ Radar · ${titles[a] || 'Heute'}`;
  view.dataset.r = a;
  if (a === 'saison') renderSaison(q);
  else if (a === 'archiv') renderArchiv(q);
  else if (a === 'gegner') renderGegner(+b);
  else if (a === 'saisonarchiv') renderSaisonArchiv(+b);
  else if (a === 'spieler' && b) renderPlayer(+b);
  else if (a === 'spieler') renderSpieler(q);
  else if (a === 'forum') renderForum(q);
  else renderHeute();
  if (!q.get('p')) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
loadAll().then(route).catch((e) => { view.innerHTML = `<div class="empty">Fehler: ${esc(e.message)}</div>`; });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
