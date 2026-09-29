// src/routes/api/notion/update.ts
// Server route (PATCH /api/notion/update) para actualizar un proyecto en
// Notion. Toda la lógica de qué propiedad de Notion corresponde a cada
// campo, y con qué tipo (Status, Select, Number, Rich text, Date), vive en
// el mapper centralizado — este endpoint solo valida la petición y delega
// en él.
//
// IMPORTANTE: en TanStack Start (^1.168) un endpoint server-side se registra
// exportando `Route` desde `createFileRoute(...)` con una propiedad `server`.
// Un simple `export function PATCH() {}` NO se registra en el router y
// produce un 404 en producción aunque el archivo exista.

import { createFileRoute } from '@tanstack/react-router';
import { buildNotionPropertiesPayload, type ProyectoUpdateFields } from '@/lib/notion/mapper';

interface UpdateProjectRequest extends ProyectoUpdateFields {
  notionPageId: string;
}

// Nombres reales de las columnas de tipo Date de la base de datos (cache en
// memoria). Se consultan una sola vez al schema de Notion para encontrar las
// columnas "Entrada a Diseño", "Entrada a Corte", etc. sin depender de
// mayúsculas o acentos exactos.
let dateColumnsCache: { names: string[]; at: number } | null = null;

async function getDateColumnNames(token: string, databaseId: string): Promise<string[]> {
  if (dateColumnsCache && Date.now() - dateColumnsCache.at < 5 * 60 * 1000) {
    return dateColumnsCache.names;
  }
  const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`No se pudo leer el esquema de Notion: ${err.message ?? res.status}`);
  }
  const db = await res.json();
  const names = Object.entries<any>(db.properties ?? {})
    .filter(([, prop]) => prop?.type === 'date')
    .map(([name]) => name);
  dateColumnsCache = { names, at: Date.now() };
  return names;
}

export const Route = createFileRoute('/api/notion/update')({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        const notionToken = process.env.NOTION_API_KEY;

        if (!notionToken) {
          return new Response(
            JSON.stringify({ error: 'Missing Notion API credentials' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          );
        }

        try {
          const body: UpdateProjectRequest = await request.json();
          const { notionPageId, ...updates } = body;

          if (!notionPageId) {
            // El identificador de la página de Notion es obligatorio: nunca
            // se debe usar el nombre/código del proyecto para identificar
            // qué actualizar.
            return new Response(
              JSON.stringify({ error: 'notionPageId is required' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
          }

          let datePropNames: string[] = [];
          if (updates.entradas && Object.keys(updates.entradas).length > 0) {
            const databaseId = process.env.NOTION_DATABASE_ID;
            if (!databaseId) {
              return new Response(
                JSON.stringify({ error: 'Missing NOTION_DATABASE_ID' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
              );
            }
            datePropNames = await getDateColumnNames(notionToken, databaseId);
          }

          const { properties, missing } = buildNotionPropertiesPayload(updates, datePropNames);

          if (Object.keys(properties).length === 0) {
            return new Response(
              JSON.stringify({ error: 'No fields to update were provided' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
          }

          const response = await fetch(
            `https://api.notion.com/v1/pages/${notionPageId}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ properties }),
            },
          );

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Notion API error: ${error.message ?? response.status}`);
          }

          const updated = await response.json();

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Project updated successfully',
              notionPageId: updated.id,
              // Estaciones cuya columna "Entrada a ..." no existe en Notion.
              missingColumns: missing,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        } catch (error: any) {
          console.error('Error updating Notion page:', error);
          return new Response(
            JSON.stringify({
              error: 'Failed to update project',
              message: error.message,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          );
        }
      },
    },
  },
});
