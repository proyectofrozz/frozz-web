// src/routes/api/notion/read.ts
// Endpoint para leer proyectos desde Notion

export async function GET() {
  const notionToken = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!notionToken || !databaseId) {
    return new Response(
      JSON.stringify({
        error: 'Missing Notion API credentials',
        message: 'NOTION_API_KEY o NOTION_DATABASE_ID not configured'
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
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
          filter: {
            property: 'archived',
            checkbox: { equals: false },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.status}`);
    }

    const data = await response.json();

    // Transforma los datos de Notion al formato que tu app necesita
    const proyectos = data.results.map((page: any) => {
      const props = page.properties;
      return {
        id: page.id,
        codigoProyecto: props['codigo proyecto']?.rich_text[0]?.plain_text || '',
        equipo: props['equipo']?.rich_text[0]?.plain_text || '',
        cliente: props['cliente']?.rich_text[0]?.plain_text || '',
        personaACargo: props['persona a cargo']?.select?.name || '',
        fechaInicio: props['fecha de inicio']?.date?.start || '',
        fechaEstimadaEntrega: props['fecha estimada de entrega']?.date?.start || '',
        estado: props['estado']?.select?.name || '',
        avance: props['avance']?.number || 0,
        prioridad: props['prioridad']?.select?.name || '',
        entradaAEstacion: props['entrada a estación']?.date?.start || '',
      };
    });

    return new Response(JSON.stringify({ proyectos, total: data.results.length }), {
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
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
