// src/routes/api/notion/notion-update.ts
// Endpoint server-side para actualizar un proyecto en Notion.
// Toda la lógica de qué propiedad de Notion corresponde a cada campo, y con
// qué tipo (Status, Select, Number, Rich text, Date), vive en el mapper
// centralizado — este endpoint solo valida la petición y delega en él.

import { buildNotionPropertiesPayload, type ProyectoUpdateFields } from '@/lib/notion/mapper';

interface UpdateProjectRequest extends ProyectoUpdateFields {
  notionPageId: string;
}

export async function PATCH(req: Request) {
  const notionToken = process.env.NOTION_API_KEY;

  if (!notionToken) {
    return new Response(
      JSON.stringify({ error: 'Missing Notion API credentials' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: UpdateProjectRequest = await req.json();
    const { notionPageId, ...updates } = body;

    if (!notionPageId) {
      // El identificador de la página de Notion es obligatorio: nunca se debe
      // usar el nombre/código del proyecto para identificar qué actualizar.
      return new Response(
        JSON.stringify({ error: 'notionPageId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const properties = buildNotionPropertiesPayload(updates);

    if (Object.keys(properties).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No fields to update were provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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
      }
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
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error updating Notion page:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to update project',
        message: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
