import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronDown, ChevronRight } from 'lucide-react';

const COLORS = ['#10b981', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const fechaDeGasto = (gasto) => gasto.fecha?.toDate?.() || null;

const mesDeGasto = (gasto) => {
  const fecha = fechaDeGasto(gasto);
  if (!fecha) return '';
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
};

const formatMoney = (valor, moneda) => `${moneda === 'USD' ? 'US$' : '$'}${Number(valor || 0).toFixed(2)}`;

const emptyTotals = () => ({ UYU: 0, USD: 0 });

const addAmount = (totals, gasto) => {
  const moneda = gasto.moneda || 'UYU';
  totals[moneda] = (totals[moneda] || 0) + Number(gasto.monto || 0);
};

export default function Dashboard({ user }) {
  const [mes, setMes] = useState(currentMonth());
  const [gastos, setGastos] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [showChart, setShowChart] = useState(false);
  const [groupMode, setGroupMode] = useState('categoria');

  useEffect(() => {
    const q = query(collection(db, 'gastos'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGastos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user.uid]);

  const gastosFiltrados = useMemo(() => (
    gastos.filter(gasto => !mes || mesDeGasto(gasto) === mes)
  ), [gastos, mes]);

  const totals = useMemo(() => {
    const result = emptyTotals();
    gastosFiltrados.forEach(gasto => addAmount(result, gasto));
    return result;
  }, [gastosFiltrados]);

  const grouped = useMemo(() => {
    const map = new Map();

    gastosFiltrados.forEach(gasto => {
      const categoria = groupMode === 'destino'
        ? gasto.tipoDestino || 'General'
        : gasto.categoriaGrupo || gasto.categoria || 'Sin categoría';
      const subcategoria = groupMode === 'subcategoria'
        ? gasto.subcategoria || gasto.categoria || 'Sin subcategoría'
        : gasto.subcategoria || gasto.categoria || 'Sin subcategoría';

      if (!map.has(categoria)) {
        map.set(categoria, { name: categoria, totals: emptyTotals(), sub: new Map(), count: 0 });
      }
      const item = map.get(categoria);
      addAmount(item.totals, gasto);
      item.count += 1;

      if (!item.sub.has(subcategoria)) {
        item.sub.set(subcategoria, { name: subcategoria, totals: emptyTotals(), count: 0 });
      }
      const sub = item.sub.get(subcategoria);
      addAmount(sub.totals, gasto);
      sub.count += 1;
    });

    return [...map.values()]
      .map(item => ({ ...item, sub: [...item.sub.values()].sort((a, b) => (b.totals.UYU + b.totals.USD) - (a.totals.UYU + a.totals.USD)) }))
      .sort((a, b) => (b.totals.UYU + b.totals.USD) - (a.totals.UYU + a.totals.USD));
  }, [gastosFiltrados, groupMode]);

  const chartData = grouped.map(item => ({ name: item.name, value: item.totals.UYU, usd: item.totals.USD }));

  return (
    <div className="pt-4 animate-in fade-in duration-500 space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-zinc-800">Reportes</h2>
          <p className="text-sm font-medium text-zinc-500">{gastosFiltrados.length} gastos del período</p>
        </div>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="p-3 rounded-2xl border border-zinc-200 bg-white font-bold text-zinc-700 outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 p-4 rounded-2xl text-white">
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Pesos</p>
          <p className="text-2xl font-black">{formatMoney(totals.UYU, 'UYU')}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm">
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Dólares</p>
          <p className="text-2xl font-black text-zinc-800">{formatMoney(totals.USD, 'USD')}</p>
        </div>
      </div>

      <div className="bg-white p-2 rounded-2xl border border-zinc-100 shadow-sm grid grid-cols-3 gap-1">
        {[
          ['categoria', 'Categoría'],
          ['subcategoria', 'Subcat.'],
          ['destino', 'Tipo'],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setGroupMode(value)}
            className={`py-3 rounded-xl text-sm font-bold ${groupMode === value ? 'bg-emerald-500 text-white' : 'text-zinc-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-bold text-zinc-800">Gastos por {groupMode === 'destino' ? 'tipo' : groupMode}</h3>
          <button onClick={() => setShowChart(!showChart)} className="text-sm font-bold text-emerald-600">
            {showChart ? 'Ocultar gráfico' : 'Ver gráfico'}
          </button>
        </div>

        {showChart && (
          <div className="h-64 p-4 border-b border-zinc-100">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} innerRadius={52} outerRadius={82} paddingAngle={4} dataKey="value">
                    {chartData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(value, 'UYU')} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-zinc-400 mt-24">No hay datos.</p>
            )}
          </div>
        )}

        <div className="divide-y divide-zinc-100">
          {grouped.length === 0 && <p className="p-8 text-center text-zinc-400 font-medium">No hay gastos en este mes.</p>}
          {grouped.map(item => {
            const isOpen = expanded[item.name];
            return (
              <div key={item.name}>
                <button
                  onClick={() => setExpanded((actual) => ({ ...actual, [item.name]: !actual[item.name] }))}
                  className="w-full p-4 flex items-center gap-3 text-left"
                >
                  {isOpen ? <ChevronDown size={18} className="text-zinc-400" /> : <ChevronRight size={18} className="text-zinc-400" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-zinc-800 truncate">{item.name}</p>
                    <p className="text-xs font-medium text-zinc-400">{item.count} movimientos</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-zinc-900">{formatMoney(item.totals.UYU, 'UYU')}</p>
                    {item.totals.USD > 0 && <p className="text-xs font-bold text-zinc-500">{formatMoney(item.totals.USD, 'USD')}</p>}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-2">
                    {item.sub.map(sub => (
                      <div key={sub.name} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
                        <div>
                          <p className="font-bold text-sm text-zinc-700">{sub.name}</p>
                          <p className="text-xs text-zinc-400">{sub.count} movimientos</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-sm text-zinc-900">{formatMoney(sub.totals.UYU, 'UYU')}</p>
                          {sub.totals.USD > 0 && <p className="text-xs font-bold text-zinc-500">{formatMoney(sub.totals.USD, 'USD')}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
