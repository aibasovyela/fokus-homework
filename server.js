/* Фокус ИИ — приём домашних заданий и профилей участников + админ-панель.
   Данные хранятся в DATA_DIR (Railway volume /data). Доступ к админке — по паролю ADMIN_PASS. */
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DATA = process.env.DATA_DIR || '/data';
const FILES = path.join(DATA, 'files');
const STORE = path.join(DATA, 'submissions.json');
const ADMIN_PASS = process.env.ADMIN_PASS || 'yelumio2026';

fs.mkdirSync(FILES, { recursive: true });
if (!fs.existsSync(STORE)) fs.writeFileSync(STORE, '[]');

app.use(express.json({ limit: '30mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const load = () => { try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch (e) { return []; } };
const save = (a) => fs.writeFileSync(STORE, JSON.stringify(a));
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ── приём от сайта ── */
app.post('/api/submit', (req, res) => {
  const d = req.body || {};
  const rec = {
    id: newId(), at: new Date().toISOString(),
    kind: d.type === 'profile' ? 'profile' : 'homework',
    name: d.name || 'аноним', sphere: d.sphere || '', module: d.module || '', homework: d.homework || '',
    type: d.type || 'text', content: d.content || '', fileName: d.fileName || ''
  };
  if (d.type === 'file' && d.fileData) {
    try {
      const ext = (d.fileName || 'file').split('.').pop().slice(0, 8);
      const fn = rec.id + '.' + ext;
      fs.writeFileSync(path.join(FILES, fn), Buffer.from(d.fileData, 'base64'));
      rec.file = fn; rec.fileMime = d.fileMime || 'application/octet-stream';
    } catch (e) { rec.error = 'file save failed'; }
  }
  const arr = load(); arr.push(rec); save(arr);
  // зеркалим на Google Drive через Apps Script (если настроен DRIVE_WEBHOOK)
  if (process.env.DRIVE_WEBHOOK) {
    try {
      fetch(process.env.DRIVE_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d)
      }).catch(() => {});
    } catch (e) {}
  }
  res.json({ ok: true });
});

/* ── скачать файл (только с ключом) ── */
app.get('/file/:id', (req, res) => {
  if (req.query.key !== ADMIN_PASS) return res.status(403).send('forbidden');
  const rec = load().find(r => r.id === req.params.id);
  if (!rec || !rec.file) return res.status(404).send('not found');
  res.setHeader('Content-Type', rec.fileMime || 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(rec.fileName || rec.file) + '"');
  fs.createReadStream(path.join(FILES, rec.file)).pipe(res);
});

/* ── админ-панель ── */
app.get('/admin', (req, res) => {
  const key = req.query.key || '';
  if (key !== ADMIN_PASS) return res.send(loginPage());
  const all = load().slice().reverse();
  const profiles = all.filter(r => r.kind === 'profile');
  const hw = all.filter(r => r.kind !== 'profile');
  res.send(adminPage(profiles, hw, key));
});

app.get('/', (req, res) => res.send('Фокус ИИ — приём домашних заданий. Куратор: /admin'));
app.listen(process.env.PORT || 3000, () => console.log('homework up'));

/* ── HTML ── */
function shell(body) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Фокус ИИ — Домашние задания</title>
<link rel="icon" type="image/png" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAEWklEQVR4nMWXS4hcRRSGv1N1u2emH/fOIzMaY3RExSEYBeODiK6yUFBQHDU7s8gIcaEIAUV8gEi2CroK0aUbcQRDNoIiaiSCECUoBEPiTAYyOslM953unp7u23WPi9ttOrE784rJv7rUrar/r6pz/jolJLCAC4KeUdHUKwpPAqOABwgbgwINYErgiEr0YRjWplqc0vrw/ezzgnwkIiOqukHOzhARVHVO0ZcXFyufAVYAgiA3LsjnTWIHGDa+8suhQAxYEUHRZ8OwPCkDA71bXcOeEJGg1eEqE18OBxhVDa3n7jHOefuNMf3XiJwmR2yM6XfO2y9+PntGREabP6/2tneDAqjqlAR+rsE6Vm4NiFyczbl1CXHeWsmFhLhYUmKXNIiBIJeoWWMCWW9VpALGAAqRgyiC1/b0sPUGQRVmLyjvf1rH8yBlE1FxvDoxKwqwJiEtlhRrYMAXNm8SXhpPccvtBhTOnY354tuI8wWlsKg4B/mskPLAxSssLvBzXXVaA6UlpT8nPLPL4/GdHmO3GoYCoSd9abzWImUhhJPTjq+OOSa/iSiUlHxGriiiq4AW+c7tloNv9TF2h4GIJOJSUKsojTiJCWOgNyuJ4SqQhj9Ox+w7UOWHXx1+truIjgJEoB7BlhHhx48zDA8ZiqGSzybn/fPvjofutgwFyS4USsqxE477t1luGhZKFej3hQtF5dG9Fab/VnpTEHdYqum2+qWqMvFUiuEbDfMFxfeFI0cbPLinwvjrVc6dV1IeeBb+mleee6PKAy9U+PK7Br4vzBeVTSPCxNNpqlVNgrgDOjbHCum0sGPMonVIp6BeU947VGf2gjLoCzaJP7R5BIO+MFdQ3j1UZ3lZ6UmB1uC+MUNPWoi7HEFHAaqQ8iCXEYgVz0JYUoplJZ8VGq5pZW1oNJL+ixWluKh4XjJRLiOkumx/VwECRA0oVxVMQhjkhSAnlCqJoMs927NQXlL8jNCfFxoNQIRKVYkiMF1MvqMAY6BeV46fdEg6Cch0j/D2RJrNm4SFRcU1M0BITGehpIwMCO+8mKa3T6hFID1w/GRMrd49BjpmgRGoRXDziHD0kwzDgx2yYLtlyL80C3Zss2xpy4L5UHlkb4XpWaU33fkYruwDFeXhey0H3+zjrjX6wKkzMfsOLPP9L421+8AlIppOOL4rxWM7LWOjlqEA+tKSsDdHV+ttTviTY/LriIVSEhPrcsJ2EZGDUlmxNrkLBgPhyAcZ7rxNQOHPGeWJV5c4X1QK4drughUvIxcnIgb7E7JaBNOzym+nHXFsUIVTMzFT55LUC3KCSDJuJfJV7cB/BrSnU2tkW9taC+pV1QPtaCf4l38DVbwhqVLXhZYPbADOqOpZLtr6tYICqqpnDSKHRURIyvJrhVhEBJHD1/9hUigsz4iRieYu2GaH/+M4tDm3FRERIxOFwvKMAWwYlidjjXcDcyLSrGuvOqQ591ys8e4wLE/SepxyHZ/n/wCf6hOQy5rbSwAAAABJRU5ErkJggg==">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0F0E0C;color:#F4ECD8;font-family:-apple-system,Segoe UI,Inter,sans-serif;padding:24px;line-height:1.5}
a{color:#F5C518}
.wrap{max-width:1000px;margin:0 auto}
h1{font-size:26px;margin-bottom:4px}.sub{color:rgba(244,236,216,.55);font-size:13px;margin-bottom:24px}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.12em;color:#F5C518;margin:30px 0 12px}
.card{background:#17150F;border:1px solid #33301f;border-radius:12px;padding:16px 18px;margin-bottom:10px}
.row{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.who{font-weight:600}.meta{color:rgba(244,236,216,.5);font-size:12px;font-family:monospace}
.tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:20px;border:1px solid #33301f;color:rgba(244,236,216,.7);margin-left:6px}
.tag-hw{border-color:#F5C518;color:#F5C518;background:rgba(245,197,24,.08)}
.content{margin-top:8px;white-space:pre-wrap;word-break:break-word;color:rgba(244,236,216,.85)}
.dl{display:inline-block;margin-top:8px;background:#F5C518;color:#0F0E0C;text-decoration:none;font-weight:600;padding:8px 16px;border-radius:8px;font-size:13px}
.empty{color:rgba(244,236,216,.4);font-size:14px}
input{background:#17150F;border:1px solid #33301f;color:#F4ECD8;padding:12px 14px;border-radius:10px;font-size:15px;width:100%;max-width:320px}
button{background:#F5C518;color:#0F0E0C;border:none;font-weight:600;padding:12px 24px;border-radius:10px;font-size:15px;cursor:pointer;margin-top:12px}
.people{background:#17150F;border:1px solid #33301f;border-radius:12px;padding:14px 16px;display:flex;flex-wrap:wrap;gap:8px}
.person{font-size:13px;background:#211E16;border:1px solid #33301f;border-radius:20px;padding:5px 12px;white-space:nowrap}
.person b{color:#F4ECD8;font-weight:600}.person span{color:rgba(244,236,216,.5)}
.daypick{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
.dchip{background:#17150F;border:1px solid #33301f;color:rgba(244,236,216,.7);border-radius:20px;padding:8px 15px;font-size:13px;cursor:pointer;margin:0;font-weight:500;transition:all .15s}
.dchip:hover{border-color:#F5C518}
.dchip.active{background:#F5C518;color:#0F0E0C;border-color:#F5C518;font-weight:700}
.dchip b{font-weight:700;opacity:.6;margin-left:4px}
.dchip.active b{opacity:.8}
</style></head><body><div class="wrap">${body}</div></body></html>`;
}
function loginPage() {
  return shell(`<h1>Фокус ИИ · Куратор</h1><p class="sub">Введите пароль доступа.</p>
  <form method="get" action="/admin"><input name="key" type="password" placeholder="Пароль куратора" autofocus><br><button>Войти</button></form>`);
}
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function dayLabel(iso) {            // 'YYYY-MM-DD' → '14 июня 2026'
  const [y, m, d] = iso.slice(0, 10).split('-');
  return parseInt(d, 10) + ' ' + (MONTHS[parseInt(m, 10) - 1] || m) + ' ' + y;
}
function adminPage(profiles, hw, key) {
  // последний профиль на участника (по имени)
  const seen = {};
  profiles.forEach(p => { if (!seen[p.name]) seen[p.name] = p.sphere; });
  const names = Object.keys(seen);
  const people = names.length
    ? `<div class="people">${names.map(n => `<span class="person"><b>${esc(n)}</b> <span>· ${esc(seen[n]) || '—'}</span></span>`).join('')}</div>`
    : '<p class="empty">Пока никто не заполнил профиль.</p>';

  // домашки по дате сдачи (новые сверху)
  const byDay = {};
  hw.forEach(r => { const k = r.at.slice(0, 10); (byDay[k] = byDay[k] || []).push(r); });
  const days = Object.keys(byDay).sort().reverse();
  const card = r => {
    const dl = r.file ? `<a class="dl" href="/file/${r.id}?key=${encodeURIComponent(key)}">↓ Скачать ${esc(r.fileName) || 'файл'}</a>` : '';
    const body = r.type === 'link' ? `<a href="${esc(r.content)}" target="_blank">${esc(r.content)}</a>` : esc(r.content);
    const hwTag = r.homework ? `<span class="tag tag-hw">${esc(r.homework)}</span>` : '';
    return `<div class="card"><div class="row"><span class="who">${esc(r.name)}<span class="tag">${esc(r.module)}</span>${hwTag}<span class="tag">${esc(r.type)}</span></span><span class="meta">${esc(r.at.slice(11, 16))}</span></div>${body ? `<div class="content">${body}</div>` : ''}${dl}</div>`;
  };
  let works;
  if (!days.length) {
    works = '<p class="empty">Домашних заданий пока нет.</p>';
  } else {
    const chips = `<div class="daypick">` +
      `<button class="dchip" data-day="all">Все дни <b>${hw.length}</b></button>` +
      days.map((d, i) => `<button class="dchip${i === 0 ? ' active' : ''}" data-day="${d}">${dayLabel(d)} <b>${byDay[d].length}</b></button>`).join('') +
      `</div>`;
    const groups = days.map((d, i) => `<div class="daygroup" data-day="${d}"${i === 0 ? '' : ' hidden'}>${byDay[d].map(card).join('')}</div>`).join('');
    const js = `<script>(function(){var ch=document.querySelectorAll('.dchip'),gr=document.querySelectorAll('.daygroup');ch.forEach(function(c){c.addEventListener('click',function(){ch.forEach(function(x){x.classList.remove('active')});c.classList.add('active');var d=c.dataset.day;gr.forEach(function(g){g.hidden=(d!=='all'&&g.dataset.day!==d)});});});})();</script>`;
    works = chips + groups + js;
  }

  return shell(`<h1>Фокус ИИ · Домашние задания</h1><p class="sub">Всего работ: ${hw.length} · участников: ${names.length}</p>
  <h2>Участники</h2>${people}<h2>Работы — выбери день сдачи</h2>${works}`);
}
