import { useEffect, useMemo, useState } from "react";
import {
  Scissors,
  Triangle,
  Flame,
  SprayCan,
  Zap,
  Snowflake,
  Wrench,
  PenTool,
  Hourglass,
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
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  type Proyecto,
  type EstadoProyecto,
  ORDEN_ESTACIONES,
  TODAS_LAS_COLUMNAS,
  SIGUIENTE_ESTADO,
  formatProjectCode,
  orSinInformacion,
} from "@/lib/notion/mapper";

// ---------- Historial (SOLO local de sesión, NO persistido en Notion) ----------
// Notion no tiene una propiedad que almacene el historial completo de
// estaciones, solamente "Entrada a estación" (el momento en que el proyecto
// entró a la estación actual). Por lo tanto este historial se reconstruye
// únicamente a partir de las transiciones realizadas durante la sesión actual
// del navegador y se pierde al recargar o sincronizar. No representa datos
// reales de Notion y nunca debe presentarse como si lo fuera.
interface HistorialEntry {
  estacion: EstadoProyecto;
  inicio: string | null; // ISO
  fin: string; // ISO
  personaACargo: string;
}

// ---------- Configuración visual de estaciones ----------
// El id y el label deben coincidir EXACTAMENTE con el valor de la propiedad
// Status "Estado" en Notion. Esto es solo configuración de interfaz (iconos,
// colores, orden); no crea una propiedad "Estación" adicional.
const ESTACION_CONFIG: Record<
  EstadoProyecto,
  { label: string; icon: typeof Scissors; color: string }
> = {
  "Sin empezar": { label: "Sin empezar", icon: Hourglass, color: "var(--stage-not-started)" },
  "Diseño": { label: "Diseño", icon: PenTool, color: "var(--stage-design)" },
  "Corte": { label: "Corte", icon: Scissors, color: "var(--stage-cutting)" },
  "Doblez": { label: "Doblez", icon: Triangle, color: "var(--stage-bending)" },
  "Soldadura": { label: "Soldadura", icon: Flame, color: "var(--stage-welding)" },
  "Pintura": { label: "Pintura", icon: SprayCan, color: "var(--stage-painting)" },
  "Ensamblaje": { label: "Ensamblaje", icon: Wrench, color: "var(--stage-assembly)" },
  "Refrigeración": { label: "Refrigeración", icon: Snowflake, color: "var(--stage-refrigeration)" },
  "Eléctrica": { label: "Eléctrica", icon: Zap, color: "var(--stage-electrical)" },
  "Finalizado": { label: "Finalizado", icon: CheckCircle2, color: "oklch(0.55 0.16 150)" },
};

// Estaciones de producción reales (sin "Sin empezar" ni "Finalizado"), en el
// orden del flujo productivo. Usadas para la vista "Por estación", el modo TV
// y los gráficos de planeación.
const ESTACIONES_PRODUCCION: { id: EstadoProyecto; label: string; icon: typeof Scissors; color: string }[] =
  ORDEN_ESTACIONES.filter((id) => id !== "Finalizado").map((id) => ({ id, ...ESTACION_CONFIG[id] }));

function estacionConfig(estado: EstadoProyecto) {
  return ESTACION_CONFIG[estado] ?? { label: estado, icon: Factory, color: "var(--muted-foreground)" };
}

// ---------- Helpers ----------
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "Sin información";
const fmtDateTime = (s: string | null) =>
  s
    ? new Date(s).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "Sin información";

