// src/lib/timeTracking.ts
// Manejo centralizado del tracking de tiempo por estación con validaciones

import { EstadoProyecto } from "@/lib/notion/mapper";

/**
 * Valida si la hora actual está dentro de la jornada laboral (8 AM - 5 PM)
 * Zona horaria: America/Bogota (UTC-5)
 */
export function isWithinWorkHours(): { valid: boolean; message: string } {
  const now = new Date();
  // Convertir a zona horaria de Bogotá
  const bogotaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }));
  const hour = bogotaTime.getHours();
  const minutes = bogotaTime.getMinutes();

  // 8 AM (8:00) - 5 PM (17:00)
  const isValid = hour >= 8 && hour < 17;

  if (!isValid) {
    const outsideMsg =
      hour < 8
        ? `Aún no es hora de trabajar (${hour}:${String(minutes).padStart(2, "0")}). La jornada comienza a las 8:00 AM`
        : `Fuera de horario laboral (${hour}:${String(minutes).padStart(2, "0")}). La jornada termina a las 5:00 PM`;
    return { valid: false, message: outsideMsg };
  }

  return { valid: true, message: "" };
}

/**
 * Calcula el tiempo transcurrido entre dos fechas ISO y lo formatea como "Xh YYm"
 */
export function calculateElapsedTime(startISO: string, endISO: string = new Date().toISOString()): string {
  try {
    const start = new Date(startISO).getTime();
    const end = new Date(endISO).getTime();
    const totalMinutes = Math.max(0, Math.round((end - start) / 60000));

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}m`;
  } catch {
    return "0h 0m";
  }
}

/**
 * Construye el registro acumulativo de tiempos
 * Ejemplo: "Diseño: 0h 45m | Corte: 1h 10m | Doblez: 0h 30m"
 */
export function buildAccumulativeTimeRecord(
  estacion: EstadoProyecto,
  elapsedTime: string,
  previousRecord: string,
): string {
  const newEntry = `${estacion}: ${elapsedTime}`;

  if (!previousRecord || previousRecord.trim() === "") {
    return newEntry;
  }

  return `${previousRecord} | ${newEntry}`;
}

/**
 * Obtiene la etiqueta legible de una estación para mostrar en mensajes
 */
export const STATION_LABELS: Record<EstadoProyecto, string> = {
  "Sin empezar": "Sin empezar",
  "Diseño": "Diseño",
  "Corte": "Corte",
  "Doblez": "Doblez",
  "Soldadura": "Soldadura",
  "Pintura": "Pintura",
  "Ensamblaje": "Ensamblaje",
  "Refrigeración": "Refrigeración",
  "Eléctrica": "Eléctrica",
  "Finalizado": "Finalizado",
};

/**
 * Estado del deshacer para mostrar en toast
 */
export interface UndoState {
  msg: string;
  previousValue: string;
  proyectoId: string;
  timestamp: number;
}
