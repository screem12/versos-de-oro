// Versos de Oro: poetas con cuenta, poemas que pasan por tu revisión, «oros» (me gusta) y tu administrador.
import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import diarios from "../../diarios.json" with { type: "json" };
import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";

const db = () => getStore({ name: "versos", consistency: "strong" });
const json = (d: unknown, status = 200) => Response.json(d, { status, headers: { "cache-control": "no-store" } });
const fail = (m: string, status = 400) => json({ error: m }, status);
const secret = () => Netlify.env.get("AUTH_SECRET") || "";
function isAdmin(req: Request) {
  const k = Netlify.env.get("ADMIN_KEY"), got = req.headers.get("x-admin-key") || "";
  return !!k && got.length === k.length && timingSafeEqual(Buffer.from(got), Buffer.from(k));
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
async function route(req: Request, _ctx: Context) {
  const p = new URL(req.url).pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean), M = req.method;
  const body = async () => { try { return await req.json(); } catch { return {}; } };
  if (!secret()) return fail("Falta configurar la app", 500);
  const me = () => { const t = verify((req.headers.get("authorization") || "").replace(/^Bearer /, "")); return t?.u ? t : null; };

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
    return json({ token: sign({ u: s, at: Date.now() }), poeta: pubPoeta(u) }, 201);
  }
  if (M === "POST" && p[0] === "entrar") {
    const b = await body(), u = await db().get("poeta/" + slug(b.alias), { type: "json" }) as any;
    if (!u || hash(String(b.clave || ""), u.salt) !== u.hash) return fail("Nombre o contraseña incorrectos", 401);
    if (u.bloqueado) return fail("Esta cuenta está suspendida", 403);
    return json({ token: sign({ u: u.slug, at: Date.now() }), poeta: pubPoeta(u) });
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
    if (u.bloqueado) return fail("Esta cuenta está suspendida", 403);
    if (M === "GET" && !p[1]) {
      const L = (await all("poema/")).filter(x => x.autor === u.slug).sort((a, b) => b.at - a.at);
      return json({ poeta: pubPoeta(u), poemas: L.map(pubPoema), revisar: (await settings()).revisar });
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
        await db().setJSON("poema/" + id, x); return json({ poema: pubPoema(x) }, 201);
      }
      const id = String(p[2]).replace(/[^a-z0-9]/g, "");
      let no = "";
      const x = await mutate("poema/" + id, v => { if (v.autor !== u.slug) { no = "Ese poema no es tuyo"; return null; } return { ...v, titulo, texto, tema, estado, nota: "", pubAt: estado === "publicado" ? (v.pubAt || Date.now()) : v.pubAt, editado: Date.now() }; });
      if (!x) return fail("Ese poema no existe", 404); if (no) return fail(no, 403);
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
    if (!isAdmin(req)) return fail("Clave de administrador incorrecta", 401);
    try { await importarDiarios(); } catch (e) { console.error("diarios", e); }
    if (p[1] === "resumen" && M === "GET") {
      const L = await all("poema/"), U = await all("poeta/"), s = await settings();
      const pub = L.filter(x => x.estado === "publicado"), dia = poemaDelDia(pub, s.diaManual);
      return json({ pendientes: L.filter(x => x.estado === "revision").length, publicados: pub.length, poetas: U.length, oros: pub.reduce((a, x) => a + (x.oros || 0), 0), revisar: s.revisar,
        dia: dia ? { id: dia.id, titulo: dia.titulo, alias: dia.alias } : null,
        ultimos: L.sort((a, b) => b.at - a.at).slice(0, 8).map(x => ({ id: x.id, titulo: x.titulo, alias: x.alias, estado: x.estado, at: x.at })) });
    }
    if (p[1] === "poemas" && M === "GET") return json({ poemas: (await all("poema/")).sort((a, b) => b.at - a.at).map(pubPoema) });
    if (p[1] === "poemas" && p[2] && M === "PATCH") {
      const b = await body(), id = String(p[2]).replace(/[^a-z0-9]/g, "");
      const x = await mutate("poema/" + id, v => {
        const n = { ...v };
        if (["publicado", "revision", "rechazado", "oculto"].includes(b.estado)) { n.estado = b.estado; if (b.estado === "publicado" && !v.pubAt) n.pubAt = Date.now(); }
        if (b.nota !== undefined) n.nota = txt(b.nota, 300);
        return n;
      });
      return x ? json({ poema: pubPoema(x) }) : fail("Ese poema no existe", 404);
    }
    if (p[1] === "poemas" && p[2] && M === "DELETE") { await db().delete("poema/" + String(p[2]).replace(/[^a-z0-9]/g, "")); return json({ ok: true }); }
    if (p[1] === "poetas" && M === "GET") {
      const L = await all("poema/");
      return json({ poetas: (await all("poeta/")).sort((a, b) => b.at - a.at).map(u => ({ ...pubPoeta(u), bloqueado: !!u.bloqueado, pausado: !!u.pausado, poemas: L.filter(x => x.autor === u.slug).length, oros: L.filter(x => x.autor === u.slug).reduce((a, x) => a + (x.oros || 0), 0) })) });
    }
    if (p[1] === "poetas" && p[2] && M === "PATCH") {
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
