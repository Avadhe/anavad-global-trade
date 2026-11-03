(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);

  /* ---------- footer year + sticky nav ---------- */
  $('#yr').textContent = new Date().getFullYear();
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- products (from the FastAPI backend, with offline fallback) ---------- */
  const FALLBACK = [
    { id: 'spices', name: 'Spices & Herbs', direction: 'Export', icon: 'bi-flower2', items: ['Turmeric', 'Cumin', 'Red chilli'], note: 'Whole and ground.' },
    { id: 'grains', name: 'Rice, Pulses & Grains', direction: 'Export', icon: 'bi-basket3', items: ['Basmati rice', 'Lentils', 'Wheat'], note: 'Bulk and private label.' },
    { id: 'textiles', name: 'Textiles & Apparel', direction: 'Export', icon: 'bi-layers', items: ['Cotton fabrics', 'Garments'], note: 'Certified mills.' },
    { id: 'electronics', name: 'Electronics & Components', direction: 'Import', icon: 'bi-cpu', items: ['LED lighting', 'Components'], note: 'Audited manufacturers.' }
  ];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const grid = $('#productGrid');
  const select = $('#product');
  let products = [];

  function renderProducts(filter = 'all') {
    grid.innerHTML = products
      .filter(p => filter === 'all' || p.direction === filter)
      .map(p => `
        <div class="col-md-6 col-lg-3">
          <article class="prod">
            <span class="tag">${esc(p.direction)}</span>
            <i class="bi ${esc(p.icon)}"></i>
            <h3>${esc(p.name)}</h3>
            <ul>${p.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
            <p class="note">${esc(p.note)}</p>
            <a href="#quote" data-pick="${esc(p.name)}">Request a quote for this</a>
          </article>
        </div>`).join('');
  }

  async function loadProducts() {
    try {
      const r = await fetch('/api/products');
      if (!r.ok) throw new Error();
      products = await r.json();
    } catch { products = FALLBACK; }
    renderProducts();
    select.innerHTML = '<option value="" disabled selected>Choose a category</option>' +
      products.map(p => `<option>${esc(p.name)}</option>`).join('') + '<option>Other (tell us below)</option>';
  }
  loadProducts();

  document.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProducts(btn.dataset.filter);
  }));
  grid.addEventListener('click', e => {
    const a = e.target.closest('[data-pick]');
    if (a) select.value = a.dataset.pick;
  });

  /* ---------- quote form ---------- */
  const form = $('#quoteForm'), msg = $('#formMsg'), btn = $('#sendBtn');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.innerHTML = '';
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = Array.isArray(data.detail) ? data.detail.map(d => d.msg).join('. ') : data.detail;
        throw new Error(detail || 'Something went wrong. Please check the form and try again.');
      }
      msg.innerHTML = `<div class="ok">Request received. Your reference is <strong>${esc(data.reference)}</strong>. We will reply within 24 hours.</div>`;
      form.reset();
    } catch (err) {
      msg.innerHTML = `<div class="err">${esc(err.message)}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = 'Send my request';
    }
  });

  /* ---------- hero: live trade lanes ---------- */
  const cv = $('#lanes'), ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ORIGIN = { n: 'Nhava Sheva', lat: 18.95, lon: 72.95 };
  const PORTS = [
    { n: 'Rotterdam', lat: 51.9, lon: 4.5 }, { n: 'Dubai', lat: 25.2, lon: 55.3 },
    { n: 'Singapore', lat: 1.3, lon: 103.8 }, { n: 'Shanghai', lat: 31.2, lon: 121.5 },
    { n: 'Sydney', lat: -33.9, lon: 151.2 }, { n: 'Lagos', lat: 6.5, lon: 3.4 },
    { n: 'New York', lat: 40.7, lon: -74 }, { n: 'Los Angeles', lat: 34, lon: -118.2 },
    { n: 'Santos', lat: -23.9, lon: -46.3 }
  ];
  let W, H, dpr, lanes;
  const proj = p => [(p.lon + 180) / 360 * W, (62 - p.lat) / 112 * H * .9 + H * .06];

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const o = proj(ORIGIN);
    lanes = PORTS.map((p, i) => {
      const t = proj(p), mx = (o[0] + t[0]) / 2, my = (o[1] + t[1]) / 2 - Math.hypot(t[0] - o[0], t[1] - o[1]) * .22;
      return { p, o, t, c: [mx, my], phase: i / PORTS.length, speed: .0001 + (i % 3) * .00003 };
    });
    if (reduce) draw(0);
  }
  const bez = (l, u) => {
    const a = (1 - u) ** 2, b = 2 * (1 - u) * u, c = u * u;
    return [a * l.o[0] + b * l.c[0] + c * l.t[0], a * l.o[1] + b * l.c[1] + c * l.t[1]];
  };

  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    // graticule dots
    ctx.fillStyle = 'rgba(120,180,200,.16)';
    for (let x = 20; x < W; x += 30) for (let y = 20; y < H; y += 30) ctx.fillRect(x, y, 1.5, 1.5);
    ctx.font = '12px "DM Sans", sans-serif';
    lanes.forEach(l => {
      // route
      ctx.beginPath(); ctx.moveTo(...l.o); ctx.quadraticCurveTo(...l.c, ...l.t);
      ctx.strokeStyle = 'rgba(63,208,201,.35)'; ctx.lineWidth = 1.2; ctx.setLineDash([4, 6]); ctx.stroke(); ctx.setLineDash([]);
      // moving cargo
      const u = reduce ? .5 : (time * l.speed + l.phase) % 1;
      const [x, y] = bez(l, u);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
      g.addColorStop(0, 'rgba(242,163,58,.95)'); g.addColorStop(1, 'rgba(242,163,58,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.fill();
      // port
      ctx.fillStyle = '#3fd0c9'; ctx.beginPath(); ctx.arc(l.t[0], l.t[1], 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText(l.p.n, l.t[0] + 8, l.t[1] + 4);
    });
    // origin
    const pr = reduce ? 0 : (time / 900) % 1;
    ctx.strokeStyle = `rgba(242,163,58,${1 - pr})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(lanes[0].o[0], lanes[0].o[1], 6 + pr * 22, 0, 7); ctx.stroke();
    ctx.fillStyle = '#f2a33a'; ctx.beginPath(); ctx.arc(lanes[0].o[0], lanes[0].o[1], 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 13px "DM Sans", sans-serif';
    ctx.fillText(ORIGIN.n + ', India', lanes[0].o[0] + 12, lanes[0].o[1] - 10);
  }

  let raf, visible = true;
  const loop = t => { if (visible) draw(t); raf = requestAnimationFrame(loop); };
  new IntersectionObserver(([e]) => visible = e.isIntersecting).observe(cv);
  window.addEventListener('resize', resize);
  resize();
  if (!reduce) raf = requestAnimationFrame(loop);
})();
