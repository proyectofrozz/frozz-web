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
//   Entrada a [Estación]       -> Date (para cada estación de producción)

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
  entradaDiseño: "Entrada a Diseño",
  entradaCorte: "Entrada a Corte",
  entradaDoblez: "Entrada a Doblez",
  entradaSoldadura: "Entrada a Soldadura",
  entradaPintura: "Entrada a Pintura",
  entradaEnsamblaje: "Entrada a Ensamblaje",
  entradaRefrigeración: "Entrada a Refrigeración",
  entradaEléctrica: "Entrada a Eléctrica",
  entradaFinalizado: "Entrada a Finalizado",
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
  entradaAEstacion: string | null;
  // Fechas de entrada a cada estación (guardadas en Notion, recuperadas al recargar)
  entradaDiseño: string | null;
  entradaCorte: string | null;
  entradaDoblez: string | null;
  entradaSoldadura: string | null;
  entradaPintura: string | null;
  entradaEnsamblaje: string | null;
  entradaRefrigeración: string | null;
  entradaEléctrica: string | null;
  entradaFinalizado: string | null;
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
    entradaAEstacion: getDate(props[NOTION_PROPS.entradaAEstacion]),
    // Fechas de entrada a cada estación (persistidas en Notion)
    entradaDiseño: getDate(props[NOTION_PROPS.entradaDiseño]),
    entradaCorte: getDate(props[NOTION_PROPS.entradaCorte]),
    entradaDoblez: getDate(props[NOTION_PROPS.entradaDoblez]),
    entradaSoldadura: getDate(props[NOTION_PROPS.entradaSoldadura]),
    entradaPintura: getDate(props[NOTION_PROPS.entradaPintura]),
    entradaEnsamblaje: getDate(props[NOTION_PROPS.entradaEnsamblaje]),
    entradaRefrigeración: getDate(props[NOTION_PROPS.entradaRefrigeración]),
    entradaEléctrica: getDate(props[NOTION_PROPS.entradaEléctrica]),
    entradaFinalizado: getDate(props[NOTION_PROPS.entradaFinalizado]),
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
  entradaAEstacion: string | null;
  entradaDiseño: string | null;
  entradaCorte: string | null;
  entradaDoblez: string | null;
  entradaSoldadura: string | null;
  entradaPintura: string | null;
  entradaEnsamblaje: string | null;
  entradaRefrigeración: string | null;
  entradaEléctrica: string | null;
  entradaFinalizado: string | null;
}>;

/**
 * Construye el objeto `properties` que espera `PATCH /v1/pages/{id}` de Notion,
 * respetando el tipo real de cada propiedad (en particular: Estado es Status,
 * no Select; Código Proyecto y Avance son Number, no texto).
 */
export function buildNotionPropertiesPayload(updates: ProyectoUpdateFields): Record<string, any> {
  const properties: Record<string, any> = {};

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
  if (updates.entradaAEstacion !== undefined) {
    properties[NOTION_PROPS.entradaAEstacion] = {
      date: updates.entradaAEstacion ? { start: updates.entradaAEstacion } : null,
    };
  }
  if (updates.entradaDiseño !== undefined) {
    properties[NOTION_PROPS.entradaDiseño] = {
      date: updates.entradaDiseño ? { start: updates.entradaDiseño } : null,
    };
  }
  if (updates.entradaCorte !== undefined) {
    properties[NOTION_PROPS.entradaCorte] = {
      date: updates.entradaCorte ? { start: updates.entradaCorte } : null,
    };
  }
  if (updates.entradaDoblez !== undefined) {
    properties[NOTION_PROPS.entradaDoblez] = {
      date: updates.entradaDoblez ? { start: updates.entradaDoblez } : null,
    };
  }
  if (updates.entradaSoldadura !== undefined) {
    properties[NOTION_PROPS.entradaSoldadura] = {
      date: updates.entradaSoldadura ? { start: updates.entradaSoldadura } : null,
    };
  }
  if (updates.entradaPintura !== undefined) {
    properties[NOTION_PROPS.entradaPintura] = {
      date: updates.entradaPintura ? { start: updates.entradaPintura } : null,
    };
  }
  if (updates.entradaEnsamblaje !== undefined) {
    properties[NOTION_PROPS.entradaEnsamblaje] = {
      date: updates.entradaEnsamblaje ? { start: updates.entradaEnsamblaje } : null,
    };
  }
  if (updates.entradaRefrigeración !== undefined) {
    properties[NOTION_PROPS.entradaRefrigeración] = {
      date: updates.entradaRefrigeración ? { start: updates.entradaRefrigeración } : null,
    };
  }
  if (updates.entradaEléctrica !== undefined) {
    properties[NOTION_PROPS.entradaEléctrica] = {
      date: updates.entradaEléctrica ? { start: updates.entradaEléctrica } : null,
    };
  }
  if (updates.entradaFinalizado !== undefined) {
    properties[NOTION_PROPS.entradaFinalizado] = {
      date: updates.entradaFinalizado ? { start: updates.entradaFinalizado } : null,
    };
  }

  return properties;
}
