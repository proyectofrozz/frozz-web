// src/lib/notion/mapper.ts
//
// Capa centralizada de mapping entre Notion y el modelo de datos de la aplicación.
// Ningún componente ni endpoint debe leer `page.properties[...]` directamente:
// toda página de Notion debe pasar por `mapNotionPageToProyecto` antes de llegar
// a React, y toda actualización debe construirse con `buildNotionPropertiesPayload`.
//
// Estructura real de la base de datos de Notion (NO renombrar, NO inventar):
//
//   Código Proyecto            -> Number
//   Equipo                     -> Rich text
//   Cliente                    -> Rich text
//   Persona a cargo            -> Select
//   Fecha de inicio            -> Date
//   Fecha estimada de entrega  -> Date
//   Estado                     -> Status   (¡NO Select!)
//   Avance                     -> Number
//   Prioridad                  -> Select
//   Entrada a Diseño           -> Date (con hora, 24 h)
//   Entrada a Corte            -> Date
//   Entrada a Doblez           -> Date
//   ... una columna "Entrada a <Estación>" por cada estación del flujo.
//
// El historial de estaciones se reconstruye SIEMPRE desde esas columnas de
// fecha: cada vez que un proyecto pasa a una estación se guarda la fecha de
// entrada en su columna, y al recargar la página se leen de nuevo desde Notion.
//
//   Entrada a [Estación]       -> Date (para cada estación de producción)
//   Tiempo por estación        -> Rich text (acumulativo)

export const NOTION_PROPS = {
  codigoProyecto: "Código Proyecto",
  equipo: "Equipo",
  cliente: "Cliente",
  personaACargo: "Persona a cargo",
  fechaInicio: "Fecha de inicio",
  fechaEstimadaEntrega: "Fecha estimada de entrega",
  estado: "Estado",
  avance: "Avance",
  prioridad: "Prioridad",
  // Columna antigua (opcional). Solo se usa como respaldo de lectura.
  entradaAEstacionLegacy: "Entrada a estación",
  entradaAEstacion: "Entrada a estación",
  tiempoPorEstacion: "Tiempo por estación",
  entradaDiseño: "Entrada a Diseño",
  entradaCorte: "Entrada a Corte",
  entradaDoblez: "Entrada a Doblez",
  entradaSoldadura: "Entrada a Soldadura",
  entradaPintura: "Entrada a Pintura",
  entradaEnsamblaje: "Entrada a Ensamblaje",
  entradaRefrigeración: "Entrada a Refrigeración",
  entradaEléctrica: "Entrada a Eléctrica",
  entradaFinalizado: "Entrada a Finalizado",
  tiempoPorEstacion: "Tiempo por estación",
} as const;

// Nombres exactos de las propiedades Date que existen en la base de Notion.
// Se mantienen explícitos porque estas columnas son parte del contrato del MES.
export const ENTRADA_PROPS: Record<EstadoProyecto, string> = {
  "Sin empezar": "Entrada a estación",
  "Diseño": "Entrada a Diseño",
  "Corte": "Entrada a Corte",
  "Doblez": "Entrada a Doblez",
  "Soldadura": "Entrada a Soldadura",
  "Pintura": "Entrada a Pintura",
  "Ensamblaje": "Entrada a Ensamblaje",
  "Refrigeración": "Entrada a Refrigeración",
  "Eléctrica": "Entrada a Eléctrica",
  "Finalizado": "Entrada a Finalizado",
};
export type EstadoProyecto =
  | "Sin empezar"
  | "Diseño"
  | "Corte"
  | "Doblez"
  | "Soldadura"
  | "Pintura"
  | "Ensamblaje"
  | "Refrigeración"
  | "Eléctrica"
  | "Finalizado";

