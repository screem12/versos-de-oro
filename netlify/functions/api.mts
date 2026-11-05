// Versos de Oro: poetas con cuenta, poemas que pasan por tu revisión, «oros» (me gusta) y tu administrador.
import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import diarios from "../../diarios.json" with { type: "json" };
import webpush from "web-push";
import { createHash, createHmac, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";

const db = () => getStore({ name: "versos", consistency: "strong" });
const json = (d: unknown, status = 200) => Response.json(d, { status, headers: { "cache-control": "no-store" } });
const fail = (m: string, status = 400) => json({ error: m }, status);
const secret = () => Netlify.env.get("AUTH_SECRET") || "";
// Tu cuenta de poeta (MR.CH) es la única que también entra como administrador; las demás son cuentas normales.
const DUENO = "mr-ch";
async function isAdmin(req: Request) {
  const k = Netlify.env.get("ADMIN_KEY"), got = req.headers.get("x-admin-key") || "";
  if (k && got && got.length === k.length && timingSafeEqual(Buffer.from(got), Buffer.from(k))) return true;
  const t = verify((req.headers.get("authorization") || "").replace(/^Bearer /, ""));
  if (!t || t.u !== DUENO) return false;
  const u = await db().get("poeta/" + DUENO, { type: "json" }) as any;
  return !!u && (u.tv || 0) === (t.v || 0); // si cambias tu contraseña, las sesiones viejas dejan de servir
}
const sign = (o: any) => { const b = Buffer.from(JSON.stringify(o)).toString("base64url"); return b + "." + createHmac("sha256", secret()).update(b).digest("base64url"); };
function verify(t: string) {
  const [b, s] = String(t || "").split("."); if (!b || !s) return null;
  const g = createHmac("sha256", secret()).update(b).digest("base64url");
  if (g.length !== s.length || !timingSafeEqual(Buffer.from(g), Buffer.from(s))) return null;
  try { return JSON.parse(Buffer.from(b, "base64url").toString()); } catch { return null; }
}
const hash = (pw: string, salt: string) => scryptSync(pw, salt, 32).toString("hex");
const slug = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
const txt = (v: unknown, n: number) => String(v ?? "").replace(/\r/g, "").trim().slice(0, n);
const TEMAS = ["amor", "desamor", "soledad", "tristeza", "felicidad", "vida", "muerte", "esperanza", "naturaleza", "fe", "tierra", "personal", "reflexion", "libre"];
/* Los 5 poemas diarios de la casa: vienen en diarios.json por fecha y entran a revisión el día que les toca.
   Nunca se publican solos: tú decides Publicar o Denegar. Si los niegas no vuelven a entrar. */
const hoyMX = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
// Los poemas diarios salen a nombre de tu cuenta de poeta (MR.CH)
const AUTOR_DIARIOS = "mr-ch";
async function autorDiarios() {
  const u = await db().get("poeta/" + AUTOR_DIARIOS, { type: "json" }) as any;
  return { slug: AUTOR_DIARIOS, alias: u?.alias || "MR.CH" };
}
// Una sola vez: pasa a tu cuenta los poemas diarios que ya habían entrado a nombre de la casa
async function pasarDiariosATuCuenta() {
  const s = db(); if (await s.get("config/migr-mrch")) return;
  const a = await autorDiarios();
  for (const x of await all("poema/")) if (x.casa && x.autor === "versos-de-oro") await s.setJSON("poema/" + x.id, { ...x, autor: a.slug, alias: a.alias });
  await s.delete("poeta/versos-de-oro"); await s.set("config/migr-mrch", "1");
}
async function importarDiarios() {
  await pasarDiariosATuCuenta();
  const s = db(), hoy = hoyMX(), hechos: string[] = ((await s.get("config/diarios", { type: "json" })) as string[]) || [];
  const pend = Object.keys(diarios as Record<string, any[]>).filter(f => f <= hoy && !hechos.includes(f)).sort();
  if (!pend.length) return;
  const a = await autorDiarios();
  for (const f of pend) {
    const L = (diarios as Record<string, any[]>)[f] || [];
    await Promise.all(L.slice(0, 10).map((x, i) => {
      const id = "d" + f.replace(/-/g, "") + "abcdefghij"[i];
      return s.setJSON("poema/" + id, { id, titulo: txt(x.titulo, 120), texto: txt(x.texto, 8000), tema: TEMAS.includes(x.tema) ? x.tema : "libre", autor: a.slug, alias: a.alias, at: Date.now() + i, pubAt: 0, oros: 0, estado: "revision", casa: true }, { onlyIfNew: true });
    }));
  }
  const now = ((await s.get("config/diarios", { type: "json" })) as string[]) || [];
  await s.setJSON("config/diarios", [...new Set([...now, ...pend])].slice(-400));
}
/* ===== Avisos al celular (notificaciones push) ===== */
const subKey = (endpoint: string) => "sub/" + createHash("sha256").update(endpoint).digest("hex").slice(0, 40);
async function avisar(filtro: (s: any) => boolean, aviso: { title: string; body: string; url: string; tag: string }) {
  const pub = Netlify.env.get("VAPID_PUBLIC"), priv = Netlify.env.get("VAPID_PRIVATE"); if (!pub || !priv) return;
  webpush.setVapidDetails("https://versos-de-oro.netlify.app", pub, priv);
  const S = (await all("sub/")).filter(filtro), store = db();
  for (let i = 0; i < S.length; i += 50) await Promise.all(S.slice(i, i + 50).map(async x => {
    try { await webpush.sendNotification(x.sub, JSON.stringify(aviso), { TTL: 86400 }); }
    catch (e: any) { if (e?.statusCode === 404 || e?.statusCode === 410) await store.delete(subKey(x.sub.endpoint)); }
  }));
}
// Cuando un poema sale publicado: aviso a todos (menos al autor) y al autor le decimos que ya salió. Si el poeta está en pausa o suspendido, no se avisa a nadie.
async function anunciarPoema(x: any) {
  const u = await db().get("poeta/" + x.autor, { type: "json" }) as any; if (!u || u.pausado || u.bloqueado) return;
  await Promise.all([
    avisar(s => s.poeta !== x.autor, { title: "✦ Nuevo poema en Versos de Oro", body: `«${x.titulo}» de ${x.alias}`, url: "/#/poema/" + x.id, tag: "poema-" + x.id }),
    avisar(s => s.poeta === x.autor, { title: "Tu poema ya está publicado ✦", body: `«${x.titulo}» ya lo puede leer todo el mundo`, url: "/#/poema/" + x.id, tag: "mio-" + x.id })
  ]);
}
const DEF = { revisar: true, diaManual: "" };
async function settings() { return { ...DEF, ...(((await db().get("config/settings", { type: "json" })) as any) || {}) }; }
async function mutate(key: string, fn: (v: any) => any) {
  const s = db();
  for (let i = 0; i < 6; i++) {
    const r = await s.getWithMetadata(key, { type: "json" }); if (!r) return null;
    const v = fn(r.data as any); if (!v) return r.data;
    if ((await s.setJSON(key, v, { onlyIfMatch: r.etag })).modified) return v;
  }
  throw new Error("Intenta de nuevo");
}
async function all(prefix: string) {
  const s = db(), { blobs } = await s.list({ prefix });
  return (await Promise.all(blobs.map(x => s.get(x.key, { type: "json" })))).filter(Boolean) as any[];
}
const pubPoeta = (p: any) => ({ slug: p.slug, alias: p.alias, bio: p.bio || "", ciudad: p.ciudad || "", at: p.at });
const pubPoema = (x: any) => ({ id: x.id, titulo: x.titulo, texto: x.texto, tema: x.tema, autor: x.autor, alias: x.alias, at: x.at, pubAt: x.pubAt || x.at, oros: x.oros || 0, estado: x.estado, nota: x.nota || "", casa: !!x.casa });
// Poema del día: el que elijas tú, o uno de los más queridos que va cambiando cada día
function poemaDelDia(L: any[], manual: string) {
  const m = manual && L.find(x => x.id === manual); if (m) return m;
  const top = [...L].sort((a, b) => (b.oros || 0) - (a.oros || 0)).slice(0, 15); if (!top.length) return null;
  return top[Math.floor(Date.now() / 864e5) % top.length];
}

export default async (req: Request, ctx: Context) => { try { return await route(req, ctx); } catch (e: any) { console.error(e); return fail(e?.message === "Intenta de nuevo" ? e.message : "Error del servidor. Intenta de nuevo.", 500); } };
async function route(req: Request, ctx: Context) {
  const luego = (p: Promise<unknown>) => { const q = p.catch(e => console.error("avisos", e)); if (typeof (ctx as any)?.waitUntil === "function") (ctx as any).waitUntil(q); return q; };
  const p = new URL(req.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean), M = req.method;
  const body = async () => { try { return await req.json(); } catch { return {}; } };
  if (!secret()) return fail("Falta configurar la app", 500);
  const me = () => { const t = verify((req.headers.get("authorization") || "").replace(/^Bearer /, "")); return t?.u ? t : null; };

  /* ===== avisos ===== */
  if (p[0] === "avisos") {
    if (M === "GET" && p[1] === "clave") return json({ key: Netlify.env.get("VAPID_PUBLIC") || "" });
    const b = await body(), sub = b.sub, ep = String(sub?.endpoint || "");
    if (!/^https:\/\//.test(ep) || ep.length > 1000 || !sub?.keys?.p256dh || !sub?.keys?.auth) return fail("Aviso no válido");
    if (M === "POST") {
      const t = me(), adm = await isAdmin(req);
      await db().setJSON(subKey(ep), { sub: { endpoint: ep, keys: { p256dh: String(sub.keys.p256dh).slice(0, 200), auth: String(sub.keys.auth).slice(0, 100) } }, poeta: t?.u || "", admin: adm, at: Date.now() });
      return json({ ok: true, admin: adm });
    }
    if (M === "DELETE") { await db().delete(subKey(ep)); return json({ ok: true }); }
  }

  /* ===== cuentas de poetas ===== */
  if (M === "POST" && p[0] === "registro") {
    const b = await body(), alias = txt(b.alias, 40).replace(/\s+/g, " "), s = slug(alias), pw = String(b.clave || "");
    if (b.web) return fail("No se pudo crear la cuenta");
    if (s.length < 3) return fail("Tu nombre de poeta debe tener al menos 3 letras");
    if (pw.length < 6) return fail("La contraseña debe tener al menos 6 caracteres");
    if (["admin", "versos", "versos-de-oro", "anonimo"].includes(s)) return fail("Ese nombre no está disponible");
    const salt = randomBytes(12).toString("hex");
    const u = { slug: s, alias, bio: txt(b.bio, 300), ciudad: txt(b.ciudad, 60), salt, hash: hash(pw, salt), at: Date.now() };
    const r = await db().setJSON("poeta/" + s, u, { onlyIfNew: true });
    if (!r.modified) return fail("Ese nombre de poeta ya existe. Prueba con otro.", 409);
    luego(avisar(x => x.admin, { title: "🖋 Nuevo poeta en Versos de Oro", body: `${alias} se acaba de unir a la casa`, url: "/admin.html", tag: "poeta-" + s }));
    return json({ token: sign({ u: s, at: Date.now() }), poeta: pubPoeta(u), dueno: s === DUENO }, 201);
  }
  if (M === "POST" && p[0] === "entrar") {
    const b = await body(), u = await db().get("poeta/" + slug(b.alias), { type: "json" }) as any;
    if (!u || hash(String(b.clave || ""), u.salt) !== u.hash) return fail("Nombre o contraseña incorrectos", 401);
    if (u.bloqueado) return fail("Esta cuenta está suspendida", 403);
    return json({ token: sign({ u: u.slug, v: u.tv || 0, at: Date.now() }), poeta: pubPoeta(u), dueno: u.slug === DUENO, temporal: !!u.temporal });
  }

  /* ===== lectura pública ===== */
  if (M === "GET" && p[0] === "poemas" && !p[1]) {
    const s = await settings(), L = (await all("poema/")).filter(x => x.estado === "publicado");
    // Poetas en pausa: sus poemas no los ve nadie más, pero ellos los siguen viendo como siempre (no se enteran)
    const yo = me()?.u, bloq = new Set((await all("poeta/")).filter(u => u.bloqueado || (u.pausado && u.slug !== yo)).map(u => u.slug));
    const V = L.filter(x => !bloq.has(x.autor)).sort((a, b) => (b.pubAt || b.at) - (a.pubAt || a.at));
    const dia = poemaDelDia(V, s.diaManual);
    return json({ poemas: V.map(pubPoema), dia: dia ? dia.id : null });
  }
  if (M === "GET" && p[0] === "poeta" && p[1]) {
    const u = await db().get("poeta/" + slug(p[1]), { type: "json" }) as any; if (!u || u.bloqueado || (u.pausado && me()?.u !== u.slug)) return fail("Ese poeta no existe", 404);
    const L = (await all("poema/")).filter(x => x.autor === u.slug && x.estado === "publicado").sort((a, b) => b.at - a.at);
    return json({ poeta: pubPoeta(u), poemas: L.map(pubPoema) });
  }
  // dar o quitar un oro (uno por teléfono)
  if (M === "POST" && p[0] === "oro" && p[1]) {
    const b = await body(), dev = String(b.device || "").replace(/[^a-z0-9-]/gi, "").slice(0, 40), id = String(p[1]).replace(/[^a-z0-9]/g, "");
    if (dev.length < 8) return fail("Falta el teléfono");
    const k = `oro/${id}/${dev}`, s = db(), had = await s.get(k);
    const x = await db().get("poema/" + id, { type: "json" }) as any; if (!x || x.estado !== "publicado") return fail("Ese poema no existe", 404);
    if (had) await s.delete(k); else await s.set(k, "1");
    const n = await mutate("poema/" + id, v => ({ ...v, oros: Math.max(0, (v.oros || 0) + (had ? -1 : 1)) }));
    return json({ oros: n?.oros || 0, dado: !had });
  }

  /* ===== mi cuaderno (poeta con sesión) ===== */
  if (p[0] === "yo") {
    const t = me(); if (!t) return fail("Entra con tu cuenta", 401);
    const u = await db().get("poeta/" + t.u, { type: "json" }) as any; if (!u) return fail("Tu cuenta ya no existe", 401);
    if ((u.tv || 0) !== (t.v || 0)) return fail("Tu contraseña cambió. Vuelve a entrar.", 401);
    if (u.bloqueado) return fail("Esta cuenta está suspendida", 403);
    if (M === "GET" && !p[1]) {
      const L = (await all("poema/")).filter(x => x.autor === u.slug).sort((a, b) => b.at - a.at);
      return json({ poeta: pubPoeta(u), poemas: L.map(pubPoema), revisar: (await settings()).revisar, dueno: u.slug === DUENO, temporal: !!u.temporal });
    }
    // cambiar mi contraseña (pide la actual)
    if (M === "PUT" && p[1] === "clave") {
      const b = await body(), nueva = String(b.nueva || "");
      if (hash(String(b.actual || ""), u.salt) !== u.hash) return fail("Tu contraseña actual no es correcta", 403);
      if (nueva.length < 6) return fail("La nueva contraseña debe tener al menos 6 caracteres");
      const salt = randomBytes(12).toString("hex"), tv = (u.tv || 0) + 1;
      if (nueva === String(b.actual || "")) return fail("La nueva debe ser distinta a la de acceso");
      await mutate("poeta/" + u.slug, v => ({ ...v, salt, hash: hash(nueva, salt), tv, temporal: false }));
      return json({ token: sign({ u: u.slug, v: tv, at: Date.now() }), poeta: pubPoeta(u), dueno: u.slug === DUENO });
    }
    if (M === "PUT" && p[1] === "perfil") {
      const b = await body(); const v = await mutate("poeta/" + u.slug, x => ({ ...x, bio: txt(b.bio, 300), ciudad: txt(b.ciudad, 60) }));
      return json({ poeta: pubPoeta(v) });
    }
    if ((M === "POST" && p[1] === "poemas" && !p[2]) || (M === "PUT" && p[1] === "poemas" && p[2])) {
      const b = await body(), titulo = txt(b.titulo, 120), texto = txt(b.texto, 8000).replace(/\n{4,}/g, "\n\n\n");
      if (!titulo) return fail("Ponle título a tu poema");
      if (texto.length < 20) return fail("El poema está muy corto");
      const tema = TEMAS.includes(b.tema) ? b.tema : "libre", s = await settings(), estado = s.revisar ? "revision" : "publicado";
      if (M === "POST") {
        const mine = (await all("poema/")).filter(x => x.autor === u.slug && x.at > Date.now() - 864e5).length;
        if (mine >= 15) return fail("Llegaste al límite de 15 poemas por día. Sigue mañana.", 429);
        const id = Date.now().toString(36) + randomBytes(3).toString("hex");
        const x = { id, titulo, texto, tema, autor: u.slug, alias: u.alias, at: Date.now(), pubAt: estado === "publicado" ? Date.now() : 0, oros: 0, estado };
        await db().setJSON("poema/" + id, x); if (estado === "publicado") luego(anunciarPoema(x));
        return json({ poema: pubPoema(x) }, 201);
      }
      const id = String(p[2]).replace(/[^a-z0-9]/g, "");
      let no = "", antes = "";
      const x = await mutate("poema/" + id, v => { antes = v.estado; if (v.autor !== u.slug) { no = "Ese poema no es tuyo"; return null; } return { ...v, titulo, texto, tema, estado, nota: "", pubAt: estado === "publicado" ? (v.pubAt || Date.now()) : v.pubAt, editado: Date.now() }; });
      if (!x) return fail("Ese poema no existe", 404); if (no) return fail(no, 403);
      if (x.estado === "publicado" && antes !== "publicado") luego(anunciarPoema(x));
      return json({ poema: pubPoema(x) });
    }
    if (M === "DELETE" && p[1] === "poemas" && p[2]) {
      const id = String(p[2]).replace(/[^a-z0-9]/g, ""), x = await db().get("poema/" + id, { type: "json" }) as any;
      if (!x || x.autor !== u.slug) return fail("Ese poema no existe", 404);
      await db().delete("poema/" + id); return json({ ok: true });
    }
  }

  /* ===== administrador (tú) ===== */
  if (p[0] === "admin") {
    if (!(await isAdmin(req))) return fail("Clave de administrador incorrecta", 401);
    try { await importarDiarios(); } catch (e) { console.error("diarios", e); }
    if (p[1] === "resumen" && M === "GET") {
      const L = await all("poema/"), U = await all("poeta/"), s = await settings();
      const pub = L.filter(x => x.estado === "publicado"), dia = poemaDelDia(pub, s.diaManual);
      const avisosN = (await db().list({ prefix: "sub/" })).blobs.length;
      return json({ avisos: avisosN, pendientes: L.filter(x => x.estado === "revision").length, publicados: pub.length, poetas: U.length, oros: pub.reduce((a, x) => a + (x.oros || 0), 0), revisar: s.revisar,
        dia: dia ? { id: dia.id, titulo: dia.titulo, alias: dia.alias } : null,
        ultimos: L.sort((a, b) => b.at - a.at).slice(0, 8).map(x => ({ id: x.id, titulo: x.titulo, alias: x.alias, estado: x.estado, at: x.at })) });
    }
    if (p[1] === "poemas" && M === "GET") return json({ poemas: (await all("poema/")).sort((a, b) => b.at - a.at).map(pubPoema) });
    if (p[1] === "poemas" && p[2] && M === "PATCH") {
      const b = await body(), id = String(p[2]).replace(/[^a-z0-9]/g, "");
      let antes = "";
      const x = await mutate("poema/" + id, v => {
        antes = v.estado; const n = { ...v };
        if (["publicado", "revision", "rechazado", "oculto"].includes(b.estado)) { n.estado = b.estado; if (b.estado === "publicado" && !v.pubAt) n.pubAt = Date.now(); }
        if (b.nota !== undefined) n.nota = txt(b.nota, 300);
        return n;
      });
      if (x && x.estado === "publicado" && antes !== "publicado") luego(anunciarPoema(x));
      return x ? json({ poema: pubPoema(x) }) : fail("Ese poema no existe", 404);
    }
    if (p[1] === "poemas" && p[2] && M === "DELETE") { await db().delete("poema/" + String(p[2]).replace(/[^a-z0-9]/g, "")); return json({ ok: true }); }
    if (p[1] === "poetas" && M === "GET") {
      const L = await all("poema/");
      return json({ poetas: (await all("poeta/")).sort((a, b) => b.at - a.at).map(u => ({ ...pubPoeta(u), bloqueado: !!u.bloqueado, pausado: !!u.pausado, temporal: !!u.temporal, poemas: L.filter(x => x.autor === u.slug).length, oros: L.filter(x => x.autor === u.slug).reduce((a, x) => a + (x.oros || 0), 0) })) });
    }
    // poner una contraseña nueva a cualquier cuenta (también la tuya, si se te olvida)
    if (p[1] === "poetas" && p[2] && p[3] === "clave" && M === "PUT") {
      const b = await body(), nueva = String(b.nueva || ""); if (nueva.length < 6) return fail("La contraseña debe tener al menos 6 caracteres");
      const salt = randomBytes(12).toString("hex");
      const u = await mutate("poeta/" + slug(p[2]), v => ({ ...v, salt, hash: hash(nueva, salt), tv: (v.tv || 0) + 1, temporal: true }));
      return u ? json({ ok: true }) : fail("Ese poeta no existe", 404);
    }
    if (p[1] === "poetas" && p[2] && M === "PATCH") {
      if (slug(p[2]) === DUENO) return fail("Esa es tu cuenta de dueño");
      const b = await body(), u = await mutate("poeta/" + slug(p[2]), v => ({ ...v, ...(b.bloqueado !== undefined ? { bloqueado: !!b.bloqueado } : {}), ...(b.pausado !== undefined ? { pausado: !!b.pausado } : {}) }));
      return u ? json({ ok: true }) : fail("Ese poeta no existe", 404);
    }
    if (p[1] === "settings") {
      if (M === "GET") return json(await settings());
      if (M === "PUT") {
        const b = await body(), s = await settings();
        if (b.revisar !== undefined) s.revisar = !!b.revisar;
        if (b.diaManual !== undefined) s.diaManual = String(b.diaManual || "").replace(/[^a-z0-9]/g, "");
        await db().setJSON("config/settings", s); return json(s);
      }
    }
  }
  return fail("Ruta no encontrada", 404);
}
export const config: Config = { path: "/api/*", rateLimit: { windowLimit: 90, windowSize: 60, aggregateBy: ["ip", "domain"] } };
