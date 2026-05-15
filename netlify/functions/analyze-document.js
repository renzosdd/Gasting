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
    const { fileName, mimeType, fileData, extractedText, categorias = [], tarjetas = [] } = JSON.parse(event.body || '{}');

    if (!extractedText && (!fileName || !mimeType || !fileData)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Falta texto o archivo para analizar.' }) };
    }

    const content = [];

    if (extractedText) {
      content.push({ type: 'input_text', text: `Texto extraído localmente por OCR/text layer:\n\n${extractedText}` });
    } else {
      const isImage = mimeType.startsWith('image/');
      content.push(isImage
        ? { type: 'input_image', image_url: `data:${mimeType};base64,${fileData}`, detail: 'auto' }
        : { type: 'input_file', filename: fileName, file_data: `data:${mimeType};base64,${fileData}` });
    }

    const prompt = `
Analiza este documento financiero para una app de gastos personales.

Objetivo:
- Extraer gastos sugeridos para que el usuario pueda confirmarlos antes de guardarlos.
- Sirve para estados de cuenta de tarjeta, tickets de supermercado, facturas de servicios, recibos y boletas.
- Si es estado de cuenta de tarjeta:
  - separar movimientos relevantes cuando estén disponibles;
  - identificar cuotas, saldos, pagos mínimos o totales si aparecen;
  - sugerir un gasto tipo "tarjeta" cuando el documento represente el pago/resumen total;
  - usar "notas" para indicar cuotas pendientes o dudas.
- Si es ticket/boleta:
  - sugerir un gasto único cuando no convenga separar líneas;
  - separar líneas solo si son importes claros y útiles.
- Si es factura de servicio:
  - usar tipoDestino "hogar" cuando corresponda;
  - extraer vencimiento en "fecha" si aparece.
- Usa las categorías existentes cuando calcen.
- No inventes importes. Si no estás seguro, baja la confianza.
- Moneda:
  - UYU para pesos uruguayos, $, U$, UYU;
  - USD para dólares, US$, USD.
- Fechas: usa YYYY-MM-DD cuando puedas; si no hay fecha, deja string vacío.
- Confianza: número entre 0 y 1.

Categorías existentes:
${JSON.stringify(categorias)}

Tarjetas registradas:
${JSON.stringify(tarjetas)}

Devuelve solo JSON válido con este shape:
${JSON.stringify(JSON_SCHEMA)}
`;

    const callOpenAI = (model) => fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'user',
            content: [
              ...content,
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

    const primaryModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini';
    let openaiResponse = await callOpenAI(primaryModel);
    let data = await openaiResponse.json();

    if (!openaiResponse.ok && primaryModel !== fallbackModel && /model|access|does not have access/i.test(data.error?.message || '')) {
      openaiResponse = await callOpenAI(fallbackModel);
      data = await openaiResponse.json();
    }

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
