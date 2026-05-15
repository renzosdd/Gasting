import { getAdminDb, verifyAdminRequest } from './_firebase-admin.js';

export const config = {
  schedule: '@monthly',
};

const MIN_SAMPLES = Number(process.env.PRODUCT_PRICE_MIN_SAMPLES || 5);
const READ_LIMIT = Number(process.env.PRODUCT_PRICE_AGGREGATE_READ_LIMIT || 5000);

const normalizar = (valor = '') => String(valor)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const canonicalProductKey = (nombre = '', marca = '', unidad = '') => {
  const text = normalizar(`${marca} ${nombre}`)
    .replace(/coca[\s-]?cola|coca cola|coca/g, 'coca cola')
    .replace(/(\d+)[,.](\d+)\s*(l|lt|lts|litro|litros)\b/g, '$1.$2 l')
    .replace(/(\d+)\s*(cc|ml)\b/g, (_, amount) => `${Number(amount) / 1000} l`)
    .replace(/(\d+)\s*(kg|kilo|kilos)\b/g, '$1 kg')
    .replace(/(\d+)\s*(g|gr|gramos)\b/g, '$1 g')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\b(un|una|el|la|los|las|de|del|x|pack)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return `${text}|${unidad || 'unidad'}`;
};

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

export const handler = async (event) => {
  try {
    await verifyAdminRequest(event);
    const db = getAdminDb();
    const snapshot = await db.collection('producto_precios')
      .where('estadoAgregado', 'in', ['pendiente_anonimizar', 'esperando_muestras'])
      .limit(READ_LIMIT)
      .get();

    const groups = new Map();
    snapshot.docs.forEach((doc) => {
      const item = { id: doc.id, ...doc.data() };
      if (!item.nombre || Number(item.precioUnitario || 0) <= 0) return;
      const key = canonicalProductKey(item.nombre, item.marca, item.unidad);
      const current = groups.get(key) || [];
      current.push(item);
      groups.set(key, current);
    });

    const batches = [];
    let batch = db.batch();
    let batchOps = 0;
    const queueSet = (ref, data, options) => {
      batch.set(ref, data, options);
      batchOps += 1;
      if (batchOps >= 450) {
        batches.push(batch);
        batch = db.batch();
        batchOps = 0;
      }
    };
    const queueUpdate = (ref, data) => {
      batch.update(ref, data);
      batchOps += 1;
      if (batchOps >= 450) {
        batches.push(batch);
        batch = db.batch();
        batchOps = 0;
      }
    };
    let agregados = 0;
    let esperando = 0;
    const now = new Date();
    const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    groups.forEach((items, key) => {
      const values = items.map(item => Number(item.precioUnitario || 0)).filter(Boolean);
      if (values.length < MIN_SAMPLES) {
        items
          .filter(item => item.estadoAgregado !== 'esperando_muestras')
          .forEach((item) => {
            queueUpdate(db.collection('producto_precios').doc(item.id), {
              estadoAgregado: 'esperando_muestras',
              productoKey: key,
              muestrasActuales: values.length,
            });
            esperando += 1;
          });
        return;
      }

      const sample = items[0];
      const promedio = values.reduce((sum, value) => sum + value, 0) / values.length;
      const agregadoRef = db.collection('producto_precios_agregados').doc(`${periodo}_${key.replace(/[^a-z0-9]+/g, '_').slice(0, 120)}`);
      queueSet(agregadoRef, {
        key,
        periodo,
        nombreCanonico: key.split('|')[0],
        unidad: sample.unidad || 'unidad',
        moneda: sample.moneda || 'UYU',
        muestras: values.length,
        promedio,
        minimo: Math.min(...values),
        maximo: Math.max(...values),
        p25: percentile(values, 25),
        p50: percentile(values, 50),
        p75: percentile(values, 75),
        actualizado: new Date(),
        minMuestras: MIN_SAMPLES,
      }, { merge: true });
      items.forEach((item) => {
        queueUpdate(db.collection('producto_precios').doc(item.id), { estadoAgregado: 'anonimizado', productoKey: key });
      });
      agregados += 1;
    });

    if (batchOps > 0) batches.push(batch);
    await Promise.all(batches.map(item => item.commit()));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, procesados: snapshot.size, agregados, esperando, minMuestras: MIN_SAMPLES, readLimit: READ_LIMIT }),
    };
  } catch (error) {
    return {
      statusCode: /permisos|token/i.test(error.message) ? 403 : 500,
      body: JSON.stringify({ error: error.message || 'No se pudo agregar precios.' }),
    };
  }
};
