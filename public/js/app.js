// Versos de Oro · la casa de los poetas
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LS = { get(k, d) { try { const v = localStorage.getItem("vdo." + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem("vdo." + k, JSON.stringify(v)); } catch { } } };
function toast(m, ms = 2400) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, ms); }
const TEMAS = { amor: "Amor", desamor: "Desamor", vida: "Vida", muerte: "Muerte", soledad: "Soledad", esperanza: "Esperanza", naturaleza: "Naturaleza", fe: "Fe", tierra: "Mi tierra", libre: "Tema libre" };
const I = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  pen: '<path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 6l3 3"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-4a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h5z"/>',
  oro: '<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/>',
  share: '<path d="M12 3v13"/><path d="M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  img: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 16l-5-5-9 9"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  dl: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>'
};
const ico = (k, fill) => `<svg viewBox="0 0 24 24" fill="${fill ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
const st = { poemas: [], dia: null, ready: false, tema: "", q: "", orden: "nuevos", sesion: LS.get("sesion", null), oros: LS.get("oros", []), size: LS.get("size", 22), centro: LS.get("centro", false) };
const device = LS.get("device", null) || (() => { const d = "d" + crypto.getRandomValues(new Uint32Array(3)).join("-"); LS.set("device", d); return d; })();
const byId = id => st.poemas.find(p => p.id === id);
const fecha = t => new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
const hace = t => { const m = (Date.now() - t) / 6e4; if (m < 60) return "hace " + Math.max(1, Math.round(m)) + " min"; const h = m / 60; if (h < 24) return "hace " + Math.round(h) + " h"; const d = h / 24; if (d < 7) return "hace " + Math.round(d) + (Math.round(d) === 1 ? " día" : " días"); return new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "short" }); };

async function api(path, method = "GET", body, auth) {
  const h = { "content-type": "application/json" }; if (auth && st.sesion) h.authorization = "Bearer " + st.sesion.token;
  const r = await fetch("/api/" + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && auth) { st.sesion = null; LS.set("sesion", null); }
  if (!r.ok) { const e = new Error(d.error || "Algo salió mal"); e.status = r.status; throw e; } return d;
}
async function load() {
  try { const d = await api("poemas"); st.poemas = d.poemas; st.dia = d.dia; } catch { toast("Sin conexión. Te muestro lo que ya habías visto."); }
  st.ready = true; route();
}

/* ================= piezas ================= */
const topbar = () => `<div class="top"><a class="brand" href="#/"><img src="/icons/versos-192.png" alt=""><span><b>Versos de Oro</b><small>La casa de los poetas</small></span></a>${st.sesion ? `<a class="btn sm ghost" href="#/cuaderno">${esc(st.sesion.poeta.alias)}</a>` : `<a class="btn sm ghost" href="#/cuaderno">Entrar</a>`}</div>`;
const card = p => `<a class="pc" href="#/poema/${p.id}"><h3>${esc(p.titulo)}</h3><div class="v">${esc(p.texto)}</div>
  <div class="ft"><span>de <b>${esc(p.alias)}</b> · ${hace(p.pubAt)}</span><span class="oro">${ico("oro", 1)}${p.oros}</span></div></a>`;
function tabbar(cur) {
  const t = (h, k, n) => `<a href="${h}" ${cur === h ? 'aria-current="page"' : ""}>${ico(k)}<span>${n}</span></a>`;
  $("#tabbar").innerHTML = cur === null ? "" : t("#/", "home", "Inicio") + t("#/explorar", "search", "Explorar") + `<a class="pen" href="#/escribir" ${cur === "#/escribir" ? 'aria-current="page"' : ""}><span class="c">${ico("pen")}</span><span>Escribir</span></a>` + t("#/oros", "oro", "Mis oros") + t("#/cuaderno", "book", "Cuaderno");
}

/* ================= inicio ================= */
function home() {
  const P = st.poemas, d = byId(st.dia), top = [...P].sort((a, b) => b.oros - a.oros).filter(p => p.oros > 0).slice(0, 10);
  const poetas = Object.values(P.reduce((m, p) => { (m[p.autor] ||= { slug: p.autor, alias: p.alias, n: 0, oros: 0 }); m[p.autor].n++; m[p.autor].oros += p.oros; return m; }, {})).sort((a, b) => b.oros - a.oros || b.n - a.n).slice(0, 12);
  return `<div class="wrap">${topbar()}
    ${d ? `<a class="dia" href="#/poema/${d.id}"><span class="q">“</span><span class="lbl">✦ Poema del día</span><h1>${esc(d.titulo)}</h1><div class="v">${esc(d.texto)}</div><div class="by">de <b>${esc(d.alias)}</b> · <span class="oro">${ico("oro", 1)}${d.oros}</span></div></a>`
      : `<div class="dia"><span class="lbl">✦ Bienvenido</span><h1>Aquí empieza la casa de los poetas</h1><div class="v">Escribe tu primer poema y ocupa el primer lugar en Versos de Oro.</div><div style="margin-top:16px"><a class="btn gold-b" href="#/escribir">${ico("pen")}Escribir un poema</a></div></div>`}
    <div class="orn"><span>Temas</span></div>
    <div class="chips">${Object.entries(TEMAS).map(([k, n]) => `<a href="#/explorar?tema=${k}">${n}</a>`).join("")}</div>
    ${P.length ? `<h2 class="sec">Recién publicados <a href="#/explorar">Ver todos</a></h2><div class="list">${P.slice(0, 6).map(card).join("")}</div>` : ""}
    ${top.length ? `<h2 class="sec">Los más queridos</h2><div class="row">${top.map(card).join("")}</div>` : ""}
    ${poetas.length ? `<h2 class="sec">Poetas de la casa</h2><div class="chips">${poetas.map(u => `<a href="#/poeta/${u.slug}" style="text-transform:none">${esc(u.alias)} <span class="oro" style="margin-left:4px">${ico("oro", 1)}${u.oros}</span></a>`).join("")}</div>` : ""}
    <div class="box" style="margin-top:26px;text-align:center"><p style="font:600 italic 21px/1.45 var(--serif);margin:0 0 12px">¿Tienes versos guardados en un cuaderno?<br>Aquí los lee todo el mundo.</p><a class="btn gold-b" href="#/escribir">${ico("pen")}Publicar mi poema</a></div>
    ${installBox()}
  </div>`;
}

/* ================= explorar ================= */
function explorar(params) {
  if (params) { st.tema = params.get("tema") || ""; }
  return `<div class="wrap">${topbar()}
    <label class="search">${ico("search")}<input id="q" type="search" placeholder="Busca un verso, título o poeta…" value="${esc(st.q)}" autocomplete="off"></label>
    <div class="chips"><button data-t="" aria-pressed="${!st.tema}">Todos</button>${Object.entries(TEMAS).map(([k, n]) => `<button data-t="${k}" aria-pressed="${st.tema === k}">${n}</button>`).join("")}</div>
    <div class="tabs2"><button data-o="nuevos" aria-pressed="${st.orden === "nuevos"}">Más nuevos</button><button data-o="oros" aria-pressed="${st.orden === "oros"}">Más queridos</button></div>
    <div id="res"></div></div>`;
}
function results() {
  const n = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const w = n(st.q).split(/\s+/).filter(Boolean);
  let L = st.poemas.filter(p => (!st.tema || p.tema === st.tema) && w.every(x => n(p.titulo + " " + p.alias + " " + p.texto).includes(x)));
  if (st.orden === "oros") L = [...L].sort((a, b) => b.oros - a.oros);
  $("#res").innerHTML = L.length ? `<p class="note">${L.length} ${L.length === 1 ? "poema" : "poemas"}</p><div class="list">${L.map(card).join("")}</div>` : `<p class="empty">Aún no hay poemas aquí.<br>Puede ser el tuyo el primero.</p>`;
}
function bindExplorar() {
  const q = $("#q"); q.oninput = () => { st.q = q.value; results(); };
  document.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { st.tema = b.dataset.t; document.querySelectorAll("[data-t]").forEach(x => x.setAttribute("aria-pressed", x === b)); results(); });
  document.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { st.orden = b.dataset.o; document.querySelectorAll("[data-o]").forEach(x => x.setAttribute("aria-pressed", x === b)); results(); });
  results();
}

/* ================= leer un poema ================= */
function leer(id, p) {
  if (!p) return `<div class="wrap"><p class="empty">Este poema no existe o fue retirado.</p><a class="btn wide" href="#/">Volver al inicio</a></div>`;
  const dado = st.oros.includes(p.id);
  return `<div class="wrap read">
    <button class="bk" id="bk">${ico("back")}Regresar</button>
    <div style="text-align:center;margin-top:10px"><span class="tema">${esc(TEMAS[p.tema] || "Libre")}</span></div>
    <h1>${esc(p.titulo)}</h1>
    <div class="au">de <a href="#/poeta/${esc(p.autor)}">${esc(p.alias)}</a> · ${fecha(p.pubAt)}</div>
    <div class="poem ${st.centro ? "c" : ""}" id="poem" style="font-size:${st.size}px">${esc(p.texto)}</div>
    <div class="fin">✦ ✦ ✦</div>
    <div class="tsize"><button class="btn sm" data-sz="-2" aria-label="Letra más chica">A−</button><button class="btn sm" data-sz="2" aria-label="Letra más grande">A+</button><button class="btn sm" id="bC" aria-pressed="${st.centro}">Centrar versos</button></div>
    <div class="bar"><button class="btn oro-b" id="bOro" aria-pressed="${dado}">${ico("oro", 1)}<span>${p.oros}</span></button><button class="btn" id="bImg">${ico("img")}Imagen</button><button class="btn" id="bSh">${ico("share")}Compartir</button></div>
  </div>`;
}
function afterLeer(p) {
  $("#bk").onclick = () => history.length > 1 ? history.back() : (location.hash = "#/");
  if (!p) return;
  document.querySelectorAll("[data-sz]").forEach(b => b.onclick = () => { st.size = Math.max(16, Math.min(32, st.size + +b.dataset.sz)); LS.set("size", st.size); $("#poem").style.fontSize = st.size + "px"; });
  $("#bC").onclick = e => { st.centro = !st.centro; LS.set("centro", st.centro); $("#poem").classList.toggle("c", st.centro); e.currentTarget.setAttribute("aria-pressed", st.centro); };
  $("#bOro").onclick = async e => {
    const b = e.currentTarget; b.disabled = true;
    try { const r = await api("oro/" + p.id, "POST", { device }); p.oros = r.oros; st.oros = r.dado ? [...new Set([...st.oros, p.id])] : st.oros.filter(x => x !== p.id); LS.set("oros", st.oros);
      b.setAttribute("aria-pressed", r.dado); b.querySelector("span").textContent = r.oros; if (r.dado) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); toast("Le diste un oro a este poema"); } }
    catch (x) { toast(x.message); } b.disabled = false;
  };
  $("#bSh").onclick = async () => { const url = location.origin + "/#/poema/" + p.id; try { if (navigator.share) await navigator.share({ title: p.titulo + " · Versos de Oro", text: `«${p.titulo}», de ${p.alias}`, url }); else { await navigator.clipboard.writeText(url); toast("Link copiado"); } } catch { } };
  $("#bImg").onclick = () => tarjeta(p);
}

/* ================= tarjeta para redes (negro y oro) ================= */
async function tarjeta(p) {
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  try { await Promise.all(["700 70px 'Cormorant Garamond'", "500 40px 'Cormorant Garamond'", "italic 500 40px 'Cormorant Garamond'", "700 28px Manrope"].map(f => document.fonts.load(f))); } catch { }
  x.fillStyle = "#0b0a08"; x.fillRect(0, 0, W, H);
  const rg = x.createRadialGradient(W / 2, -100, 50, W / 2, -100, 1100); rg.addColorStop(0, "#3a2e15"); rg.addColorStop(1, "#0b0a0800"); x.fillStyle = rg; x.fillRect(0, 0, W, H);
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#f6e3a1"); g.addColorStop(.4, "#d9b45a"); g.addColorStop(.72, "#a8822f"); g.addColorStop(1, "#e8cc7a");
  x.strokeStyle = g; x.lineWidth = 3; x.strokeRect(48, 48, W - 96, H - 96); x.lineWidth = 1; x.strokeRect(62, 62, W - 124, H - 124);
  x.textAlign = "center"; x.fillStyle = g; x.font = "700 26px Manrope"; x.letterSpacing = "6px"; x.fillText("VERSOS DE ORO", W / 2, 132); x.letterSpacing = "0px";
  const wrap = (t, max, font) => { x.font = font; const out = []; for (const ln of String(t).split("\n")) { if (!ln.trim()) { out.push(""); continue; } let cur = ""; for (const w of ln.split(/\s+/)) { const tr = cur ? cur + " " + w : w; if (x.measureText(tr).width > max && cur) { out.push(cur); cur = w; } else cur = tr; } out.push(cur); } return out; };
  const tl = wrap(p.titulo, W - 220, "700 70px 'Cormorant Garamond'").slice(0, 2);
  let y = 240; x.fillStyle = g; x.font = "700 70px 'Cormorant Garamond'"; tl.forEach(l => { x.fillText(l, W / 2, y); y += 76; });
  x.fillStyle = "#a8822f"; x.font = "500 30px 'Cormorant Garamond'"; x.fillText("✦", W / 2, y + 4); y += 66;
  // el poema: busca el tamaño de letra que quepa
  let fs = 44, lines, lh; const room = H - y - 210;
  for (; fs >= 24; fs -= 2) { lines = wrap(p.texto, W - 240, `500 ${fs}px 'Cormorant Garamond'`); lh = fs * 1.42; if (lines.length * lh <= room) break; }
  let cut = false; if (lines.length * lh > room) { lines = lines.slice(0, Math.floor(room / lh) - 1); cut = true; }
  x.fillStyle = "#efe6cf"; x.font = `500 ${fs}px 'Cormorant Garamond'`; y += (room - lines.length * lh) / 2 * .8;
  lines.forEach(l => { x.fillText(l, W / 2, y); y += lh; }); if (cut) { x.fillStyle = "#a69d86"; x.fillText("…", W / 2, y); }
  x.fillStyle = g; x.font = "italic 500 40px 'Cormorant Garamond'"; x.fillText("— " + p.alias, W / 2, H - 150);
  x.fillStyle = "#6f6852"; x.font = "600 22px Manrope"; x.fillText(location.host, W / 2, H - 98);
  const blob = await new Promise(r => c.toBlob(r, "image/png")), file = new File([blob], `${p.titulo.replace(/[^\w\sáéíóúñ-]/gi, "").slice(0, 40) || "poema"} - Versos de Oro.png`, { type: "image/png" }), url = URL.createObjectURL(blob);
  const sh = document.createElement("div"); sh.className = "sheet";
  sh.innerHTML = `<div><img src="${url}" alt="Tarjeta del poema"><div class="acts" style="justify-content:center">${navigator.canShare?.({ files: [file] }) ? `<button class="btn gold-b" id="sS">${ico("share")}Mandar a WhatsApp o redes</button>` : ""}<a class="btn" href="${url}" download="${esc(file.name)}">${ico("dl")}Guardar imagen</a><button class="btn" id="sX">Cerrar</button></div></div>`;
  document.body.append(sh);
  sh.onclick = e => { if (e.target === sh) sh.remove(); }; $("#sX").onclick = () => sh.remove();
  const s = $("#sS"); if (s) s.onclick = async () => { try { await navigator.share({ files: [file], title: p.titulo }); } catch { } };
}

/* ================= perfil de un poeta ================= */
async function poeta(slug) {
  const app = $("#app"); app.innerHTML = `<div class="wrap">${topbar()}<p class="empty"><span class="spin"></span></p></div>`;
  try {
    const { poeta: u, poemas } = await api("poeta/" + encodeURIComponent(slug)), oros = poemas.reduce((a, p) => a + p.oros, 0);
    app.innerHTML = `<div class="wrap">${topbar()}<div class="prof"><div class="av">${esc(u.alias[0] || "V").toUpperCase()}</div><h1>${esc(u.alias)}</h1>${u.ciudad ? `<p>${esc(u.ciudad)}</p>` : ""}${u.bio ? `<p style="font:500 italic 19px/1.45 var(--serif);color:#d8cfb6">${esc(u.bio)}</p>` : ""}
      <div class="stats"><div><b>${poemas.length}</b><small>Poemas</small></div><div><b>${oros}</b><small>Oros</small></div><div><b>${new Date(u.at).getFullYear()}</b><small>Desde</small></div></div>
      <button class="btn sm" id="bShP" style="margin-top:8px">${ico("link")}Compartir perfil</button></div>
      <div class="orn"><span>Su obra</span></div><div class="list">${poemas.length ? poemas.map(card).join("") : `<p class="empty">Aún no publica poemas.</p>`}</div></div>`;
    $("#bShP").onclick = async () => { const url = location.origin + "/#/poeta/" + u.slug; try { if (navigator.share) await navigator.share({ title: u.alias + " · Versos de Oro", url }); else { await navigator.clipboard.writeText(url); toast("Link copiado"); } } catch { } };
  } catch (e) { app.innerHTML = `<div class="wrap">${topbar()}<p class="empty">${esc(e.message)}</p></div>`; }
}

/* ================= mis oros ================= */
function oros() {
  const L = st.oros.map(byId).filter(Boolean);
  return `<div class="wrap">${topbar()}<h2 class="sec" style="margin-top:14px">Mis oros</h2><p class="note">Los poemas a los que les diste un oro se quedan aquí para releerlos.</p>
    <div class="list">${L.length ? L.map(card).join("") : `<p class="empty">Cuando un poema te llegue al alma, tócale la estrella dorada.</p>`}</div></div>`;
}

/* ================= cuenta y cuaderno ================= */
function acceso(modo = "entrar", msg = "") {
  return `<div class="wrap">${topbar()}<div class="prof" style="padding-bottom:0"><div class="av">✒</div><h1>${modo === "entrar" ? "Entra a tu cuaderno" : "Hazte poeta de la casa"}</h1><p>${msg || (modo === "entrar" ? "Con tu nombre de poeta y tu contraseña." : "Gratis. Solo necesitas un nombre de poeta y una contraseña.")}</p></div>
    <div class="tabs2"><button data-m="entrar" aria-pressed="${modo === "entrar"}">Ya tengo cuenta</button><button data-m="registro" aria-pressed="${modo === "registro"}">Crear cuenta</button></div>
    <form class="form" id="af" novalidate>
      <label>Nombre de poeta<input id="a_n" maxlength="40" autocomplete="username" placeholder="Así te van a conocer"></label>
      <label>Contraseña<input id="a_c" type="password" minlength="6" autocomplete="${modo === "entrar" ? "current-password" : "new-password"}" placeholder="Mínimo 6 caracteres"></label>
      ${modo === "registro" ? `<label>¿De dónde escribes? (opcional)<input id="a_ci" maxlength="60" placeholder="Ciudad, país"></label><label>Unas palabras sobre ti (opcional)<textarea id="a_b" rows="3" maxlength="300" placeholder="Qué te mueve a escribir…"></textarea></label><input id="a_w" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">` : ""}
      <p class="err" id="a_e"></p>
      <button class="btn gold-b wide" type="submit">${modo === "entrar" ? "Entrar" : "Crear mi cuenta"}</button>
      ${modo === "registro" ? `<p class="note" style="text-align:center">Guarda bien tu contraseña: es la llave de tus poemas.</p>` : ""}
    </form></div>`;
}
function afterAcceso(modo, next) {
  document.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { $("#app").innerHTML = acceso(b.dataset.m); afterAcceso(b.dataset.m, next); });
  $("#af").onsubmit = async e => {
    e.preventDefault(); const b = e.submitter || $("#af button[type=submit]"); b.disabled = true; $("#a_e").textContent = "";
    try {
      const d = modo === "entrar" ? await api("entrar", "POST", { alias: $("#a_n").value, clave: $("#a_c").value })
        : await api("registro", "POST", { alias: $("#a_n").value, clave: $("#a_c").value, ciudad: $("#a_ci").value, bio: $("#a_b").value, web: $("#a_w").value });
      st.sesion = d; LS.set("sesion", d); toast(modo === "entrar" ? "Bienvenido de vuelta, " + d.poeta.alias : "¡Bienvenido a la casa, " + d.poeta.alias + "!");
      next ? next() : route();
    } catch (x) { $("#a_e").textContent = x.message; b.disabled = false; }
  };
}
async function cuaderno() {
  const app = $("#app");
  if (!st.sesion) { app.innerHTML = acceso("entrar"); afterAcceso("entrar"); return; }
  app.innerHTML = `<div class="wrap">${topbar()}<p class="empty"><span class="spin"></span></p></div>`;
  let d; try { d = await api("yo", "GET", null, true); } catch (e) { if (e.status === 401 || e.status === 403) { app.innerHTML = acceso("entrar", e.message); afterAcceso("entrar"); } else app.innerHTML = `<div class="wrap">${topbar()}<p class="empty">${esc(e.message)}</p></div>`; return; }
  const u = d.poeta, P = d.poemas, pub = P.filter(p => p.estado === "publicado"), oros = pub.reduce((a, p) => a + p.oros, 0);
  const borr = LS.get("borrador", null);
  const ET = { publicado: "Publicado", revision: "En revisión", rechazado: "No aprobado", oculto: "Retirado" };
  app.innerHTML = `<div class="wrap">${topbar()}
    <div class="prof"><div class="av">${esc(u.alias[0] || "V").toUpperCase()}</div><h1>${esc(u.alias)}</h1>${u.ciudad ? `<p>${esc(u.ciudad)}</p>` : ""}
      <div class="stats"><div><b>${pub.length}</b><small>Publicados</small></div><div><b>${oros}</b><small>Oros</small></div><div><b>${P.length - pub.length}</b><small>Otros</small></div></div>
      <div class="acts" style="justify-content:center;margin-top:8px"><a class="btn sm" href="#/poeta/${u.slug}">Ver mi perfil público</a><button class="btn sm" id="bPf">Editar perfil</button><button class="btn sm" id="bOut">Salir</button></div></div>
    <form class="form box" id="pf" hidden><label>¿De dónde escribes?<input id="p_ci" maxlength="60" value="${esc(u.ciudad)}"></label><label>Unas palabras sobre ti<textarea id="p_b" rows="3" maxlength="300">${esc(u.bio)}</textarea></label><button class="btn gold-b" type="submit">Guardar</button></form>
    ${borr && (borr.texto || borr.titulo) ? `<div class="box"><b>Tienes un borrador sin publicar</b><p class="note">${esc(borr.titulo || "Sin título")}</p><a class="btn sm gold-b" href="#/escribir">Seguir escribiendo</a></div>` : ""}
    ${d.revisar ? `<p class="note" style="text-align:center;margin-top:14px">Cada poema nuevo pasa por una revisión antes de publicarse, para cuidar la calidad de la casa.</p>` : ""}
    <div class="orn"><span>Mis poemas</span></div>
    <div>${P.length ? P.map(p => `<div class="mine"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h3>${esc(p.titulo)}</h3><span class="estado ${p.estado}">${ET[p.estado] || p.estado}</span></div>
      <small class="note" style="margin:0">${TEMAS[p.tema] || ""} · escrito ${hace(p.at)}${p.estado === "publicado" ? ` · <span class="oro">${ico("oro", 1)}${p.oros}</span>` : ""}</small>
      ${p.nota ? `<p class="note" style="color:#ffb59f">Nota de la revisión: ${esc(p.nota)}</p>` : ""}
      <div class="acts">${p.estado === "publicado" ? `<a class="btn sm" href="#/poema/${p.id}">Leer</a>` : ""}<a class="btn sm" href="#/escribir?id=${p.id}">Editar</a><button class="btn sm" data-del="${p.id}">Borrar</button></div></div>`).join("")
      : `<p class="empty">Tu cuaderno está en blanco.<br>Es el mejor momento para empezar.</p><a class="btn gold-b wide" href="#/escribir">${ico("pen")}Escribir mi primer poema</a>`}</div>
  </div>`;
  st.mios = P;
  $("#bOut").onclick = () => { st.sesion = null; LS.set("sesion", null); toast("Saliste de tu cuenta"); route(); };
  $("#bPf").onclick = () => { $("#pf").hidden = !$("#pf").hidden; };
  $("#pf").onsubmit = async e => { e.preventDefault(); try { const r = await api("yo/perfil", "PUT", { ciudad: $("#p_ci").value, bio: $("#p_b").value }, true); st.sesion.poeta = r.poeta; LS.set("sesion", st.sesion); toast("Perfil guardado"); cuaderno(); } catch (x) { toast(x.message); } };
  document.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { if (b.dataset.k !== "1") { b.dataset.k = "1"; b.textContent = "¿Seguro? Toca otra vez"; return; } try { await api("yo/poemas/" + b.dataset.del, "DELETE", null, true); toast("Poema borrado"); st.poemas = st.poemas.filter(p => p.id !== b.dataset.del); cuaderno(); } catch (x) { toast(x.message); } });
}

/* ================= escribir ================= */
function escribir(params) {
  const id = params?.get("id"), ed = id ? (st.mios || []).find(p => p.id === id) || byId(id) : null;
  if (id && !ed) { location.hash = "#/cuaderno"; return; }
  const p = ed || LS.get("borrador", null) || { titulo: "", texto: "", tema: "amor" };
  const app = $("#app");
  if (!st.sesion) { app.innerHTML = acceso("registro", "Para publicar tus poemas crea tu cuenta de poeta. Es gratis."); afterAcceso("registro", () => { route(); }); return; }
  app.innerHTML = `<div class="wrap">${topbar()}<h2 class="sec" style="margin-top:12px">${ed ? "Editar poema" : "Nuevo poema"}</h2>
    <form class="form" id="wf" novalidate>
      <input class="tit" id="w_t" maxlength="120" placeholder="Título" value="${esc(p.titulo)}" aria-label="Título">
      <label>Tema<select id="w_m">${Object.entries(TEMAS).map(([k, n]) => `<option value="${k}" ${p.tema === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <textarea class="verso" id="w_x" maxlength="8000" placeholder="Escribe aquí tus versos…&#10;&#10;Cada renglón es un verso.&#10;Deja un renglón vacío entre estrofas." aria-label="Poema">${esc(p.texto)}</textarea>
      <p class="note" id="w_n"></p>
      <p class="err" id="w_e"></p>
      <button class="btn gold-b wide" type="submit">${ed && ed.estado === "publicado" ? "Guardar cambios" : "Publicar"}</button>
      <p class="note" style="text-align:center">Al publicar confirmas que el poema es de tu autoría.${ed ? "" : " Lo que escribes se guarda solo mientras tanto."}</p>
    </form></div>`;
  const cnt = () => { const t = $("#w_x").value, v = t.split("\n").filter(l => l.trim()).length, e = t.split(/\n\s*\n/).filter(l => l.trim()).length; $("#w_n").textContent = `${v} ${v === 1 ? "verso" : "versos"} · ${e} ${e === 1 ? "estrofa" : "estrofas"}`; };
  const save = () => { if (!ed) LS.set("borrador", { titulo: $("#w_t").value, texto: $("#w_x").value, tema: $("#w_m").value }); };
  ["#w_t", "#w_x", "#w_m"].forEach(s => $(s).addEventListener("input", () => { save(); cnt(); })); cnt();
  $("#wf").onsubmit = async e => {
    e.preventDefault(); const b = e.submitter || $("#wf button[type=submit]"); b.disabled = true; $("#w_e").textContent = "";
    const d = { titulo: $("#w_t").value, texto: $("#w_x").value, tema: $("#w_m").value };
    try {
      const r = ed ? await api("yo/poemas/" + ed.id, "PUT", d, true) : await api("yo/poemas", "POST", d, true);
      if (!ed) LS.set("borrador", null);
      if (r.poema.estado === "publicado") { st.poemas = [r.poema, ...st.poemas.filter(x => x.id !== r.poema.id)]; toast("¡Tu poema ya está publicado!"); location.hash = "#/poema/" + r.poema.id; }
      else { toast("Enviado. Se publicará en cuanto lo revisen.", 3600); location.hash = "#/cuaderno"; }
    } catch (x) { $("#w_e").textContent = x.message; b.disabled = false; if (x.status === 401) setTimeout(() => route(), 900); }
  };
}

/* ================= instalar ================= */
let deferred = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; const b = $("#bInst"); if (b) b.hidden = false; });
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
function installBox() {
  if (standalone()) return "";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<div class="box" style="margin-top:14px;display:flex;gap:12px;align-items:center"><img src="/icons/versos-192.png" alt="" style="width:48px;height:48px;border-radius:12px"><div style="flex:1"><b>Tenla como app</b><br><small class="note" style="margin:0">${ios ? "En Safari toca Compartir → «Agregar a inicio»." : "Ábrela en Chrome y toca ⋮ → «Instalar app» o «Agregar a la pantalla principal»."}</small></div>${ios ? "" : `<button class="btn sm gold-b" id="bInst" ${deferred ? "" : "hidden"}>Instalar</button>`}</div>`;
}
document.addEventListener("click", async e => { if (e.target.closest("#bInst") && deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; e.target.closest("#bInst").hidden = true; } });

/* ================= navegación ================= */
async function route() {
  if (!st.ready) return;
  const h = location.hash || "#/", [path, qs] = h.slice(1).split("?"), params = new URLSearchParams(qs || ""), app = $("#app");
  document.querySelectorAll(".sheet").forEach(s => s.remove());
  scrollTo(0, 0);
  if (path.startsWith("/poema/")) {
    const id = decodeURIComponent(path.slice(7)); tabbar(""); let p = byId(id);
    if (!p) { try { await load2(); p = byId(id); } catch { } }
    app.innerHTML = leer(id, p); afterLeer(p); document.title = p ? `${p.titulo} · ${p.alias} · Versos de Oro` : "Versos de Oro"; return;
  }
  document.title = "Versos de Oro";
  if (path.startsWith("/poeta/")) { tabbar(""); poeta(decodeURIComponent(path.slice(7))); }
  else if (path === "/explorar") { tabbar("#/explorar"); app.innerHTML = explorar(qs ? params : null); bindExplorar(); }
  else if (path === "/escribir") { tabbar("#/escribir"); escribir(params); }
  else if (path === "/oros") { tabbar("#/oros"); app.innerHTML = oros(); }
  else if (path === "/cuaderno") { tabbar("#/cuaderno"); cuaderno(); }
  else { tabbar("#/"); app.innerHTML = home(); }
}
async function load2() { const d = await api("poemas"); st.poemas = d.poemas; st.dia = d.dia; }
addEventListener("hashchange", route);
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => { }));
load();
