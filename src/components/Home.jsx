import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { CheckCircle2, CheckSquare, Edit3, FileText, Filter, Mic, Plus, Save, Search, Sparkles, Square, Trash2, X } from 'lucide-react';
import { db } from '../firebase';
import { dateInputToDate, dateToInputValue, getCategoriasFiltradas, getSubcategorias, normalizar, TIPOS_DESTINO } from '../utils/expenseUtils';

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const currentWeek = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - first) / 86400000);
  return `${now.getFullYear()}-W${String(Math.ceil((days + first.getDay() + 1) / 7)).padStart(2, '0')}`;
};

const currentDay = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const expenseMonth = (gasto) => {
  const date = gasto.fecha?.toDate?.() || (gasto.fecha instanceof Date ? gasto.fecha : null);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const expenseWeek = (gasto) => {
  const date = gasto.fecha?.toDate?.() || (gasto.fecha instanceof Date ? gasto.fecha : null);
  if (!date) return '';
  const first = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - first) / 86400000);
  return `${date.getFullYear()}-W${String(Math.ceil((days + first.getDay() + 1) / 7)).padStart(2, '0')}`;
};

const expenseDay = (gasto) => {
  const date = gasto.fecha?.toDate?.() || (gasto.fecha instanceof Date ? gasto.fecha : null);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatDate = (fecha) => {
  const date = fecha?.toDate?.() || (fecha instanceof Date ? fecha : null);
  if (date) {
    return date.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' });
  }
  return 'Sin fecha';
};

const formatMoney = (gasto) => {
  const prefix = gasto.moneda === 'USD' ? 'US$' : '$';
  return `${prefix}${Number(gasto.monto || 0).toLocaleString('es-UY', { maximumFractionDigits: 2 })}`;
};

const emptyForm = {
  monto: '',
  moneda: 'UYU',
  fecha: '',
  comentario: '',
  tipoDestino: 'general',
  categoriaId: '',
  categoria: '',
  subcategoria: '',
  vehiculoId: '',
  hogarId: '',
  tarjetaId: '',
};

export default function Home({ user, onAddExpense, focusPendingSignal = 0 }) {
  const [gastos, setGastos] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [hogares, setHogares] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriasUsuario, setCategoriasUsuario] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [showNuevaCategoria, setShowNuevaCategoria] = useState(false);
  const [showNuevaSubcategoria, setShowNuevaSubcategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [nuevaSubcategoria, setNuevaSubcategoria] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState({});
  const [filters, setFilters] = useState({
    periodo: 'mes',
    mes: currentMonth(),
    moneda: 'todas',
    tipoDestino: 'todos',
    estadoRevision: 'todos',
    montoMin: '',
    texto: '',
  });

  const mesActual = currentMonth();
  const semanaActual = currentWeek();
  const diaActual = currentDay();

  useEffect(() => {
    if (!focusPendingSignal) return;
    setFilters((actual) => ({
      ...actual,
      periodo: 'todos',
      estadoRevision: 'pendiente_revision',
      montoMin: '',
      texto: '',
    }));
  }, [focusPendingSignal]);

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
      setCategoriasUsuario(snapshot.docs.map(doc => ({ id: `sugerida-${doc.id}`, sugerenciaId: doc.id, ...doc.data(), esSugerida: true })));
    });
    return () => { unsubCat(); unsubUserCat(); };
  }, [user.uid]);

  useEffect(() => {
    const vehiculosQuery = query(collection(db, 'vehiculos'), where('propietarios', 'array-contains', user.uid));
    const hogaresQuery = query(collection(db, 'hogares'), where('propietarios', 'array-contains', user.uid));
    const hogaresCompartidosQuery = user.email
      ? query(collection(db, 'hogares'), where('miembrosEmails', 'array-contains', user.email.toLowerCase()))
      : null;
    const tarjetasQuery = query(collection(db, 'tarjetas'), where('propietarios', 'array-contains', user.uid));

    const unsubVehiculos = onSnapshot(vehiculosQuery, (snapshot) => {
      setVehiculos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubHogares = onSnapshot(hogaresQuery, (snapshot) => {
      setHogares(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubHogaresCompartidos = hogaresCompartidosQuery ? onSnapshot(hogaresCompartidosQuery, (snapshot) => {
      setHogares((actual) => {
        const items = [...actual, ...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
        return [...new Map(items.map(item => [item.id, item])).values()];
      });
    }) : () => {};
    const unsubTarjetas = onSnapshot(tarjetasQuery, (snapshot) => {
      setTarjetas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubVehiculos(); unsubHogares(); unsubHogaresCompartidos(); unsubTarjetas(); };
  }, [user.email, user.uid]);

  const gastosPeriodo = useMemo(() => (
    gastos
      .filter((gasto) => {
        if (filters.periodo === 'todos') return true;
        if (filters.periodo === 'hoy') return expenseDay(gasto) === diaActual;
        if (filters.periodo === 'semana') return expenseWeek(gasto) === semanaActual;
        return expenseMonth(gasto) === filters.mes;
      })
      .filter(gasto => filters.moneda === 'todas' || (gasto.moneda || 'UYU') === filters.moneda)
      .filter(gasto => filters.tipoDestino === 'todos' || (gasto.tipoDestino || 'general') === filters.tipoDestino)
      .filter(gasto => filters.estadoRevision === 'todos' || (gasto.estadoRevision || 'confirmado') === filters.estadoRevision)
      .filter(gasto => !filters.montoMin || Number(gasto.monto || 0) >= Number(filters.montoMin))
      .filter(gasto => {
        const texto = filters.texto.trim().toLowerCase();
        if (!texto) return true;
        return `${gasto.categoriaGrupo || ''} ${gasto.subcategoria || ''} ${gasto.categoria || ''} ${gasto.detalles?.descripcion || ''} ${gasto.detalles?.comentario || ''}`.toLowerCase().includes(texto);
      })
      .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0))
  ), [diaActual, filters, gastos, semanaActual]);

  const gastosMes = useMemo(() => (
    gastos.filter(gasto => expenseMonth(gasto) === mesActual)
  ), [gastos, mesActual]);

  const totalUyu = useMemo(() => (
    gastosPeriodo
      .filter(gasto => (gasto.moneda || 'UYU') === 'UYU')
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0)
  ), [gastosPeriodo]);

  const totalUsd = useMemo(() => (
    gastosPeriodo
      .filter(gasto => gasto.moneda === 'USD')
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0)
  ), [gastosPeriodo]);

  const pendientesRevision = useMemo(() => (
    gastosMes.filter(gasto => gasto.estadoRevision === 'pendiente_revision').length
  ), [gastosMes]);

  const categoriasDisponibles = useMemo(() => {
    const globales = categorias.filter(categoria => !categoria.mergedInto);
    const globalKeys = new Set(globales.map(categoria => `${categoria.tipoDestino || 'general'}:${normalizar(categoria.nombre)}`));
    const propias = categoriasUsuario.filter(categoria => (
      categoria.estado !== 'rechazada'
      && !categoria.mergedInto
      && !globalKeys.has(`${categoria.tipoDestino || 'general'}:${normalizar(categoria.nombre)}`)
    ));
    return [...globales, ...propias];
  }, [categorias, categoriasUsuario]);

  const categoriasFiltradas = useMemo(() => (
    getCategoriasFiltradas(categoriasDisponibles, form.tipoDestino)
  ), [categoriasDisponibles, form.tipoDestino]);

  const categoriaSeleccionada = categoriasDisponibles.find(categoria => categoria.id === form.categoriaId)
    || categoriasDisponibles.find(categoria => categoria.nombre === form.categoria);
  const subcategorias = getSubcategorias(categoriaSeleccionada);

  const selectedGastos = useMemo(() => (
    gastosPeriodo.filter(gasto => selectedIds[gasto.id])
  ), [gastosPeriodo, selectedIds]);

  const confirmarGasto = async (gastoId) => {
    await updateDoc(doc(db, 'gastos', gastoId), { estadoRevision: 'confirmado' });
  };

  const toggleSelected = (gastoId) => {
    setSelectedIds((actual) => ({ ...actual, [gastoId]: !actual[gastoId] }));
  };

  const confirmarSeleccionados = async () => {
    await Promise.all(selectedGastos.map(gasto => updateDoc(doc(db, 'gastos', gasto.id), { estadoRevision: 'confirmado' })));
    setSelectedIds({});
    setSelectionMode(false);
  };

  const eliminarSeleccionados = async () => {
    if (!window.confirm(`¿Eliminar ${selectedGastos.length} gastos seleccionados?`)) return;
    await Promise.all(selectedGastos.map(gasto => deleteDoc(doc(db, 'gastos', gasto.id))));
    setSelectedIds({});
    setSelectionMode(false);
  };

  const empezarEdicion = (gasto) => {
    setEditando(gasto.id);
    setForm({
      monto: gasto.monto || '',
      moneda: gasto.moneda || 'UYU',
      fecha: dateToInputValue(gasto.fecha),
      comentario: gasto.detalles?.comentario || '',
      tipoDestino: gasto.tipoDestino || 'general',
      categoriaId: gasto.categoriaId || '',
      categoria: gasto.categoriaGrupo || '',
      subcategoria: gasto.subcategoria || gasto.categoria || '',
      vehiculoId: gasto.vehiculoId || '',
      hogarId: gasto.hogarId || '',
      tarjetaId: gasto.tarjetaId || '',
    });
  };

  const cancelarEdicion = () => {
    setEditando(null);
    setForm(emptyForm);
    setShowNuevaCategoria(false);
    setShowNuevaSubcategoria(false);
    setNuevaCategoria('');
    setNuevaSubcategoria('');
  };

  const crearCategoriaDesdeEdicion = async () => {
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;

    const existente = categoriasDisponibles.find(categoria => (
      (categoria.tipoDestino || 'general') === form.tipoDestino
      && normalizar(categoria.nombre) === normalizar(nombre)
    ));

    if (existente) {
      setForm({ ...form, categoriaId: existente.id, categoria: existente.nombre, subcategoria: '' });
      setNuevaCategoria('');
      setShowNuevaCategoria(false);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'categoria_sugerencias'), {
        userId: user.uid,
        nombre,
        tipoDestino: form.tipoDestino,
        subcategorias: [],
        estado: 'pendiente',
        fecha: serverTimestamp(),
      });

      setForm({ ...form, categoriaId: `sugerida-${docRef.id}`, categoria: nombre, subcategoria: '' });
      setNuevaCategoria('');
      setShowNuevaCategoria(false);
    } catch (error) {
      alert('Error al crear categoría: ' + error.message);
    }
  };

  const crearSubcategoriaDesdeEdicion = async () => {
    const nombre = nuevaSubcategoria.trim();
    if (!nombre || !form.categoriaId) return;

    const existe = subcategorias.some(subcategoria => normalizar(subcategoria) === normalizar(nombre));
    if (existe) {
      setForm({ ...form, subcategoria: subcategorias.find(subcategoria => normalizar(subcategoria) === normalizar(nombre)) || nombre });
      setNuevaSubcategoria('');
      setShowNuevaSubcategoria(false);
      return;
    }

    try {
      await addDoc(collection(db, 'subcategoria_sugerencias'), {
        userId: user.uid,
        categoriaId: categoriaSeleccionada?.sugerenciaId || categoriaSeleccionada?.id || form.categoriaId,
        categoriaNombre: categoriaSeleccionada?.nombre || form.categoria,
        tipoDestino: form.tipoDestino,
        nombre,
        estado: 'pendiente',
        fecha: serverTimestamp(),
      });

      setForm({ ...form, subcategoria: nombre });
      setNuevaSubcategoria('');
      setShowNuevaSubcategoria(false);
    } catch (error) {
      alert('Error al crear subcategoría: ' + error.message);
    }
  };

  const guardarEdicion = async (gasto) => {
    const categoria = categoriasDisponibles.find(item => item.id === form.categoriaId)
      || categoriasDisponibles.find(item => item.nombre === form.categoria);
    const categoriaNombre = categoria?.nombre || form.categoria;
    const vehiculo = vehiculos.find(item => item.id === form.vehiculoId);
    const hogar = hogares.find(item => item.id === form.hogarId);
    const tarjeta = tarjetas.find(item => item.id === form.tarjetaId);

    await updateDoc(doc(db, 'gastos', gasto.id), {
      monto: Number(form.monto),
      moneda: form.moneda,
      fecha: Timestamp.fromDate(dateInputToDate(form.fecha)),
      tipoDestino: form.tipoDestino,
      categoriaId: categoria?.id || form.categoriaId || null,
      categoriaGrupo: categoriaNombre,
      categoria: form.subcategoria || categoriaNombre,
      subcategoria: form.subcategoria,
      vehiculoId: form.tipoDestino === 'vehiculo' && form.vehiculoId ? form.vehiculoId : null,
      vehiculoNombre: form.tipoDestino === 'vehiculo' && vehiculo ? vehiculo.nombre || `${vehiculo.marca || ''} ${vehiculo.modelo || ''}`.trim() : null,
      hogarId: form.tipoDestino === 'hogar' && form.hogarId ? form.hogarId : null,
      hogarNombre: form.tipoDestino === 'hogar' && hogar ? hogar.nombre : null,
      tarjetaId: form.tipoDestino === 'tarjeta' && form.tarjetaId ? form.tarjetaId : null,
      tarjetaNombre: form.tipoDestino === 'tarjeta' && tarjeta ? tarjeta.nombre || `${tarjeta.banco || ''} ${tarjeta.marca || ''}`.trim() : null,
      detalles: {
        ...(gasto.detalles || {}),
        comentario: form.comentario.trim(),
      },
      estadoRevision: 'confirmado',
    });
    cancelarEdicion();
  };

  const eliminarGasto = async (gasto) => {
    if (window.confirm('¿Eliminar este gasto?')) {
      await deleteDoc(doc(db, 'gastos', gasto.id));
    }
  };

  const repetirGasto = async (gasto) => {
    const { id, createdAt, importBatchId, importSourceType, duplicateKey, posibleDuplicado, ...data } = gasto;
    await addDoc(collection(db, 'gastos'), {
      ...data,
      userId: user.uid,
      fecha: Timestamp.fromDate(new Date()),
      createdAt: serverTimestamp(),
      origen: 'repetido',
      estadoRevision: 'confirmado',
    });
  };

  const periodoLabel = filters.periodo === 'hoy'
    ? 'hoy'
    : filters.periodo === 'semana'
      ? 'esta semana'
      : filters.periodo === 'todos'
        ? filters.estadoRevision === 'pendiente_revision' ? 'pendiente de revisar' : 'total'
        : 'este mes';

  return (
    <div className="pt-4 animate-in fade-in duration-500 space-y-5">
      <section className="rounded-[2rem] bg-zinc-900 text-white p-5 shadow-xl shadow-zinc-900/10">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Gastado {periodoLabel}</p>
          <p className="mt-2 text-4xl font-black tracking-tight">
            ${totalUyu.toLocaleString('es-UY', { maximumFractionDigits: 0 })}
          </p>
          {totalUsd > 0 && (
            <p className="mt-1 text-sm font-bold text-emerald-300">
              + US${totalUsd.toLocaleString('es-UY', { maximumFractionDigits: 0 })}
            </p>
          )}
          <p className="mt-3 text-sm font-bold text-zinc-300">Agregar nuevo gasto</p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-white/10 p-1">
          {[
            { id: 'hoy', label: 'Hoy' },
            { id: 'semana', label: 'Semana' },
            { id: 'mes', label: 'Mes' },
          ].map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilters((actual) => ({ ...actual, periodo: item.id, estadoRevision: 'todos', montoMin: '' }))}
              className={`py-2 rounded-xl text-xs font-black transition-all ${filters.periodo === item.id ? 'bg-white text-zinc-900' : 'text-zinc-300'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button type="button" onClick={() => onAddExpense('manual')} className="h-16 rounded-2xl bg-white text-zinc-900 flex flex-col items-center justify-center gap-1 font-black active:scale-95 transition-all">
            <Plus size={19} />
            <span className="text-[11px]">Manual</span>
          </button>
          <button type="button" onClick={() => onAddExpense('voice')} className="h-16 rounded-2xl bg-emerald-500 text-white flex flex-col items-center justify-center gap-1 font-black active:scale-95 transition-all">
            <Mic size={19} />
            <span className="text-[11px]">Voz</span>
          </button>
          <button type="button" onClick={() => onAddExpense('document')} className="h-16 rounded-2xl bg-indigo-500 text-white flex flex-col items-center justify-center gap-1 font-black active:scale-95 transition-all">
            <Sparkles size={19} />
            <span className="text-[11px]">IA</span>
          </button>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white border border-zinc-100 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={filters.texto}
              onChange={(e) => setFilters((actual) => ({ ...actual, texto: e.target.value }))}
              placeholder="Buscar gasto..."
              className="w-full pl-9 pr-3 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 outline-none font-medium text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center"
          >
            <Filter size={18} />
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select value={filters.periodo} onChange={(e) => setFilters((actual) => ({ ...actual, periodo: e.target.value }))} className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-bold outline-none">
              <option value="hoy">Hoy</option>
              <option value="mes">Este mes</option>
              <option value="semana">Esta semana</option>
              <option value="todos">Todos</option>
            </select>
            <input
              type="month"
              value={filters.mes}
              onChange={(e) => setFilters((actual) => ({ ...actual, mes: e.target.value, periodo: 'mes' }))}
              className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-bold outline-none"
            />
            <select value={filters.moneda} onChange={(e) => setFilters((actual) => ({ ...actual, moneda: e.target.value }))} className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-bold outline-none">
              <option value="todas">Todas las monedas</option>
              <option value="UYU">Pesos</option>
              <option value="USD">Dólares</option>
            </select>
            <select value={filters.tipoDestino} onChange={(e) => setFilters((actual) => ({ ...actual, tipoDestino: e.target.value }))} className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-bold outline-none">
              <option value="todos">Todos los tipos</option>
              <option value="general">General</option>
              <option value="vehiculo">Vehículo</option>
              <option value="hogar">Casa</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
            <select value={filters.estadoRevision} onChange={(e) => setFilters((actual) => ({ ...actual, estadoRevision: e.target.value }))} className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-bold outline-none">
              <option value="todos">Todos los estados</option>
              <option value="confirmado">Confirmados</option>
              <option value="pendiente_revision">Pendientes</option>
            </select>
            <input
              type="number"
              value={filters.montoMin}
              onChange={(e) => setFilters((actual) => ({ ...actual, montoMin: e.target.value }))}
              placeholder="Mínimo"
              className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-bold outline-none"
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {pendientesRevision > 0 && (
            <button
              type="button"
              onClick={() => setFilters((actual) => ({ ...actual, periodo: 'todos', estadoRevision: actual.estadoRevision === 'pendiente_revision' ? 'todos' : 'pendiente_revision' }))}
              className={`px-3 py-2 rounded-full text-xs font-black transition-all ${filters.estadoRevision === 'pendiente_revision' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'}`}
            >
              {pendientesRevision} pendiente{pendientesRevision > 1 ? 's' : ''} de revisar
            </button>
          )}
          <button
            type="button"
            onClick={() => setFilters((actual) => ({ ...actual, montoMin: actual.montoMin ? '' : '2500' }))}
            className={`px-3 py-2 rounded-full text-xs font-black ${filters.montoMin ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'}`}
          >
            Gastos grandes
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectionMode((actual) => !actual);
              setSelectedIds({});
            }}
            className={`px-3 py-2 rounded-full text-xs font-black ${selectionMode ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-500'}`}
          >
            Seleccionar
          </button>
          {(filters.estadoRevision === 'pendiente_revision' || filters.montoMin) && (
            <button
              type="button"
              onClick={() => setFilters((actual) => ({ ...actual, estadoRevision: 'todos', montoMin: '' }))}
              className="px-3 py-2 rounded-full bg-zinc-100 text-zinc-500 text-xs font-black"
            >
              Ver todos
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-black text-zinc-900">Últimos gastos</h2>
            <p className="text-sm font-medium text-zinc-500">{gastosPeriodo.length} registros</p>
          </div>
        </div>

        {selectionMode && (
          <div className="sticky top-2 z-10 rounded-[2rem] bg-zinc-900 text-white p-3 shadow-xl flex items-center gap-2">
            <p className="flex-1 text-sm font-black">{selectedGastos.length} seleccionado{selectedGastos.length === 1 ? '' : 's'}</p>
            <button type="button" onClick={confirmarSeleccionados} disabled={selectedGastos.length === 0} className="px-3 py-2 rounded-xl bg-emerald-500 text-xs font-black disabled:opacity-40">
              Confirmar
            </button>
            <button type="button" onClick={eliminarSeleccionados} disabled={selectedGastos.length === 0} className="px-3 py-2 rounded-xl bg-red-500 text-xs font-black disabled:opacity-40">
              Eliminar
            </button>
          </div>
        )}

        {gastosPeriodo.length === 0 && (
          <div className="rounded-[2rem] bg-white border border-zinc-100 p-8 text-center">
            <FileText size={28} className="mx-auto text-zinc-300" />
            <p className="mt-3 font-black text-zinc-800">No hay gastos para este filtro.</p>
            <p className="mt-1 text-sm text-zinc-400">Cargá uno nuevo o cambiá los filtros para ver más registros.</p>
          </div>
        )}

        {gastosPeriodo.slice(0, 40).map(gasto => (
          <article key={gasto.id} className="rounded-3xl bg-white border border-zinc-100 p-4 shadow-sm">
            {editando === gasto.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold" />
                  <select value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold">
                    <option value="UYU">Pesos</option>
                    <option value="USD">Dólares</option>
                  </select>
                </div>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={e => setForm({ ...form, fecha: e.target.value })}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold"
                />
                <select value={form.tipoDestino} onChange={e => setForm({ ...form, tipoDestino: e.target.value, categoriaId: '', categoria: '', subcategoria: '', vehiculoId: '', hogarId: '', tarjetaId: '' })} className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none font-bold">
                  {TIPOS_DESTINO.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.label}</option>)}
                </select>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={categoriaSeleccionada?.id || form.categoriaId}
                        onChange={e => {
                          const categoria = categoriasDisponibles.find(item => item.id === e.target.value);
                          setForm({ ...form, categoriaId: e.target.value, categoria: categoria?.nombre || '', subcategoria: '' });
                        }}
                        className="min-w-0 flex-1 p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
                      >
                        <option value="">Categoría</option>
                        {categoriasFiltradas.map(categoria => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
                      </select>
                      <button type="button" onClick={() => setShowNuevaCategoria(true)} className="w-12 rounded-xl bg-zinc-900 text-white flex items-center justify-center">
                        <Plus size={18} />
                      </button>
                    </div>
                    {showNuevaCategoria && (
                      <div className="flex gap-2">
                        <input
                          value={nuevaCategoria}
                          onChange={e => setNuevaCategoria(e.target.value)}
                          placeholder="Nueva categoría"
                          className="min-w-0 flex-1 p-3 bg-white border border-dashed border-zinc-300 rounded-xl outline-none"
                        />
                        <button type="button" onClick={crearCategoriaDesdeEdicion} className="px-3 rounded-xl bg-emerald-500 text-white font-black">OK</button>
                        <button type="button" onClick={() => setShowNuevaCategoria(false)} className="px-3 rounded-xl bg-zinc-100 text-zinc-500"><X size={16} /></button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={form.subcategoria}
                        onChange={e => setForm({ ...form, subcategoria: e.target.value })}
                        className="min-w-0 flex-1 p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none"
                      >
                        <option value="">Subcategoría</option>
                        {subcategorias.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
                        {form.subcategoria && !subcategorias.includes(form.subcategoria) && <option value={form.subcategoria}>{form.subcategoria}</option>}
                      </select>
                      <button type="button" onClick={() => setShowNuevaSubcategoria(true)} disabled={!form.categoriaId} className="w-12 rounded-xl bg-zinc-900 text-white flex items-center justify-center disabled:opacity-30">
                        <Plus size={18} />
                      </button>
                    </div>
                    {showNuevaSubcategoria && (
                      <div className="flex gap-2">
                        <input
                          value={nuevaSubcategoria}
                          onChange={e => setNuevaSubcategoria(e.target.value)}
                          placeholder="Nueva subcategoría"
                          className="min-w-0 flex-1 p-3 bg-white border border-dashed border-zinc-300 rounded-xl outline-none"
                        />
                        <button type="button" onClick={crearSubcategoriaDesdeEdicion} className="px-3 rounded-xl bg-emerald-500 text-white font-black">OK</button>
                        <button type="button" onClick={() => setShowNuevaSubcategoria(false)} className="px-3 rounded-xl bg-zinc-100 text-zinc-500"><X size={16} /></button>
                      </div>
                    )}
                  </div>
                </div>
                {form.tipoDestino === 'vehiculo' && (
                  <select value={form.vehiculoId} onChange={e => setForm({ ...form, vehiculoId: e.target.value })} className="w-full p-3 bg-emerald-50 border border-emerald-100 rounded-xl outline-none font-bold text-emerald-900">
                    <option value="">Sin vehículo asociado</option>
                    {vehiculos.map(vehiculo => <option key={vehiculo.id} value={vehiculo.id}>{vehiculo.nombre || `${vehiculo.marca || ''} ${vehiculo.modelo || ''}`.trim()}</option>)}
                  </select>
                )}
                {form.tipoDestino === 'hogar' && (
                  <select value={form.hogarId} onChange={e => setForm({ ...form, hogarId: e.target.value })} className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl outline-none font-bold text-blue-900">
                    <option value="">Sin casa asociada</option>
                    {hogares.map(hogar => <option key={hogar.id} value={hogar.id}>{hogar.nombre}</option>)}
                  </select>
                )}
                {form.tipoDestino === 'tarjeta' && (
                  <select value={form.tarjetaId} onChange={e => setForm({ ...form, tarjetaId: e.target.value })} className="w-full p-3 bg-indigo-50 border border-indigo-100 rounded-xl outline-none font-bold text-indigo-900">
                    <option value="">Sin tarjeta asociada</option>
                    {tarjetas.map(tarjeta => <option key={tarjeta.id} value={tarjeta.id}>{tarjeta.nombre || `${tarjeta.banco || ''} ${tarjeta.marca || ''}`.trim()}</option>)}
                  </select>
                )}
                <textarea
                  value={form.comentario}
                  onChange={e => setForm({ ...form, comentario: e.target.value })}
                  className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none resize-none"
                  rows={2}
                  placeholder="Comentario opcional"
                />
                <div className="flex gap-2">
                  <button onClick={() => guardarEdicion(gasto)} className="flex-1 p-3 rounded-2xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2"><Save size={18} /> Guardar</button>
                  <button onClick={cancelarEdicion} className="p-3 rounded-2xl bg-zinc-100 text-zinc-500"><X size={18} /></button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                {selectionMode && (
                  <button
                    type="button"
                    onClick={() => toggleSelected(gasto.id)}
                    className={`mt-1 shrink-0 ${selectedIds[gasto.id] ? 'text-emerald-500' : 'text-zinc-300'}`}
                  >
                    {selectedIds[gasto.id] ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-zinc-900 truncate">{gasto.subcategoria || gasto.categoria || 'Gasto'}</p>
                    {gasto.estadoRevision === 'pendiente_revision' && (
                      <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black shrink-0">Revisar</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-zinc-500 truncate">
                    {gasto.categoriaGrupo || 'Sin categoría'} · {gasto.tipoDestino || 'general'}
                  </p>
                  {(gasto.vehiculoNombre || gasto.hogarNombre || gasto.tarjetaNombre) && (
                    <p className="mt-1 text-xs font-black text-emerald-600 truncate">{gasto.vehiculoNombre || gasto.hogarNombre || gasto.tarjetaNombre}</p>
                  )}
                  {gasto.detalles?.comentario && (
                    <p className="mt-2 text-xs font-medium text-zinc-400 line-clamp-2">{gasto.detalles.comentario}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-zinc-900">{formatMoney(gasto)}</p>
                  <p className="text-xs font-bold text-zinc-400">{formatDate(gasto.fecha)}</p>
                  <div className="mt-2 flex justify-end gap-1">
                    {gasto.estadoRevision === 'pendiente_revision' && (
                      <button
                        type="button"
                        onClick={() => confirmarGasto(gasto.id)}
                        className="inline-flex items-center gap-1 text-xs font-black text-emerald-600"
                      >
                        <CheckCircle2 size={14} /> OK
                      </button>
                    )}
                    <button type="button" onClick={() => repetirGasto(gasto)} className="p-2 rounded-full bg-emerald-50 text-emerald-600"><Plus size={15} /></button>
                    <button type="button" onClick={() => empezarEdicion(gasto)} className="p-2 rounded-full bg-zinc-50 text-zinc-500"><Edit3 size={15} /></button>
                    <button type="button" onClick={() => eliminarGasto(gasto)} className="p-2 rounded-full bg-red-50 text-red-500"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