export const ORDEN_ESTACIONES: EstadoProyecto[] = [
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

export const ESTADO_INICIAL: EstadoProyecto = "Sin empezar";
export const TODAS_LAS_COLUMNAS: EstadoProyecto[] = [ESTADO_INICIAL, ...ORDEN_ESTACIONES];

export const SIGUIENTE_ESTADO: Record<EstadoProyecto, EstadoProyecto | null> = {
  "Sin empezar": "Diseño",
  "Diseño": "Corte",
  "Corte": "Doblez",
  "Doblez": "Soldadura",
  "Soldadura": "Pintura",
  "Pintura": "Ensamblaje",
  "Ensamblaje": "Refrigeración",
  "Refrigeración": "Eléctrica",
  "Eléctrica": "Finalizado",
  "Finalizado": null,
};

export interface Proyecto {
  id: string;
  notionPageId: string;
  codigoProyecto: number | null;
  equipo: string;
  cliente: string;
  personaACargo: string;
  fechaInicio: string | null;
  fechaEstimadaEntrega: string | null;
  estado: EstadoProyecto;
  avance: number;
  prioridad: string;
  /** Fecha de entrada a la estación actual (derivada de `entradas`). */
  entradaAEstacion: string | null;
  /** Tiempo acumulado por estación, almacenado en Notion. */
  tiempoPorEstacion: string;
  /** Fecha/hora (ISO) en que el proyecto entró a cada estación, leída de Notion. */
  entradas: EntradasEstaciones;
  // Propiedades de entrada individual para acceso directo
  entradaDiseño?: string | null;
  entradaCorte?: string | null;
  entradaDoblez?: string | null;
  entradaSoldadura?: string | null;
  entradaPintura?: string | null;
  entradaEnsamblaje?: string | null;
  entradaRefrigeración?: string | null;
  entradaEléctrica?: string | null;
  entradaFinalizado?: string | null;
}
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dado el nombre de una propiedad de Notion, devuelve a qué estación
 * corresponde si es una columna "Entrada a <Estación>" (tolerante a
 * mayúsculas, acentos y pequeños errores de tipeo como "Dobles").
 */
export function estacionDeColumnaEntrada(propName: string): EstadoProyecto | null {
  const n = normalizeName(propName);
  const m = n.match(/^entrada a (.+)$/);
  if (!m) return null;
  const resto = m[1];
  for (const est of ORDEN_ESTACIONES) {
    const e = normalizeName(est);
    if (resto === e || resto.startsWith(e.slice(0, 4))) return est;
  }
  return null;
}

/** Busca, entre los nombres reales de propiedades, la columna de entrada de una estación. */
export function findEntradaPropName(propNames: string[], estacion: EstadoProyecto): string | null {
  const expected = ENTRADA_PROPS[estacion];
  if (expected && propNames.includes(expected)) return expected;
  return propNames.find((name) => estacionDeColumnaEntrada(name) === estacion) ?? null;
}

/**
 * Devuelve la fecha/hora actual en formato ISO con la zona horaria de Bogotá
 * (UTC-5, sin horario de verano), p. ej. "2026-09-29T14:35:00-05:00".
 * Así Notion muestra exactamente la hora local de la planta.
 */
export function nowBogotaISO(date: Date = new Date()): string {
  // Usar la zona horaria de Bogotá directamente
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  const second = parts.find((p) => p.type === 'second')?.value;

  return `${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`;
}

export function isWithinWorkday(date: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? -1);
  const minutes = hour * 60 + minute;
  return minutes >= 8 * 60 && minutes < 17 * 60;
}
}

function getRichText(prop: any): string {
  if (!prop || !Array.isArray(prop.rich_text)) return "";
  return prop.rich_text.map((item: any) => item?.plain_text ?? "").join("");
}
function getSelect(prop: any): string { return prop?.select?.name ?? ""; }
function getStatus(prop: any): string { return prop?.status?.name ?? ""; }
function getNumber(prop: any): number | null { return typeof prop?.number === "number" ? prop.number : null; }
function getDate(prop: any): string | null { return prop?.date?.start ?? null; }
function isEstadoProyecto(value: string): value is EstadoProyecto {
  return (TODAS_LAS_COLUMNAS as string[]).includes(value);
}

export function mapNotionPageToProyecto(page: any): Proyecto {
  const props = page?.properties ?? {};
  const estadoRaw = getStatus(props[NOTION_PROPS.estado]);
  const estadoActual = (isEstadoProyecto(estadoRaw) ? estadoRaw : ESTADO_INICIAL) as EstadoProyecto;

  const entradas: EntradasEstaciones = {};
  // Leer primero por los nombres exactos de la base FROZZ.
  for (const estacion of ORDEN_ESTACIONES) {
    const prop = props[ENTRADA_PROPS[estacion]];
    const fecha = getDate(prop);
    if (fecha) entradas[estacion] = fecha;
  }

  // Compatibilidad adicional por si Notion devuelve una propiedad con una
  // variación menor de nombre (acentos/mayúsculas) en alguna instalación.
  for (const [name, prop] of Object.entries<any>(props)) {
    const estacion = estacionDeColumnaEntrada(name);
    if (!estacion || entradas[estacion]) continue;
    const fecha = getDate(prop);
    if (fecha) entradas[estacion] = fecha;
  }

  // Lee todas las columnas "Entrada a <Estación>" (tipo Date).
  const entradas: EntradasEstaciones = {};
  for (const [name, prop] of Object.entries<any>(props)) {
    const est = estacionDeColumnaEntrada(name);
    if (!est) continue;
    const fecha = getDate(prop);
    if (fecha) entradas[est] = fecha;
  }
  const estadoActual = (isEstadoProyecto(estadoRaw) ? estadoRaw : estadoRaw || ESTADO_INICIAL) as EstadoProyecto;

  const proyecto: Proyecto = {
    id: page.id,
    notionPageId: page.id,
    codigoProyecto: getNumber(props[NOTION_PROPS.codigoProyecto]),
    equipo: getRichText(props[NOTION_PROPS.equipo]),
    cliente: getRichText(props[NOTION_PROPS.cliente]),
    personaACargo: getSelect(props[NOTION_PROPS.personaACargo]),
    fechaInicio: getDate(props[NOTION_PROPS.fechaInicio]),
    fechaEstimadaEntrega: getDate(props[NOTION_PROPS.fechaEstimadaEntrega]),
    estado: estadoActual,
    avance: getNumber(props[NOTION_PROPS.avance]) ?? 0,
    prioridad: getSelect(props[NOTION_PROPS.prioridad]),
    entradaAEstacion:
      entradas[estadoActual] ?? getDate(props[NOTION_PROPS.entradaAEstacionLegacy]),
    entradas,
    tiempoPorEstacion: getRichText(props[NOTION_PROPS.tiempoPorEstacion]),
    // Propiedades de entrada individual
    entradaDiseño: entradas["Diseño"] ?? null,
    entradaCorte: entradas["Corte"] ?? null,
    entradaDoblez: entradas["Doblez"] ?? null,
    entradaSoldadura: entradas["Soldadura"] ?? null,
    entradaPintura: entradas["Pintura"] ?? null,
    entradaEnsamblaje: entradas["Ensamblaje"] ?? null,
    entradaRefrigeración: entradas["Refrigeración"] ?? null,
    entradaEléctrica: entradas["Eléctrica"] ?? null,
    entradaFinalizado: entradas["Finalizado"] ?? null,
  };

  return proyecto;
}

