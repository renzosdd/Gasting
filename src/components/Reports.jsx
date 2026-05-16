import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, CalendarDays, CheckCircle2, MessageCircle, Sparkles, TrendingUp } from 'lucide-react';
import { db } from '../firebase';
import { normalizar } from '../utils/expenseUtils';

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

const formatMoney = (monto, moneda = 'UYU') => (
  `${moneda === 'USD' ? 'US$' : '$'}${Number(monto || 0).toLocaleString('es-UY', { maximumFractionDigits: 0 })}`
);

export default function Reports({ user }) {
  const [gastos, setGastos] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [hogares, setHogares] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [productoPrecios, setProductoPrecios] = useState([]);
  const [productoAgregados, setProductoAgregados] = useState([]);
  const [showCharts, setShowCharts] = useState(false);
  const [chatPregunta, setChatPregunta] = useState('');
  const [chatRespuesta, setChatRespuesta] = useState('');
  const [filters, setFilters] = useState({
    periodo: 'mes',
    mes: currentMonth(),
    moneda: 'UYU',
  });

  const semanaActual = currentWeek();
  const mesActual = currentMonth();

  useEffect(() => {
    const q = query(collection(db, 'gastos'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGastos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const presupuestosQuery = query(collection(db, 'presupuestos'), where('miembros', 'array-contains', user.uid));
    const hogaresQuery = query(collection(db, 'hogares'), where('propietarios', 'array-contains', user.uid));
    const hogaresCompartidosQuery = user.email
      ? query(collection(db, 'hogares'), where('miembrosEmails', 'array-contains', user.email.toLowerCase()))
      : null;
    const tarjetasQuery = query(collection(db, 'tarjetas'), where('propietarios', 'array-contains', user.uid));
    const preciosQuery = query(collection(db, 'producto_precios'), where('userId', '==', user.uid));

    const unsubPresupuestos = onSnapshot(presupuestosQuery, (snapshot) => {
      setPresupuestos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
    const unsubPrecios = onSnapshot(preciosQuery, (snapshot) => {
      setProductoPrecios(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAgregados = onSnapshot(collection(db, 'producto_precios_agregados'), (snapshot) => {
      setProductoAgregados(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubPresupuestos();
      unsubHogares();
      unsubHogaresCompartidos();
      unsubTarjetas();
      unsubPrecios();
      unsubAgregados();
    };
  }, [user.email, user.uid]);

  const gastosPeriodo = useMemo(() => (
    gastos
      .filter(gasto => filters.periodo === 'semana' ? expenseWeek(gasto) === semanaActual : expenseMonth(gasto) === filters.mes)
      .filter(gasto => (gasto.moneda || 'UYU') === filters.moneda)
      .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0))
  ), [filters, gastos, semanaActual]);

  const gastosMes = useMemo(() => (
    gastos.filter(gasto => expenseMonth(gasto) === mesActual)
  ), [gastos, mesActual]);

  const gastosMesAnterior = useMemo(() => (
    gastos.filter(gasto => expenseMonth(gasto) === previousMonth(filters.mes))
  ), [gastos, filters.mes]);

  const totalPeriodo = useMemo(() => (
    gastosPeriodo.reduce((total, gasto) => total + Number(gasto.monto || 0), 0)
  ), [gastosPeriodo]);

  const totalMesActualUyu = useMemo(() => (
    gastosMes
      .filter(gasto => (gasto.moneda || 'UYU') === 'UYU')
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0)
  ), [gastosMes]);

  const totalMesAnterior = useMemo(() => (
    gastosMesAnterior
      .filter(gasto => (gasto.moneda || 'UYU') === filters.moneda)
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0)
  ), [filters.moneda, gastosMesAnterior]);

  const resumenMes = useMemo(() => {
    const ahora = new Date();
    const dia = ahora.getDate();
    const diasMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
    const presupuestoMensual = presupuestos
      .filter(presupuesto => (presupuesto.periodo || 'mensual') === 'mensual')
      .filter(presupuesto => (presupuesto.moneda || 'UYU') === 'UYU')
      .reduce((total, presupuesto) => total + Number(presupuesto.monto || 0), 0);
    return {
      diasRestantes: Math.max(0, diasMes - dia),
      pctPresupuesto: presupuestoMensual > 0 ? (totalMesActualUyu / presupuestoMensual) * 100 : null,
      promedioActual: totalMesActualUyu / Math.max(dia, 1),
      promedioRecomendado: presupuestoMensual > 0 ? presupuestoMensual / diasMes : null,
      presupuestoMensual,
    };
  }, [presupuestos, totalMesActualUyu]);

  const porCategoria = useMemo(() => {
    const grupos = new Map();
    gastosPeriodo.forEach((gasto) => {
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
        subcategorias: [...item.subcategorias.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [gastosPeriodo]);

  const categoriaMesAnterior = useMemo(() => {
    const grupos = new Map();
    gastosMesAnterior.filter(gasto => (gasto.moneda || 'UYU') === filters.moneda).forEach((gasto) => {
      const key = gasto.categoriaGrupo || gasto.categoria || 'Sin categoría';
      grupos.set(key, (grupos.get(key) || 0) + Number(gasto.monto || 0));
    });
    return grupos;
  }, [filters.moneda, gastosMesAnterior]);

  const cambiosCategoria = useMemo(() => (
    porCategoria
      .map((item) => {
        const anterior = categoriaMesAnterior.get(item.categoria) || 0;
        const diff = item.total - anterior;
        return { ...item, anterior, diff, pct: anterior > 0 ? (diff / anterior) * 100 : null };
      })
      .filter(item => Math.abs(item.diff) > 0)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 4)
  ), [categoriaMesAnterior, porCategoria]);

  const gastosRaros = useMemo(() => {
    const promedio = totalPeriodo / Math.max(gastosPeriodo.length, 1);
    return gastosPeriodo
      .filter(gasto => Number(gasto.monto || 0) >= Math.max(promedio * 2.2, filters.moneda === 'USD' ? 80 : 2500))
      .sort((a, b) => Number(b.monto || 0) - Number(a.monto || 0))
      .slice(0, 5);
  }, [filters.moneda, gastosPeriodo, totalPeriodo]);

  const timeline = useMemo(() => {
    const grupos = new Map();
    gastosPeriodo.forEach((gasto) => {
      const date = gasto.fecha?.toDate?.();
      if (!date) return;
      const key = date.toLocaleDateString('es-UY', { day: '2-digit', month: 'short' });
      grupos.set(key, (grupos.get(key) || 0) + Number(gasto.monto || 0));
    });
    return [...grupos.entries()].slice(-10);
  }, [gastosPeriodo]);

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

  const productoInsights = useMemo(() => {
    const comercioKey = (valor = '') => normalizar(valor).replace(/[^a-z0-9]+/g, ' ').trim();
    const agregadosGlobales = new Map(productoAgregados.filter(item => (item.scope || 'global') === 'global').map(item => [item.key, item]));
    const agregadosPorComercio = new Map(productoAgregados.filter(item => item.scope === 'comercio').map(item => [`${item.key}|${item.comercioKey}`, item]));

    return productoPrecios
      .filter(item => item.productoKey && Number(item.precioUnitario || 0) > 0)
      .map((item) => {
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
      .slice(0, 5);
  }, [productoAgregados, productoPrecios]);

  const alertas = useMemo(() => {
    const resultado = [];
    const pendientes = gastosMes.filter(gasto => gasto.estadoRevision === 'pendiente_revision').length;
    if (pendientes > 0) {
      resultado.push({
        titulo: `${pendientes} gasto${pendientes > 1 ? 's' : ''} pendiente${pendientes > 1 ? 's' : ''} de revisar`,
        texto: 'Confirmalos para que los reportes queden finos.',
      });
    }

    presupuestosActivos.filter(item => item.pct >= 80).slice(0, 3).forEach((presupuesto) => {
      resultado.push({
        titulo: `${presupuesto.nombre || presupuesto.categoriaGrupo || 'Presupuesto'} va en ${presupuesto.pct.toFixed(0)}%`,
        texto: `${formatMoney(presupuesto.gastado, presupuesto.moneda)} de ${formatMoney(presupuesto.limite, presupuesto.moneda)}.`,
      });
    });

    const hoy = new Date().getDate();
    hogares.flatMap(hogar => hogar.servicios || []).forEach((servicio) => {
      const dia = Number(servicio.diaPago || 0);
      if (dia >= hoy && dia - hoy <= 5) resultado.push({ titulo: `${servicio.nombre} vence pronto`, texto: `Pago estimado día ${dia}.` });
    });
    tarjetas.forEach((tarjeta) => {
      const dia = Number(tarjeta.diaVencimiento || 0);
      if (dia >= hoy && dia - hoy <= 5) resultado.push({ titulo: `${tarjeta.nombre || tarjeta.marca} vence pronto`, texto: `Vencimiento día ${dia}.` });
    });

    productoInsights.slice(0, 2).forEach((insight) => {
      resultado.push({
        titulo: `${insight.nombre} está ${Math.abs(Math.round(insight.diff))}% ${insight.diff > 0 ? 'más caro' : 'más barato'}`,
        texto: `${formatMoney(insight.precio, insight.moneda)} vs promedio ${formatMoney(insight.promedio, insight.moneda)}.`,
      });
    });

    return resultado.slice(0, 7);
  }, [gastosMes, hogares, presupuestosActivos, productoInsights, tarjetas]);

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

  const chartData = porCategoria.map(item => ({ categoria: item.categoria, total: item.total }));
  const variacionMes = totalMesAnterior > 0 ? ((totalPeriodo - totalMesAnterior) / totalMesAnterior) * 100 : 0;

  const responderChat = (pregunta) => {
    const texto = normalizar(pregunta);
    const gastosMoneda = gastosPeriodo.filter(gasto => (gasto.moneda || 'UYU') === filters.moneda);

    if (gastosMoneda.length === 0) return 'Todavía no tengo gastos para responder con este filtro.';

    if (texto.includes('mas') || texto.includes('categoria') || texto.includes('donde')) {
      const top = porCategoria[0];
      if (!top) return 'No encontré una categoría clara todavía.';
      const pct = totalPeriodo > 0 ? (top.total / totalPeriodo) * 100 : 0;
      return `Lo más fuerte viene por ${top.categoria}: ${formatMoney(top.total, filters.moneda)}, aprox. ${pct.toFixed(0)}% del total filtrado.`;
    }

    if (texto.includes('presupuesto') || texto.includes('ritmo')) {
      if (!resumenMes.presupuestoMensual) return 'Todavía no tenés presupuesto mensual en pesos. Cuando lo cargues puedo comparar ritmo real contra recomendado.';
      const diferencia = resumenMes.promedioActual - resumenMes.promedioRecomendado;
      return `Vas gastando ${formatMoney(resumenMes.promedioActual)} por día. Recomendado: ${formatMoney(resumenMes.promedioRecomendado)}. ${diferencia > 0 ? `Estás ${formatMoney(diferencia)} por día arriba.` : `Estás ${formatMoney(Math.abs(diferencia))} por día abajo.`}`;
    }

    if (texto.includes('pendiente') || texto.includes('revisar')) {
      const pendientes = gastos.filter(gasto => gasto.estadoRevision === 'pendiente_revision').length;
      return pendientes > 0 ? `Tenés ${pendientes} gasto${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'} de revisar.` : 'No tenés pendientes de revisar.';
    }

    if (texto.includes('raro') || texto.includes('grande')) {
      return gastosRaros.length > 0
        ? `El gasto que más destaca es ${gastosRaros[0].subcategoria || gastosRaros[0].categoria || 'Gasto'} por ${formatMoney(gastosRaros[0].monto, gastosRaros[0].moneda)}.`
        : 'No veo gastos particularmente raros con este filtro.';
    }

    return `Con este filtro llevás ${formatMoney(totalPeriodo, filters.moneda)} en ${gastosMoneda.length} gasto${gastosMoneda.length === 1 ? '' : 's'}.`;
  };

  const preguntarChat = (pregunta) => {
    const texto = pregunta.trim();
    if (!texto) return;
    setChatPregunta(texto);
    setChatRespuesta(responderChat(texto));
  };

  return (
    <div className="pt-4 animate-in fade-in duration-500 space-y-5">
      <section className="rounded-[2rem] bg-zinc-900 text-white p-5 shadow-xl shadow-zinc-900/10">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Reportes</p>
        <h2 className="mt-1 text-3xl font-black">Entender el mes</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-300">Preguntas, gráficos e insights para decidir mejor sin ensuciar la carga diaria.</p>
      </section>

      <section className="rounded-[2rem] bg-white border border-zinc-100 p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          <select value={filters.periodo} onChange={(e) => setFilters((actual) => ({ ...actual, periodo: e.target.value }))} className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-bold outline-none">
            <option value="mes">Mes</option>
            <option value="semana">Semana</option>
          </select>
          <input
            type="month"
            value={filters.mes}
            onChange={(e) => setFilters((actual) => ({ ...actual, mes: e.target.value, periodo: 'mes' }))}
            className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-bold outline-none"
          />
          <select value={filters.moneda} onChange={(e) => setFilters((actual) => ({ ...actual, moneda: e.target.value }))} className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-bold outline-none">
            <option value="UYU">UYU</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-zinc-900 text-white p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Total filtrado</p>
            <p className="mt-1 text-2xl font-black">{formatMoney(totalPeriodo, filters.moneda)}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Contra anterior</p>
            <p className={`mt-1 text-2xl font-black ${variacionMes > 0 ? 'text-red-500' : 'text-emerald-700'}`}>
              {totalMesAnterior > 0 ? `${variacionMes > 0 ? '+' : ''}${variacionMes.toFixed(0)}%` : '-'}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Quedan</p>
            <p className="mt-1 text-xl font-black text-zinc-900">{resumenMes.diasRestantes} días</p>
          </div>
          <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Presupuesto</p>
            <p className="mt-1 text-xl font-black text-zinc-900">{resumenMes.pctPresupuesto === null ? '-' : `${resumenMes.pctPresupuesto.toFixed(0)}%`}</p>
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-zinc-50 border border-zinc-100 p-4">
          <p className="text-xs font-bold text-zinc-500">
            Promedio diario: <span className="text-zinc-900 font-black">{formatMoney(resumenMes.promedioActual)}</span>
            {resumenMes.promedioRecomendado !== null && <> · recomendado <span className="text-zinc-900 font-black">{formatMoney(resumenMes.promedioRecomendado)}</span></>}
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle size={18} className="text-emerald-600" />
          <h2 className="font-black text-zinc-900">Preguntale a tus datos</h2>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {['¿En qué gasté más este mes?', '¿Voy bien con el presupuesto?', '¿Qué gasto raro aparece?'].map(pregunta => (
            <button key={pregunta} type="button" onClick={() => preguntarChat(pregunta)} className="px-3 py-2 rounded-full bg-zinc-100 text-zinc-600 text-xs font-black">
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
          <button type="button" onClick={() => preguntarChat(chatPregunta)} className="px-4 rounded-2xl bg-zinc-900 text-white font-black text-sm">OK</button>
        </div>
        {chatRespuesta && (
          <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-sm font-bold leading-6 text-emerald-950">{chatRespuesta}</p>
          </div>
        )}
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
                  <Tooltip formatter={(value) => formatMoney(value, filters.moneda)} />
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
                  <span className="font-black text-zinc-900">{formatMoney(item.total, filters.moneda)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (item.total / Math.max(totalPeriodo, 1)) * 100)}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.subcategorias.map(([nombre, total]) => (
                    <span key={nombre} className="px-2 py-1 rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-500">
                      {nombre}: {formatMoney(total, filters.moneda)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(cambiosCategoria.length > 0 || gastosRaros.length > 0) && (
        <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-600" />
            <h2 className="font-black text-zinc-900">Insights</h2>
          </div>
          {cambiosCategoria.map(item => (
            <div key={item.categoria} className="rounded-2xl bg-zinc-50 border border-zinc-100 p-3">
              <p className="font-black text-sm text-zinc-900">{item.categoria}</p>
              <p className={`text-xs font-bold ${item.diff > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {item.diff > 0 ? 'Subió' : 'Bajó'} {formatMoney(Math.abs(item.diff), filters.moneda)}
                {item.pct !== null ? ` (${item.pct > 0 ? '+' : ''}${item.pct.toFixed(0)}%)` : ''}
              </p>
            </div>
          ))}
          {gastosRaros.length > 0 && (
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
              <p className="text-xs font-black uppercase tracking-wider text-amber-700">Gastos raros</p>
              <div className="mt-2 space-y-1">
                {gastosRaros.slice(0, 3).map(gasto => (
                  <p key={gasto.id} className="text-xs font-bold text-amber-900">
                    {gasto.subcategoria || gasto.categoria || 'Gasto'} · {formatMoney(gasto.monto, gasto.moneda)}
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
            {presupuestosActivos.slice(0, 6).map(presupuesto => (
              <div key={presupuesto.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-zinc-700 truncate">{presupuesto.nombre}</span>
                  <span className={`font-black ${presupuesto.pct >= 100 ? 'text-red-500' : presupuesto.ritmoEsperado > 1.15 ? 'text-amber-600' : 'text-zinc-900'}`}>{presupuesto.pct.toFixed(0)}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div className={`h-full rounded-full ${presupuesto.pct >= 100 ? 'bg-red-500' : presupuesto.ritmoEsperado > 1.15 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, presupuesto.pct)}%` }} />
                </div>
                {presupuesto.periodo === 'mensual' && presupuesto.proyeccion > presupuesto.limite && (
                  <p className="mt-1 text-xs font-bold text-red-500">Si sigue igual: {formatMoney(presupuesto.proyeccion, presupuesto.moneda)}.</p>
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
                  <div className="h-full rounded-full bg-zinc-900" style={{ width: `${Math.min(100, (total / Math.max(totalPeriodo, 1)) * 100)}%` }} />
                </div>
                <span className="font-black text-zinc-800">{formatMoney(total, filters.moneda)}</span>
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
                  Tu precio: {formatMoney(insight.precio, insight.moneda)} · promedio {formatMoney(insight.promedio, insight.moneda)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {gastosPeriodo.length === 0 && (
        <div className="rounded-[2rem] bg-white border border-zinc-100 p-8 text-center shadow-sm">
          <CheckCircle2 size={28} className="mx-auto text-zinc-300" />
          <p className="mt-3 font-black text-zinc-800">No hay datos para este filtro.</p>
        </div>
      )}
    </div>
  );
}
