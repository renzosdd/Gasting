import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, CalendarDays, CheckCircle2, CheckSquare, Edit3, FileText, Filter, MessageCircle, Mic, Plus, Save, Search, Sparkles, Square, Trash2, TrendingUp, X } from 'lucide-react';
import { db } from '../firebase';
import { dateInputToDate, dateToInputValue, getCategoriasFiltradas, getSubcategorias, normalizar, TIPOS_DESTINO } from '../utils/expenseUtils';

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const previousMonth = (monthValue) => {
  const [year, month] = monthValue.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

export default function Home({ user, onAddExpense, focusPendingSignal = 0 }) {
  const [gastos, setGastos] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [hogares, setHogares] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [productoPrecios, setProductoPrecios] = useState([]);
  const [productoAgregados, setProductoAgregados] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriasUsuario, setCategoriasUsuario] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ monto: '', moneda: 'UYU', fecha: '', comentario: '', tipoDestino: 'general', categoriaId: '', categoria: '', subcategoria: '', vehiculoId: '', hogarId: '', tarjetaId: '' });
  const [showNuevaCategoria, setShowNuevaCategoria] = useState(false);
  const [showNuevaSubcategoria, setShowNuevaSubcategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [nuevaSubcategoria, setNuevaSubcategoria] = useState('');
  const [showCharts, setShowCharts] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState({});
  const [chatPregunta, setChatPregunta] = useState('');
  const [chatRespuesta, setChatRespuesta] = useState('');
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
    const preciosQuery = query(collection(db, 'producto_precios'), where('userId', '==', user.uid));
    const agregadosQuery = query(collection(db, 'producto_precios_agregados'));
    const unsubPrecios = onSnapshot(preciosQuery, (snapshot) => {
      setProductoPrecios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAgregados = onSnapshot(agregadosQuery, (snapshot) => {
      setProductoAgregados(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubPrecios(); unsubAgregados(); };
  }, [user.uid]);

  useEffect(() => {
    const presupuestosQuery = query(collection(db, 'presupuestos'), where('miembros', 'array-contains', user.uid));
    const vehiculosQuery = query(collection(db, 'vehiculos'), where('propietarios', 'array-contains', user.uid));
    const hogaresQuery = query(collection(db, 'hogares'), where('propietarios', 'array-contains', user.uid));
    const hogaresCompartidosQuery = user.email
      ? query(collection(db, 'hogares'), where('miembrosEmails', 'array-contains', user.email.toLowerCase()))
      : null;
    const tarjetasQuery = query(collection(db, 'tarjetas'), where('propietarios', 'array-contains', user.uid));

    const unsubPresupuestos = onSnapshot(presupuestosQuery, (snapshot) => {
      setPresupuestos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
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

    return () => { unsubPresupuestos(); unsubVehiculos(); unsubHogares(); unsubHogaresCompartidos(); unsubTarjetas(); };
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

  const mesAnteriorFiltro = useMemo(() => previousMonth(filters.mes), [filters.mes]);

  const gastosMesAnterior = useMemo(() => (
    gastos.filter(gasto => expenseMonth(gasto) === mesAnteriorFiltro)
  ), [gastos, mesAnteriorFiltro]);

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

  const totalMesAnteriorUyu = useMemo(() => (
    gastosMesAnterior
      .filter(gasto => (gasto.moneda || 'UYU') === 'UYU')
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0)
  ), [gastosMesAnterior]);

  const variacionMes = totalMesAnteriorUyu > 0 ? ((totalUyu - totalMesAnteriorUyu) / totalMesAnteriorUyu) * 100 : 0;

  const totalMesUyu = useMemo(() => (
    gastosMes
      .filter(gasto => (gasto.moneda || 'UYU') === 'UYU')
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0)
  ), [gastosMes]);

  const resumenMes = useMemo(() => {
    const ahora = new Date();
    const dia = ahora.getDate();
    const diasMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
    const diasRestantes = Math.max(0, diasMes - dia);
    const presupuestoMensual = presupuestos
      .filter(presupuesto => (presupuesto.periodo || 'mensual') === 'mensual')
      .filter(presupuesto => (presupuesto.moneda || 'UYU') === 'UYU')
      .reduce((total, presupuesto) => total + Number(presupuesto.monto || 0), 0);
    const pctPresupuesto = presupuestoMensual > 0 ? (totalMesUyu / presupuestoMensual) * 100 : null;
    const promedioActual = totalMesUyu / Math.max(dia, 1);
    const promedioRecomendado = presupuestoMensual > 0 ? presupuestoMensual / diasMes : null;

    return {
      dia,
      diasMes,
      diasRestantes,
      presupuestoMensual,
      pctPresupuesto,
      promedioActual,
      promedioRecomendado,
    };
  }, [presupuestos, totalMesUyu]);

  const pendientesRevision = useMemo(() => (
    gastosMes.filter(gasto => gasto.estadoRevision === 'pendiente_revision').length
  ), [gastosMes]);

  const porCategoria = useMemo(() => {
    const grupos = new Map();
    gastosPeriodo.filter(gasto => (gasto.moneda || 'UYU') === 'UYU').forEach((gasto) => {
      const key = gasto.categoriaGrupo || gasto.categoria || 'Sin categoría';
      const actual = grupos.get(key) || { categoria: key, total: 0, subcategorias: new Map() };
      const monto = Number(gasto.monto || 0);
      const subcategoria = gasto.subcategoria || gasto.categoria || 'Sin subcategoría';
      actual.total += monto;
      actual.subcategorias.set(subcategoria, (actual.subcategorias.get(subcategoria) || 0) + monto);
      grupos.set(key, actual);
    });
    return [...grupos.values()]
      .map(item => ({
        ...item,
        subcategorias: [...item.subcategorias.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [gastosPeriodo]);

  const categoriaMesAnterior = useMemo(() => {
    const grupos = new Map();
    gastosMesAnterior.filter(gasto => (gasto.moneda || 'UYU') === 'UYU').forEach((gasto) => {
      const key = gasto.categoriaGrupo || gasto.categoria || 'Sin categoría';
      grupos.set(key, (grupos.get(key) || 0) + Number(gasto.monto || 0));
    });
    return grupos;
  }, [gastosMesAnterior]);

  const cambiosCategoria = useMemo(() => (
    porCategoria
      .map(item => {
        const anterior = categoriaMesAnterior.get(item.categoria) || 0;
        const diff = item.total - anterior;
        return { ...item, anterior, diff, pct: anterior > 0 ? (diff / anterior) * 100 : null };
      })
      .filter(item => Math.abs(item.diff) > 0)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 3)
  ), [categoriaMesAnterior, porCategoria]);

  const gastosRaros = useMemo(() => {
    const confirmadosUyu = gastosPeriodo.filter(gasto => (gasto.moneda || 'UYU') === 'UYU');
    const promedio = confirmadosUyu.reduce((total, gasto) => total + Number(gasto.monto || 0), 0) / Math.max(confirmadosUyu.length, 1);
    return confirmadosUyu
      .filter(gasto => Number(gasto.monto || 0) >= Math.max(promedio * 2.2, 2500))
      .sort((a, b) => Number(b.monto || 0) - Number(a.monto || 0))
      .slice(0, 5);
  }, [gastosPeriodo]);

  const timeline = useMemo(() => {
    const grupos = new Map();
    gastosPeriodo.filter(gasto => (gasto.moneda || 'UYU') === 'UYU').forEach((gasto) => {
      const date = gasto.fecha?.toDate?.();
      if (!date) return;
      const key = date.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' });
      grupos.set(key, (grupos.get(key) || 0) + Number(gasto.monto || 0));
    });
    return [...grupos.entries()].slice(-10);
  }, [gastosPeriodo]);

  const chartData = porCategoria.map(item => ({ categoria: item.categoria, total: item.total }));

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

  const productoInsights = useMemo(() => {
    const comercioKey = (valor = '') => valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const agregadosGlobales = new Map(productoAgregados.filter(item => (item.scope || 'global') === 'global').map(item => [item.key, item]));
    const agregadosPorComercio = new Map(productoAgregados.filter(item => item.scope === 'comercio').map(item => [`${item.key}|${item.comercioKey}`, item]));
    return productoPrecios
      .filter(item => item.productoKey && Number(item.precioUnitario || 0) > 0)
      .map(item => {
        const keyComercio = comercioKey(item.comercio || '');
        const agregadoComercio = keyComercio ? agregadosPorComercio.get(`${item.productoKey}|${keyComercio}`) : null;
        const agregado = agregadoComercio || agregadosGlobales.get(item.productoKey);
        if (!agregado || Number(agregado.muestras || 0) < Number(agregado.minMuestras || 5)) return null;
        const promedio = Number(agregado.promedio || 0);
        const precio = Number(item.precioUnitario || 0);
        if (!promedio) return null;
        const diff = ((precio - promedio) / promedio) * 100;
        if (Math.abs(diff) < 12) return null;
        return {
          id: item.id,
          nombre: item.nombre,
          diff,
          precio,
          promedio,
          muestras: agregado.muestras,
          moneda: item.moneda || 'UYU',
          comercio: agregadoComercio ? item.comercio : '',
          scope: agregadoComercio ? 'comercio' : 'global',
        };
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 3);
  }, [productoAgregados, productoPrecios]);

  const tarjetaConsumosMes = useMemo(() => {
    const grupos = new Map();
    gastosMes.forEach((gasto) => {
      if (!gasto.tarjetaId || (gasto.moneda || 'UYU') !== 'UYU') return;
      grupos.set(gasto.tarjetaId, (grupos.get(gasto.tarjetaId) || 0) + Number(gasto.monto || 0));
    });
    return grupos;
  }, [gastosMes]);

  const alertas = useMemo(() => {
    const resultado = [];
    const pendientes = gastosMes.filter(gasto => gasto.estadoRevision === 'pendiente_revision').length;
    if (pendientes > 0) {
      resultado.push({
        tipo: 'revision',
        titulo: `${pendientes} gasto${pendientes > 1 ? 's' : ''} pendiente${pendientes > 1 ? 's' : ''} de revisar`,
        texto: 'Confirmalos para que tus reportes queden finos.',
      });
    }

    presupuestos.forEach((presupuesto) => {
      const base = presupuesto.periodo === 'semanal'
        ? gastos.filter(gasto => expenseWeek(gasto) === semanaActual)
        : gastosMes;
      const gastado = base
        .filter(gasto => (gasto.moneda || 'UYU') === (presupuesto.moneda || 'UYU'))
        .filter(gasto => !presupuesto.categoriaGrupo || gasto.categoriaGrupo === presupuesto.categoriaGrupo)
        .filter(gasto => !presupuesto.subcategoria || gasto.subcategoria === presupuesto.subcategoria)
        .filter(gasto => !presupuesto.hogarId || gasto.hogarId === presupuesto.hogarId)
        .reduce((total, gasto) => total + Number(gasto.monto || 0), 0);
      const limite = Number(presupuesto.monto || 0);
      if (limite > 0 && gastado >= limite * 0.8) {
        resultado.push({
          tipo: gastado > limite ? 'exceso' : 'presupuesto',
          titulo: `${presupuesto.nombre || presupuesto.categoriaGrupo || 'Presupuesto'} va en ${Math.round((gastado / limite) * 100)}%`,
          texto: `${presupuesto.moneda === 'USD' ? 'US$' : '$'}${gastado.toLocaleString('es-UY', { maximumFractionDigits: 0 })} de ${presupuesto.moneda === 'USD' ? 'US$' : '$'}${limite.toLocaleString('es-UY', { maximumFractionDigits: 0 })}.`,
        });
      }
    });

    const hoy = new Date().getDate();
    hogares.flatMap(hogar => hogar.servicios || []).forEach((servicio) => {
      const dia = Number(servicio.diaPago || 0);
      if (dia >= hoy && dia - hoy <= 5) {
        resultado.push({ tipo: 'vencimiento', titulo: `${servicio.nombre} vence pronto`, texto: `Pago estimado día ${dia}.` });
      }
    });
    tarjetas.forEach((tarjeta) => {
      const dia = Number(tarjeta.diaVencimiento || 0);
      if (dia >= hoy && dia - hoy <= 5) {
        resultado.push({ tipo: 'vencimiento', titulo: `${tarjeta.nombre || tarjeta.marca} vence pronto`, texto: `Vencimiento día ${dia}.` });
      }
      const cierre = Number(tarjeta.diaCierre || 0);
      const consumos = tarjetaConsumosMes.get(tarjeta.id) || 0;
      if (cierre >= hoy && cierre - hoy <= 5 && consumos > 0) {
        resultado.push({
          tipo: 'tarjeta',
          titulo: `${tarjeta.nombre || tarjeta.marca} cierra pronto`,
          texto: `Consumos cargados este mes: $${consumos.toLocaleString('es-UY', { maximumFractionDigits: 0 })}.`,
        });
      }
    });

    productoInsights.forEach((insight) => {
      resultado.push({
        tipo: 'precio',
        titulo: `${insight.nombre} está ${Math.abs(Math.round(insight.diff))}% ${insight.diff > 0 ? 'más caro' : 'más barato'} ${insight.scope === 'comercio' ? `en ${insight.comercio}` : 'que el promedio'}`,
        texto: `${insight.moneda === 'USD' ? 'US$' : '$'}${insight.precio.toFixed(0)} vs promedio ${insight.moneda === 'USD' ? 'US$' : '$'}${insight.promedio.toFixed(0)} (${insight.muestras} muestras).`,
      });
    });

    return resultado.slice(0, 6);
  }, [gastos, gastosMes, hogares, presupuestos, productoInsights, semanaActual, tarjetaConsumosMes, tarjetas]);

  const presupuestosActivos = useMemo(() => {
    const ahora = new Date();
    const dia = ahora.getDate();
    const diasMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
    const avanceMes = dia / diasMes;

    return presupuestos.map((presupuesto) => {
      const base = presupuesto.periodo === 'semanal'
        ? gastos.filter(gasto => expenseWeek(gasto) === semanaActual)
        : gastosMes;
      const gastado = base
        .filter(gasto => (gasto.moneda || 'UYU') === (presupuesto.moneda || 'UYU'))
        .filter(gasto => !presupuesto.categoriaGrupo || gasto.categoriaGrupo === presupuesto.categoriaGrupo)
        .filter(gasto => !presupuesto.subcategoria || gasto.subcategoria === presupuesto.subcategoria)
        .filter(gasto => !presupuesto.hogarId || gasto.hogarId === presupuesto.hogarId)
        .reduce((total, gasto) => total + Number(gasto.monto || 0), 0);
      const limite = Number(presupuesto.monto || 0);
      const pct = limite > 0 ? (gastado / limite) * 100 : 0;
      const ritmoEsperado = presupuesto.periodo === 'mensual' && avanceMes > 0 ? (pct / (avanceMes * 100)) : 1;
      const proyeccion = presupuesto.periodo === 'mensual' && avanceMes > 0 ? gastado / avanceMes : gastado;
      return { ...presupuesto, gastado, limite, pct, ritmoEsperado, proyeccion };
    }).filter(item => item.limite > 0);
  }, [gastos, gastosMes, presupuestos, semanaActual]);

  const cierreMes = useMemo(() => {
    const sinCategoria = gastosMes.filter(gasto => !gasto.categoriaGrupo || gasto.categoriaGrupo === 'Sin categoría').length;
    const pendientes = gastosMes.filter(gasto => gasto.estadoRevision === 'pendiente_revision').length;
    const duplicados = gastosMes.filter(gasto => gasto.posibleDuplicado).length;
    const presupuestosPasados = presupuestosActivos.filter(item => item.pct >= 100).length;
    return [
      { label: 'Gastos pendientes de revisar', count: pendientes, ok: pendientes === 0 },
      { label: 'Gastos sin categoría clara', count: sinCategoria, ok: sinCategoria === 0 },
      { label: 'Posibles duplicados', count: duplicados, ok: duplicados === 0 },
      { label: 'Presupuestos excedidos', count: presupuestosPasados, ok: presupuestosPasados === 0 },
    ];
  }, [gastosMes, presupuestosActivos]);

  const selectedGastos = useMemo(() => (
    gastosPeriodo.filter(gasto => selectedIds[gasto.id])
  ), [gastosPeriodo, selectedIds]);

  const responderChat = (pregunta) => {
    const texto = normalizar(pregunta);
    const base = texto.includes('semana') ? gastosPeriodo : gastosMes;
    const gastosUyu = base.filter(gasto => (gasto.moneda || 'UYU') === 'UYU');
    const total = gastosUyu.reduce((sum, gasto) => sum + Number(gasto.monto || 0), 0);
    const topCategoria = () => {
      const grupos = new Map();
      gastosUyu.forEach((gasto) => {
        const key = gasto.categoriaGrupo || gasto.categoria || 'Sin categoría';
        grupos.set(key, (grupos.get(key) || 0) + Number(gasto.monto || 0));
      });
      return [...grupos.entries()].sort((a, b) => b[1] - a[1])[0];
    };

    if (gastosUyu.length === 0) return 'Todavía no tengo gastos en pesos para responder esa pregunta.';

    if (texto.includes('mas') || texto.includes('categoria') || texto.includes('donde')) {
      const top = topCategoria();
      if (!top) return 'No encontré una categoría clara todavía.';
      const pct = total > 0 ? (top[1] / total) * 100 : 0;
      return `Lo más fuerte viene por ${top[0]}: $${top[1].toLocaleString('es-UY', { maximumFractionDigits: 0 })}, aprox. ${pct.toFixed(0)}% del total analizado.`;
    }

    if (texto.includes('presupuesto') || texto.includes('ritmo')) {
      if (!resumenMes.presupuestoMensual) return 'Todavía no tenés presupuesto mensual en pesos. Cuando lo cargues puedo comparar ritmo real contra recomendado.';
      const diferencia = resumenMes.promedioActual - resumenMes.promedioRecomendado;
      return `Vas gastando $${resumenMes.promedioActual.toLocaleString('es-UY', { maximumFractionDigits: 0 })} por día. Recomendado: $${resumenMes.promedioRecomendado.toLocaleString('es-UY', { maximumFractionDigits: 0 })}. ${diferencia > 0 ? `Estás $${diferencia.toLocaleString('es-UY', { maximumFractionDigits: 0 })} por día arriba.` : `Estás $${Math.abs(diferencia).toLocaleString('es-UY', { maximumFractionDigits: 0 })} por día abajo.`}`;
    }

    if (texto.includes('pendiente') || texto.includes('revisar')) {
      const pendientes = gastos.filter(gasto => gasto.estadoRevision === 'pendiente_revision').length;
      return pendientes > 0 ? `Tenés ${pendientes} gasto${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'} de revisar. Te conviene cerrar eso antes de mirar reportes finos.` : 'No tenés pendientes de revisar. Bien, los reportes deberían estar bastante limpios.';
    }

    if (texto.includes('tarjeta')) {
      const totalTarjeta = gastosMes
        .filter(gasto => gasto.tipoDestino === 'tarjeta' || gasto.tarjetaId)
        .filter(gasto => (gasto.moneda || 'UYU') === 'UYU')
        .reduce((sum, gasto) => sum + Number(gasto.monto || 0), 0);
      return totalTarjeta > 0 ? `En tarjetas tenés $${totalTarjeta.toLocaleString('es-UY', { maximumFractionDigits: 0 })} cargados este mes.` : 'No veo gastos de tarjeta cargados este mes.';
    }

    return `Este mes llevás $${totalMesUyu.toLocaleString('es-UY', { maximumFractionDigits: 0 })} en pesos. ${resumenMes.pctPresupuesto !== null ? `Eso es ${resumenMes.pctPresupuesto.toFixed(0)}% de tus presupuestos mensuales.` : 'Si cargás presupuestos, te puedo decir si vas bien de ritmo.'}`;
  };

  const preguntarChat = (pregunta) => {
    const texto = pregunta.trim();
    if (!texto) return;
    setChatPregunta(texto);
    setChatRespuesta(responderChat(texto));
  };

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
    setForm({ monto: '', moneda: 'UYU', fecha: '', comentario: '', tipoDestino: 'general', categoriaId: '', categoria: '', subcategoria: '', vehiculoId: '', hogarId: '', tarjetaId: '' });
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

      <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Quedan</p>
            <p className="mt-1 text-2xl font-black text-zinc-900">{resumenMes.diasRestantes}</p>
            <p className="text-xs font-bold text-zinc-500">días del mes</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Gastado</p>
            <p className="mt-1 text-2xl font-black text-emerald-700">
              {resumenMes.pctPresupuesto === null ? '-' : `${resumenMes.pctPresupuesto.toFixed(0)}%`}
            </p>
            <p className="text-xs font-bold text-emerald-700/70">del presupuesto</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-zinc-900 text-white p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Promedio actual</p>
            <p className="mt-1 text-lg font-black">${resumenMes.promedioActual.toLocaleString('es-UY', { maximumFractionDigits: 0 })}</p>
            <p className="text-xs font-bold text-zinc-400">por día</p>
          </div>
          <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Recomendado</p>
            <p className="mt-1 text-lg font-black text-zinc-900">
              {resumenMes.promedioRecomendado === null ? '-' : `$${resumenMes.promedioRecomendado.toLocaleString('es-UY', { maximumFractionDigits: 0 })}`}
            </p>
            <p className="text-xs font-bold text-zinc-500">según presupuesto</p>
          </div>
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
              onClick={() => setFilters((actual) => ({ ...actual, estadoRevision: actual.estadoRevision === 'pendiente_revision' ? 'todos' : 'pendiente_revision' }))}
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

      {(totalMesAnteriorUyu > 0 || cambiosCategoria.length > 0 || gastosRaros.length > 0) && (
        <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-600" />
            <h2 className="font-black text-zinc-900">Qué cambió</h2>
          </div>
          {totalMesAnteriorUyu > 0 && (
            <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Contra el mes anterior</p>
              <p className={`mt-1 text-lg font-black ${variacionMes > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {variacionMes > 0 ? '+' : ''}{variacionMes.toFixed(0)}%
              </p>
              <p className="text-xs font-medium text-zinc-500">
                Antes: ${totalMesAnteriorUyu.toLocaleString('es-UY', { maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
          {cambiosCategoria.length > 0 && (
            <div className="space-y-2">
              {cambiosCategoria.map(item => (
                <div key={item.categoria} className="rounded-2xl bg-zinc-50 border border-zinc-100 p-3">
                  <p className="font-black text-sm text-zinc-900">{item.categoria}</p>
                  <p className={`text-xs font-bold ${item.diff > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {item.diff > 0 ? 'Subió' : 'Bajó'} ${Math.abs(item.diff).toLocaleString('es-UY', { maximumFractionDigits: 0 })}
                    {item.pct !== null ? ` (${item.pct > 0 ? '+' : ''}${item.pct.toFixed(0)}%)` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
          {gastosRaros.length > 0 && (
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
              <p className="text-xs font-black uppercase tracking-wider text-amber-700">Gastos raros del mes</p>
              <div className="mt-2 space-y-1">
                {gastosRaros.slice(0, 3).map(gasto => (
                  <p key={gasto.id} className="text-xs font-bold text-amber-900">
                    {gasto.subcategoria || gasto.categoria || 'Gasto'} · {formatMoney(gasto)}
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {presupuestosActivos.length > 0 && (
        <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm">
          <h2 className="font-black text-zinc-900">Presupuestos</h2>
          <div className="mt-4 space-y-3">
            {presupuestosActivos.slice(0, 4).map(presupuesto => (
              <div key={presupuesto.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-zinc-700 truncate">{presupuesto.nombre}</span>
                  <span className={`font-black ${presupuesto.pct >= 100 ? 'text-red-500' : presupuesto.ritmoEsperado > 1.15 ? 'text-amber-600' : 'text-zinc-900'}`}>
                    {presupuesto.pct.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div className={`h-full rounded-full ${presupuesto.pct >= 100 ? 'bg-red-500' : presupuesto.ritmoEsperado > 1.15 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, presupuesto.pct)}%` }} />
                </div>
                {presupuesto.ritmoEsperado > 1.15 && presupuesto.periodo === 'mensual' && (
                  <p className="mt-1 text-xs font-bold text-amber-600">Vas más rápido que el avance del mes.</p>
                )}
                {presupuesto.periodo === 'mensual' && presupuesto.proyeccion > presupuesto.limite && (
                  <p className="mt-1 text-xs font-bold text-red-500">
                    Si sigue igual: {presupuesto.moneda === 'USD' ? 'US$' : '$'}{presupuesto.proyeccion.toLocaleString('es-UY', { maximumFractionDigits: 0 })}.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {timeline.length > 0 && (
        <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={18} className="text-zinc-700" />
            <h2 className="font-black text-zinc-900">Ritmo diario</h2>
          </div>
          <div className="space-y-2">
            {timeline.map(([dia, total]) => (
              <div key={dia} className="grid grid-cols-[52px_1fr_auto] items-center gap-2 text-xs">
                <span className="font-bold text-zinc-400">{dia}</span>
                <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div className="h-full rounded-full bg-zinc-900" style={{ width: `${Math.min(100, (total / Math.max(totalUyu, 1)) * 100)}%` }} />
                </div>
                <span className="font-black text-zinc-800">${total.toLocaleString('es-UY', { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm">
        <h2 className="font-black text-zinc-900">Cierre de mes</h2>
        <div className="mt-3 space-y-2">
          {cierreMes.map(item => (
            <div key={item.label} className="flex items-center justify-between rounded-2xl bg-zinc-50 border border-zinc-100 p-3">
              <span className="text-sm font-bold text-zinc-700">{item.label}</span>
              <span className={`text-xs font-black px-2 py-1 rounded-full ${item.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {item.ok ? 'OK' : item.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      {porCategoria.length > 0 && (
        <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-zinc-900">Dónde se está yendo</h2>
            <button type="button" onClick={() => setShowCharts(!showCharts)} className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <BarChart3 size={18} />
            </button>
          </div>
          {showCharts && (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="categoria" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => `$${Number(value).toLocaleString('es-UY')}`} />
                  <Bar dataKey="total" fill="#10b981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-4 space-y-3">
            {porCategoria.map((item) => (
              <div key={item.categoria}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-zinc-700">{item.categoria}</span>
                  <span className="font-black text-zinc-900">${item.total.toLocaleString('es-UY', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(100, (item.total / Math.max(totalUyu, 1)) * 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.subcategorias.map(([nombre, total]) => (
                    <span key={nombre} className="px-2 py-1 rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-500">
                      {nombre}: ${total.toLocaleString('es-UY', { maximumFractionDigits: 0 })}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {alertas.length > 0 && (
        <section className="rounded-[2rem] bg-amber-50 border border-amber-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-600" />
            <h2 className="font-black text-amber-950">Alertas útiles</h2>
          </div>
          <div className="space-y-2">
            {alertas.map((alerta, index) => (
              <div key={`${alerta.titulo}-${index}`} className="rounded-2xl bg-white/70 border border-amber-100 p-3">
                <p className="font-black text-sm text-zinc-900">{alerta.titulo}</p>
                <p className="text-xs font-medium text-zinc-500">{alerta.texto}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {productoInsights.length > 0 && (
        <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={18} className="text-indigo-600" />
            <h2 className="font-black text-zinc-900">Supermercado</h2>
          </div>
          <div className="space-y-2">
            {productoInsights.map((insight) => (
              <div key={insight.id} className="rounded-2xl bg-zinc-50 border border-zinc-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-sm text-zinc-900 truncate">{insight.nombre}</p>
                    <p className="text-xs font-bold text-zinc-500">
                      {insight.scope === 'comercio' ? `Comparado en ${insight.comercio}` : `${insight.muestras} muestras anónimas`}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[11px] font-black ${insight.diff > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                    {insight.diff > 0 ? '+' : ''}{insight.diff.toFixed(0)}%
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold text-zinc-500">
                  Tu precio: {insight.moneda === 'USD' ? 'US$' : '$'}{insight.precio.toFixed(0)} · Promedio: {insight.moneda === 'USD' ? 'US$' : '$'}{insight.promedio.toFixed(0)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle size={18} className="text-emerald-600" />
          <h2 className="font-black text-zinc-900">Chat financiero</h2>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {['¿En qué gasté más este mes?', '¿Voy bien con el presupuesto?', '¿Qué tengo pendiente de revisar?'].map(pregunta => (
            <button
              key={pregunta}
              type="button"
              onClick={() => preguntarChat(pregunta)}
              className="px-3 py-2 rounded-full bg-zinc-100 text-zinc-600 text-xs font-black"
            >
              {pregunta}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={chatPregunta}
            onChange={(e) => setChatPregunta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') preguntarChat(chatPregunta);
            }}
            placeholder="Preguntá sobre tus gastos..."
            className="min-w-0 flex-1 p-3 rounded-2xl bg-zinc-50 border border-zinc-100 outline-none text-sm font-medium"
          />
          <button
            type="button"
            onClick={() => preguntarChat(chatPregunta)}
            className="px-4 rounded-2xl bg-zinc-900 text-white font-black text-sm"
          >
            OK
          </button>
        </div>
        {chatRespuesta && (
          <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-sm font-bold leading-6 text-emerald-950">{chatRespuesta}</p>
          </div>
        )}
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
            <p className="mt-3 font-black text-zinc-800">Todavía no cargaste gastos este mes.</p>
            <p className="mt-1 text-sm text-zinc-400">Empezá con el próximo gasto y la lista se arma sola.</p>
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
