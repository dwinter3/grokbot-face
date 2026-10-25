// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
// v1.9 AI newsfeed + harness-changelog tracker for the Grok Bot Face tablet.
// Runs from the staggered news cron; each run refreshes the few most-overdue sources
// (round-robin) so CPU / subrequests stay well inside the Workers Free limits.
const GN = q => 'https://news.google.com/rss/search?q=' + q + '&hl=en-US&gl=US&ceid=US:en';
const BING = q => 'https://www.bing.com/news/search?q=' + q + '&format=rss'; // Bing News RSS carries real snippets + direct links
export const SOURCES = [
  // --- general AI briefing list (AlphaSignal, TechCrunch, WSJ, NYT, Fortune, CNN + priority companies)
  { id: 'tc', name: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', tag: 'ai', every: 60 },
  { id: 'nyt', name: 'NYT', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', tag: 'ai', every: 60, aiOnly: true },
  { id: 'wsj', name: 'WSJ', url: 'https://feeds.a.dj.com/rss/RSSWSJD.xml', tag: 'ai', every: 60, aiOnly: true },
  { id: 'fortune', name: 'Fortune', url: GN('site:fortune.com+AI+when:2d'), tag: 'ai', every: 60, gn: true, aiOnly: true },
  { id: 'cnn', name: 'CNN', url: GN('site:cnn.com+AI+when:2d'), tag: 'ai', every: 60, gn: true, aiOnly: true },
  { id: 'alpha', name: 'AlphaSignal', url: GN('alphasignal+when:7d'), tag: 'ai', every: 60, gn: true },
  { id: 'anthropic', name: 'Anthropic', url: GN('Anthropic+when:2d'), tag: 'ai', every: 60, gn: true, top: true },
  { id: 'openai', name: 'OpenAI', url: GN('OpenAI+when:2d'), tag: 'ai', every: 60, gn: true, top: true },
  { id: 'cognition', name: 'Cognition', url: GN('%22Cognition+AI%22+OR+Devin+when:7d'), tag: 'ai', every: 60, gn: true, top: true },
  { id: 'verge', name: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', tag: 'ai', every: 60 },
  // --- brand queries
  { id: 'grokbot', name: 'Grok Bot', url: GN('%22Grok+Bot%22+when:7d'), tag: 'grokbot', every: 30, gn: true },
  { id: 'cursor', name: 'Cursor', url: GN('%22Cursor+AI%22+OR+%22Anysphere%22+when:7d'), tag: 'cursor', every: 30, gn: true },
  { id: 'spacexai', name: 'SpaceXAI', url: GN('%22SpaceX+AI%22+OR+%22spacex.ai%22+OR+SpaceXAI+OR+xAI+OR+Grok+when:3d'), tag: 'spacexai', every: 30, gn: true },
  { id: 'b-grokbot', name: 'Grok Bot', url: BING('%22Grok+Bot%22'), tag: 'grokbot', every: 40, bing: true },
  { id: 'b-cursor', name: 'Cursor', url: BING('%22Cursor+AI%22+OR+Anysphere'), tag: 'cursor', every: 40, bing: true },
  { id: 'b-spacexai', name: 'SpaceXAI', url: BING('xAI+Grok+OR+%22SpaceX+AI%22+OR+SpaceXAI'), tag: 'spacexai', every: 40, bing: true },
  { id: 'b-ai', name: 'AI', url: BING('%22artificial+intelligence%22+OR+OpenAI+OR+Anthropic'), tag: 'ai', every: 60, bing: true },
  // --- harness changelogs
  { id: 'h-claude', tool: 'Claude Code', url: 'https://github.com/anthropics/claude-code/releases.atom', kind: 'gh', every: 30 },
  { id: 'h-agy', tool: 'Antigravity', url: 'https://antigravity.google/docs/changelog', kind: 'agy', every: 30 },
  { id: 'h-codex', tool: 'Codex', url: 'https://github.com/openai/codex/releases.atom', kind: 'gh', every: 30 },
  { id: 'h-opencode', tool: 'OpenCode', url: 'https://github.com/anomalyco/opencode/releases.atom', kind: 'gh', every: 30, only: /^v\d/ },
  { id: 'h-goose', tool: 'Goose', url: 'https://github.com/block/goose/releases.atom', kind: 'gh', every: 30, only: /^v\d/ },
  { id: 'h-grokbuild', tool: 'Grok Build', url: 'https://x.ai/changelog/build/rss.xml', kind: 'rssrel', every: 30, ver: /(\d+\.\d+\.\d+)/ },
  // Cursor changelog (covers the editor, cloud agents and the Cursor CLI; no separate CLI feed exists).
  { id: 'h-cursor', tool: 'Cursor', url: 'https://cursor.com/changelog/rss.xml', kind: 'rssrel', every: 30 },
];
export const HARNESS_ORDER = ['Claude Code', 'Antigravity', 'Codex', 'OpenCode', 'Goose', 'Grok Build', 'Cursor'];
const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast', AI_FALLBACK = '@cf/zai-org/glm-4.7-flash';
const PER_RUN = 4, AI_PER_RUN = 4, AI_PER_DAY = 250, H_KEEP = 5, MAX_ITEMS = 30;
const UA = 'GrokBotFaceNews/1.10.1 (+personal tablet newsfeed; contact via workers.dev owner)';
const AI_RE = /\b(A\.?I\.?|artificial intelligence|machine learning|LLM|chatbot|OpenAI|ChatGPT|Anthropic|Claude|Gemini|Nvidia|xAI|Grok|DeepSeek|Copilot|Cursor|agents?|model|robot)/i;
const PRIORITY_RE = /\b(SpaceX|xAI|Grok|Cursor|Anysphere|Anthropic|Claude|OpenAI|ChatGPT|Cognition|Devin)\b/i;
const BRAND = [['grokbot', /grok ?bot/i], ['spacexai', /spacex ?ai|spacex\.ai|\bx\.?ai\b|\bgrok\b/i], ['cursor', /\bcursor (ai|ide|agent|editor)|anysphere|\bcursor\b(?=.*\b(ai|agent|code|coding|ide)\b)/i]];
const PRE_RE = /(alpha|beta|nightly|canary|preview|\brc\b|-rc|-pre)/i;

// ---------- text helpers
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch { return ''; } }
    const v = ENT[e.toLowerCase()]; return v === undefined ? m : v;
  });
}
function cdata(s) { return s ? s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') : ''; }
export function clean(s) {
  if (!s) return '';
  s = decode(cdata(s));                        // escaped HTML -> HTML
  s = s.replace(/<(script|style|figure|pre)[\s\S]*?<\/\1>/gi, ' ').replace(/<li[^>]*>/gi, ' • ').replace(/<\/(p|h\d|li|div)>/gi, '. ').replace(/<[^>]+>/g, ' ');
  s = decode(s).replace(/\s+/g, ' ').replace(/(\.\s*){2,}/g, '. ').replace(/\s+([.,;:!?])/g, '$1').replace(/^[\s.•]+/, '').trim();
  return s;
}
// release notes: drop bare section headers ("What's changed.", "Bug Fixes.", "✨ Features.") that precede bullets
const HDR_RE = /^(?:[^\w\s]+\s*)?(?:what'?s (?:changed|new)|changes?|core|improvements?|bug ?fixes|fixes|features?|new features?|highlights|breaking changes?|other(?: changes)?|misc(?:ellaneous)?|performance|security|docs|documentation|deprecations?|tui|cli|sdk|desktop|app|general|internal|dependencies|chores?|refactor(?:ing)?)[.:]?$/i;
function relClean(t) {
  return t.split(' • ').map(seg => seg.split(/(?<=[.!?:])\s+/).filter(x => !HDR_RE.test(x.trim())).join(' ').trim())
    .filter(seg => seg.length > 2).join(' • ').replace(/\s*\(\s*#\d+\s*\)/g, '').replace(/\s#\d{3,6}\b/g, '').replace(/\.\./g, '.').trim();
}
function cap(s, n) { if (s.length <= n) return s; const c = s.slice(0, n - 1); const i = c.lastIndexOf(' '); return (i > n * 0.6 ? c.slice(0, i) : c).replace(/[\s,;:.–—-]+$/, '') + '…'; }
function capSent(s, n) { if (s.length <= n) return s; const c = s.slice(0, n); const i = Math.max(c.lastIndexOf('. '), c.lastIndexOf('! '), c.lastIndexOf('? ')); return i > n * 0.4 ? c.slice(0, i + 1) : cap(s, n); }
function tag1(b, t) { const m = b.match(new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + t + '>', 'i')); return m ? m[1] : ''; }
function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
function normKey(t) { return t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 64); }
function iso(d) { const t = Date.parse(d); return isNaN(t) ? null : new Date(t).toISOString(); }

// ---------- feed parsing (regex; feeds are pre-truncated to keep CPU tiny)
export function parseFeed(xml, max = 15) {
  const out = []; const atom = xml.indexOf('<entry') >= 0 && xml.indexOf('<item') < 0;
  const re = atom ? /<entry[\s>][\s\S]*?<\/entry>/g : /<item[\s>][\s\S]*?<\/item>/g;
  let m; while ((m = re.exec(xml)) && out.length < max) {
    const b = m[0];
    const title = clean(tag1(b, 'title'));
    let link = clean(tag1(b, 'link')); if (!link) { const l = b.match(/<link[^>]*href="([^"]+)"/); link = l ? decode(l[1]) : ''; }
    const date = iso(clean(tag1(b, 'pubDate') || tag1(b, 'published') || tag1(b, 'updated') || tag1(b, 'dc:date')));
    const body = (tag1(b, 'content:encoded') || tag1(b, 'content') || tag1(b, 'description') || tag1(b, 'summary')).slice(0, 6000);
    const desc = tag1(b, 'description') || tag1(b, 'summary');
    const src = clean(tag1(b, 'source')); const su = b.match(/<source[^>]*\surl="([^"]+)"/i);
    if (title) out.push({ title, link, date, body, desc, src, srcUrl: su ? decode(su[1]) : '', raw: b.length < 4000 ? b : '' });
  }
  return out;
}
function unwrap(l) { if (!l) return undefined; const m = l.match(/[?&]url=([^&]+)/); if (/bing\.com\/news\/apiclick/.test(l) && m) { try { l = decodeURIComponent(m[1]); } catch {} } return /^https?:\/\//.test(l) ? l.slice(0, 300) : undefined; }
function truncFeed(t, n) { // keep only the first n items (Google News returns up to 100)
  const tagn = t.indexOf('<item') >= 0 ? '</item>' : '</entry>'; let p = 0;
  for (let i = 0; i < n; i++) { const q = t.indexOf(tagn, p); if (q < 0) return t; p = q + tagn.length; }
  return t.slice(0, p);
}


// ---------- v1.10.1 source quality: allowlisted outlets only on the tablet list; known news kept aside; blogs/UGC/shops dropped
const ALLOW_DOMAINS = ['theverge.com', 'techcrunch.com', 'wired.com', 'arstechnica.com', 'thenewstack.io', 'bloomberg.com', 'reuters.com', 'cnbc.com', 'wsj.com',
  'nytimes.com', 'ft.com', 'theinformation.com', 'businessinsider.com', 'insider.com', 'axios.com', 'fortune.com', 'venturebeat.com', 'zdnet.com', 'engadget.com',
  '9to5mac.com', '9to5google.com', 'electrek.co', 'teslarati.com', 'semafor.com', 'platformer.news', 'stratechery.com', 'cnn.com', 'apnews.com', 'bbc.com', 'bbc.co.uk',
  'theguardian.com', 'washingtonpost.com', 'economist.com', 'technologyreview.com', 'theatlantic.com', 'time.com', 'cnet.com', 'theregister.com', 'spectrum.ieee.org',
  'x.ai', 'cursor.com', 'anysphere.inc', 'anthropic.com', 'openai.com', 'spacex.com', 'blog.google', 'deepmind.google', 'github.blog', 'latent.space', 'simonwillison.net'];
const ALLOW_NAMES = ['the verge', 'techcrunch', 'wired', 'ars technica', 'the new stack', 'bloomberg', 'reuters', 'cnbc', 'wsj', 'the wall street journal', 'wall street journal',
  'nyt', 'the new york times', 'new york times', 'financial times', 'ft', 'the information', 'business insider', 'insider', 'axios', 'fortune', 'venturebeat', 'zdnet',
  'engadget', '9to5mac', '9to5google', 'electrek', 'teslarati', 'semafor', 'platformer', 'stratechery', 'cnn', 'associated press', 'ap news', 'bbc', 'bbc news', 'the guardian',
  'the washington post', 'washington post', 'the economist', 'mit technology review', 'the atlantic', 'time', 'cnet', 'the register', 'ieee spectrum',
  'xai', 'cursor', 'anthropic', 'openai', 'spacex', 'google blog', 'google deepmind', 'github blog', 'latent space', 'simon willison'];
const NEWS_DOMAINS = ['yahoo.com', 'msn.com', 'gizmodo.com', 'mashable.com', 'androidheadlines.com', 'techrepublic.com', 'tomshardware.com', 'pcmag.com', 'digitaltrends.com',
  'neowin.net', 'windowscentral.com', 'androidauthority.com', 'macrumors.com', 'appleinsider.com', 'forbes.com', 'fastcompany.com', 'inc.com', 'investors.com', 'marketwatch.com',
  'barrons.com', 'benzinga.com', 'cityam.com', 'ndtv.com', 'moneycontrol.com', 'economictimes.indiatimes.com', 'indiatimes.com', 'livemint.com', 'hindustantimes.com',
  'indianexpress.com', 'ynetnews.com', 'scmp.com', 'siliconangle.com', 'infoworld.com', 'futurism.com', 'space.com', 'the-decoder.com', 'analyticsindiamag.com',
  'newsbytesapp.com', 'socialmediatoday.com', 'scworld.com', 'theglobeandmail.com', 'independent.co.uk', 'telegraph.co.uk', 'politico.com', 'npr.org', 'cbsnews.com',
  'nbcnews.com', 'abcnews.go.com', 'foxbusiness.com', 'usatoday.com', 'latimes.com', 'sfchronicle.com', 'theconversation.com', 'thestreet.com', 'investopedia.com',
  'qz.com', 'vox.com', 'slate.com', 'protocol.com', 'techradar.com', 'tweaktown.com', 'wccftech.com', 'notebookcheck.net', 'pymnts.com', 'datacenterdynamics.com',
  'computerworld.com', 'theinformation.com', 'thenextweb.com', 'sifted.eu', 'restofworld.org', 'businesstoday.in', 'bgr.com', 'slashgear.com', 'howtogeek.com', 'makeuseof.com',
  'zdnet.com', 'semianalysis.com', 'spacenews.com', 'nasaspaceflight.com', 'teslanorth.com', 'notateslaapp.com', 'driveteslacanada.ca'];
const NEWS_NAMES = ['yahoo finance', 'yahoo news', 'yahoo tech', 'gizmodo', 'mashable', 'android headlines', 'techrepublic', "tom's hardware", 'pcmag', 'digital trends',
  'neowin', 'windows central', 'android authority', 'macrumors', 'appleinsider', 'forbes', 'fast company', 'inc', "investor's business daily", 'marketwatch', "barron's",
  'benzinga', 'city am', 'ndtv', 'moneycontrol', 'moneycontrolcom', 'the economic times', 'economic times', 'mint', 'livemint', 'hindustan times', 'the indian express',
  'ynetnews', 'south china morning post', 'siliconangle', 'infoworld', 'futurism', 'spacecom', 'the decoder', 'analytics india magazine', 'newsbytes', 'social media today',
  'sc media', 'politico', 'npr', 'cbs news', 'nbc news', 'abc news', 'fox business', 'usa today', 'los angeles times', 'thestreet', 'quartz', 'vox', 'techradar', 'tweaktown',
  'wccftech', 'notebookcheck', 'pymnts', 'computerworld', 'the next web', 'sifted', 'rest of world', 'business today', 'bgr', 'slashgear', 'how-to geek', 'space news',
  'spacenews', 'teslanorthcom', 'teslanorth', 'not a tesla app', 'drive tesla canada'];
// blogs / UGC / shops / PR wires / personal sites: never shown (even if a name collides with a news list)
const DENY_DOMAINS = ['note.com', 'note.jp', 'medium.com', 'substack.com', 'blogspot.com', 'wordpress.com', 'tumblr.com', 'linkedin.com', 'reddit.com', 'quora.com',
  'pinterest.com', 'youtube.com', 'youtu.be', 'x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com', 'threads.net', 'vocal.media', 'hackernoon.com', 'dev.to',
  'hashnode.dev', 'ghost.io', 'beehiiv.com', 'kucoin.com', 'binance.com', 'pasqualepillitteri.it', 'basenor.com', 't.co', 'prnewswire.com', 'businesswire.com',
  'globenewswire.com', 'einpresswire.com', 'accesswire.com', 'openpr.com', 'newswire.com', 'prweb.com', 'issuewire.com', 'medium.datadriveninvestor.com', 'steemit.com',
  'github.io', 'wixsite.com', 'weebly.com', 'blogger.com', 'livejournal.com', 'naver.com', 'ameblo.jp', 'hatena.ne.jp', 'qiita.com', 'zenn.dev'];
const DENY_NAME_RE = /\b(note|medium|substack|blogspot|wordpress|linkedin|reddit|quora|pinterest|youtube|vocal|hackernoon|kucoin|binance|pr ?newswire|business ?wire|globe ?newswire|ein ?presswire|accesswire|openpr)\b|accessor(y|ies)|\bshop\b|\bstore\b|\bdeals?\b|\bcoupons?\b|pasquale pillitteri|\bblog\b/i;
const nName = n => (n || '').toLowerCase().replace(/\s+on msn$/, '').replace(/[^a-z0-9' -]/g, '').replace(/\s+/g, ' ').trim();
function hostOf(u) { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } }
const inList = (h, list) => !!h && list.some(d => h === d || h.endsWith('.' + d));
// -> 'trusted' (published), 'news' (known news domain: kept aside, never on the tablet), 'deny' or 'unknown' (dropped)
export function sourceQuality(name, host) {
  const n = nName(name);
  if (inList(host, ALLOW_DOMAINS)) return 'trusted';                              // the publisher's own allowlisted domain wins
  if (inList(host, DENY_DOMAINS) || DENY_NAME_RE.test(name || '') || /^https?:|\.(it|jp|pk|hu)\b/.test(n)) return 'deny';
  if (host && host !== 'msn.com' && !host.endsWith('.msn.com')) {               // the publisher's own domain decides
    if (inList(host, NEWS_DOMAINS)) return 'news';
    return 'unknown';
  }
  if (ALLOW_NAMES.includes(n)) return 'trusted';                                  // MSN syndication / no domain: use the publisher name
  if (NEWS_NAMES.includes(n)) return 'news';
  return 'unknown';
}
// machine-translated / diary / non-news titles
export function titleJunk(t) {
  if (!t) return 'empty';
  const letters = t.replace(/[^\p{L}]/gu, ''); const nonLatin = t.replace(/[\p{Script=Latin}\P{L}]/gu, '');
  if (letters.length && nonLatin.length / letters.length > 0.15) return 'non-english';
  if (/[àâçéèêëîïôûùüÿñæœäöß]/i.test(t) && (t.match(/[àâçéèêëîïôûùüÿñæœäöß]/gi) || []).length >= 3) return 'non-english';
  const w = t.split(/\s+/).filter(Boolean); if (w.length < 4) return 'too-short';
  if (/^(country|summer|winter|autumn|spring|quiet|lonely|rainy|starry|sleepless|late|midnight) (nights?|days?|mornings?|evenings?)\b/i.test(t)) return 'diary';
  if (/\b(my diary|diary|daily life|i tried|i asked grok|i used|my experience|impressions? of|thoughts on)\b/i.test(t)) return 'diary';
  if (/ - [A-Z0-9]{4,}$/.test(t)) return 'seo-suffix';                            // "... - BASENOR"
  return '';
}

// ---------- per-source processing -> normalized records
function brandTag(title, base) { for (const [t, re] of BRAND) if (re.test(title)) return t; return base; }
function newsRecords(s, items, now) {
  const maxAge = (s.tag === 'ai' ? 3 : 7) * 864e5, out = [];
  for (const it of items) {
    if (!it.date || now - Date.parse(it.date) > maxAge || Date.parse(it.date) - now > 36e5) continue;
    let title = it.title, source = s.name;
    if (s.bing) { source = clean(it.raw.match(/<News:Source>([\s\S]*?)<\/News:Source>/i)?.[1] || '').replace(/ on MSN$/, '') || s.name; }
    if (s.gn) { // "Headline - Publisher"
      const pub = it.src || (title.match(/ - ([^-]{2,40})$/) || [])[1] || s.name;
      title = title.replace(/\s+-\s+[^-]{2,40}$/, ''); source = pub;
    }
    if (s.aiOnly && !AI_RE.test(title + ' ' + clean(it.desc).slice(0, 300))) continue;
    // quality: direct publisher feeds are trusted; aggregator results are judged by the real publisher domain/name
    const host = s.gn ? hostOf(it.srcUrl) : s.bing ? hostOf(unwrap(it.link)) : '';
    const q = (s.gn || s.bing) ? sourceQuality(source, host) : 'trusted';
    if (q === 'deny' || q === 'unknown' || titleJunk(title)) continue;
    let text = clean(it.desc || it.body);
    if (s.gn || normKey(text).startsWith(normKey(title).slice(0, 30))) text = ''; // GN descriptions only repeat the headline
    const tag = brandTag(title, s.tag);
    out.push({ id: hash(normKey(title)), title: cap(title, 110), source: cap(source, 28), publishedAt: it.date, tag,
      top: !!(s.top || tag !== 'ai' || PRIORITY_RE.test(title)) || undefined, text: text.slice(0, 900), url: s.gn ? undefined : unwrap(it.link), q, host: host || undefined });
  }
  return out;
}
function relRecords(s, items) {
  const out = [];
  for (const it of items) {
    let title = it.title, version = title;
    if (s.kind === 'gh') {
      version = title.split(/[:\s]/)[0].replace(/^rust-/, '');
      if (s.only && !s.only.test(version)) continue;
      if (!/^v?\d+\.\d+/.test(version)) continue;
      if (!version.startsWith('v')) version = 'v' + version;
      title = '';
    } else if (s.ver) { const m = title.match(s.ver); version = m ? 'v' + m[1] : title; title = ''; }
    else { version = cap(title, 60); title = ''; } // Cursor changelog entries are titled, not versioned
    const body = relClean(clean(it.body));
    const pre = PRE_RE.test(version);
    out.push({ version, headline: title ? cap(title, 90) : '', publishedAt: it.date, pre, text: pre || out.filter(r => !r.pre).length >= 3 ? '' : body.slice(0, 1200) });
    if (out.length >= 12) break;
  }
  return out;
}
export function parseAgy(html) { // Antigravity docs changelog (static Astro page, no RSS). "hub" = Antigravity app.
  const i = html.indexOf('id="rel-hub-'); if (i < 0) return [];
  const seg = html.slice(i - 200, i + 90000), out = [];
  const re = /<article[^>]*id="rel-hub-([^"]+)"[\s\S]*?<\/article>/g; let m;
  while ((m = re.exec(seg)) && out.length < H_KEEP) {
    const b = m[0];
    const date = iso(clean(tag1(b, 'time')));
    const head = clean((b.match(/rn-headline[^>]*>([\s\S]*?)<\/h3>/) || [])[1] || '');
    const sum = clean((b.match(/rn-summary[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '');
    const items = []; const lr = /<li class="rn-item[^>]*>([\s\S]*?)<\/li>/g; let l; while ((l = lr.exec(b)) && items.length < 6) items.push(clean(l[1]));
    out.push({ version: 'v' + m[1], headline: cap(head, 90), publishedAt: date, pre: false, text: out.length >= 3 ? '' : (sum + (items.length ? ' • ' + items.join(' • ') : '')).slice(0, 1200) });
  }
  return out;
}

async function getText(url, maxBytes) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/atom+xml, text/html;q=0.8, */*;q=0.5' }, redirect: 'follow', cf: { cacheTtl: 300 } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const t = await r.text(); return maxBytes ? t.slice(0, maxBytes) : t;
}
export async function refreshSource(s, state, now) {
  const st = state.src[s.id] || (state.src[s.id] = {});
  try {
    if (s.kind === 'agy') { const html = await getText(s.url); st.rel = parseAgy(html); }
    else {
      let t = await getText(s.url, s.kind ? 400000 : 300000); t = truncFeed(t, s.kind ? 40 : 15);
      const items = parseFeed(t, s.kind ? 40 : 15);
      if (s.kind) { st.rel = relRecords(s, items); if (s.newsTag) st.items = newsRecords({ ...s, name: 'Cursor Changelog', tag: s.newsTag }, items.slice(0, 6), now); }
      else st.items = newsRecords(s, items, now);
    }
    st.ok = new Date(now).toISOString(); st.err = undefined;
  } catch (e) { st.err = String(e.message || e).slice(0, 80); }
  st.at = now;
}

// ---------- summaries (Workers AI when bound, else cleaned feed text)
function plainSummary(text) { return text ? capSent(text, 600) : ''; }
const trimRel = t => t ? t.replace(/^[^.]{0,70}\breleased\.\s+(?=\S)/i, '') : t;   // drop an 'X vN released.' opener
async function aiSummary(env, title, text, harness) {
  const sys = harness
    ? 'You condense software release notes for a glanceable desk display. Use only the facts given. Write 2-4 short plain sentences (under 90 words) on the most notable changes; fewer if the notes are brief. No preamble, no markdown, no bullet points.'
    : 'You summarize news for a glanceable desk display. Use only the facts in the provided text; never add facts or speculate. Write 1-4 short plain sentences (under 90 words), fewer when the text is brief. No preamble, no markdown.';
  const input = { messages: [{ role: 'system', content: sys }, { role: 'user', content: 'Title: ' + title + '\n\nText: ' + text.slice(0, 1800) }], max_tokens: 220 };
  let r; try { r = await env.AI.run(AI_MODEL, input); } catch (e) { r = await env.AI.run(AI_FALLBACK, input); }
  const msg = r && r.choices && r.choices[0] && r.choices[0].message;
  let s = (r && (r.response || r.result && r.result.response) || msg && msg.content || '').replace(/^(here is|here's|summary)[^:]*:\s*/i, '').replace(/\s+/g, ' ').trim();
  return s.length > 40 ? capSent(s, 600) : '';
}

async function articleText(url) { // first paragraphs of the article (for better summaries); tablet never loads it
  if (!url || /nytimes\.com|wsj\.com|msn\.com|news\.google|bing\.com/.test(url)) return '';
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrokBotFaceNews/1.10.1)', 'Accept': 'text/html' }, redirect: 'follow' });
  if (!r.ok || !/html/.test(r.headers.get('content-type') || '')) return '';
  const h = (await r.text()).slice(0, 250000); const ps = []; let n = 0; const re = /<p[^>]*>([\s\S]*?)<\/p>/g; let m;
  while ((m = re.exec(h)) && n < 2000) { const t = clean(m[1]); if (t.length > 60 && !/cookie|subscribe|newsletter|sign up|all rights reserved/i.test(t)) { ps.push(t); n += t.length; } }
  return ps.join(' ').slice(0, 2000);
}
function relId(tool, v) { return 'h' + hash(tool + '|' + v); }
export function harnessView(state) {
  const tools = [];
  for (const tool of HARNESS_ORDER) {
    const s = SOURCES.find(x => x.tool === tool); const st = state.src[s.id]; const rel = st && st.rel;
    if (!rel || !rel.length) { tools.push({ tool, version: null, publishedAt: null, summary: '', status: st && st.err ? 'unavailable' : 'pending' }); continue; }
    const stableIdx = rel.findIndex(r => !r.pre); const latest = rel[stableIdx >= 0 ? stableIdx : 0];
    const preNewer = stableIdx > 0 ? rel.slice(0, stableIdx).filter(r => r.pre) : [];
    const id = relId(tool, latest.version);
    tools.push({ id, tool, version: latest.version, headline: latest.headline || undefined, publishedAt: latest.publishedAt,
      summary: trimRel(state.sum[id]) || plainSummary(latest.text),
      prerelease: preNewer.length ? { count: preNewer.length, latest: preNewer[0].version } : undefined,
      recent: rel.filter(r => !r.pre).slice(0, H_KEEP).map(r => ({ version: r.version, publishedAt: r.publishedAt, headline: r.headline || undefined })) });
  }
  return tools;
}
export function buildOutput(state, now) {
  const seen = new Map();
  for (const s of SOURCES) { const st = state.src[s.id]; if (!st || !st.items) continue;
    for (const it of st.items) { const k = it.id, prev = seen.get(k);
      if (it.q !== 'trusted' && it.q !== 'news') continue;                       // pre-v1.10.1 records (no quality verdict) are purged
      if (!prev || (it.q === 'trusted' && prev.q !== 'trusted') || (it.q === prev.q && ((it.text.length > prev.text.length) || (prev.tag === 'ai' && it.tag !== 'ai'))))
        seen.set(k, prev ? { ...it, tag: it.tag !== 'ai' ? it.tag : prev.tag, top: it.top || prev.top } : it);
      else if (prev.tag === 'ai' && it.tag !== 'ai') prev.tag = it.tag; } }
  const harness = harnessView(state);
  const items = [], more = [];
  for (const it of seen.values()) if (it.q === 'news' && titleJunk(it.title) === '') more.push({ id: it.id, title: it.title, source: it.source, publishedAt: it.publishedAt, tag: it.tag, quality: 'news' });
  more.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  for (const it of seen.values()) if (it.q === 'trusted') items.push({ id: it.id, title: it.title, source: it.source, publishedAt: it.publishedAt, tag: it.tag, top: it.top, summary: state.sum[it.id] || plainSummary(it.text) || undefined });
  for (const h of harness) if (h.version && h.publishedAt && now - Date.parse(h.publishedAt) < 7 * 864e5)
    items.push({ id: h.id, title: cap(/^v\d/.test(h.version) ? h.tool + ' ' + h.version + (h.headline ? ' — ' + h.headline : ' released') : h.tool + ': ' + h.version, 110), source: h.tool + ' changelog', publishedAt: h.publishedAt, tag: 'harness', tool: h.tool, version: h.version, top: true, summary: h.summary || undefined });
  const boosted = it => it.tag !== 'ai' && now - Date.parse(it.publishedAt) < 48 * 36e5;
  const order = (a, b) => (boosted(b) - boosted(a)) || (Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  items.sort(order);
  // harness releases (<7d) always make the list; brand items capped at 6 per tag in the boosted block
  // v1.10.1: brand items are allowlisted-only now, so a few (<=4 per tag, <7d) always make the list even when older than the 48h boost
  const per = {}, outItems = items.filter(i => i.tag === 'harness'), res = {};
  for (const it of items) if (it.tag !== 'harness' && it.tag !== 'ai' && !boosted(it) && now - Date.parse(it.publishedAt) < 7 * 864e5 && (res[it.tag] = (res[it.tag] || 0) + 1) <= 4) { it._res = true; outItems.push(it); }
  for (const it of items) { if (outItems.length >= MAX_ITEMS) break; if (it.tag === 'harness' || it._res) continue; if (boosted(it)) { per[it.tag] = (per[it.tag] || 0) + 1; if (per[it.tag] > 6) continue; } outItems.push(it); }
  outItems.sort(order); for (const it of outItems) delete it._res;
  // `more`: known-news-domain items from non-allowlisted outlets. Not in `items`, so the tablet never shows them,
  // never breaks on them and never uses them for a news moment (the app only reads items/harness).
  return { updatedAt: new Date(now).toISOString(), items: outItems, harness, more: more.slice(0, 15),
    sources: SOURCES.map(s => ({ id: s.id, ok: !!(state.src[s.id] && state.src[s.id].ok && !state.src[s.id].err) })) };
}

export async function newsCron(env, now = Date.now(), opts = {}) {
  let state = null; try { state = JSON.parse(await env.FEED.get('newsstate') || 'null'); } catch {}
  if (!state || state.v !== 1) state = { v: 1, src: {}, sum: {}, ai: { day: '', n: 0 } };
  const due = SOURCES.map(s => ({ s, over: (now - ((state.src[s.id] || {}).at || 0)) / (s.every * 60000) }))
    .filter(x => opts.all || x.over >= 0.95).sort((a, b) => b.over - a.over).slice(0, opts.all ? 99 : PER_RUN);
  await Promise.all(due.map(x => refreshSource(x.s, state, now)));
  let out = null;
  // summaries: only new ids, cached in state.sum
  const day = new Date(now).toISOString().slice(0, 10); if (state.ai.day !== day) state.ai = { day, n: 0 };
  out = buildOutput(state, now); const want = [];
  for (const it of out.items) if (!state.sum[it.id]) {
    let text = '', harness = false;
    if (it.tag === 'harness') { const s = SOURCES.find(x => x.tool === it.tool); const r = (state.src[s.id].rel || []).find(r => r.version === it.version); text = r ? r.text : ''; harness = true; }
    else for (const s of SOURCES) { const f = (state.src[s.id] && state.src[s.id].items || []).find(x => x.id === it.id); if (f) { if (f.text.length >= text.length) text = f.text; if (f.url) it._url = f.url; } }
    if (harness ? text.length >= 160 : (text.length >= 80 || it._url)) want.push({ it, text, harness, url: it._url });
  }
  let aiErr = null, aiDone = 0;
  if (env.AI) for (const w of want.slice(0, opts.aiMax ?? AI_PER_RUN)) {
    if (state.ai.n >= AI_PER_DAY) break;
    try {
      if (!w.harness && w.url) { try { const a = await articleText(w.url); if (a.length > w.text.length + 200) w.text = (w.text ? w.text + ' ' : '') + a; } catch {} }
      if (w.text.length < 80) continue;
      const s = await aiSummary(env, w.it.title, w.text, w.harness); state.ai.n++; aiDone++; if (s) state.sum[w.it.id] = s;
    }
    catch (e) { aiErr = String(e.message || e).slice(0, 80); break; }
  }
  if (!due.length && !aiDone) return { wrote: false, refreshed: [], ai: 0, aiErr, items: out.items.length };
  if (aiDone) out = buildOutput(state, now);
  // prune summary cache to live ids
  const live = new Set(out.items.map(i => i.id)); for (const h of out.harness) if (h.id) live.add(h.id);
  for (const k of Object.keys(state.sum)) if (!live.has(k)) delete state.sum[k];
  await env.FEED.put('newsstate', JSON.stringify(state));
  // write the public object only when its content changed (KV free tier: 1000 writes/day)
  const prev = await env.FEED.get('news'); let body = JSON.stringify(out);
  const strip = b => b ? b.replace(/^\{"updatedAt":"[^"]*",/, '{') : '';
  let wrote = false;
  if (strip(prev) !== strip(body)) { await env.FEED.put('news', body); wrote = true; }
  return { wrote, refreshed: due.map(x => x.s.id + (state.src[x.s.id].err ? '!' + state.src[x.s.id].err : '')), ai: aiDone, aiErr, items: out.items.length, bytes: body.length };
}
