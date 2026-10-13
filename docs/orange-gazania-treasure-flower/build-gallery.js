#!/usr/bin/env node
/* Builds the self-contained gallery page from ./images + manifest.json.
   All CSS colors are pink/purple shades only (rose-pink accent). No external assets, no runtime fetch. */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');           // web/orange-gazania-treasure-flower -> /var/www/html
const imgDir = path.join(__dirname, 'images');
const manifestPath = path.join(imgDir, 'manifest.json');
const outPath = path.join(__dirname, 'index.html');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Stable numeric order: img-001 .. img-100
const keys = Object.keys(manifest).sort((a, b) => {
  const na = Number(a.match(/img-(\d+)\.svg$/)[1]);
  const nb = Number(b.match(/img-(\d+)\.svg$/)[1]);
  return na - nb;
});

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const fmtBytes = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function inlineSvg(filename) {
  let svg = fs.readFileSync(path.join(imgDir, filename), 'utf8');
  const si = svg.indexOf('<svg');
  if (si !== -1) svg = svg.slice(si);   // drop <?xml?> declaration + comment
  svg = svg.replace(/\ns+/g, ' ').trim();
  // Inject viewBox matching width/height attributes so the SVG scales
  // correctly when rendered at a different size via CSS (otherwise only
  // a portion of the image displays in preview/modal).
  svg = svg.replace(/<svg([^>]*?)\swidth="(\d+)"([^>]*?)\sheight="(\d+)"([^>]*?)>/,
    (m, p1, w, p2, h, p3) => `<svg viewBox="0 0 ${w} ${h}"${p1}${p2}${p3}>`);
  if (!/viewBox=/i.test(svg)) {
    // fallback: if no width/height, just prepend viewBox (1512x2016 for orange-gazania)
    svg = svg.replace('<svg', '<svg viewBox="0 0 1512 2016"');
  }
  return svg;
}

// --- card markup ---
const cards = keys.map((k, i) => {
  const e = manifest[k];
  const svg = inlineSvg(k);
  return `
    <div class="card" data-idx="${i + 1}">
      <div class="preview">${svg}</div>
      <div class="meta">
        <span class="size">${fmtBytes(e.size_bytes)} bytes</span>
        <code class="settings">${esc(e.settings)}</code>
      </div>
    </div>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Orange Gazania Treasure Flower — SVG Style Gallery</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='%23f43f5e'/%3E%3C/svg%3E" type="image/svg+xml">
<style>
  :root{
    --bg:#fff1f2;        /* pink-50 (very light, rose-leaning) */
    --card:#ffe4e6;      /* rose-100 */
    --border:#f43f5e;    /* rose-500 */
    --accent:#f43f5e;    /* rose-500 (interactive) */
    --accent-2:#db2777;  /* pink-600 (interactive) */
    --text:#581c87;      /* purple-900 */
    --muted:#be185d;     /* pink-800 / magenta */
    --badge:#fff1f2;     /* pink-50 */
    --paper:#fff5fb;     /* pink-50 (light pink, for text/background) */
    --header:#581c87;    /* very dark purple */
    --header-2:#7012a0;  /* purple-900 */
  }
  *{box-sizing:border-box}
  body{
    margin:0; background:var(--bg); color:var(--text);
    font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
    -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
  }
  header{
    background:linear-gradient(135deg,var(--header),var(--header-2));
    color:var(--paper); padding:1.5rem 1rem; text-align:center;
  }
  header h1{font-size:1.6rem; margin:0; letter-spacing:.02em}
  header p{font-size:.9rem; opacity:.9;margin:.25rem 0 0}
  main{max-width:1200px;margin:1.5rem auto;padding:0 1rem}
  .grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(160px,1fr));
    gap:1rem;
  }
  .card{
    background:var(--card); border:1.5px solid var(--border);
    border-radius:.6rem; padding:.75rem; cursor:pointer;
    transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease;
    display:flex; flex-direction:column; gap:.45rem;
  }
  .card:hover{transform:translateY(-2px); box-shadow:0 6px 14px rgba(88,28,135,.15); border-color:var(--accent)}
  .preview{width:100%; height:110px; display:flex; align-items:center; justify-content:center;
    background:var(--paper); border-radius:.35rem; overflow:hidden;}
  .preview svg{max-width:100%; max-height:100%; width:auto; height:auto;
    display:block;}
  .meta{display:flex;flex-direction:column;gap:.15rem}
  .size{font-size:.8rem;font-weight:600;color:var(--muted)}
  .settings{font-size:.62rem;line-height:1.2;color:var(--text);
    word-break:break-all;background:var(--badge);padding:.3rem .35rem;border-radius:.25rem}
  /* popup modal */
  .modal{
    position:fixed; inset:0; background:rgba(244,63,94,.5); /* rose-500 50% */
    display:none; align-items:center; justify-content:center; z-index:1000;
  }
  .modal.open{display:flex}
  .modal-content{
    position:relative; background:var(--card); border:2px solid var(--border);
    border-radius:.8rem; max-width:90vw; max-height:90vh; width:90%; padding:1rem;
  }
  .modal .modal-svg{width:100%; height:80vh; display:flex; align-items:center;
    justify-content:center; background:var(--paper); border-radius:.4rem; overflow:auto;}
  .modal .modal-svg svg{max-width:100%; max-height:100%; width:auto; height:auto;
    display:block;}
  .close{
    position:absolute; top:-.55rem; right:-.55rem;
    background:var(--accent-2); color:var(--paper); border:none; border-radius:50%;
    width:32px; height:32px; font-size:1.2rem; line-height:1; cursor:pointer;
    box-shadow:0 2px 8px rgba(219,39,119,.4);
  }
  footer{text-align:center;color:var(--muted);font-size:.8rem;margin:2rem 0 3rem}
</style>
</head>
<body>
<header>
  <h1>Orange Gazania Treasure Flower — SVG Style Gallery</h1>
  <p>100 vectorizations of a flower photo via vtracer &middot; every style under 300KB</p>
</header>
<main>
  <div class="grid">
${cards}
  </div>
  <footer>Each card lists its byte size and the exact vtracer settings used.</footer>
</main>

<div id="modal" class="modal" aria-hidden="true">
  <div class="modal-content">
    <button class="close" aria-label="Close preview">×</button>
    <div class="modal-svg"></div>
  </div>
</div>

<script>
(function(){
  const modal=document.getElementById('modal');
  const slot=modal.querySelector('.modal-svg');
  let active=null;
  function open(card){
    const src=card.querySelector('svg');
    if(!src) return;
    slot.innerHTML='';
    const clone=src.cloneNode(true);
    slot.appendChild(clone);
    active=card;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }
  function close(){
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    slot.innerHTML='';
    active=null;
    document.body.style.overflow='';
  }
  document.querySelectorAll('.card').forEach(c=>c.addEventListener('click',()=>open(c)));
  modal.querySelector('.close').addEventListener('click',close);
  modal.addEventListener('click',e=>{ if(e.target===modal) close(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && modal.classList.contains('open')) close(); });
})();
</script>
</body>
</html>
`;

fs.writeFileSync(outPath, html, 'utf8');
console.log('Wrote', outPath, '(', html.length, 'bytes )');
console.log('Cards:', keys.length);
