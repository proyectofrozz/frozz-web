import { useEffect, useMemo, useState } from "react";
import {
  Scissors,
  Triangle,
  Flame,
  SprayCan,
  Zap,
  Snowflake,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  Tv,
  X,
  History,
  Undo2,
  LayoutGrid,
  Monitor,
  BarChart3,
  Factory,
  User,
  CalendarDays,
  ChevronRight,
} from "lucide-react";

// ---------- Tipos ----------
type Prioridad = "baja" | "media" | "alta" | "urgente";
type EstacionId =
  | "corte"
  | "doblez"
  | "soldadura"
  | "pintura"
  | "electrica"
  | "refrigeracion"
  | "ensamblaje";
type EstadoFinal = "finalizado";
type Estado = EstacionId | EstadoFinal;

interface HistorialEntry {
  estacion: EstacionId;
  inicio: string; // ISO
  fin: string | null; // ISO
  operario: string;
  registradoPor: string;
}

interface Proyecto {
  id: string; // PR-2026-001
  cliente: string;
  producto: string;
  prioridad: Prioridad;
  estado: Estado;
  operario: string;
  inicio: string; // ISO
  entrega: string; // ISO
  entradaEstacion: string; // ISO -> tiempo transcurrido en estación
  historial: HistorialEntry[];
}

const ESTACIONES: {
  id: EstacionId;
  label: string;
  icon: typeof Scissors;
  color: string;
}[] = [
  { id: "corte", label: "Corte", icon: Scissors, color: "var(--stage-cutting)" },
  { id: "doblez", label: "Doblez", icon: Triangle, color: "var(--stage-bending)" },
  { id: "soldadura", label: "Soldadura", icon: Flame, color: "var(--stage-welding)" },
  { id: "pintura", label: "Pintura", icon: SprayCan, color: "var(--stage-painting)" },
  { id: "electrica", label: "Eléctrica", icon: Zap, color: "var(--stage-electrical)" },
  { id: "refrigeracion", label: "Refrigeración", icon: Snowflake, color: "var(--stage-refrigeration)" },
  { id: "ensamblaje", label: "Ensamblaje", icon: Wrench, color: "var(--stage-assembly)" },
];

const SIGUIENTE: Record<EstacionId, Estado> = {
  corte: "doblez",
  doblez: "soldadura",
  soldadura: "pintura",
  pintura: "electrica",
  electrica: "refrigeracion",
  refrigeracion: "ensamblaje",
  ensamblaje: "finalizado",
};

const OPERARIOS = [
  "Carlos Ramírez",
  "María Gómez",
  "Andrés Ortiz",
  "Luisa Fernanda",
  "Diego Torres",
  "Sandra Peña",
  "Julián Ríos",
];

