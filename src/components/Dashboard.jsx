import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLORS = ['#10b981', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];

const VISTAS = [
  { id: 'categoria', label: 'Categorías' },
  { id: 'subcategoria', label: 'Subcategorías' },
  { id: 'destino', label: 'Destino' },
  { id: 'vehiculos', label: 'Autos' },
  { id: 'hogares', label: 'Casas' },
  { id: 'mensual', label: 'Meses' },
  { id: 'fijos', label: 'Fijos' },
  { id: 'tarjetas', label: 'Tarjetas' },
  { id: 'vencimientos', label: 'Vence' },
];

const formatMoney = (valor) => `$${Number(valor || 0).toFixed(2)}`;

const fechaDeGasto = (gasto) => {
  if (gasto.fecha?.toDate) return gasto.fecha.toDate();
  if (gasto.fecha instanceof Date) return gasto.fecha;
  return null;
};

const mesDeGasto = (gasto) => {
  const fecha = fechaDeGasto(gasto);
  if (!fecha) return 'Sin fecha';
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
};

const agrupar = (gastos, getKey) => {
  const mapa = new Map();
  gastos.forEach((gasto) => {
    const key = getKey(gasto) || 'Sin asignar';
    mapa.set(key, (mapa.get(key) || 0) + Number(gasto.monto || 0));
  });
  return [...mapa.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

export default function Dashboard({ user }) {
  const [vista, setVista] = useState('categoria');
  const [gastos, setGastos] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'gastos'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGastos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user.uid]);

  const total = useMemo(() => gastos.reduce((sum, gasto) => sum + Number(gasto.monto || 0), 0), [gastos]);

  const data = useMemo(() => {
    if (vista === 'categoria') return agrupar(gastos, gasto => gasto.categoriaGrupo || gasto.categoria);
    if (vista === 'subcategoria') return agrupar(gastos, gasto => gasto.subcategoria || gasto.categoria);
    if (vista === 'destino') return agrupar(gastos, gasto => gasto.tipoDestino || 'general');
    if (vista === 'vehiculos') return agrupar(gastos.filter(g => (g.tipoDestino || '') === 'vehiculo'), gasto => gasto.vehiculoNombre || 'Auto sin asociar');
    if (vista === 'hogares') return agrupar(gastos.filter(g => (g.tipoDestino || '') === 'hogar'), gasto => gasto.hogarNombre || 'Casa sin asociar');
    if (vista === 'mensual') return agrupar(gastos, mesDeGasto).sort((a, b) => a.name.localeCompare(b.name));
    if (vista === 'fijos') return agrupar(gastos, gasto => gasto.gastoFijo ? 'Fijos' : 'Variables');
    if (vista === 'tarjetas') return agrupar(gastos.filter(g => (g.tipoDestino || '') === 'tarjeta'), gasto => gasto.estadoCuenta ? 'Con estado' : 'Pendiente PDF');
    return [];
  }, [gastos, vista]);

  const vencimientos = useMemo(() => (
    gastos
      .filter(gasto => gasto.detalles?.vencimiento)
      .sort((a, b) => a.detalles.vencimiento.localeCompare(b.detalles.vencimiento))
      .slice(0, 8)
  ), [gastos]);

  const topTres = data.slice(0, 3);

  return (
    <div className="pt-4 animate-in fade-in duration-500 space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold text-zinc-800">Reportes</h2>
        <p className="text-sm text-zinc-500 font-medium">Todas las lecturas principales de tu economía.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 p-4 rounded-2xl text-white">
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Total</p>
          <p className="text-2xl font-black">{formatMoney(total)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm">
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Gastos</p>
          <p className="text-2xl font-black text-zinc-800">{gastos.length}</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {VISTAS.map(item => (
          <button
            key={item.id}
            onClick={() => setVista(item.id)}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border ${vista === item.id ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-zinc-200 text-zinc-500'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {vista === 'vencimientos' ? (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4">
          <h3 className="font-bold text-zinc-800 mb-3">Próximos vencimientos</h3>
          <div className="space-y-2">
            {vencimientos.length === 0 && <p className="text-sm text-zinc-400 text-center py-8">No hay vencimientos cargados.</p>}
            {vencimientos.map(gasto => (
              <div key={gasto.id} className="flex items-center justify-between gap-3 p-3 bg-zinc-50 rounded-xl">
                <div>
                  <p className="font-bold text-zinc-800">{gasto.subcategoria || gasto.categoria}</p>
                  <p className="text-xs text-zinc-500">{gasto.detalles.vencimiento}</p>
                </div>
                <p className="font-black text-zinc-900">{formatMoney(gasto.monto)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4">
          <div className="h-72">
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {vista === 'mensual' ? (
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatMoney(value)} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#10b981" />
                  </BarChart>
                ) : (
                  <PieChart>
                    <Pie data={data} innerRadius={56} outerRadius={86} paddingAngle={4} dataKey="value">
                      {data.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(value)} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-zinc-400 mt-24">No hay datos para esta vista.</p>
            )}
          </div>

          <div className="space-y-2 mt-2">
            {topTres.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="font-bold text-sm text-zinc-700">{item.name}</span>
                </div>
                <span className="font-black text-sm text-zinc-900">{formatMoney(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