export function formatProjectCode(codigo: number | null | undefined): string {
  if (codigo === null || codigo === undefined || Number.isNaN(codigo)) return "Sin información";
  return `PRJ - ${String(codigo).padStart(3, "0")}`;
}

export function orSinInformacion(value: string | null | undefined): string {
  return value && value.trim() ? value : "Sin información";
}

export type ProyectoUpdateFields = Partial<{
  codigoProyecto: number;
  equipo: string;
  cliente: string;
  personaACargo: string;
  fechaInicio: string | null;
  fechaEstimadaEntrega: string | null;
  estado: EstadoProyecto;
  avance: number;
  prioridad: string;
  entradaAEstacion: string | null;
  tiempoPorEstacion: string;
  /** Estación -> ISO con fecha y hora (o null para borrar la fecha). */
  entradas: Partial<Record<EstadoProyecto, string | null>>;
}>;

/**
 * Construye el objeto `properties` que espera `PATCH /v1/pages/{id}` de Notion,
 * respetando el tipo real de cada propiedad (en particular: Estado es Status,
 * no Select; Código Proyecto y Avance son Number, no texto).
 */
export function buildNotionPropertiesPayload(
  updates: ProyectoUpdateFields,
  /** Nombres reales de las propiedades de tipo Date de la base de datos. */
  datePropNames: string[] = [],
): { properties: Record<string, any>; missing: EstadoProyecto[] } {
  const properties: Record<string, any> = {};
  const missing: EstadoProyecto[] = [];

  if (updates.codigoProyecto !== undefined) properties[NOTION_PROPS.codigoProyecto] = { number: updates.codigoProyecto };
  if (updates.equipo !== undefined) properties[NOTION_PROPS.equipo] = { rich_text: updates.equipo ? [{ text: { content: updates.equipo } }] : [] };
  if (updates.cliente !== undefined) properties[NOTION_PROPS.cliente] = { rich_text: updates.cliente ? [{ text: { content: updates.cliente } }] : [] };
  if (updates.personaACargo !== undefined) properties[NOTION_PROPS.personaACargo] = { select: { name: updates.personaACargo } };
  if (updates.fechaInicio !== undefined) properties[NOTION_PROPS.fechaInicio] = { date: updates.fechaInicio ? { start: updates.fechaInicio } : null };
  if (updates.fechaEstimadaEntrega !== undefined) properties[NOTION_PROPS.fechaEstimadaEntrega] = { date: updates.fechaEstimadaEntrega ? { start: updates.fechaEstimadaEntrega } : null };
  if (updates.estado !== undefined) properties[NOTION_PROPS.estado] = { status: { name: updates.estado } };
  if (updates.avance !== undefined) properties[NOTION_PROPS.avance] = { number: updates.avance };
  if (updates.prioridad !== undefined) properties[NOTION_PROPS.prioridad] = { select: { name: updates.prioridad } };

  if (updates.entradas) {
    for (const [estacion, fecha] of Object.entries(updates.entradas) as [EstadoProyecto, string | null][]) {
      const propName = findEntradaPropName(datePropNames, estacion);
      if (!propName) {
        missing.push(estacion);
        continue;
      }
      properties[propName] = { date: fecha ? { start: fecha } : null };
    }
  }
  if (updates.entradaAEstacion !== undefined) {
    properties[NOTION_PROPS.entradaAEstacion] = {
      date: updates.entradaAEstacion ? { start: updates.entradaAEstacion } : null,
    };
  }
  if (updates.tiempoPorEstacion !== undefined) {
    properties[NOTION_PROPS.tiempoPorEstacion] = {
      rich_text: updates.tiempoPorEstacion ? [{ text: { content: updates.tiempoPorEstacion } }] : [],
    };
  }
    };
  }
  if (updates.tiempoPorEstacion !== undefined) {
    properties[NOTION_PROPS.tiempoPorEstacion] = {
      rich_text: updates.tiempoPorEstacion ? [{ text: { content: updates.tiempoPorEstacion } }] : [],
    };
  }

  return { properties, missing };
}
