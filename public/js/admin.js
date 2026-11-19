// Administrador de Versos de Oro: revisar y aprobar poemas, retirar, elegir el poema del día y suspender cuentas.
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(m, ms = 2600) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, ms); }
const TEMAS = { amor: "Amor", desamor: "Desamor", soledad: "Soledad", tristeza: "Tristeza", felicidad: "Felicidad", vida: "Vida", muerte: "Muerte", esperanza: "Esperanza", naturaleza: "Naturaleza", fe: "Fe", tierra: "Mi tierra", personal: "Personales", reflexion: "Reflexiones", libre: "Uso libre" };
const ET = { publicado: "Publicado", revision: "En revisión", rechazado: "No aprobado", oculto: "Retirado", papelera: "En la papelera" };
let KEY = ""; try { KEY = localStorage.getItem("vdo.admin") || ""; } catch { }
// Si entraste a la app con tu cuenta de dueño (MR.CH), pasas directo sin clave
let SES = null; try { SES = JSON.parse(localStorage.getItem("vdo.sesion") || "null"); } catch { }
const DUENO = !!(SES && SES.dueno && SES.token);
let tab = "rev", R = {}, P = [], U = [], S = {}, q = "", RP = [], filtro = "", orden = "";
// Selección de varios poemas: mantén apretado uno (o toca «Seleccionar») y luego toca los demás
let selMode = false; const sel = new Set();
const salirSel = () => { selMode = false; sel.clear(); };
const fdate = t => new Date(t).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
async function A(path, method = "GET", body) {
  const r = await fetch("/api/admin/" + path, { method, headers: { "content-type": "application/json", ...(KEY ? { "x-admin-key": KEY } : DUENO ? { authorization: "Bearer " + SES.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(d.error || "Algo salió mal"); e.status = r.status; throw e; } return d;
}
const head = () => `<div class="top"><a class="brand" href="/"><img src="/icons/versos-192.png" alt=""><span><b>Versos de Oro</b><small>Administrador</small></span></a>${DUENO && !KEY ? `<a class="btn sm" href="/#/cuaderno">‹ Volver a la app</a>` : `<button class="btn sm" id="bOut">Salir</button>`}</div>`;
function login(err = "") {
  $("#app").innerHTML = `<div class="wrap"><div class="prof"><div class="av">✦</div><h1>Administrar Versos de Oro</h1></div><form class="form" id="lf" novalidate><label>Clave de administrador<input id="k" type="password" autocomplete="current-password"></label><p class="err">${esc(err)}</p><button class="btn gold-b wide" type="submit">Entrar</button></form></div>`;
  $("#lf").onsubmit = async e => { e.preventDefault(); KEY = $("#k").value.trim(); try { await A("settings"); try { localStorage.setItem("vdo.admin", KEY); } catch { } load(); } catch (x) { login(x.status === 401 ? "Clave incorrecta" : x.message); } };
}
async function load() {
  try { let rp; [R, { poemas: P }, { poetas: U }, S, rp] = await Promise.all([A("resumen"), A("poemas"), A("poetas"), A("settings"), A("reportes")]); RP = rp.reportes || []; }
  catch (e) { if (e.status === 401) return login("Clave incorrecta"); return toast(e.message); }
  const y = scrollY; draw(); scrollTo(0, y);
}
// Cambios al instante en pantalla; el servidor se actualiza por detrás
function aplicar(ids, acc) {
  const S2 = new Set(ids);
  if (acc === "borrar") P = P.filter(p => !S2.has(p.id));
  else P = P.map(p => { if (!S2.has(p.id)) return p;
    if (acc === "publicar") return p.estado === "papelera" ? p : { ...p, estado: "publicado", pubAt: p.pubAt || Date.now() };
    if (acc === "papelera") return { ...p, estado: "papelera", antes: p.estado, borradoAt: Date.now(), borradoPor: "admin" };
    if (acc === "recuperar") return { ...p, estado: ["publicado", "revision", "rechazado", "oculto"].includes(p.antes) ? p.antes : "revision" };
    return { ...p, estado: acc };
  });
  R.pendientes = P.filter(p => p.estado === "revision").length; R.publicados = P.filter(p => p.estado === "publicado").length;
  const y = scrollY; draw(); scrollTo(0, y);
}
let refrescando = null;
function refrescar() { clearTimeout(refrescando); refrescando = setTimeout(async () => { try { const [r, { poemas }] = await Promise.all([A("resumen"), A("poemas")]); R = r; P = poemas; if (!selMode) { const y = scrollY; draw(); scrollTo(0, y); } } catch { } }, 1500); }
async function lote(ids, accion) { aplicar(ids, accion); try { await A("poemas/lote", "POST", { ids, accion }); } catch (e) { toast(e.message); load(); return false; } refrescar(); return true; }
function draw() {
  const rev = P.filter(p => p.estado === "revision"), pap = P.filter(p => p.estado === "papelera").sort((a, b) => b.borradoAt - a.borradoAt);
  const n = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  let todos = P.filter(p => p.estado !== "papelera" && (!filtro || p.estado === filtro)).filter(p => !q || n(p.titulo + " " + p.alias + " " + p.texto).includes(n(q)));
  if (orden === "oros") todos = [...todos].sort((a, b) => (b.oros || 0) - (a.oros || 0));
  const lista = tab === "rev" ? rev : tab === "all" ? todos : tab === "pap" ? pap : [];
  for (const id of [...sel]) if (!lista.some(p => p.id === id)) sel.delete(id);
  const selBtn = lista.length ? `<div class="acts" style="justify-content:space-between;align-items:center;margin-top:6px"><small class="note" style="margin:0">Mantén apretado un poema para seleccionar varios.</small><button class="btn sm" id="bSel">${selMode ? "Cancelar selección" : "Seleccionar"}</button></div>` : "";
  $("#app").innerHTML = `<div class="wrap">${head()}
    <div class="kp"><button type="button" data-go="rev"><b>${R.pendientes}</b><small>Por revisar</small></button><button type="button" data-go="pub"><b>${R.publicados}</b><small>Publicados</small></button><button type="button" data-go="poe"><b>${R.poetas}</b><small>Poetas</small></button><button type="button" data-go="oros"><b>${R.oros}</b><small>Oros</small></button></div>
    <div class="tabs2"><button data-tab="rev" aria-pressed="${tab === "rev"}">Revisar${rev.length ? ` (${rev.length})` : ""}</button><button data-tab="all" aria-pressed="${tab === "all"}">Poemas</button><button data-tab="poe" aria-pressed="${tab === "poe"}">Poetas</button><button data-tab="pap" aria-pressed="${tab === "pap"}">Papelera${pap.length ? ` (${pap.length})` : ""}</button><button data-tab="cfg" aria-pressed="${tab === "cfg"}">Ajustes</button></div>
    <div id="body">${tab === "rev" && RP.length ? `<div class="box" style="border-color:#ff8f7a66"><b style="color:#ffb59f">⚠️ Reportes de plagio (${RP.length})</b>${RP.map(r => `<div class="adm"><small class="note" style="margin:0">${fdate(r.at)}${r.poeta ? " · lo mandó " + esc(r.poeta) : ""}${r.contacto ? " · " + esc(r.contacto) : ""}</small><b>${esc(r.titulo || "Sin título")}</b>${r.link ? `<a href="${esc(/^https?:\/\//.test(r.link) ? r.link : "#")}" target="_blank" rel="noopener" style="color:var(--gold2);word-break:break-all">${esc(r.link)}</a>` : ""}${r.detalle ? `<p class="note" style="white-space:pre-wrap">${esc(r.detalle)}</p>` : ""}<div class="acts">${r.poema ? `<a class="btn sm" href="/#/poema/${esc(r.poema)}" target="_blank">Ver poema</a>` : ""}<button class="btn sm" data-rep="${esc(r.id)}">Ya lo atendí</button></div></div>`).join("")}</div>` : ""}${tab === "rev" ? (rev.length ? (rev.length > 1 && !selMode ? `<div class="acts" style="justify-content:flex-end;margin-top:6px"><button class="btn sm gold-b" id="bAll">✓ Publicar los ${rev.length}</button></div>` : "") + selBtn + rev.map(p => item(p, true)).join("") : `<p class="empty">No hay poemas esperando revisión. ✦</p>`)
      : tab === "all" ? `<label class="search"><input id="q" placeholder="Buscar poema o poeta" value="${esc(q)}"></label>
        <div class="chips" style="margin:0 0 6px">${[["", "Todos"], ["publicado", "Publicados"], ["revision", "En revisión"], ["oculto", "Retirados"], ["rechazado", "No aprobados"]].map(([k, l]) => `<button type="button" data-fil="${k}" aria-pressed="${filtro === k}">${l}</button>`).join("")}<button type="button" data-ord="${orden === "oros" ? "" : "oros"}" aria-pressed="${orden === "oros"}">★ Más oros</button></div>
        ${selBtn}${todos.map(p => item(p)).join("") || `<p class="empty">No hay poemas aquí.</p>`}`
      : tab === "pap" ? `<p class="note" style="text-align:center">Aquí quedan los poemas que borras o niegas. Puedes recuperarlos cuando quieras.</p>` + selBtn + (pap.length ? pap.map(p => `<div class="adm${sel.has(p.id) ? " on" : ""}" data-pid="${p.id}">${chk(p)}<div class="sw"><h3>${esc(p.titulo)}</h3><span class="estado oculto">Borrado ${fdate(p.borradoAt)}</span></div>
          <small class="note" style="margin:0">de <b style="color:var(--gold2)">${esc(p.alias)}</b> · ${TEMAS[p.tema] || ""} · estaba ${esc((ET[p.antes] || "en revisión").toLowerCase())} · lo borró ${p.borradoPor === "poeta" ? "el poeta" : "el administrador"}</small>
          <div class="v">${esc(p.texto)}</div>
          ${selMode ? "" : `<div class="acts"><button class="btn sm gold-b" data-rec="${p.id}">↺ Recuperar</button><button class="btn sm" data-fin="${p.id}">Borrar para siempre</button></div>`}</div>`).join("") : `<p class="empty">La papelera está vacía.</p>`)
      : tab === "poe" ? (U.length ? U.map(u => `<div class="adm"><div class="sw"><div><h3>${esc(u.alias)}</h3><small class="note">${esc(u.ciudad || "")} · ${u.poemas} poemas · ${u.oros} oros · desde ${new Date(u.at).toLocaleDateString("es-MX")}</small>${u.bio ? `<p class="note">${esc(u.bio)}</p>` : ""}</div>
          <div class="acts"><a class="btn sm" href="/#/poeta/${esc(u.slug)}" target="_blank">Ver</a><button class="btn sm" data-clv="${esc(u.slug)}" data-al="${esc(u.alias)}">Dar contraseña de acceso</button><button class="btn sm" data-pau="${esc(u.slug)}" data-v="${u.pausado ? "" : "1"}">${u.pausado ? "Quitar pausa" : "Pausar"}</button><button class="btn sm" data-blq="${esc(u.slug)}" data-v="${u.bloqueado ? "" : "1"}">${u.bloqueado ? "Reactivar" : "Suspender"}</button></div></div>${u.bloqueado ? `<span class="estado oculto" style="width:max-content">Suspendido: sus poemas no se ven</span>` : ""}${u.pausado ? `<span class="estado revision" style="width:max-content">En pausa: nadie ve sus poemas; él no se entera</span>` : ""}${u.temporal ? `<span class="estado revision" style="width:max-content">Tiene contraseña de acceso: aún no pone la suya</span>` : ""}</div>`).join("") : `<p class="empty">Aún no hay poetas registrados.</p>`)
      : `<div class="box"><div class="sw"><div><b>Revisar antes de publicar</b><p class="note">Si está prendido, cada poema nuevo o editado espera tu aprobación. Si lo apagas, se publican al instante (igual puedes retirarlos).</p></div><input type="checkbox" id="cRev" ${S.revisar ? "checked" : ""}></div></div>
         <div class="box"><div class="sw"><div><b>🔔 Avisos al celular</b><p class="note">${R.avisos || 0} ${R.avisos === 1 ? "celular recibe" : "celulares reciben"} avisos. A todos les llega cada poema que publicas. A ti te llega además cuando se une un poeta nuevo.</p></div><button class="btn sm gold-b" id="bAv">Avisarme en este celular</button></div></div>
         <div class="box"><b>Poema del día</b><p class="note">${R.dia ? `Hoy: «${esc(R.dia.titulo)}» de ${esc(R.dia.alias)}.` : "Todavía no hay poemas publicados."} ${S.diaManual ? "Lo elegiste tú." : "Se elige solo entre los más queridos y cambia cada día."}</p>${S.diaManual ? `<button class="btn sm" id="bDiaAuto">Que se elija solo otra vez</button>` : `<p class="note">Para elegirlo tú, ve a «Poemas» y toca «Poema del día» en el que quieras.</p>`}</div>`}</div></div>
    ${selMode ? `<div class="selbar"><div class="acts" style="justify-content:space-between;align-items:center"><b>${sel.size} ${sel.size === 1 ? "seleccionado" : "seleccionados"}</b><button class="btn sm" id="sTodos">${sel.size === lista.length ? "Quitar todos" : "Seleccionar todos"}</button></div>
      <div class="acts">${tab === "pap" ? `<button class="btn sm gold-b" data-bulk="rec" ${sel.size ? "" : "disabled"}>↺ Recuperar</button><button class="btn sm danger" data-bulk="fin" ${sel.size ? "" : "disabled"}>Borrar para siempre</button>` : `<button class="btn sm gold-b" data-bulk="pub" ${sel.size ? "" : "disabled"}>✓ Publicar</button><button class="btn sm danger" data-bulk="del" ${sel.size ? "" : "disabled"}>🗑 Eliminar</button>`}<button class="btn sm" id="sX">Cancelar</button></div></div>` : ""}`;
  if ($("#bOut")) $("#bOut").onclick = () => { try { localStorage.removeItem("vdo.admin"); } catch { } KEY = ""; login(); };
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; salirSel(); draw(); });
  document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { const g = b.dataset.go; salirSel(); q = "";
    if (g === "rev") { tab = "rev"; } else if (g === "poe") { tab = "poe"; } else { tab = "all"; filtro = g === "pub" ? "publicado" : "publicado"; orden = g === "oros" ? "oros" : ""; }
    draw(); const t = document.querySelector(".tabs2"); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); });
  document.querySelectorAll("[data-fil]").forEach(b => b.onclick = () => { filtro = b.dataset.fil; salirSel(); draw(); });
  document.querySelectorAll("[data-ord]").forEach(b => b.onclick = () => { orden = b.dataset.ord; draw(); });
  const bs = $("#bSel"); if (bs) bs.onclick = () => { if (selMode) salirSel(); else selMode = true; draw(); };
  const sx = $("#sX"); if (sx) sx.onclick = () => { salirSel(); draw(); };
  const st = $("#sTodos"); if (st) st.onclick = () => { if (sel.size === lista.length) sel.clear(); else lista.forEach(p => sel.add(p.id)); draw(); };
  // mantener apretado = seleccionar; en modo selección, tocar = marcar o desmarcar
  document.querySelectorAll("[data-pid]").forEach(c => {
    let t = null, sx0 = 0, sy0 = 0, largo = false;
    const fuera = e => e.target.closest("button, a, input, textarea, select, label");
    c.addEventListener("pointerdown", e => { if (fuera(e)) return; largo = false; sx0 = e.clientX; sy0 = e.clientY; clearTimeout(t);
      t = setTimeout(() => { largo = true; if (!selMode) { selMode = true; sel.clear(); } sel.add(c.dataset.pid); try { navigator.vibrate?.(30); } catch { } draw(); }, 550); });
    c.addEventListener("pointermove", e => { if (Math.abs(e.clientX - sx0) > 10 || Math.abs(e.clientY - sy0) > 10) clearTimeout(t); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(ev => c.addEventListener(ev, () => clearTimeout(t)));
    c.addEventListener("contextmenu", e => e.preventDefault());
    c.addEventListener("click", e => { if (!selMode || largo || fuera(e)) return; const id = c.dataset.pid; sel.has(id) ? sel.delete(id) : sel.add(id); draw(); });
  });
  document.querySelectorAll("[data-bulk]").forEach(b => b.onclick = async () => {
    const op = b.dataset.bulk, ids = [...sel]; if (!ids.length) return;
    const msg = { pub: "¿Publicar", del: "¿Mandar a la papelera", rec: "¿Recuperar", fin: "¿Borrar para siempre" }[op];
    if (b.dataset.k !== "1") { b.dataset.k = "1"; b.textContent = `${msg} ${ids.length}? Toca otra vez`; return; }
    const acc = { pub: "publicar", del: "papelera", rec: "recuperar", fin: "borrar" }[op];
    salirSel(); toast({ pub: `${ids.length} publicados ✦`, del: `${ids.length} enviados a la papelera`, rec: `${ids.length} recuperados`, fin: `${ids.length} borrados para siempre` }[op]);
    lote(ids, acc);
  });
  const qi = $("#q"); if (qi) qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; draw(); const n2 = $("#q"); n2.focus(); n2.setSelectionRange(pos, pos); };
  document.querySelectorAll("[data-st]").forEach(b => b.onclick = async () => {
    const id = b.dataset.id, estado = b.dataset.st, nota = $("#n_" + id)?.value || "";
    if (estado === "rechazado" && b.dataset.k !== "1") { b.dataset.k = "1"; b.textContent = "¿Seguro?"; return; }
    aplicar([id], estado); toast(estado === "publicado" ? "Publicado ✦" : estado === "rechazado" ? "Denegado" : estado === "oculto" ? "Retirado" : "Listo");
    try { await A("poemas/" + id, "PATCH", { estado, nota: estado === "publicado" ? "" : nota }); refrescar(); } catch (e) { toast(e.message); load(); }
  });
  document.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { if (b.dataset.k !== "1") { b.dataset.k = "1"; b.textContent = b.textContent.includes("Denegar") ? "¿Seguro? Toca otra vez" : "¿Mandar a la papelera?"; return; } toast(b.textContent.includes("Seguro") ? "Denegado (quedó en la papelera)" : "Enviado a la papelera"); lote([b.dataset.del], "papelera"); });
  document.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => {
    const box = b.closest(".adm"); if (box.querySelector(".edf")) return; const p = P.find(x => x.id === b.dataset.edit); if (!p) return;
    box.querySelector(".v").hidden = true; b.closest(".acts").hidden = true;
    box.insertAdjacentHTML("beforeend", `<form class="edf form" novalidate style="gap:10px;margin-top:6px">
      <input class="ed-t" maxlength="120" value="${esc(p.titulo)}" aria-label="Título" style="font:700 22px var(--serif);text-align:center">
      <select class="ed-m" aria-label="Tema">${Object.entries(TEMAS).map(([k, n]) => `<option value="${k}" ${p.tema === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      <textarea class="ed-x" maxlength="8000" aria-label="Poema" style="font:500 18px/1.6 var(--serif);text-align:center;min-height:300px">${esc(p.texto)}</textarea>
      <div class="acts" style="justify-content:center"><button class="btn sm gold-b" type="submit">Guardar cambios</button><button class="btn sm" type="button" data-cx>Cancelar</button></div></form>`);
    const f = box.querySelector(".edf"), ta = f.querySelector(".ed-x"); ta.style.height = Math.max(300, ta.scrollHeight + 6) + "px"; ta.focus();
    f.querySelector("[data-cx]").onclick = () => { const y = scrollY; draw(); scrollTo(0, y); };
    f.onsubmit = async e => { e.preventDefault(); const titulo = f.querySelector(".ed-t").value.trim(), texto = ta.value, tema = f.querySelector(".ed-m").value;
      if (!titulo) return toast("Ponle título"); if (texto.trim().length < 20) return toast("El poema está muy corto");
      const btn = f.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Guardando…";
      try { const r = await A("poemas/" + p.id, "PATCH", { titulo, texto, tema }); P = P.map(x => x.id === p.id ? { ...x, ...r.poema } : x); toast("Cambios guardados ✦"); const y = scrollY; draw(); scrollTo(0, y); }
      catch (x) { toast(x.message); btn.disabled = false; btn.textContent = "Guardar cambios"; } };
  });
  document.querySelectorAll("[data-rep]").forEach(b => b.onclick = async () => { try { await A("reportes/" + b.dataset.rep, "DELETE"); toast("Reporte cerrado"); load(); } catch (e) { toast(e.message); } });
  document.querySelectorAll("[data-rec]").forEach(b => b.onclick = async () => { toast("Recuperado"); lote([b.dataset.rec], "recuperar"); });
  document.querySelectorAll("[data-fin]").forEach(b => b.onclick = async () => { if (b.dataset.k !== "1") { b.dataset.k = "1"; b.textContent = "¿Seguro? Ya no se podrá recuperar"; return; } toast("Borrado para siempre"); lote([b.dataset.fin], "borrar"); });
  document.querySelectorAll("[data-dia]").forEach(b => b.onclick = async () => { try { S = await A("settings", "PUT", { diaManual: b.dataset.dia }); toast("Ahora es el poema del día"); load(); } catch (e) { toast(e.message); } });
  document.querySelectorAll("[data-clv]").forEach(b => b.onclick = () => {
    const box = b.closest(".adm"); if (box.querySelector(".clv")) return;
    const ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", gen = () => Array.from(crypto.getRandomValues(new Uint32Array(6)), n => ABC[n % ABC.length]).join("");
    box.insertAdjacentHTML("beforeend", `<div class="clv box" style="margin-top:8px"><b>Contraseña de acceso para ${esc(b.dataset.al)}</b><p class="note">Se la pasas al poeta. Entra con ella y la app le pide de inmediato que ponga una suya.</p>
      <div class="acts"><input type="text" value="${gen()}" style="flex:1;min-width:140px;font:700 20px var(--sans);letter-spacing:3px;text-align:center" autocomplete="off"><button class="btn sm" data-gen>Otra</button></div>
      <div class="acts" style="margin-top:8px"><button class="btn sm gold-b" data-save>Guardar y dar acceso</button><button class="btn sm" data-x>Cancelar</button></div><div class="done"></div></div>`);
    const c = box.querySelector(".clv"), i = c.querySelector("input");
    c.querySelector("[data-gen]").onclick = () => { i.value = gen(); };
    c.querySelector("[data-x]").onclick = () => c.remove();
    c.querySelector("[data-save]").onclick = async e => { e.target.disabled = true;
      try { await A("poetas/" + b.dataset.clv + "/clave", "PUT", { nueva: i.value.trim() });
        const msg = `Hola ${b.dataset.al}, esta es tu contraseña de acceso para Versos de Oro: ${i.value.trim()}\n\nEntra en ${location.origin} con tu nombre de poeta y esa contraseña; la app te pedirá que pongas una nueva que solo tú sepas.`;
        c.querySelector(".done").innerHTML = `<p class="note" style="color:var(--gold2)">✓ Listo. Ya puede entrar con <b>${esc(i.value.trim())}</b>.</p><div class="acts"><button class="btn sm" data-cp>Copiar mensaje</button><a class="btn sm gold-b" target="_blank" href="https://wa.me/?text=${encodeURIComponent(msg)}">Mandar por WhatsApp</a></div>`;
        c.querySelector("[data-cp]").onclick = async () => { try { await navigator.clipboard.writeText(msg); toast("Mensaje copiado"); } catch { toast("No se pudo copiar"); } };
        i.disabled = true; c.querySelector("[data-gen]").remove(); e.target.remove(); c.querySelector("[data-x]").textContent = "Cerrar"; c.querySelector("[data-x]").onclick = () => load();
      } catch (x) { toast(x.message); e.target.disabled = false; } };
  });
  document.querySelectorAll("[data-pau]").forEach(b => b.onclick = async () => { try { await A("poetas/" + b.dataset.pau, "PATCH", { pausado: !!b.dataset.v }); toast(b.dataset.v ? "En pausa. Él no recibe ningún aviso." : "Pausa quitada: sus poemas se ven otra vez"); load(); } catch (e) { toast(e.message); } });
  document.querySelectorAll("[data-blq]").forEach(b => b.onclick = async () => { try { await A("poetas/" + b.dataset.blq, "PATCH", { bloqueado: !!b.dataset.v }); toast(b.dataset.v ? "Cuenta suspendida" : "Cuenta reactivada"); load(); } catch (e) { toast(e.message); } });
  const cr = $("#cRev"); if (cr) cr.onchange = async () => { try { S = await A("settings", "PUT", { revisar: cr.checked }); toast(cr.checked ? "Ahora revisas cada poema antes de publicarse" : "Los poemas se publican al instante"); } catch (e) { toast(e.message); } };
  const ba = $("#bAll"); if (ba) ba.onclick = async () => { if (ba.dataset.k !== "1") { ba.dataset.k = "1"; ba.textContent = "¿Publicar todos? Toca otra vez"; return; } ba.disabled = true;
    const ids = P.filter(x => x.estado === "revision").map(x => x.id); toast(`${ids.length} publicados ✦`); lote(ids, "publicar"); };
  const av = $("#bAv"); if (av) av.onclick = async () => {
    try {
      if (!("PushManager" in window)) return toast("Este navegador no permite avisos. Abre la app instalada o Chrome.");
      if (await Notification.requestPermission() !== "granted") return toast("No diste permiso para avisos");
      const reg = await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready;
      const { key } = await (await fetch("/api/avisos/clave")).json(), pad = "=".repeat((4 - key.length % 4) % 4), raw = atob((key + pad).replace(/-/g, "+").replace(/_/g, "/"));
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, c => c.charCodeAt(0)) });
      const r = await fetch("/api/avisos", { method: "POST", headers: { "content-type": "application/json", ...(KEY ? { "x-admin-key": KEY } : DUENO ? { authorization: "Bearer " + SES.token } : {}) }, body: JSON.stringify({ sub: sub.toJSON() }) });
      if (!r.ok) throw new Error("no se guardó"); try { localStorage.setItem("vdo.avisos", "true"); } catch { }
      toast("Listo: este celular te avisará cuando se una un poeta 🔔"); load();
    } catch (e) { toast("No se pudo: " + e.message); }
  };
  const da = $("#bDiaAuto"); if (da) da.onclick = async () => { try { S = await A("settings", "PUT", { diaManual: "" }); load(); } catch (e) { toast(e.message); } };
}
const chk = p => selMode ? `<span class="chk" aria-hidden="true">${sel.has(p.id) ? "✓" : ""}</span>` : "";
function item(p, rev) {
  return `<div class="adm${sel.has(p.id) ? " on" : ""}" data-pid="${p.id}">${chk(p)}<div class="sw"><h3>${esc(p.titulo)}</h3><span class="estado ${p.estado}">${ET[p.estado]}</span></div>
    <small class="note" style="margin:0">de <b style="color:var(--gold2)">${esc(p.alias)}</b> · ${TEMAS[p.tema] || ""} · ${fdate(p.at)}${p.estado === "publicado" ? ` · ✦ ${p.oros} oros` : ""}</small>
    ${p.parecido ? `<div class="box" style="border-color:#ff8f7a88;margin:4px 0;padding:10px 12px"><b style="color:#ffb59f">⚠️ Posible plagio: se parece ${p.parecido.pct}% a «${esc(p.parecido.titulo)}» de ${esc(p.parecido.alias)}</b><br><a class="note" href="/#/poema/${esc(p.parecido.id)}" target="_blank" style="color:var(--gold2)">Comparar con el original</a></div>` : ""}
    <div class="v">${esc(p.texto)}</div>${p.cert ? `<small class="note" style="margin:0">Certificado: <b style="color:var(--gold2)">${esc(p.cert)}</b></small>` : ""}
    ${p.casa ? `<span class="estado publicado" style="width:max-content">✦ Poema diario para MR.CH</span>` : ""}${!p.casa && (rev || p.estado !== "publicado") ? `<input id="n_${p.id}" placeholder="Nota para el poeta si no lo apruebas (opcional)" value="${esc(p.nota)}">` : ""}
    ${selMode ? "" : `<div class="acts"><button class="btn sm" data-edit="${p.id}">✏️ Editar</button>${p.estado !== "publicado" ? `<button class="btn sm gold-b" data-st="publicado" data-id="${p.id}">✓ Publicar</button>` : `<a class="btn sm" href="/#/poema/${p.id}" target="_blank">Ver</a><button class="btn sm" data-dia="${p.id}">Poema del día</button><button class="btn sm" data-st="oculto" data-id="${p.id}">Retirar</button>`}
      ${p.estado === "revision" ? (p.casa ? `<button class="btn sm" data-del="${p.id}">✕ Denegar</button>` : `<button class="btn sm" data-st="rechazado" data-id="${p.id}">✕ Denegar</button>`) : ""}${p.casa && p.estado === "revision" ? "" : `<button class="btn sm" data-del="${p.id}">Borrar</button>`}</div>`}</div>`;
}
KEY || DUENO ? load() : login();
