// Centralized mapping between the FROZZ MES model and Notion.

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
  entradaAEstacionLegacy: "Entrada a estación",
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
  entradaAEstacion: string | null;
  tiempoPorEstacion: string;
  entradas: EntradasEstaciones;
}

export type EntradasEstaciones = Partial<Record<EstadoProyecto, string>>;

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function estacionDeColumnaEntrada(propName: string): EstadoProyecto | null {
  const n = normalizeName(propName);
  const match = n.match(/^entrada a (.+)$/);
  if (!match) return null;

  const resto = match[1];
  return (
    ORDEN_ESTACIONES.find((est) => {
      const normalized = normalizeName(est);
      return resto === normalized || resto.startsWith(normalized.slice(0, 4));
    }) ?? null
  );
}

export function findEntradaPropName(propNames: string[], estacion: EstadoProyecto): string | null {
  const expected = ENTRADA_PROPS[estacion];
  if (expected && propNames.includes(expected)) return expected;
  return propNames.find((name) => estacionDeColumnaEntrada(name) === estacion) ?? null;
}

/** Current instant represented as an ISO-8601 timestamp with Bogotá's -05:00 offset. */
export function nowBogotaISO(date: Date = new Date()): string {
  const utc = date.toISOString().replace(/\.\d{3}Z$/, "Z");
  const shifted = new Date(new Date(utc).getTime() - 5 * 60 * 60 * 1000);
  return shifted.toISOString().replace(/\.\d{3}Z$/, "-05:00");
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

  return {
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
    entradaAEstacion: entradas[estadoActual] ?? getDate(props[NOTION_PROPS.entradaAEstacionLegacy]),
    tiempoPorEstacion: getRichText(props[NOTION_PROPS.tiempoPorEstacion]),
    entradas,
  };
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
  entradas: Partial<Record<EstadoProyecto, string | null>>;
}>;

export function buildNotionPropertiesPayload(
  updates: ProyectoUpdateFields,
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

  if (updates.tiempoPorEstacion !== undefined) {
    properties[NOTION_PROPS.tiempoPorEstacion] = {
      rich_text: updates.tiempoPorEstacion ? [{ text: { content: updates.tiempoPorEstacion } }] : [],
    };
  }

  return { properties, missing };
}
