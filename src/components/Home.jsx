import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, CheckCircle2, ChevronDown, FileText, Filter, Mic, Plus, Search, Sparkles } from 'lucide-react';
import { db } from '../firebase';

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

const expenseMonth = (gasto) => {
  const date = gasto.fecha?.toDate?.();
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const expenseWeek = (gasto) => {
  const date = gasto.fecha?.toDate?.();
  if (!date) return '';
  const first = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - first) / 86400000);
  return `${date.getFullYear()}-W${String(Math.ceil((days + first.getDay() + 1) / 7)).padStart(2, '0')}`;
};

const formatDate = (fecha) => {
  if (fecha?.toDate) {
    return fecha.toDate().toLocaleDateString('es-UY', { day: '2-digit', month: 'short' });
  }
  return 'Sin fecha';
};

const formatMoney = (gasto) => {
  const prefix = gasto.moneda === 'USD' ? 'US$' : '$';
  return `${prefix}${Number(gasto.monto || 0).toLocaleString('es-UY', { maximumFractionDigits: 2 })}`;
};

export default function Home({ user, onAddExpense }) {
  const [gastos, setGastos] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [hogares, setHogares] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [productoPrecios, setProductoPrecios] = useState([]);
  const [productoAgregados, setProductoAgregados] = useState([]);
  const [showCharts, setShowCharts] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    periodo: 'mes',
    mes: currentMonth(),
    moneda: 'todas',
    tipoDestino: 'todos',
    estadoRevision: 'todos',
    texto: '',
  });
  const mesActual = currentMonth();
  const semanaActual = currentWeek();

  useEffect(() => {
    const q = query(collection(db, 'gastos'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGastos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
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
    const hogaresQuery = query(collection(db, 'hogares'), where('propietarios', 'array-contains', user.uid));
    const hogaresCompartidosQuery = user.email
      ? query(collection(db, 'hogares'), where('miembrosEmails', 'array-contains', user.email.toLowerCase()))
      : null;
    const tarjetasQuery = query(collection(db, 'tarjetas'), where('propietarios', 'array-contains', user.uid));

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

    return () => { unsubPresupuestos(); unsubHogares(); unsubHogaresCompartidos(); unsubTarjetas(); };
  }, [user.email, user.uid]);

  const gastosPeriodo = useMemo(() => (
    gastos
      .filter(gasto => filters.periodo === 'semana' ? expenseWeek(gasto) === semanaActual : expenseMonth(gasto) === filters.mes)
      .filter(gasto => filters.moneda === 'todas' || (gasto.moneda || 'UYU') === filters.moneda)
      .filter(gasto => filters.tipoDestino === 'todos' || (gasto.tipoDestino || 'general') === filters.tipoDestino)
      .filter(gasto => filters.estadoRevision === 'todos' || (gasto.estadoRevision || 'confirmado') === filters.estadoRevision)
      .filter(gasto => {
        const texto = filters.texto.trim().toLowerCase();
        if (!texto) return true;
        return `${gasto.categoriaGrupo || ''} ${gasto.subcategoria || ''} ${gasto.categoria || ''} ${gasto.detalles?.descripcion || ''}`.toLowerCase().includes(texto);
      })
      .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0))
  ), [filters, gastos, semanaActual]);

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

  const porCategoria = useMemo(() => {
    const grupos = new Map();
    gastosPeriodo.filter(gasto => (gasto.moneda || 'UYU') === 'UYU').forEach((gasto) => {
      const key = gasto.categoriaGrupo || gasto.categoria || 'Sin categoría';
      grupos.set(key, (grupos.get(key) || 0) + Number(gasto.monto || 0));
    });
    return [...grupos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [gastosPeriodo]);

  const chartData = porCategoria.map(([categoria, total]) => ({ categoria, total }));

  const productoInsights = useMemo(() => {
    const agregadosPorKey = new Map(productoAgregados.map(item => [item.key, item]));
    return productoPrecios
      .filter(item => item.productoKey && Number(item.precioUnitario || 0) > 0)
      .map(item => {
        const agregado = agregadosPorKey.get(item.productoKey);
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
        };
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .slice(0, 3);
  }, [productoAgregados, productoPrecios]);

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
    });

    return resultado.slice(0, 4);
    productoInsights.forEach((insight) => {
      resultado.push({
        tipo: 'precio',
        titulo: `${insight.nombre} está ${Math.abs(Math.round(insight.diff))}% ${insight.diff > 0 ? 'más caro' : 'más barato'} que el promedio`,
        texto: `${insight.moneda === 'USD' ? 'US$' : '$'}${insight.precio.toFixed(0)} vs promedio ${insight.moneda === 'USD' ? 'US$' : '$'}${insight.promedio.toFixed(0)} (${insight.muestras} muestras).`,
      });
    });

    return resultado.slice(0, 6);
  }, [gastos, gastosMes, hogares, presupuestos, productoInsights, semanaActual, tarjetas]);

  const confirmarGasto = async (gastoId) => {
    await updateDoc(doc(db, 'gastos', gastoId), { estadoRevision: 'confirmado' });
  };

  return (
    <div className="pt-4 animate-in fade-in duration-500 space-y-5">
      <section className="rounded-[2rem] bg-zinc-900 text-white p-5 shadow-xl shadow-zinc-900/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Gastado {filters.periodo === 'semana' ? 'esta semana' : 'este mes'}</p>
            <p className="mt-2 text-4xl font-black tracking-tight">
              ${totalUyu.toLocaleString('es-UY', { maximumFractionDigits: 0 })}
            </p>
            {totalUsd > 0 && (
              <p className="mt-1 text-sm font-bold text-emerald-300">
                + US${totalUsd.toLocaleString('es-UY', { maximumFractionDigits: 0 })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowCharts((actual) => !actual)}
            className="w-12 h-12 rounded-2xl bg-white/10 text-emerald-300 flex items-center justify-center active:scale-95 transition-all"
          >
            <BarChart3 size={22} />
          </button>
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
              <option value="mes">Este mes</option>
              <option value="semana">Esta semana</option>
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
          </div>
        )}
      </section>

      {porCategoria.length > 0 && (
        <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-zinc-900">Dónde se está yendo</h2>
            <button type="button" onClick={() => setShowCharts(!showCharts)} className="inline-flex items-center gap-1 text-xs font-black text-emerald-600">
              {showCharts ? 'Ocultar gráfico' : 'Ver gráfico'} <ChevronDown size={14} />
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
            {porCategoria.map(([categoria, total]) => (
              <div key={categoria}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-zinc-700">{categoria}</span>
                  <span className="font-black text-zinc-900">${total.toLocaleString('es-UY', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(100, (total / Math.max(totalUyu, 1)) * 100)}%` }}
                  />
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

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-black text-zinc-900">Últimos gastos</h2>
            <p className="text-sm font-medium text-zinc-500">{gastosPeriodo.length} registros</p>
          </div>
        </div>

        {gastosPeriodo.length === 0 && (
          <div className="rounded-[2rem] bg-white border border-zinc-100 p-8 text-center">
            <FileText size={28} className="mx-auto text-zinc-300" />
            <p className="mt-3 font-black text-zinc-800">Todavía no cargaste gastos este mes.</p>
            <p className="mt-1 text-sm text-zinc-400">Empezá con el próximo gasto y la lista se arma sola.</p>
          </div>
        )}

        {gastosPeriodo.slice(0, 40).map(gasto => (
          <article key={gasto.id} className="rounded-3xl bg-white border border-zinc-100 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
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
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-zinc-900">{formatMoney(gasto)}</p>
                <p className="text-xs font-bold text-zinc-400">{formatDate(gasto.fecha)}</p>
                {gasto.estadoRevision === 'pendiente_revision' && (
                  <button
                    type="button"
                    onClick={() => confirmarGasto(gasto.id)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-black text-emerald-600"
                  >
                    <CheckCircle2 size={14} /> OK
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
