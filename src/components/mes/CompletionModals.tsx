import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Undo2, Clock, AlertCircle } from "lucide-react";
import { calculateElapsedTime, isWithinWorkHours, STATION_LABELS } from "@/lib/timeTracking";
import type { Proyecto, EstadoProyecto } from "@/lib/notion/mapper";

// ---------- Modal de confirmación para completar estación ----------
export function ConfirmCompletionModal({
  proyecto,
  onConfirm,
  onCancel,
  submitting = false,
}: {
  proyecto: Proyecto | null;
  onConfirm: (p: Proyecto) => void;
  onCancel: () => void;
  submitting?: boolean;
}) {
  const [workHourCheck, setWorkHourCheck] = useState<{ valid: boolean; message: string }>({ valid: true, message: "" });
  const [elapsedTime, setElapsedTime] = useState("0h 0m");

  useEffect(() => {
    if (!proyecto) return;
    
    // Verificar horario laboral
    const check = isWithinWorkHours();
    setWorkHourCheck(check);

    // Calcular tiempo en la estación
    if (proyecto.entradaAEstacion) {
      const elapsed = calculateElapsedTime(proyecto.entradaAEstacion);
      setElapsedTime(elapsed);
    }
  }, [proyecto]);

  if (!proyecto) return null;

  const estationLabel = STATION_LABELS[proyecto.estado] || proyecto.estado;
  const canComplete = workHourCheck.valid;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-start gap-3">
          <div className={`rounded-full p-2 ${canComplete ? "bg-blue-100" : "bg-red-100"}`}>
            {canComplete ? (
              <Clock className="h-5 w-5 text-blue-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">Finalizar estación</h2>
            <p className="text-sm text-muted-foreground">
              {proyecto.equipo} • {estationLabel}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* Información de tiempo */}
        <div className="mb-4 rounded-xl bg-secondary p-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Tiempo en estación
          </div>
          <div className="mt-1 text-2xl font-bold text-foreground">{elapsedTime}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {proyecto.entradaAEstacion
              ? new Date(proyecto.entradaAEstacion).toLocaleString("es-CO", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Bogota",
                })
              : "Sin información"}
          </div>
        </div>

        {/* Validación de horario */}
        {!canComplete && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="text-sm font-medium text-red-700">{workHourCheck.message}</p>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(proyecto)}
            disabled={submitting || !canComplete}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Marcar como hecho
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Toast de deshacer ----------
export function UndoToastNotification({
  visible,
  msg,
  onUndo,
  onDismiss,
  undoing = false,
}: {
  visible: boolean;
  msg: string;
  onUndo: () => void;
  onDismiss: () => void;
  undoing?: boolean;
}) {
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (!visible) {
      setTimeLeft(30);
      return;
    }

    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          onDismiss();
          return 30;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{msg}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Puedes deshacer en {timeLeft} segundo{timeLeft !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onDismiss}
          disabled={undoing}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          ×
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onUndo}
          disabled={undoing}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-100 px-3 py-2 font-semibold text-blue-700 transition hover:bg-blue-200 disabled:opacity-50"
        >
          {undoing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Deshaciendo…
            </>
          ) : (
            <>
              <Undo2 className="h-4 w-4" />
              Deshacer
            </>
          )}
        </button>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(timeLeft / 30) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------- Toast de error ----------
export function ErrorToastNotification({
  msg,
  onDismiss,
}: {
  msg: string | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(onDismiss, 6000);
    return () => clearTimeout(id);
  }, [msg, onDismiss]);

  if (!msg) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl border border-red-200 bg-red-50 p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-900">{msg}</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600"
        >
          ×
        </button>
      </div>
    </div>
  );
}
