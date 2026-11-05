// Administrador de Versos de Oro: revisar y aprobar poemas, retirar, elegir el poema del día y suspender cuentas.
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(m, ms = 2600) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, ms); }
const TEMAS = { amor: "Amor", desamor: "Desamor", soledad: "Soledad", tristeza: "Tristeza", felicidad: "Felicidad", vida: "Vida", muerte: "Muerte", esperanza: "Esperanza", naturaleza: "Naturaleza", fe: "Fe", tierra: "Mi tierra", personal: "Personales", reflexion: "Reflexiones", libre: "Uso libre" };
const ET = { publicado: "Publicado", revision: "En revisión", rechazado: "No aprobado", oculto: "Retirado" };
let KEY = ""; try { KEY = localStorage.getItem("vdo.admin") || ""; } catch { }
let tab = "rev", R = {}, P = [], U = [], S = {}, q = "";
const fdate = t => new Date(t).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
async function A(path, method = "GET", body) {
  const r = await fetch("/api/admin/" + path, { method, headers: { "content-type": "application/json", "x-admin-key": KEY }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(d.error || "Algo salió mal"); e.status = r.status; throw e; } return d;
}
const head = () => `<div class="top"><a class="brand" href="/"><img src="/icons/versos-192.png" alt=""><span><b>Versos de Oro</b><small>Administrador</small></span></a><button class="btn sm" id="bOut">Salir</button></div>`;
function login(err = "") {
  $("#app").innerHTML = `<div class="wrap"><div class="prof"><div class="av">✦</div><h1>Administrar Versos de Oro</h1></div><form class="form" id="lf" novalidate><label>Clave de administrador<input id="k" type="password" autocomplete="current-password"></label><p class="err">${esc(err)}</p><button class="btn gold-b wide" type="submit">Entrar</button></form></div>`;
  $("#lf").onsubmit = async e => { e.preventDefault(); KEY = $("#k").value.trim(); try { await A("settings"); try { localStorage.setItem("vdo.admin", KEY); } catch { } load(); } catch (x) { login(x.status === 401 ? "Clave incorrecta" : x.message); } };
}
async function load() {
  try { [R, { poemas: P }, { poetas: U }, S] = await Promise.all([A("resumen"), A("poemas"), A("poetas"), A("settings")]); }
  catch (e) { if (e.status === 401) return login("Clave incorrecta"); return toast(e.message); }
  draw();
}
function draw() {
  const rev = P.filter(p => p.estado === "revision");
  const n = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const todos = P.filter(p => !q || n(p.titulo + " " + p.alias + " " + p.texto).includes(n(q)));
  $("#app").innerHTML = `<div class="wrap">${head()}
    <div class="kp"><div><b>${R.pendientes}</b><small>Por revisar</small></div><div><b>${R.publicados}</b><small>Publicados</small></div><div><b>${R.poetas}</b><small>Poetas</small></div><div><b>${R.oros}</b><small>Oros</small></div></div>
    <div class="tabs2"><button data-tab="rev" aria-pressed="${tab === "rev"}">Revisar${rev.length ? ` (${rev.length})` : ""}</button><button data-tab="all" aria-pressed="${tab === "all"}">Poemas</button><button data-tab="poe" aria-pressed="${tab === "poe"}">Poetas</button><button data-tab="cfg" aria-pressed="${tab === "cfg"}">Ajustes</button></div>
    <div id="body">${tab === "rev" ? (rev.length ? (rev.length > 1 ? `<div class="acts" style="justify-content:flex-end;margin-top:6px"><button class="btn sm gold-b" id="bAll">✓ Publicar los ${rev.length}</button></div>` : "") + rev.map(p => item(p, true)).join("") : `<p class="empty">No hay poemas esperando revisión. ✦</p>`)
      : tab === "all" ? `<label class="search"><input id="q" placeholder="Buscar poema o poeta" value="${esc(q)}"></label>${todos.map(p => item(p)).join("") || `<p class="empty">Aún no hay poemas.</p>`}`
      : tab === "poe" ? (U.length ? U.map(u => `<div class="adm"><div class="sw"><div><h3>${esc(u.alias)}</h3><small class="note">${esc(u.ciudad || "")} · ${u.poemas} poemas · ${u.oros} oros · desde ${new Date(u.at).toLocaleDateString("es-MX")}</small>${u.bio ? `<p class="note">${esc(u.bio)}</p>` : ""}</div>
          <div class="acts"><a class="btn sm" href="/#/poeta/${esc(u.slug)}" target="_blank">Ver</a><button class="btn sm" data-blq="${esc(u.slug)}" data-v="${u.bloqueado ? "" : "1"}">${u.bloqueado ? "Reactivar" : "Suspender"}</button></div></div>${u.bloqueado ? `<span class="estado oculto" style="width:max-content">Suspendido: sus poemas no se ven</span>` : ""}</div>`).join("") : `<p class="empty">Aún no hay poetas registrados.</p>`)
      : `<div class="box"><div class="sw"><div><b>Revisar antes de publicar</b><p class="note">Si está prendido, cada poema nuevo o editado espera tu aprobación. Si lo apagas, se publican al instante (igual puedes retirarlos).</p></div><input type="checkbox" id="cRev" ${S.revisar ? "checked" : ""}></div></div>
         <div class="box"><b>Poema del día</b><p class="note">${R.dia ? `Hoy: «${esc(R.dia.titulo)}» de ${esc(R.dia.alias)}.` : "Todavía no hay poemas publicados."} ${S.diaManual ? "Lo elegiste tú." : "Se elige solo entre los más queridos y cambia cada día."}</p>${S.diaManual ? `<button class="btn sm" id="bDiaAuto">Que se elija solo otra vez</button>` : `<p class="note">Para elegirlo tú, ve a «Poemas» y toca «Poema del día» en el que quieras.</p>`}</div>`}</div></div>`;
  $("#bOut").onclick = () => { try { localStorage.removeItem("vdo.admin"); } catch { } KEY = ""; login(); };
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
  const qi = $("#q"); if (qi) qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; draw(); const n2 = $("#q"); n2.focus(); n2.setSelectionRange(pos, pos); };
  document.querySelectorAll("[data-st]").forEach(b => b.onclick = async () => {
    const id = b.dataset.id, estado = b.dataset.st, nota = $("#n_" + id)?.value || "";
    if (estado === "rechazado" && b.dataset.k !== "1") { b.dataset.k = "1"; b.textContent = "¿Seguro?"; return; }
    try { await A("poemas/" + id, "PATCH", { estado, nota: estado === "publicado" ? "" : nota }); toast(estado === "publicado" ? "Publicado ✦" : estado === "rechazado" ? "Denegado" : estado === "oculto" ? "Retirado" : "Listo"); load(); } catch (e) { toast(e.message); }
  });
  document.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { if (b.dataset.k !== "1") { b.dataset.k = "1"; b.textContent = b.textContent.includes("Denegar") ? "¿Seguro? Toca otra vez" : "¿Borrar para siempre?"; return; } try { await A("poemas/" + b.dataset.del, "DELETE"); toast(b.textContent.includes("Seguro") ? "Denegado" : "Borrado"); load(); } catch (e) { toast(e.message); } });
  document.querySelectorAll("[data-dia]").forEach(b => b.onclick = async () => { try { S = await A("settings", "PUT", { diaManual: b.dataset.dia }); toast("Ahora es el poema del día"); load(); } catch (e) { toast(e.message); } });
  document.querySelectorAll("[data-blq]").forEach(b => b.onclick = async () => { try { await A("poetas/" + b.dataset.blq, "PATCH", { bloqueado: !!b.dataset.v }); toast(b.dataset.v ? "Cuenta suspendida" : "Cuenta reactivada"); load(); } catch (e) { toast(e.message); } });
  const cr = $("#cRev"); if (cr) cr.onchange = async () => { try { S = await A("settings", "PUT", { revisar: cr.checked }); toast(cr.checked ? "Ahora revisas cada poema antes de publicarse" : "Los poemas se publican al instante"); } catch (e) { toast(e.message); } };
  const ba = $("#bAll"); if (ba) ba.onclick = async () => { if (ba.dataset.k !== "1") { ba.dataset.k = "1"; ba.textContent = "¿Publicar todos? Toca otra vez"; return; } ba.disabled = true;
    try { for (const p of P.filter(x => x.estado === "revision")) await A("poemas/" + p.id, "PATCH", { estado: "publicado", nota: "" }); toast("Todos publicados ✦"); } catch (e) { toast(e.message); } load(); };
  const da = $("#bDiaAuto"); if (da) da.onclick = async () => { try { S = await A("settings", "PUT", { diaManual: "" }); load(); } catch (e) { toast(e.message); } };
}
function item(p, rev) {
  return `<div class="adm"><div class="sw"><h3>${esc(p.titulo)}</h3><span class="estado ${p.estado}">${ET[p.estado]}</span></div>
    <small class="note" style="margin:0">de <b style="color:var(--gold2)">${esc(p.alias)}</b> · ${TEMAS[p.tema] || ""} · ${fdate(p.at)}${p.estado === "publicado" ? ` · ✦ ${p.oros} oros` : ""}</small>
    <div class="v">${esc(p.texto)}</div>
    ${p.casa ? `<span class="estado publicado" style="width:max-content">✦ Poema diario para MR.CH</span>` : ""}${!p.casa && (rev || p.estado !== "publicado") ? `<input id="n_${p.id}" placeholder="Nota para el poeta si no lo apruebas (opcional)" value="${esc(p.nota)}">` : ""}
    <div class="acts">${p.estado !== "publicado" ? `<button class="btn sm gold-b" data-st="publicado" data-id="${p.id}">✓ Publicar</button>` : `<a class="btn sm" href="/#/poema/${p.id}" target="_blank">Ver</a><button class="btn sm" data-dia="${p.id}">Poema del día</button><button class="btn sm" data-st="oculto" data-id="${p.id}">Retirar</button>`}
      ${p.estado === "revision" ? (p.casa ? `<button class="btn sm" data-del="${p.id}">✕ Denegar</button>` : `<button class="btn sm" data-st="rechazado" data-id="${p.id}">✕ Denegar</button>`) : ""}${p.casa && p.estado === "revision" ? "" : `<button class="btn sm" data-del="${p.id}">Borrar</button>`}</div></div>`;
}
KEY ? load() : login();