function elapsedText(fromISO: string | null, toISO?: string, nowTime?: Date) {
  if (!fromISO) return "Sin información";
  const from = new Date(fromISO).getTime();
  const to = toISO ? new Date(toISO).getTime() : (nowTime ? nowTime.getTime() : Date.now());
  const mins = Math.max(0, Math.round((to - from) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

function isDelayed(p: Proyecto) {
  return p.estado !== "Finalizado" && !!p.fechaEstimadaEntrega && new Date(p.fechaEstimadaEntrega).getTime() < Date.now();
}

// El Avance es un valor real de Notion (Number). No se recalcula ni se
// inventa: solo se acota a un rango visualizable de 0-100 para la barra.
function progressPct(p: Proyecto) {
  return Math.min(100, Math.max(0, Math.round(p.avance)));
}

// Estilo visual según el texto real de Prioridad en Notion. No se inventan
// valores de prioridad; el label mostrado siempre es el valor real de Notion.
function prioridadStyle(raw: string) {
  const key = raw.trim().toLowerCase();
  if (key.includes("urgente")) return { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-600" };
  if (key.includes("alta")) return { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" };
  if (key.includes("media")) return { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" };
  if (key.includes("baja")) return { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" };
  return { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" };
}

function PrioridadBadge({ prioridad, size = "sm" }: { prioridad: string; size?: "sm" | "lg" }) {
  const s = prioridadStyle(prioridad);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${s.bg} ${s.text} ${
        size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {orSinInformacion(prioridad)}
    </span>
  );
}

// ---------- Helper: mapear estación a propiedad de entrada en Notion ----------
function getEntradaPropertyKey(estado: EstadoProyecto): keyof Proyecto | null {
  const map: Record<EstadoProyecto, keyof Proyecto | null> = {
    "Diseño": "entradaDiseño",
    "Corte": "entradaCorte",
    "Doblez": "entradaDoblez",
    "Soldadura": "entradaSoldadura",
    "Pintura": "entradaPintura",
    "Ensamblaje": "entradaEnsamblaje",
    "Refrigeración": "entradaRefrigeración",
    "Eléctrica": "entradaEléctrica",
    "Finalizado": "entradaFinalizado",
    "Sin empezar": null,
  };
  return map[estado];
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
  updating = false,
  tv = false,
  now = null,
}: {
  p: Proyecto;
  onCompletar: (p: Proyecto) => void;
  onHistorial: (p: Proyecto) => void;
  updating?: boolean;
  tv?: boolean;
  now?: Date | null;
}) {
  const delayed = isDelayed(p);
  const pct = progressPct(p);
  const estStyle = estacionConfig(p.estado);
  const siguienteDisponible = SIGUIENTE_ESTADO[p.estado] !== null;
  const codigo = formatProjectCode(p.codigoProyecto);

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
            {codigo}
          </div>
          <div className={`mt-0.5 truncate font-bold text-foreground ${tv ? "text-2xl" : "text-lg"}`}>
            {orSinInformacion(p.equipo)}
          </div>
          <div className={`truncate text-muted-foreground ${tv ? "text-base" : "text-sm"}`}>
            Cliente: <span className="font-semibold text-foreground">{orSinInformacion(p.cliente)}</span>
          </div>
        </div>
        <PrioridadBadge prioridad={p.prioridad} size={tv ? "lg" : "sm"} />
      </div>

      <div className={`mt-3 grid grid-cols-2 gap-2 ${tv ? "text-base" : "text-sm"}`}>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <User className={`shrink-0 ${tv ? "h-5 w-5" : "h-4 w-4"}`} />
          <span className="truncate font-medium text-foreground">{orSinInformacion(p.personaACargo)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className={`shrink-0 ${tv ? "h-5 w-5" : "h-4 w-4"}`} />
          <span className="truncate">En estación: {elapsedText(p.entradaAEstacion, undefined, now)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className={`shrink-0 ${tv ? "h-5 w-5" : "h-4 w-4"}`} />
          <span className="truncate">Inicio: {fmtDate(p.fechaInicio)}</span>
        </div>
        <div className={`flex items-center gap-1.5 ${delayed ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
          <CalendarDays className={`shrink-0 ${tv ? "h-5 w-5" : "h-4 w-4"}`} />
          <span className="truncate">Entrega: {fmtDate(p.fechaEstimadaEntrega)}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className={`font-semibold text-muted-foreground ${tv ? "text-sm" : "text-xs"}`}>
            Avance
          </span>
          <span className={`font-bold tabular-nums text-foreground ${tv ? "text-base" : "text-sm"}`}>
            {p.avance}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, var(--primary), ${estStyle.color})`,
            }}
          />
        </div>
      </div>

      <div className={`mt-4 flex gap-2 ${tv ? "flex-col" : ""}`}>
        {siguienteDisponible ? (
          <button
            onClick={() => onCompletar(p)}
            disabled={updating}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground transition-all active:scale-[0.98] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${
              tv ? "py-5 text-xl" : "py-3 text-sm"
            }`}
          >
            {updating ? (
              <Loader2 className={`animate-spin ${tv ? "h-6 w-6" : "h-4 w-4"}`} />
            ) : (
              <CheckCircle2 className={tv ? "h-6 w-6" : "h-4 w-4"} />
            )}
            {updating ? "Actualizando…" : "Completar tarea"}
          </button>
        ) : (
          <div
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary font-bold text-muted-foreground ${
              tv ? "py-5 text-xl" : "py-3 text-sm"
            }`}
          >
            <CheckCircle2 className={tv ? "h-6 w-6" : "h-4 w-4"} />
            Finalizado
          </div>
        )}
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
  updatingId,
  now = null,
}: {
  estacion: { id: EstadoProyecto; label: string; icon: typeof Scissors; color: string };
  proyectos: Proyecto[];
  onCompletar: (p: Proyecto) => void;
  onHistorial: (p: Proyecto) => void;
  updatingId: string | null;
  now?: Date | null;
}) {
  const Icon = estacion.icon;
  const activos = proyectos.length;
  const conTiempo = proyectos.filter((p) => !!p.entradaAEstacion);
  const avgMin =
    conTiempo.length > 0
      ? Math.round(
          conTiempo.reduce((acc, p) => acc + (Date.now() - new Date(p.entradaAEstacion as string).getTime()) / 60000, 0) /
            conTiempo.length,
        )
      : 0;
  const avgTxt = conTiempo.length === 0 ? "Sin información" : avgMin >= 60 ? `${Math.floor(avgMin / 60)}h ${avgMin % 60}m` : `${avgMin}m`;
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
            <ProyectoCard
              key={p.id}
              p={p}
              onCompletar={onCompletar}
              onHistorial={onHistorial}
              updating={updatingId === p.notionPageId}
              now={now}
            />
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
  submitting,
}: {
  proyecto: Proyecto | null;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  if (!proyecto) return null;
  const siguiente = SIGUIENTE_ESTADO[proyecto.estado];
  const siguienteLabel = siguiente ? estacionConfig(siguiente).label : "—";
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
          <div className="font-mono text-muted-foreground">{formatProjectCode(proyecto.codigoProyecto)}</div>
          <div className="font-bold text-foreground">{orSinInformacion(proyecto.equipo)}</div>
          <div className="text-muted-foreground">Cliente: {orSinInformacion(proyecto.cliente)}</div>
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
            disabled={submitting}
            className="flex-1 rounded-xl border border-border bg-card py-3 font-bold text-foreground hover:bg-secondary disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Actualizando Notion…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistorialModal({
  proyecto,
  historial,
  onClose,
}: {
  proyecto: Proyecto | null;
  historial: HistorialEntry[];
  onClose: () => void;
}) {
  if (!proyecto) return null;

  // Construir historial desde las fechas de entrada guardadas en Notion
  const construirHistorialDesdeNotion = (): Array<{
    estacion: EstadoProyecto;
    inicio: string | null;
    fin: string | null;
  }> => {
    const estaciones: EstadoProyecto[] = [
      "Diseño",
      "Corte",
      "Doblez",
      "Soldadura",
      "Pintura",
      "Ensamblaje",
      "Refrigeración",
      "Eléctrica",
      "Finalizado",
    ];

    const propiedades: Array<[EstadoProyecto, keyof Proyecto]> = [
      ["Diseño", "entradaDiseño"],
      ["Corte", "entradaCorte"],
      ["Doblez", "entradaDoblez"],
      ["Soldadura", "entradaSoldadura"],
      ["Pintura", "entradaPintura"],
      ["Ensamblaje", "entradaEnsamblaje"],
      ["Refrigeración", "entradaRefrigeración"],
      ["Eléctrica", "entradaEléctrica"],
      ["Finalizado", "entradaFinalizado"],
    ];

    const historialDesdeNotion: Array<{
      estacion: EstadoProyecto;
      inicio: string | null;
      fin: string | null;
    }> = [];

    for (let i = 0; i < propiedades.length; i++) {
      const [estacion, prop] = propiedades[i];
      const inicio = proyecto[prop] ?? null;

      if (inicio) {
        // La fecha de fin es la fecha de inicio de la siguiente estación
        const siguienteIndex = i + 1;
        const fin =
          siguienteIndex < propiedades.length
            ? (proyecto[propiedades[siguienteIndex][1]] ?? null)
            : null;

        historialDesdeNotion.push({ estacion, inicio, fin });
      }
    }

    return historialDesdeNotion;
  };

  const historialNotion = construirHistorialDesdeNotion();
  const tieneHistorial = historialNotion.length > 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Historial del proyecto
            </div>
            <h3 className="mt-1 font-mono text-lg font-bold text-foreground">
              {formatProjectCode(proyecto.codigoProyecto)}
            </h3>
            <div className="text-sm text-muted-foreground">
              {orSinInformacion(proyecto.equipo)} · {orSinInformacion(proyecto.cliente)}
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

        <div className="mb-4 rounded-xl border border-dashed border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
          Historial guardado en Notion. Cada fecha registra cuándo el proyecto entró a
          esa estación. Los datos se obtienen al cargar la página desde tu base de datos.
        </div>

        {!tieneHistorial ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aún no hay estaciones completadas para este proyecto.
          </div>
        ) : (
          <ol className="relative space-y-4 border-l-2 border-border pl-5">
            {historialNotion.map((h, i) => {
              const est = estacionConfig(h.estacion);
              const Icon = est.icon;
              return (
                <li key={i} className="relative">
                  <span
                    className="absolute -left-[30px] grid h-7 w-7 place-items-center rounded-full text-white ring-4 ring-background"
                    style={{ backgroundColor: est.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="rounded-xl bg-secondary/60 p-3">
                    <div className="font-bold text-foreground">{est.label}</div>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <div>
                        Entrada:{" "}
                        <span className="text-foreground">{fmtDateTime(h.inicio)}</span>
                      </div>
                      {h.fin && (
                        <>
                          <div>
                            Salida:{" "}
                            <span className="text-foreground">{fmtDateTime(h.fin)}</span>
                          </div>
                          <div>
                            Tiempo:{" "}
                            <span className="text-foreground">
                              {elapsedText(h.inicio, h.fin)}
                            </span>
                          </div>
                        </>
                      )}
                      {!h.fin && (
                        <div>Salida: <span className="text-foreground">En progreso</span></div>
                      )}
                      <div>
                        Persona:{" "}
                        <span className="text-foreground">
                          {orSinInformacion(proyecto.personaACargo)}
                        </span>
                      </div>
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
  undoing,
}: {
  visible: boolean;
  msg: string;
  onUndo: () => void;
  onDismiss: () => void;
  undoing: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-4 rounded-2xl bg-foreground px-5 py-3 text-background shadow-2xl">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        <span className="text-sm font-semibold">{msg}</span>
        <button
          onClick={onUndo}
          disabled={undoing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background/10 px-3 py-1.5 text-sm font-bold hover:bg-background/20 disabled:opacity-60"
        >
          {undoing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
          Deshacer
        </button>
        <button onClick={onDismiss} className="rounded p-1 hover:bg-background/10" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------- Toast de error de acción ----------
function ActionErrorToast({ msg, onDismiss }: { msg: string | null; onDismiss: () => void }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-4 rounded-2xl bg-red-600 px-5 py-3 text-white shadow-2xl">
        <AlertTriangle className="h-5 w-5" />
        <span className="text-sm font-semibold">{msg}</span>
        <button onClick={onDismiss} className="rounded p-1 hover:bg-white/10" aria-label="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------- Vista Planeación ----------
function PlaneacionView({ proyectos }: { proyectos: Proyecto[] }) {
  const activos = proyectos.filter((p) => p.estado !== "Finalizado");
  const finalizadosHoy = proyectos.filter((p) => {
    if (p.estado !== "Finalizado" || !p.entradaAEstacion) return false;
    const d = new Date(p.entradaAEstacion);
    return d.toDateString() === new Date().toDateString();
  });
  const retrasados = activos.filter(isDelayed);
  const porEstacion = ESTACIONES_PRODUCCION.map((e) => ({
    ...e,
    count: activos.filter((p) => p.estado === e.id).length,
  }));
  const maxCarga = porEstacion.reduce((a, b) => (b.count > a.count ? b : a), porEstacion[0]);
  const maxBar = Math.max(1, ...porEstacion.map((e) => e.count));

  const tiemposEstacion = ESTACIONES_PRODUCCION.map((e) => {
    const times = activos
      .filter((p) => p.estado === e.id && !!p.entradaAEstacion)
      .map((p) => (Date.now() - new Date(p.entradaAEstacion as string).getTime()) / 3600000);
    const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    return { ...e, avgH: Math.round(avg * 10) / 10 };
  });
  const tiempoTotalProm = tiemposEstacion.reduce((a, b) => a + b.avgH, 0);

  // Distribución de prioridades reales (sin inventar categorías fijas)
  const prioridadesUnicas = Array.from(
    new Set(activos.map((p) => p.prioridad).filter((v) => v && v.trim().length > 0)),
  );
  const paletaColores = ["#dc2626", "#f59e0b", "#3b82f6", "#94a3b8", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6"];
  const prio = prioridadesUnicas.map((label, i) => ({
    label,
    value: activos.filter((x) => x.prioridad === label).length,
    dotClass: prioridadStyle(label).dot,
    color: paletaColores[i % paletaColores.length],
  }));
  const total = prio.reduce((a, b) => a + b.value, 0);
  let acc = 0;
  const arcs = prio.map((p) => {
    const start = acc / (total || 1);
    acc += p.value;
    const end = acc / (total || 1);
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
          value={maxCarga?.count ?? 0}
          accent={maxCarga?.color ?? "var(--primary)"}
          hint={maxCarga?.label}
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
          {total === 0 ? (
            <div className="mt-6 grid h-40 place-items-center text-sm text-muted-foreground">
              Sin datos de prioridad
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-6">
              <svg viewBox="0 0 42 42" className="h-40 w-40">
                <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--secondary)" strokeWidth="6" />
                {arcs.map((a, i) => {
                  const dash = (a.end - a.start) * 100;
                  const offset = 25 - a.start * 100;
                  return (
                    <circle
                      key={i}
                      cx="21"
                      cy="21"
                      r="15.915"
                      fill="none"
                      stroke={a.color}
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
          )}
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

// ---------- Pantallas de carga / error / vacío ----------
function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-lg font-semibold">Cargando proyectos...</span>
      </div>
    </div>
  );
}

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-3xl border border-border bg-card p-8 text-center" style={{ boxShadow: "var(--shadow-card)" }}>
        <AlertTriangle className="h-10 w-10 text-red-600" />
        <h2 className="text-xl font-black text-foreground">No se pudieron cargar los proyectos.</h2>
        <p className="text-sm text-muted-foreground">
          Revisa la conexión con Notion e inténtalo de nuevo.
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
      </div>
    </div>
  );
}

// ---------- App principal ----------
type Vista = "general" | "estacion" | "planeacion";

export function FrozzMes() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Historial local de sesión: notionPageId -> eventos. NO viene de Notion.
  const [historialLocal, setHistorialLocal] = useState<Record<string, HistorialEntry[]>>({});

  const [vista, setVista] = useState<Vista>("general");
  const [estacionSel, setEstacionSel] = useState<EstadoProyecto>("Diseño");
  const [prioridad, setPrioridad] = useState<string>("all");
  const [persona, setPersona] = useState<string>("all");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [tvMode, setTvMode] = useState(false);
  const [confirmProyecto, setConfirmProyecto] = useState<Proyecto | null>(null);
  const [historialProyecto, setHistorialProyecto] = useState<Proyecto | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoState, setUndoState] = useState<{
    notionPageId: string;
    prevEstado: EstadoProyecto;
    prevEntradaAEstacion: string | null;
    prevEntradaSiguiente: string | null; // Fecha anterior de la estación siguiente
    siguienteEstacion: EstadoProyecto;
    msg: string;
    at: number;
  } | null>(null);

  // ---------- Notion → Web ----------
  const fetchProyectos = async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/notion/read");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to fetch projects");
      }
      const data = await res.json();
      setProyectos(data.proyectos ?? []);
    } catch (err: any) {
      setLoadError(err?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProyectos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await fetchProyectos();
    setSyncing(false);
  };

  const now = useNow(1000);
  const [tvTick, setTvTick] = useState(0);
  useEffect(() => {
    if (!tvMode) return;
    const id = setInterval(() => setTvTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [tvMode]);
  void tvTick;

  // Auto-hide undo after 5 min
  useEffect(() => {
    if (!undoState) return;
    const id = setTimeout(() => setUndoState(null), 5 * 60 * 1000);
    return () => clearTimeout(id);
  }, [undoState]);

  // Auto-hide error toast
  useEffect(() => {
    if (!actionError) return;
    const id = setTimeout(() => setActionError(null), 6000);
    return () => clearTimeout(id);
  }, [actionError]);

  // Filtros derivados de los datos reales recibidos de Notion (nunca listas ficticias)
  const personasDisponibles = useMemo(
    () => Array.from(new Set(proyectos.map((p) => p.personaACargo).filter((v) => v && v.trim().length > 0))).sort(),
    [proyectos],
  );
  const prioridadesDisponibles = useMemo(
    () => Array.from(new Set(proyectos.map((p) => p.prioridad).filter((v) => v && v.trim().length > 0))).sort(),
    [proyectos],
  );

  const filtrados = useMemo(() => {
    return proyectos.filter((p) => {
      if (prioridad !== "all" && p.prioridad !== prioridad) return false;
      if (persona !== "all" && p.personaACargo !== persona) return false;
      if (estadoFiltro !== "all" && p.estado !== estadoFiltro) return false;
      if (query) {
        const q = query.toLowerCase();
        const codigo = formatProjectCode(p.codigoProyecto).toLowerCase();
        if (
          !codigo.includes(q) &&
          !p.cliente.toLowerCase().includes(q) &&
          !p.equipo.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [proyectos, prioridad, persona, estadoFiltro, query]);

  const handleCompletarClick = (p: Proyecto) => setConfirmProyecto(p);

  // ---------- Web → Notion ----------
  const doCompletar = async () => {
    if (!confirmProyecto) return;
    const p = confirmProyecto;
    const siguiente = SIGUIENTE_ESTADO[p.estado];
    if (!siguiente) {
      setConfirmProyecto(null);
      return;
    }
    const ahora = new Date().toISOString();
    const prevEstado = p.estado;
    const prevEntradaAEstacion = p.entradaAEstacion;

    // Validar jornada laboral (8 AM - 5 PM, zona Bogotá)
    const ahoraDate = new Date(ahora);
    const bogotaFormatter = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const bogotaTime = bogotaFormatter.format(ahoraDate);
    const [hStr] = bogotaTime.split(':');
    const horas = parseInt(hStr, 10);
    
    if (horas < 8 || horas >= 17) {
      setActionError("Solo se pueden guardar tiempos entre 8:00 AM y 5:00 PM (jornada laboral)");
      setConfirmProyecto(null);
      return;
    }

    // Obtener la propiedad de entrada de la siguiente estación
    const siguienteKey = getEntradaPropertyKey(siguiente);
    if (!siguienteKey) {
      setActionError("No se puede completar desde esta estación");
      setConfirmProyecto(null);
      return;
    }

    // Guardar fecha anterior de la siguiente estación para deshacer
    const prevEntradaSiguiente = p[siguienteKey] ?? null;

    setUpdatingId(p.notionPageId);
    try {
      // Construir objeto de actualización dinámicamente
      const updateData: any = {
        notionPageId: p.notionPageId,
        estado: siguiente,
        entradaAEstacion: ahora,
        [siguienteKey]: ahora, // Guardar fecha en la columna de entrada de la siguiente estación
      };

      const res = await fetch("/api/notion/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to update project");
      }

      // Actualizar estado local
      setProyectos((prev) =>
        prev.map((x) => {
          if (x.notionPageId === p.notionPageId) {
            const updated = { ...x, estado: siguiente, entradaAEstacion: ahora };
            (updated as any)[siguienteKey] = ahora;
            return updated;
          }
          return x;
        }),
      );

      // Reconstruir historial desde Notion
      setHistorialLocal((prev) => ({
        ...prev,
        [p.notionPageId]: [
          ...(prev[p.notionPageId] ?? []),
          { estacion: prevEstado, inicio: prevEntradaAEstacion, fin: ahora, personaACargo: p.personaACargo },
        ],
      }));

      setUndoState({
        notionPageId: p.notionPageId,
        prevEstado,
        prevEntradaAEstacion,
        prevEntradaSiguiente,
        siguienteEstacion: siguiente,
        msg:
          siguiente === "Finalizado"
            ? `${formatProjectCode(p.codigoProyecto)} finalizado correctamente.`
            : `Tarea completada. ${formatProjectCode(p.codigoProyecto)} pasó a ${estacionConfig(siguiente).label}.`,
        at: Date.now(),
      });
    } catch (err: any) {
      setActionError(err?.message ? `No se pudo actualizar Notion: ${err.message}` : "No se pudo actualizar Notion.");
    } finally {
      setUpdatingId(null);
      setConfirmProyecto(null);
    }
  };

  const doUndo = async () => {
    if (!undoState) return;
    setUndoing(true);
    try {
      const siguienteKey = getEntradaPropertyKey(undoState.siguienteEstacion);
      if (!siguienteKey) {
        throw new Error("No se puede deshacer: estación no válida");
      }

      const updateData: any = {
        notionPageId: undoState.notionPageId,
        estado: undoState.prevEstado,
        entradaAEstacion: undoState.prevEntradaAEstacion,
        [siguienteKey]: undoState.prevEntradaSiguiente, // Restaurar fecha anterior
      };

      const res = await fetch("/api/notion/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to undo update");
      }

      setProyectos((prev) =>
        prev.map((x) => {
          if (x.notionPageId === undoState.notionPageId) {
            const updated = {
              ...x,
              estado: undoState.prevEstado,
              entradaAEstacion: undoState.prevEntradaAEstacion,
            };
            (updated as any)[siguienteKey] = undoState.prevEntradaSiguiente;
            return updated;
          }
          return x;
        }),
      );

      setHistorialLocal((prev) => {
        const list = prev[undoState.notionPageId] ?? [];
        return { ...prev, [undoState.notionPageId]: list.slice(0, -1) };
      });
      setUndoState(null);
    } catch (err: any) {
      setActionError(err?.message ? `No se pudo deshacer en Notion: ${err.message}` : "No se pudo deshacer en Notion.");
    } finally {
      setUndoing(false);
    }
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

  if (loading) return <LoadingScreen />;
  if (loadError) return <ErrorScreen onRetry={fetchProyectos} />;

  // ---------- Modo TV ----------
  if (tvMode) {
    const estacion = ESTACIONES_PRODUCCION.find((e) => e.id === estacionSel) ?? ESTACIONES_PRODUCCION[0];
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
                onChange={(e) => setEstacionSel(e.target.value as EstadoProyecto)}
                className="h-12 rounded-xl border border-border bg-card px-4 text-lg font-bold text-foreground"
              >
                {ESTACIONES_PRODUCCION.map((e) => (
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
                  updating={updatingId === p.notionPageId}
                  now={now}
                />
              ))}
            </div>
          )}
        </main>

        <ConfirmModal
          proyecto={confirmProyecto}
          onConfirm={doCompletar}
          onCancel={() => setConfirmProyecto(null)}
          submitting={!!updatingId}
        />
        <UndoToast
          visible={!!undoState}
          msg={undoState?.msg ?? ""}
          onUndo={doUndo}
          onDismiss={() => setUndoState(null)}
          undoing={undoing}
        />
        <ActionErrorToast msg={actionError} onDismiss={() => setActionError(null)} />
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
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {dateStr}
                </div>
                <div className="font-mono text-2xl font-bold tabular-nums text-foreground">
                  {timeStr}
                </div>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground hover:bg-secondary disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Sincronizar ahora"}
              </button>
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
                onChange={(e) => setEstacionSel(e.target.value as EstadoProyecto)}
                className="ml-2 h-11 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground"
              >
                {ESTACIONES_PRODUCCION.map((e) => (
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
                  ...prioridadesDisponibles.map((p) => ({ value: p, label: p })),
                ]}
              />
              <FilterSelect
                label="Estación"
                value={estadoFiltro}
                onChange={setEstadoFiltro}
                options={[
                  { value: "all", label: "Todas" },
                  ...TODAS_LAS_COLUMNAS.map((id) => ({ value: id, label: estacionConfig(id).label })),
                ]}
              />
              <FilterSelect
                label="Persona a cargo"
                value={persona}
                onChange={setPersona}
                options={[
                  { value: "all", label: "Todos" },
                  ...personasDisponibles.map((o) => ({ value: o, label: o })),
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
                    placeholder="Código, cliente o equipo…"
                    className="h-11 w-72 rounded-xl border border-border bg-card pl-9 pr-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </label>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1920px] px-6 pb-10 pt-6 xl:px-10">
        {proyectos.length === 0 ? (
          <div className="grid min-h-[50vh] place-items-center rounded-3xl border border-dashed border-border text-lg text-muted-foreground">
            No hay proyectos disponibles.
          </div>
        ) : (
          <>
            {vista === "general" && (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[1800px]:grid-cols-5">
                {TODAS_LAS_COLUMNAS.map((id) => (
                  <KanbanColumn
                    key={id}
                    estacion={{ id, ...estacionConfig(id) }}
                    proyectos={filtrados.filter((p) => p.estado === id)}
                    onCompletar={handleCompletarClick}
                    onHistorial={setHistorialProyecto}
                    updatingId={updatingId}
                    now={now}
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
                      updating={updatingId === p.notionPageId}
                      now={now}
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
          </>
        )}
      </main>

      <ConfirmModal
        proyecto={confirmProyecto}
        onConfirm={doCompletar}
        onCancel={() => setConfirmProyecto(null)}
        submitting={!!updatingId}
      />
      <HistorialModal
        proyecto={historialProyecto}
        historial={historialProyecto ? historialLocal[historialProyecto.notionPageId] ?? [] : []}
        onClose={() => setHistorialProyecto(null)}
      />
      <UndoToast
        visible={!!undoState}
        msg={undoState?.msg ?? ""}
        onUndo={doUndo}
        onDismiss={() => setUndoState(null)}
        undoing={undoing}
      />
      <ActionErrorToast msg={actionError} onDismiss={() => setActionError(null)} />
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
