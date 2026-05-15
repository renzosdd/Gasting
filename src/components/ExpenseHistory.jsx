import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { Edit3, Save, Trash2, X } from 'lucide-react';
import { getCategoriasFiltradas, getSubcategorias, TIPOS_DESTINO } from '../utils/expenseUtils';

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatDate = (fecha) => {
  if (fecha?.toDate) return fecha.toDate().toLocaleDateString('es-UY');
  return 'Sin fecha';
};

const expenseMonth = (gasto) => {
  const date = gasto.fecha?.toDate?.();
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export default function ExpenseHistory({ user }) {
  const [gastos, setGastos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriasUsuario, setCategoriasUsuario] = useState([]);
  const [mes, setMes] = useState(currentMonth());
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ monto: '', moneda: 'UYU', tipoDestino: 'general', categoriaId: '', categoria: '', subcategoria: '' });

  useEffect(() => {
    const q = query(collection(db, 'gastos'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGastos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const unsubCat = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      setCategorias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const sugerenciasQuery = query(collection(db, 'categoria_sugerencias'), where('userId', '==', user.uid));
    const unsubUserCat = onSnapshot(sugerenciasQuery, (snapshot) => {
      setCategoriasUsuario(snapshot.docs.map(doc => ({ id: `sugerida-${doc.id}`, ...doc.data(), esSugerida: true })));
    });
    return () => { unsubCat(); unsubUserCat(); };
  }, [user.uid]);

  const categoriasDisponibles = useMemo(() => ([
    ...categorias,
    ...categoriasUsuario.filter(categoria => categoria.estado !== 'rechazada'),
  ]), [categorias, categoriasUsuario]);

  const categoriasFiltradas = useMemo(() => (
    getCategoriasFiltradas(categoriasDisponibles, form.tipoDestino)
  ), [categoriasDisponibles, form.tipoDestino]);

  const categoriaSeleccionada = categoriasDisponibles.find(categoria => categoria.id === form.categoriaId)
    || categoriasDisponibles.find(categoria => categoria.nombre === form.categoria);
  const subcategorias = getSubcategorias(categoriaSeleccionada);

  const gastosFiltrados = useMemo(() => (
    gastos
      .filter(gasto => !mes || expenseMonth(gasto) === mes)
      .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0))
  ), [gastos, mes]);

  const empezarEdicion = (gasto) => {
    setEditando(gasto.id);
    setForm({
      monto: gasto.monto || '',
      moneda: gasto.moneda || 'UYU',
      tipoDestino: gasto.tipoDestino || 'general',
      categoriaId: gasto.categoriaId || '',
      categoria: gasto.categoriaGrupo || '',
      subcategoria: gasto.subcategoria || gasto.categoria || '',
    });
  };

  const cancelar = () => {
    setEditando(null);
    setForm({ monto: '', moneda: 'UYU', tipoDestino: 'general', categoriaId: '', categoria: '', subcategoria: '' });
  };

  const guardar = async (gasto) => {
    const categoria = categoriasDisponibles.find(item => item.id === form.categoriaId)
      || categoriasDisponibles.find(item => item.nombre === form.categoria);
    const categoriaNombre = categoria?.nombre || form.categoria;

    await updateDoc(doc(db, 'gastos', gasto.id), {
      monto: Number(form.monto),
      moneda: form.moneda,
      tipoDestino: form.tipoDestino,
      categoriaId: categoria?.id || form.categoriaId || null,
      categoriaGrupo: categoriaNombre,
      categoria: form.subcategoria || categoriaNombre,
      subcategoria: form.subcategoria,
      estadoRevision: 'confirmado',
    });
    cancelar();
  };

  const eliminar = async (gasto) => {
    if (window.confirm('¿Eliminar este gasto?')) {
      await deleteDoc(doc(db, 'gastos', gasto.id));
    }
  };

  return (
    <div className="pt-4 animate-in fade-in duration-500 space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-zinc-800">Histórico</h2>
          <p className="text-sm font-medium text-zinc-500">{gastosFiltrados.length} registros</p>
        </div>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="p-3 rounded-2xl border border-zinc-200 bg-white font-bold text-zinc-700 outline-none"
        />
      </div>

      <div className="space-y-3">
        {gastosFiltrados.length === 0 && (
          <div className="bg-white p-8 rounded-3xl border border-zinc-100 text-center text-zinc-400 font-medium">
            No hay gastos en este mes.
          </div>
        )}

        {gastosFiltrados.map(gasto => (
          <div key={gasto.id} className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm">
            {editando === gasto.id ? (
              <div className="space-y-3">
                <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold" />
                <select value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold">
                  <option value="UYU">Pesos</option>
                  <option value="USD">Dólares</option>
                </select>
                <select value={form.tipoDestino} onChange={e => setForm({ ...form, tipoDestino: e.target.value, categoriaId: '', categoria: '', subcategoria: '' })} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold">
                  {TIPOS_DESTINO.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.label}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={categoriaSeleccionada?.id || form.categoriaId}
                    onChange={e => {
                      const categoria = categoriasDisponibles.find(item => item.id === e.target.value);
                      setForm({ ...form, categoriaId: e.target.value, categoria: categoria?.nombre || '', subcategoria: '' });
                    }}
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
                  >
                    <option value="">Categoría</option>
                    {categoriasFiltradas.map(categoria => <option key={categoria.id} value={categoria.id}>{categoria.nombre}{categoria.esSugerida ? ' (tuya)' : ''}</option>)}
                  </select>
                  <select
                    value={form.subcategoria}
                    onChange={e => setForm({ ...form, subcategoria: e.target.value })}
                    className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
                  >
                    <option value="">Subcategoría</option>
                    {subcategorias.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
                    {form.subcategoria && !subcategorias.includes(form.subcategoria) && <option value={form.subcategoria}>{form.subcategoria}</option>}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => guardar(gasto)} className="flex-1 p-3 rounded-2xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2"><Save size={18} /> Guardar</button>
                  <button onClick={cancelar} className="p-3 rounded-2xl bg-zinc-100 text-zinc-500"><X size={18} /></button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-lg text-zinc-900">{gasto.moneda === 'USD' ? 'US$' : '$'}{Number(gasto.monto || 0).toFixed(2)}</p>
                    <p className="text-xs font-bold text-zinc-400">{formatDate(gasto.fecha)}</p>
                  </div>
                  <p className="font-bold text-zinc-700 truncate">{gasto.subcategoria || gasto.categoria}</p>
                  <p className="text-sm text-zinc-500 truncate">{gasto.categoriaGrupo || 'Sin categoría'} · {gasto.tipoDestino || 'general'}</p>
                  {gasto.estadoRevision === 'pendiente_revision' && (
                    <p className="inline-flex mt-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">Pendiente de revisar</p>
                  )}
                  {(gasto.vehiculoNombre || gasto.hogarNombre || gasto.tarjetaNombre) && (
                    <p className="text-xs font-bold text-emerald-600 mt-1">{gasto.vehiculoNombre || gasto.hogarNombre || gasto.tarjetaNombre}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => empezarEdicion(gasto)} className="p-3 rounded-full bg-zinc-50 text-zinc-500"><Edit3 size={17} /></button>
                  <button onClick={() => eliminar(gasto)} className="p-3 rounded-full bg-red-50 text-red-500"><Trash2 size={17} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
