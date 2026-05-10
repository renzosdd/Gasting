const JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    resumen: { type: 'string' },
    gastos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          descripcion: { type: 'string' },
          monto: { type: 'number' },
          moneda: { type: 'string', enum: ['UYU', 'USD'] },
          tipoDestino: { type: 'string', enum: ['general', 'vehiculo', 'hogar', 'tarjeta'] },
          categoriaGrupo: { type: 'string' },
          subcategoria: { type: 'string' },
          fecha: { type: 'string' },
          confianza: { type: 'number' },
          notas: { type: 'string' },
        },
        required: ['descripcion', 'monto', 'moneda', 'tipoDestino', 'categoriaGrupo', 'subcategoria', 'fecha', 'confianza', 'notas'],
      },
    },
  },
  required: ['resumen', 'gastos'],
};

const extractOutputText = (response) => {
  if (response.output_text) return response.output_text;

  return (response.output || [])
    .flatMap(item => item.content || [])
    .filter(content => content.type === 'output_text' || content.type === 'text')
    .map(content => content.text)
    .join('\n');
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Falta configurar OPENAI_API_KEY en Netlify.' }) };
  }

  try {
    const { fileName, mimeType, fileData, categorias = [], tarjetas = [] } = JSON.parse(event.body || '{}');

    if (!fileName || !mimeType || !fileData) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Falta archivo para analizar.' }) };
    }

    const isImage = mimeType.startsWith('image/');
    const fileContent = isImage
      ? { type: 'input_image', image_url: `data:${mimeType};base64,${fileData}`, detail: 'auto' }
      : { type: 'input_file', filename: fileName, file_data: `data:${mimeType};base64,${fileData}` };

    const prompt = `
Analiza este documento financiero para una app de gastos personales.

Objetivo:
- Extraer gastos sugeridos para que el usuario pueda confirmarlos antes de guardarlos.
- Si es estado de cuenta de tarjeta, separar movimientos relevantes cuando sea posible.
- Si parece un pago/resumen total de tarjeta, sugerir también un gasto tipo "tarjeta".
- Usa las categorías existentes cuando calcen.
- No inventes importes. Si no estás seguro, baja la confianza.

Categorías existentes:
${JSON.stringify(categorias)}

Tarjetas registradas:
${JSON.stringify(tarjetas)}

Devuelve solo JSON válido con este shape:
${JSON.stringify(JSON_SCHEMA)}
`;

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-nano',
        input: [
          {
            role: 'user',
            content: [
              fileContent,
              { type: 'input_text', text: prompt },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'gasting_document_analysis',
            schema: JSON_SCHEMA,
            strict: true,
          },
        },
      }),
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return {
        statusCode: openaiResponse.status,
        body: JSON.stringify({ error: data.error?.message || 'No se pudo analizar el documento.' }),
      };
    }

    const outputText = extractOutputText(data);
    const parsed = JSON.parse(outputText);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Error inesperado al analizar documento.' }),
    };
  }
};