// ---------- Datos de ejemplo ----------
const HOY = new Date();
function iso(offsetDays: number, hours = 0) {
  const d = new Date(HOY);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

const PROYECTOS_INICIAL: Proyecto[] = [
  { id: "PR-2026-001", cliente: "Olímpica", producto: "UMA 10 TR", prioridad: "alta", estado: "corte", operario: "Carlos Ramírez", inicio: iso(-2), entrega: iso(4), entradaEstacion: iso(0, -3), historial: [] },
  { id: "PR-2026-002", cliente: "Éxito", producto: "Split Inverter 36 000 BTU", prioridad: "media", estado: "corte", operario: "María Gómez", inicio: iso(-1), entrega: iso(5), entradaEstacion: iso(0, -1), historial: [] },
  { id: "PR-2026-003", cliente: "Carulla", producto: "Chiller 40 TR", prioridad: "urgente", estado: "doblez", operario: "Andrés Ortiz", inicio: iso(-3), entrega: iso(1), entradaEstacion: iso(0, -5), historial: [] },
  { id: "PR-2026-004", cliente: "Alkosto", producto: "UMA 15 TR", prioridad: "media", estado: "doblez", operario: "Luisa Fernanda", inicio: iso(-2), entrega: iso(6), entradaEstacion: iso(0, -2), historial: [] },
  { id: "PR-2026-005", cliente: "D1", producto: "Cuarto Frío 20 m³", prioridad: "alta", estado: "soldadura", operario: "Diego Torres", inicio: iso(-4), entrega: iso(3), entradaEstacion: iso(0, -6), historial: [] },
  { id: "PR-2026-006", cliente: "Jumbo", producto: "Vitrina Refrigerada VR-8", prioridad: "baja", estado: "soldadura", operario: "Sandra Peña", inicio: iso(-3), entrega: iso(7), entradaEstacion: iso(0, -2), historial: [] },
  { id: "PR-2026-007", cliente: "Ara", producto: "Congelador Industrial 800L", prioridad: "media", estado: "pintura", operario: "Julián Ríos", inicio: iso(-5), entrega: iso(2), entradaEstacion: iso(0, -4), historial: [] },
  { id: "PR-2026-008", cliente: "Olímpica", producto: "UMA 20 TR", prioridad: "urgente", estado: "pintura", operario: "Carlos Ramírez", inicio: iso(-6), entrega: iso(-1), entradaEstacion: iso(0, -8), historial: [] },
  { id: "PR-2026-009", cliente: "Éxito", producto: "Chiller Enfriado por Aire 60 TR", prioridad: "alta", estado: "electrica", operario: "María Gómez", inicio: iso(-4), entrega: iso(2), entradaEstacion: iso(0, -3), historial: [] },
  { id: "PR-2026-010", cliente: "Alkosto", producto: "Cámara de Congelación 30 m³", prioridad: "media", estado: "refrigeracion", operario: "Andrés Ortiz", inicio: iso(-7), entrega: iso(1), entradaEstacion: iso(0, -5), historial: [] },
  { id: "PR-2026-011", cliente: "Carulla", producto: "Vitrina Panorámica VP-4", prioridad: "baja", estado: "refrigeracion", operario: "Luisa Fernanda", inicio: iso(-6), entrega: iso(3), entradaEstacion: iso(0, -1), historial: [] },
  { id: "PR-2026-012", cliente: "Jumbo", producto: "Isla de Congelación 3m", prioridad: "alta", estado: "ensamblaje", operario: "Diego Torres", inicio: iso(-8), entrega: iso(1), entradaEstacion: iso(0, -6), historial: [] },
  { id: "PR-2026-013", cliente: "D1", producto: "Cava de Vinos 200 bot", prioridad: "media", estado: "ensamblaje", operario: "Sandra Peña", inicio: iso(-9), entrega: iso(0), entradaEstacion: iso(0, -4), historial: [] },
  { id: "PR-2026-014", cliente: "Ara", producto: "UMA 5 TR", prioridad: "urgente", estado: "corte", operario: "Julián Ríos", inicio: iso(0), entrega: iso(-1), entradaEstacion: iso(0, -1), historial: [] },
];

// ---------- Helpers ----------
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function elapsedText(fromISO: string, toISO?: string) {
  const from = new Date(fromISO).getTime();
  const to = toISO ? new Date(toISO).getTime() : Date.now();
  const mins = Math.max(0, Math.round((to - from) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

function isDelayed(p: Proyecto) {
  return p.estado !== "finalizado" && new Date(p.entrega).getTime() < Date.now();
}

function progressPct(p: Proyecto) {
  if (p.estado === "finalizado") return 100;
  const idx = ESTACIONES.findIndex((e) => e.id === p.estado);
  return Math.round(((idx + 0.5) / ESTACIONES.length) * 100);
}

const PRIORIDAD_STYLE: Record<Prioridad, { bg: string; text: string; label: string; dot: string }> = {
  baja: { bg: "bg-slate-100", text: "text-slate-700", label: "Baja", dot: "bg-slate-400" },
  media: { bg: "bg-blue-100", text: "text-blue-700", label: "Media", dot: "bg-blue-500" },
  alta: { bg: "bg-amber-100", text: "text-amber-800", label: "Alta", dot: "bg-amber-500" },
  urgente: { bg: "bg-red-100", text: "text-red-700", label: "Urgente", dot: "bg-red-600" },
};

function PrioridadBadge({ p, size = "sm" }: { p: Prioridad; size?: "sm" | "lg" }) {
  const s = PRIORIDAD_STYLE[p];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${s.bg} ${s.text} ${
        size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ---------- Reloj ----------
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// ---------- Tarjeta de proyecto ----------
function ProyectoCard({
  p,
  onCompletar,
  onHistorial,
  tv = false,
}: {
  p: Proyecto;
  onCompletar: (p: Proyecto) => void;
  onHistorial: (p: Proyecto) => void;
  tv?: boolean;
}) {
  const delayed = isDelayed(p);
  const pct = progressPct(p);
  const estStyle = ESTACIONES.find((e) => e.id === p.estado);

  return (
    <article
      className={`group relative rounded-2xl border bg-card transition-all hover:-translate-y-0.5 ${
        tv ? "p-6" : "p-4"
      }`}
      style={{
        boxShadow: "var(--shadow-card)",
        borderColor: delayed ? "oklch(0.6 0.22 27)" : "var(--border)",
        borderWidth: delayed ? 2 : 1,
      }}
    >
      {delayed && (
        <div className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
          <AlertTriangle className="h-3 w-3" /> Retrasado
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`font-mono font-semibold text-muted-foreground ${tv ? "text-sm" : "text-xs"}`}>
            {p.id}
          </div>
          <div className={`mt-0.5 truncate font-bold text-foreground ${tv ? "text-2xl" : "text-lg"}`}>
            {p.producto}
          </div>
          <div className={`truncate text-muted-foreground ${tv ? "text-base" : "text-sm"}`}>
            Cliente: <span className="font-semibold text-foreground">{p.cliente}</span>
          </div>
        </div>
        <PrioridadBadge p={p.prioridad} size={tv ? "lg" : "sm"} />
      </div>

      <div className={`mt-3 grid grid-cols-2 gap-2 ${tv ? "text-base" : "text-sm"}`}>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <User className={`shrink-0 ${tv ? "h-5 w-5" : "h-4 w-4"}`} />
          <span className="truncate font-medium text-foreground">{p.operario}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className={`shrink-0 ${tv ? "h-5 w-5" : "h-4 w-4"}`} />
          <span className="truncate">En estación: {elapsedText(p.entradaEstacion)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className={`shrink-0 ${tv ? "h-5 w-5" : "h-4 w-4"}`} />
          <span className="truncate">Inicio: {fmtDate(p.inicio)}</span>
        </div>
        <div className={`flex items-center gap-1.5 ${delayed ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
          <CalendarDays className={`shrink-0 ${tv ? "h-5 w-5" : "h-4 w-4"}`} />
          <span className="truncate">Entrega: {fmtDate(p.entrega)}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className={`font-semibold text-muted-foreground ${tv ? "text-sm" : "text-xs"}`}>
            Avance
          </span>
          <span className={`font-bold tabular-nums text-foreground ${tv ? "text-base" : "text-sm"}`}>
            {pct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, var(--primary), ${estStyle?.color ?? "var(--primary)"})`,
            }}
          />
        </div>
      </div>

      <div className={`mt-4 flex gap-2 ${tv ? "flex-col" : ""}`}>
        <button
          onClick={() => onCompletar(p)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground transition-all active:scale-[0.98] hover:opacity-90 ${
            tv ? "py-5 text-xl" : "py-3 text-sm"
          }`}
        >
          <CheckCircle2 className={tv ? "h-6 w-6" : "h-4 w-4"} />
          Completar tarea
        </button>
        {!tv && (
          <button
            onClick={() => onHistorial(p)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
          >
            <History className="h-4 w-4" />
            Historial
          </button>
        )}
      </div>
    </article>
  );
}

// ---------- Kanban column ----------
function KanbanColumn({
  estacion,
  proyectos,
  onCompletar,
  onHistorial,
}: {
  estacion: (typeof ESTACIONES)[number];
  proyectos: Proyecto[];
  onCompletar: (p: Proyecto) => void;
  onHistorial: (p: Proyecto) => void;
}) {
  const Icon = estacion.icon;
  const activos = proyectos.length;
  const avgMin =
    activos > 0
      ? Math.round(
          proyectos.reduce((acc, p) => acc + (Date.now() - new Date(p.entradaEstacion).getTime()) / 60000, 0) /
            activos,
        )
      : 0;
  const avgTxt = avgMin >= 60 ? `${Math.floor(avgMin / 60)}h ${avgMin % 60}m` : `${avgMin}m`;
  const bottleneck = activos >= 3;

  return (
    <section className="flex min-h-[420px] flex-col rounded-3xl border border-border bg-secondary/50 p-3">
      <header
        className="mb-3 rounded-2xl bg-card p-3"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white"
              style={{ backgroundColor: estacion.color }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Estación
              </div>
              <h2 className="truncate text-base font-black text-foreground">{estacion.label}</h2>
            </div>
          </div>
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-sm font-black tabular-nums text-primary-foreground">
            {activos}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Tiempo prom.: <span className="font-bold text-foreground">{avgTxt}</span>
          </span>
          {bottleneck && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
              <AlertTriangle className="h-3 w-3" /> Cuello de botella
            </span>
          )}
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-3">
        {proyectos.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
            Sin proyectos
          </div>
        ) : (
          proyectos.map((p) => (
            <ProyectoCard key={p.id} p={p} onCompletar={onCompletar} onHistorial={onHistorial} />
          ))
        )}
      </div>
    </section>
  );
}

// ---------- Modales ----------
function ConfirmModal({
  proyecto,
  onConfirm,
  onCancel,
}: {
  proyecto: Proyecto | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!proyecto) return null;
  const siguiente = SIGUIENTE[proyecto.estado as EstacionId];
  const siguienteLabel =
    siguiente === "finalizado" ? "Proyecto finalizado" : ESTACIONES.find((e) => e.id === siguiente)?.label;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl">
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Confirmar acción
        </div>
        <h3 className="text-2xl font-black text-foreground">
          ¿Está seguro de que desea finalizar esta tarea?
        </h3>
        <div className="mt-4 rounded-xl border border-border bg-secondary/50 p-3 text-sm">
          <div className="font-mono text-muted-foreground">{proyecto.id}</div>
          <div className="font-bold text-foreground">{proyecto.producto}</div>
          <div className="text-muted-foreground">Cliente: {proyecto.cliente}</div>
          <div className="mt-2 flex items-center gap-2 text-foreground">
            <span className="text-muted-foreground">Pasará a:</span>
            <span className="inline-flex items-center gap-1 font-bold">
              <ChevronRight className="h-4 w-4" />
              {siguienteLabel}
            </span>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border bg-card py-3 font-bold text-foreground hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:opacity-90"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function HistorialModal({
  proyecto,
  onClose,
}: {
  proyecto: Proyecto | null;
  onClose: () => void;
}) {
  if (!proyecto) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Historial del proyecto
            </div>
            <h3 className="mt-1 font-mono text-lg font-bold text-foreground">{proyecto.id}</h3>
            <div className="text-sm text-muted-foreground">
              {proyecto.producto} · {proyecto.cliente}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {proyecto.historial.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aún no hay eventos registrados para este proyecto.
          </div>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-border pl-5">
            {proyecto.historial.map((h, i) => {
              const est = ESTACIONES.find((e) => e.id === h.estacion);
              const Icon = est?.icon ?? Factory;
              return (
                <li key={i} className="relative">
                  <span
                    className="absolute -left-[30px] grid h-7 w-7 place-items-center rounded-full text-white ring-4 ring-background"
                    style={{ backgroundColor: est?.color ?? "var(--primary)" }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="rounded-xl bg-secondary/60 p-3">
                    <div className="font-bold text-foreground">{est?.label}</div>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <div>Inicio: <span className="text-foreground">{fmtDateTime(h.inicio)}</span></div>
                      <div>Fin: <span className="text-foreground">{h.fin ? fmtDateTime(h.fin) : "—"}</span></div>
                      <div>Tiempo: <span className="text-foreground">{h.fin ? elapsedText(h.inicio, h.fin) : "—"}</span></div>
                      <div>Operario: <span className="text-foreground">{h.operario}</span></div>
                      <div className="col-span-2">Registrado por: <span className="text-foreground">{h.registradoPor}</span></div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

// ---------- Toast de deshacer ----------
function UndoToast({
  visible,
  msg,
  onUndo,
  onDismiss,
}: {
  visible: boolean;
  msg: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-4 rounded-2xl bg-foreground px-5 py-3 text-background shadow-2xl">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        <span className="text-sm font-semibold">{msg}</span>
        <button
          onClick={onUndo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background/10 px-3 py-1.5 text-sm font-bold hover:bg-background/20"
        >
          <Undo2 className="h-4 w-4" />
          Deshacer
        </button>
        <button onClick={onDismiss} className="rounded p-1 hover:bg-background/10" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------- Vista Planeación ----------
function PlaneacionView({ proyectos }: { proyectos: Proyecto[] }) {
  const activos = proyectos.filter((p) => p.estado !== "finalizado");
  const finalizadosHoy = proyectos.filter((p) => {
    if (p.estado !== "finalizado") return false;
    const last = p.historial[p.historial.length - 1];
    if (!last?.fin) return false;
    const d = new Date(last.fin);
    return d.toDateString() === new Date().toDateString();
  });
  const retrasados = activos.filter(isDelayed);
  const porEstacion = ESTACIONES.map((e) => ({
    ...e,
    count: activos.filter((p) => p.estado === e.id).length,
  }));
  const maxCarga = porEstacion.reduce((a, b) => (b.count > a.count ? b : a), porEstacion[0]);
  const maxBar = Math.max(1, ...porEstacion.map((e) => e.count));

  const tiemposEstacion = ESTACIONES.map((e) => {
    const times = activos
      .filter((p) => p.estado === e.id)
      .map((p) => (Date.now() - new Date(p.entradaEstacion).getTime()) / 3600000);
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    return { ...e, avgH: Math.round(avg * 10) / 10 };
  });
  const tiempoTotalProm =
    tiemposEstacion.reduce((a, b) => a + b.avgH, 0);

  // pie chart data (prioridades)
  const prio = (["urgente", "alta", "media", "baja"] as Prioridad[]).map((p) => ({
    label: PRIORIDAD_STYLE[p].label,
    value: activos.filter((x) => x.prioridad === p).length,
    color: PRIORIDAD_STYLE[p].dot.replace("bg-", ""),
    dotClass: PRIORIDAD_STYLE[p].dot,
  }));
  const total = prio.reduce((a, b) => a + b.value, 0) || 1;
  let acc = 0;
  const arcs = prio.map((p) => {
    const start = acc / total;
    acc += p.value;
    const end = acc / total;
    return { ...p, start, end };
  });

  return (
    <div className="mx-auto max-w-[1920px] space-y-6 px-6 py-6 xl:px-10">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Proyectos activos" value={activos.length} accent="var(--primary)" />
        <Kpi label="Finalizados hoy" value={finalizadosHoy.length} accent="oklch(0.6 0.16 150)" />
        <Kpi label="Proyectos retrasados" value={retrasados.length} accent="oklch(0.6 0.22 27)" />
        <Kpi
          label="Estación con mayor carga"
          value={maxCarga.count}
          accent={maxCarga.color}
          hint={maxCarga.label}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-foreground">Proyectos por estación</h3>
              <p className="text-xs text-muted-foreground">Distribución de carga en el flujo productivo</p>
            </div>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {porEstacion.map((e) => (
              <div key={e.id} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-sm font-semibold text-foreground">{e.label}</div>
                <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-secondary">
                  <div
                    className="h-full rounded-lg transition-all"
                    style={{ width: `${(e.count / maxBar) * 100}%`, backgroundColor: e.color }}
                  />
                  <span className="absolute inset-0 flex items-center px-3 text-sm font-bold text-foreground">
                    {e.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <h3 className="text-lg font-black text-foreground">Prioridades</h3>
          <p className="text-xs text-muted-foreground">Distribución de proyectos activos</p>
          <div className="mt-4 flex items-center gap-6">
            <svg viewBox="0 0 42 42" className="h-40 w-40">
              <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--secondary)" strokeWidth="6" />
              {arcs.map((a, i) => {
                const dash = (a.end - a.start) * 100;
                const offset = 25 - a.start * 100;
                const colors = ["#dc2626", "#f59e0b", "#3b82f6", "#94a3b8"];
                return (
                  <circle
                    key={i}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="none"
                    stroke={colors[i]}
                    strokeWidth="6"
                    strokeDasharray={`${dash} ${100 - dash}`}
                    strokeDashoffset={offset}
                    transform="rotate(-90 21 21)"
                  />
                );
              })}
              <text x="21" y="22" textAnchor="middle" fontSize="6" fontWeight="800" fill="currentColor">
                {activos.length}
              </text>
              <text x="21" y="27" textAnchor="middle" fontSize="2.5" fill="currentColor" opacity="0.6">
                activos
              </text>
            </svg>
            <ul className="space-y-2 text-sm">
              {prio.map((p) => (
                <li key={p.label} className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${p.dotClass}`} />
                  <span className="font-semibold text-foreground">{p.label}</span>
                  <span className="text-muted-foreground">· {p.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-foreground">Tiempos promedio por estación</h3>
            <p className="text-xs text-muted-foreground">
              Tiempo total estimado de fabricación:{" "}
              <span className="font-bold text-foreground">{tiempoTotalProm.toFixed(1)} h</span>
            </p>
          </div>
        </div>
        <div className="flex items-end gap-2 overflow-x-auto pb-2">
          {tiemposEstacion.map((e, i) => {
            const max = Math.max(1, ...tiemposEstacion.map((x) => x.avgH));
            const h = (e.avgH / max) * 100;
            return (
              <div key={e.id} className="flex flex-col items-center gap-2">
                <div className="flex h-40 w-16 flex-col justify-end">
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{ height: `${h}%`, backgroundColor: e.color, minHeight: 4 }}
                    title={`${e.avgH}h`}
                  />
                </div>
                <span className="text-[10px] font-bold text-foreground">{e.avgH}h</span>
                <span className="w-16 truncate text-center text-[11px] text-muted-foreground">{e.label}</span>
                {i < tiemposEstacion.length - 1 && (
                  <ChevronRight className="hidden h-4 w-4 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number | string;
  accent: string;
  hint?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="absolute left-0 top-0 h-full w-1.5" style={{ backgroundColor: accent }} />
      <div className="pl-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-1 text-4xl font-black tabular-nums text-foreground xl:text-5xl">{value}</div>
        {hint && <div className="mt-1 text-sm font-semibold text-foreground">{hint}</div>}
      </div>
    </div>
  );
}

// ---------- App principal ----------
type Vista = "general" | "estacion" | "planeacion";

export function FrozzMes() {
  const [proyectos, setProyectos] = useState<Proyecto[]>(PROYECTOS_INICIAL);
  const [vista, setVista] = useState<Vista>("general");
  const [estacionSel, setEstacionSel] = useState<EstacionId>("corte");
  const [prioridad, setPrioridad] = useState<string>("all");
  const [operario, setOperario] = useState<string>("all");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [tvMode, setTvMode] = useState(false);
  const [confirmProyecto, setConfirmProyecto] = useState<Proyecto | null>(null);
  const [historialProyecto, setHistorialProyecto] = useState<Proyecto | null>(null);
  const [undoState, setUndoState] = useState<{
    prev: Proyecto[];
    msg: string;
    at: number;
  } | null>(null);

  const now = useNow(1000);
  const [tvTick, setTvTick] = useState(0);
  useEffect(() => {
    if (!tvMode) return;
    const id = setInterval(() => setTvTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [tvMode]);
  // ensure tvTick is referenced (prevents dead-code warnings)
  void tvTick;

  // Auto-hide undo after 5 min
  useEffect(() => {
    if (!undoState) return;
    const id = setTimeout(() => setUndoState(null), 5 * 60 * 1000);
    return () => clearTimeout(id);
  }, [undoState]);

  const filtrados = useMemo(() => {
    return proyectos.filter((p) => {
      if (prioridad !== "all" && p.prioridad !== prioridad) return false;
      if (operario !== "all" && p.operario !== operario) return false;
      if (estadoFiltro !== "all" && p.estado !== estadoFiltro) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !p.id.toLowerCase().includes(q) &&
          !p.cliente.toLowerCase().includes(q) &&
          !p.producto.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [proyectos, prioridad, operario, estadoFiltro, query]);

  const handleCompletarClick = (p: Proyecto) => setConfirmProyecto(p);

  const doCompletar = () => {
    if (!confirmProyecto) return;
    const prev = proyectos;
    const p = confirmProyecto;
    const ahora = new Date().toISOString();
    const siguiente = SIGUIENTE[p.estado as EstacionId];
    const nuevo: Proyecto = {
      ...p,
      estado: siguiente,
      entradaEstacion: siguiente === "finalizado" ? p.entradaEstacion : ahora,
      historial: [
        ...p.historial,
        {
          estacion: p.estado as EstacionId,
          inicio: p.entradaEstacion,
          fin: ahora,
          operario: p.operario,
          registradoPor: p.operario,
        },
      ],
    };
    setProyectos(proyectos.map((x) => (x.id === p.id ? nuevo : x)));
    setUndoState({
      prev,
      msg:
        siguiente === "finalizado"
          ? `${p.id} finalizado correctamente.`
          : `Tarea completada. ${p.id} pasó a ${ESTACIONES.find((e) => e.id === siguiente)?.label}.`,
      at: Date.now(),
    });
    setConfirmProyecto(null);
  };

  const doUndo = () => {
    if (!undoState) return;
    setProyectos(undoState.prev);
    setUndoState(null);
  };

  const dateStr = now
    ? now.toLocaleDateString("es-CO", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";
  const timeStr = now
    ? now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";

  // ---------- Modo TV ----------
  if (tvMode) {
    const estacion = ESTACIONES.find((e) => e.id === estacionSel)!;
    const stageProjects = proyectos.filter((p) => p.estado === estacionSel);
    const Icon = estacion.icon;
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1920px] items-center justify-between gap-6 px-8 py-5">
            <div className="flex items-center gap-4">
              <div
                className="grid h-16 w-16 place-items-center rounded-2xl text-white"
                style={{ backgroundColor: estacion.color }}
              >
                <Icon className="h-8 w-8" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">
                  FROZZ · MES · Estación
                </div>
                <h1 className="text-4xl font-black tracking-tight text-foreground">
                  {estacion.label}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <select
                value={estacionSel}
                onChange={(e) => setEstacionSel(e.target.value as EstacionId)}
                className="h-12 rounded-xl border border-border bg-card px-4 text-lg font-bold text-foreground"
              >
                {ESTACIONES.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
              <div className="text-right">
                <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {dateStr}
                </div>
                <div className="font-mono text-4xl font-black tabular-nums text-foreground">
                  {timeStr}
                </div>
              </div>
              <button
                onClick={() => setTvMode(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-base font-bold text-foreground hover:bg-secondary"
              >
                <X className="h-5 w-5" />
                Salir modo pantalla
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1920px] px-8 py-8">
          {stageProjects.length === 0 ? (
            <div className="grid min-h-[60vh] place-items-center rounded-3xl border border-dashed border-border text-2xl text-muted-foreground">
              No hay proyectos en {estacion.label}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {stageProjects.map((p) => (
                <ProyectoCard
                  key={p.id}
                  p={p}
                  tv
                  onCompletar={handleCompletarClick}
                  onHistorial={() => {}}
                />
              ))}
            </div>
          )}
        </main>

        <ConfirmModal
          proyecto={confirmProyecto}
          onConfirm={doCompletar}
          onCancel={() => setConfirmProyecto(null)}
        />
        <UndoToast
          visible={!!undoState}
          msg={undoState?.msg ?? ""}
          onUndo={doUndo}
          onDismiss={() => setUndoState(null)}
        />
      </div>
    );
  }

  // ---------- Layout normal ----------
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1920px] flex-col gap-4 px-6 py-4 xl:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-primary-foreground"
                style={{ background: "linear-gradient(135deg, var(--primary), oklch(0.45 0.22 255))" }}
              >
                <Factory className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  FROZZ · Sistema de Ejecución de Manufactura
                </div>
                <h1 className="truncate text-2xl font-black tracking-tight text-foreground xl:text-3xl">
                  Seguimiento de Producción
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden text-right sm:block">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {dateStr}
                </div>
                <div className="font-mono text-2xl font-bold tabular-nums text-foreground">
                  {timeStr}
                </div>
              </div>
              <button
                onClick={() => setTvMode(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-bold text-background hover:opacity-90"
              >
                <Tv className="h-4 w-4" />
                Modo Pantalla
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <TabButton
              active={vista === "general"}
              onClick={() => setVista("general")}
              icon={<LayoutGrid className="h-4 w-4" />}
              label="Vista general"
            />
            <TabButton
              active={vista === "estacion"}
              onClick={() => setVista("estacion")}
              icon={<Monitor className="h-4 w-4" />}
              label="Por estación"
            />
            <TabButton
              active={vista === "planeacion"}
              onClick={() => setVista("planeacion")}
              icon={<BarChart3 className="h-4 w-4" />}
              label="Planeación / Gerencia"
            />

            {vista === "estacion" && (
              <select
                value={estacionSel}
                onChange={(e) => setEstacionSel(e.target.value as EstacionId)}
                className="ml-2 h-11 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground"
              >
                {ESTACIONES.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Filtros */}
          {vista !== "planeacion" && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-secondary-foreground">
                <Filter className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Filtros</span>
              </div>
              <FilterSelect
                label="Prioridad"
                value={prioridad}
                onChange={setPrioridad}
                options={[
                  { value: "all", label: "Todas" },
                  { value: "urgente", label: "Urgente" },
                  { value: "alta", label: "Alta" },
                  { value: "media", label: "Media" },
                  { value: "baja", label: "Baja" },
                ]}
              />
              <FilterSelect
                label="Estación"
                value={estadoFiltro}
                onChange={setEstadoFiltro}
                options={[
                  { value: "all", label: "Todas" },
                  ...ESTACIONES.map((e) => ({ value: e.id, label: e.label })),
                  { value: "finalizado", label: "Finalizado" },
                ]}
              />
              <FilterSelect
                label="Operario"
                value={operario}
                onChange={setOperario}
                options={[
                  { value: "all", label: "Todos" },
                  ...OPERARIOS.map((o) => ({ value: o, label: o })),
                ]}
              />
              <label className="ml-auto flex min-w-0 flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Buscar
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Código, cliente o producto…"
                    className="h-11 w-72 rounded-xl border border-border bg-card pl-9 pr-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </label>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1920px] px-6 pb-10 pt-6 xl:px-10">
        {vista === "general" && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[1800px]:grid-cols-7">
            {ESTACIONES.map((e) => (
              <KanbanColumn
                key={e.id}
                estacion={e}
                proyectos={filtrados.filter((p) => p.estado === e.id)}
                onCompletar={handleCompletarClick}
                onHistorial={setHistorialProyecto}
              />
            ))}
          </div>
        )}

        {vista === "estacion" && (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtrados
              .filter((p) => p.estado === estacionSel)
              .map((p) => (
                <ProyectoCard
                  key={p.id}
                  p={p}
                  onCompletar={handleCompletarClick}
                  onHistorial={setHistorialProyecto}
                />
              ))}
            {filtrados.filter((p) => p.estado === estacionSel).length === 0 && (
              <div className="col-span-full grid min-h-[40vh] place-items-center rounded-3xl border border-dashed border-border text-muted-foreground">
                No hay proyectos en esta estación
              </div>
            )}
          </div>
        )}

        {vista === "planeacion" && <PlaneacionView proyectos={proyectos} />}
      </main>

      <ConfirmModal
        proyecto={confirmProyecto}
        onConfirm={doCompletar}
        onCancel={() => setConfirmProyecto(null)}
      />
      <HistorialModal proyecto={historialProyecto} onClose={() => setHistorialProyecto(null)} />
      <UndoToast
        visible={!!undoState}
        msg={undoState?.msg ?? ""}
        onUndo={doUndo}
        onDismiss={() => setUndoState(null)}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
        active
          ? "bg-primary text-primary-foreground shadow"
          : "border border-border bg-card text-foreground hover:bg-secondary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 min-w-40 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}