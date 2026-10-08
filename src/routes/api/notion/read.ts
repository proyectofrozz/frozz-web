// src/routes/api/notion/read.ts
// Server route (GET /api/notion/read) para leer los proyectos reales desde
// Notion. Notion es la única fuente de verdad: este endpoint consulta la
// base de datos y devuelve proyectos ya normalizados con
// mapNotionPageToProyecto, nunca el objeto crudo de Notion.
//
// IMPORTANTE: en TanStack Start (^1.168) un endpoint server-side se registra
// exportando `Route` desde `createFileRoute(...)` con una propiedad `server`.
// Un simple `export function GET() {}` NO se registra en el router y produce
// un 404 en producción aunque el archivo exista.

import { createFileRoute } from '@tanstack/react-router';
import { mapNotionPageToProyecto, type Proyecto } from '@/lib/notion/mapper';

export const Route = createFileRoute('/api/notion/read')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const notionToken = process.env.NOTION_API_KEY;
        const databaseId = process.env.NOTION_DATABASE_ID;
        const requestedPageId = new URL(request.url).searchParams.get('notionPageId');

        if (!notionToken || !databaseId) {
          return new Response(
            JSON.stringify({
              error: 'Missing Notion API credentials',
              message: 'NOTION_API_KEY o NOTION_DATABASE_ID no están configurados',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          );
        }

        try {
          // Modo puntual: leer una sola página de Notion antes de finalizar o deshacer.
          if (requestedPageId) {
            const pageResponse = await fetch(
              `https://api.notion.com/v1/pages/${requestedPageId}`,
              {
                headers: {
                  Authorization: `Bearer ${notionToken}`,
                  'Notion-Version': '2022-06-28',
                },
                cache: 'no-store',
              },
            );
            if (!pageResponse.ok) {
              const errBody = await pageResponse.json().catch(() => ({}));
              throw new Error(
                `Notion API error: ${pageResponse.status} ${errBody?.message ?? ''}`.trim(),
              );
            }
            const page = await pageResponse.json();
            return new Response(
              JSON.stringify({ proyecto: mapNotionPageToProyecto(page), total: 1 }),
              { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
            );
          }

          const proyectos: Proyecto[] = [];
          let cursor: string | undefined;

          // Pagina sobre toda la base de datos por si hay más de 100 proyectos.
          do {
            const response = await fetch(
              `https://api.notion.com/v1/databases/${databaseId}/query`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${notionToken}`,
                  'Notion-Version': '2022-06-28',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  page_size: 100,
                  ...(cursor ? { start_cursor: cursor } : {}),
                }),
              },
            );

            if (!response.ok) {
              const errBody = await response.json().catch(() => ({}));
              throw new Error(
                `Notion API error: ${response.status} ${errBody?.message ?? ''}`.trim(),
              );
            }

            const data = await response.json();

            for (const page of data.results ?? []) {
              proyectos.push(mapNotionPageToProyecto(page));
            }

            cursor = data.has_more ? data.next_cursor : undefined;
          } while (cursor);

          return new Response(JSON.stringify({ proyectos, total: proyectos.length }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error: any) {
          console.error('Error reading from Notion:', error);
          return new Response(
            JSON.stringify({
              error: 'Failed to read from Notion',
              message: error.message,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          );
        }
      },
    },
  },
});
