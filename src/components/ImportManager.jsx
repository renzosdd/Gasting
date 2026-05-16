import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, FileText, RotateCcw, Trash2 } from 'lucide-react';
import { db } from '../firebase';

const formatDate = (fecha) => {
  const date = fecha?.toDate?.();
  if (!date) return 'Sin fecha';
  return date.toLocaleDateString('es-UY', { day: '2-digit', month: 'short', year: 'numeric' });
};

const sourceLabel = {
  spreadsheet: 'Planilla',
  document: 'Documento',
  voice: 'Voz',
};

const statusMeta = {
  pendiente_revision: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700' },
  parcial: { label: 'Parcial', className: 'bg-indigo-50 text-indigo-700' },
  revisada: { label: 'Revisada', className: 'bg-emerald-50 text-emerald-700' },
  activa: { label: 'Activa', className: 'bg-emerald-50 text-emerald-700' },
};

const commitBatchDeletes = async (refs, extraUpdates = []) => {
  const operations = [
    ...refs.map(ref => ({ type: 'delete', ref })),
    ...extraUpdates.map(item => ({ type: 'update', ...item })),
  ];

  for (let index = 0; index < operations.length; index += 450) {
    const batch = writeBatch(db);
    operations.slice(index, index + 450).forEach((operation) => {
      if (operation.type === 'delete') batch.delete(operation.ref);
      if (operation.type === 'update') batch.update(operation.ref, operation.data);
    });
    await batch.commit();
  }
};

export default function ImportManager({ user }) {
  const [importaciones, setImportaciones] = useState([]);
  const [procesandoId, setProcesandoId] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'importaciones'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setImportaciones(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    });
    return () => unsubscribe();
  }, [user.uid]);

  const importacionesOrdenadas = useMemo(() => (
    [...importaciones].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  ), [importaciones]);

  const activas = importacionesOrdenadas.filter(item => item.estado !== 'anulada');
  const anuladas = importacionesOrdenadas.filter(item => item.estado === 'anulada');

  const deshacerImportacion = async (importacion) => {
    if (!window.confirm(`¿Deshacer la importación "${importacion.archivoNombre}"? Se eliminarán los gastos y precios creados por ese lote.`)) return;

    setProcesandoId(importacion.id);
    try {
      const gastosSnap = await getDocs(query(
        collection(db, 'gastos'),
        where('userId', '==', user.uid),
        where('importBatchId', '==', importacion.id),
      ));
      const productosSnap = await getDocs(query(
        collection(db, 'producto_precios'),
        where('userId', '==', user.uid),
        where('importBatchId', '==', importacion.id),
      ));

      await commitBatchDeletes(
        [...gastosSnap.docs.map(item => item.ref), ...productosSnap.docs.map(item => item.ref)],
        [{
          ref: doc(db, 'importaciones', importacion.id),
          data: {
            estado: 'anulada',
            gastosEliminados: gastosSnap.size,
            productosEliminados: productosSnap.size,
            updatedAt: serverTimestamp(),
            anuladaAt: serverTimestamp(),
          },
        }],
      );
    } catch (error) {
      alert('No se pudo deshacer la importación: ' + error.message);
    }
    setProcesandoId('');
  };

  const eliminarRegistro = async (importacion) => {
    if (!window.confirm('¿Eliminar este registro de importación? No cambia los gastos existentes.')) return;
    await deleteDoc(doc(db, 'importaciones', importacion.id));
  };

  const marcarEstado = async (importacion, estado) => {
    setProcesandoId(importacion.id);
    try {
      await updateDoc(doc(db, 'importaciones', importacion.id), {
        estado,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      alert('No se pudo actualizar el estado: ' + error.message);
    }
    setProcesandoId('');
  };

  return (
    <div className="pt-4 animate-in fade-in duration-500 space-y-5">
      <section className="rounded-[2rem] bg-zinc-900 text-white p-5 shadow-xl shadow-zinc-900/10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Importaciones</p>
            <h2 className="text-2xl font-black">Históricos cargados</h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-zinc-300">
          Cada carga por documento, voz o planilla queda agrupada para poder revisarla y deshacerla si algo no quedó bien.
        </p>
      </section>

      {activas.length === 0 && (
        <div className="rounded-[2rem] bg-white border border-zinc-100 p-8 text-center shadow-sm">
          <FileText size={28} className="mx-auto text-zinc-300" />
          <p className="mt-3 font-black text-zinc-800">No hay importaciones activas.</p>
          <p className="mt-1 text-sm text-zinc-400">Cuando cargues una planilla o documento, va a aparecer acá.</p>
        </div>
      )}

      <div className="space-y-3">
        {activas.map(importacion => (
          <article key={importacion.id} className="rounded-3xl bg-white border border-zinc-100 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-600">
                  {sourceLabel[importacion.sourceType] || 'Carga'}
                </p>
                <h3 className="mt-1 font-black text-zinc-900 truncate">{importacion.archivoNombre || 'Importación'}</h3>
                <p className="mt-1 text-xs font-bold text-zinc-400">{formatDate(importacion.createdAt)}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 ${statusMeta[importacion.estado]?.className || 'bg-zinc-100 text-zinc-600'}`}>
                <CheckCircle2 size={13} /> {statusMeta[importacion.estado]?.label || importacion.estado || 'Activa'}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-zinc-50 p-3 border border-zinc-100">
                <p className="text-lg font-black text-zinc-900">{importacion.gastosGuardados || 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Gastos</p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-3 border border-zinc-100">
                <p className="text-lg font-black text-zinc-900">{importacion.totalSugerencias || 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Sugeridos</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3 border border-amber-100">
                <p className="text-lg font-black text-amber-700">{importacion.posiblesDuplicados || 0}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Duplicados</p>
              </div>
            </div>

            {Number(importacion.posiblesDuplicados || 0) > 0 && (
              <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-100 p-3 flex gap-2">
                <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-amber-800">Este lote guardó gastos marcados como posibles duplicados.</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => marcarEstado(importacion, 'revisada')}
                disabled={procesandoId === importacion.id}
                className="p-3 rounded-2xl bg-emerald-50 text-emerald-700 font-black text-xs disabled:opacity-50"
              >
                Revisada
              </button>
              <button
                type="button"
                onClick={() => marcarEstado(importacion, 'parcial')}
                disabled={procesandoId === importacion.id}
                className="p-3 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-xs disabled:opacity-50"
              >
                Parcial
              </button>
              <button
                type="button"
                onClick={() => deshacerImportacion(importacion)}
                disabled={procesandoId === importacion.id}
                className="p-3 rounded-2xl bg-red-50 text-red-600 font-black flex items-center justify-center gap-1 text-xs disabled:opacity-50"
              >
                <RotateCcw size={15} /> {procesandoId === importacion.id ? '...' : 'Deshacer'}
              </button>
            </div>
          </article>
        ))}
      </div>

      {anuladas.length > 0 && (
        <section className="space-y-3">
          <h3 className="px-1 text-xs font-black uppercase tracking-wider text-zinc-400">Anuladas</h3>
          {anuladas.slice(0, 8).map(importacion => (
            <article key={importacion.id} className="rounded-3xl bg-white/70 border border-zinc-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-zinc-700 truncate">{importacion.archivoNombre || 'Importación'}</p>
                  <p className="text-xs font-bold text-zinc-400">
                    {importacion.gastosEliminados || 0} gastos eliminados · {formatDate(importacion.anuladaAt)}
                  </p>
                </div>
                <button type="button" onClick={() => eliminarRegistro(importacion)} className="p-3 rounded-full bg-zinc-100 text-zinc-500">
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
