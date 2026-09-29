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

/** Nombres exactos de las propiedades de la base de datos de Notion. */
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
} as const;

// Estado de Notion representa directamente la estación actual del proyecto.
// No existe una propiedad "Estación" separada.
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

/** Orden real del flujo de producción, tal como está configurado en Notion (Status). */
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

/** Todas las columnas del Kanban, en orden, incluyendo "Sin empezar" y "Finalizado". */
export const TODAS_LAS_COLUMNAS: EstadoProyecto[] = [ESTADO_INICIAL, ...ORDEN_ESTACIONES];

/** Estación actual -> siguiente estación en el flujo productivo. */
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

/** Modelo de datos de la aplicación. Fuente de verdad: Notion. */
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
  /** Fecha/hora (ISO) en que el proyecto entró a cada estación, leída de Notion. */
  entradas: EntradasEstaciones;
}

/** Estación -> ISO de la fecha de entrada (solo las estaciones que ya tienen fecha). */
export type EntradasEstaciones = Partial<Record<EstadoProyecto, string>>;

/** Normaliza un nombre de propiedad: minúsculas, sin acentos, espacios simples. */
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
  return propNames.find((n) => estacionDeColumnaEntrada(n) === estacion) ?? null;
}

/**
 * Devuelve la fecha/hora actual en formato ISO con la zona horaria de Bogotá
 * (UTC-5, sin horario de verano), p. ej. "2026-09-29T14:35:00-05:00".
 * Así Notion muestra exactamente la hora local de la planta.
 */
export function nowBogotaISO(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() - 5 * 60 * 60 * 1000);
  return shifted.toISOString().replace(/\.\d{3}Z$/, "-05:00");
}

function getRichText(prop: any): string {
  if (!prop || !Array.isArray(prop.rich_text)) return "";
  return prop.rich_text.map((t: any) => t?.plain_text ?? "").join("");
}

function getSelect(prop: any): string {
  return prop?.select?.name ?? "";
}

function getStatus(prop: any): string {
  return prop?.status?.name ?? "";
}

function getNumber(prop: any): number | null {
  return typeof prop?.number === "number" ? prop.number : null;
}

function getDate(prop: any): string | null {
  return prop?.date?.start ?? null;
}

function isEstadoProyecto(value: string): value is EstadoProyecto {
  return (TODAS_LAS_COLUMNAS as string[]).includes(value);
}

/**
 * Transforma una página cruda de la API de Notion al modelo `Proyecto` de la
 * aplicación. Esta es la ÚNICA función que debe leer `page.properties`.
 */
export function mapNotionPageToProyecto(page: any): Proyecto {
  const props = page?.properties ?? {};
  const estadoRaw = getStatus(props[NOTION_PROPS.estado]);

  // Lee todas las columnas "Entrada a <Estación>" (tipo Date).
  const entradas: EntradasEstaciones = {};
  for (const [name, prop] of Object.entries<any>(props)) {
    const est = estacionDeColumnaEntrada(name);
    if (!est) continue;
    const fecha = getDate(prop);
    if (fecha) entradas[est] = fecha;
  }
  const estadoActual = (isEstadoProyecto(estadoRaw) ? estadoRaw : estadoRaw || ESTADO_INICIAL) as EstadoProyecto;

  return {
    id: page.id,
    notionPageId: page.id,
    codigoProyecto: getNumber(props[NOTION_PROPS.codigoProyecto]),
    equipo: getRichText(props[NOTION_PROPS.equipo]),
    cliente: getRichText(props[NOTION_PROPS.cliente]),
    personaACargo: getSelect(props[NOTION_PROPS.personaACargo]),
    fechaInicio: getDate(props[NOTION_PROPS.fechaInicio]),
    fechaEstimadaEntrega: getDate(props[NOTION_PROPS.fechaEstimadaEntrega]),
    // Si Notion trae un estado que no está en la lista conocida, se conserva
    // tal cual (nunca se inventa ni se traduce), mostrándolo como texto libre.
    estado: (isEstadoProyecto(estadoRaw) ? estadoRaw : estadoRaw || ESTADO_INICIAL) as EstadoProyecto,
    avance: getNumber(props[NOTION_PROPS.avance]) ?? 0,
    prioridad: getSelect(props[NOTION_PROPS.prioridad]),
    entradaAEstacion:
      entradas[estadoActual] ?? getDate(props[NOTION_PROPS.entradaAEstacionLegacy]),
    entradas,
  };
}

/**
 * Formatea el código numérico de proyecto (Notion Number) como "PRJ - 001".
 * El número de Notion sigue siendo la fuente real; esto es solo presentación.
 */
export function formatProjectCode(codigo: number | null | undefined): string {
  if (codigo === null || codigo === undefined || Number.isNaN(codigo)) {
    return "Sin información";
  }
  return `PRJ - ${String(codigo).padStart(3, "0")}`;
}

/** Muestra "Sin información" para strings vacíos venidos de Notion. */
export function orSinInformacion(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "Sin información";
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

  if (updates.codigoProyecto !== undefined) {
    properties[NOTION_PROPS.codigoProyecto] = { number: updates.codigoProyecto };
  }
  if (updates.equipo !== undefined) {
    properties[NOTION_PROPS.equipo] = {
      rich_text: updates.equipo ? [{ text: { content: updates.equipo } }] : [],
    };
  }
  if (updates.cliente !== undefined) {
    properties[NOTION_PROPS.cliente] = {
      rich_text: updates.cliente ? [{ text: { content: updates.cliente } }] : [],
    };
  }
  if (updates.personaACargo !== undefined) {
    properties[NOTION_PROPS.personaACargo] = { select: { name: updates.personaACargo } };
  }
  if (updates.fechaInicio !== undefined) {
    properties[NOTION_PROPS.fechaInicio] = {
      date: updates.fechaInicio ? { start: updates.fechaInicio } : null,
    };
  }
  if (updates.fechaEstimadaEntrega !== undefined) {
    properties[NOTION_PROPS.fechaEstimadaEntrega] = {
      date: updates.fechaEstimadaEntrega ? { start: updates.fechaEstimadaEntrega } : null,
    };
  }
  if (updates.estado !== undefined) {
    // CRÍTICO: Estado es una propiedad Status en Notion, no Select.
    properties[NOTION_PROPS.estado] = { status: { name: updates.estado } };
  }
  if (updates.avance !== undefined) {
    properties[NOTION_PROPS.avance] = { number: updates.avance };
  }
  if (updates.prioridad !== undefined) {
    properties[NOTION_PROPS.prioridad] = { select: { name: updates.prioridad } };
  }
  if (updates.entradas) {
    for (const [est, fecha] of Object.entries(updates.entradas) as [EstadoProyecto, string | null][]) {
      const propName = findEntradaPropName(datePropNames, est);
      if (!propName) {
        missing.push(est);
        continue;
      }
      properties[propName] = { date: fecha ? { start: fecha } : null };
    }
  }

  return { properties, missing };
}
