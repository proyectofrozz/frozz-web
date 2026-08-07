// src/routes/api/notion/update.ts
// Endpoint para actualizar un proyecto en Notion

interface UpdateProjectRequest {
  pageId: string;
  codigoProyecto?: string;
  equipo?: string;
  cliente?: string;
  personaACargo?: string;
  fechaInicio?: string;
  fechaEstimadaEntrega?: string;
  estado?: string;
  avance?: number;
  prioridad?: string;
  entradaAEstacion?: string;
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
    const { pageId, ...updates } = body;

    if (!pageId) {
      return new Response(
        JSON.stringify({ error: 'pageId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Construye el payload para Notion API
    const properties: Record<string, any> = {};

    if (updates.codigoProyecto !== undefined) {
      properties['codigo proyecto'] = {
        rich_text: [{ text: { content: updates.codigoProyecto } }],
      };
    }
    if (updates.equipo !== undefined) {
      properties['equipo'] = {
        rich_text: [{ text: { content: updates.equipo } }],
      };
    }
    if (updates.cliente !== undefined) {
      properties['cliente'] = {
        rich_text: [{ text: { content: updates.cliente } }],
      };
    }
    if (updates.personaACargo !== undefined) {
      properties['persona a cargo'] = {
        select: { name: updates.personaACargo },
      };
    }
    if (updates.fechaInicio !== undefined) {
      properties['fecha de inicio'] = {
        date: { start: updates.fechaInicio },
      };
    }
    if (updates.fechaEstimadaEntrega !== undefined) {
      properties['fecha estimada de entrega'] = {
        date: { start: updates.fechaEstimadaEntrega },
      };
    }
    if (updates.estado !== undefined) {
      properties['estado'] = {
        select: { name: updates.estado },
      };
    }
    if (updates.avance !== undefined) {
      properties['avance'] = {
        number: updates.avance,
      };
    }
    if (updates.prioridad !== undefined) {
      properties['prioridad'] = {
        select: { name: updates.prioridad },
      };
    }
    if (updates.entradaAEstacion !== undefined) {
      properties['entrada a estación'] = {
        date: { start: updates.entradaAEstacion },
      };
    }

    const response = await fetch(
      `https://api.notion.com/v1/pages/${pageId}`,
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
      const error = await response.json();
      throw new Error(`Notion API error: ${error.message}`);
    }

    const updated = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Project updated successfully',
        pageId: updated.id,
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
