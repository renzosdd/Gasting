import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { BarChart3, FileText, Mic, Plus, Sparkles } from 'lucide-react';
import { db } from '../firebase';

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const expenseMonth = (gasto) => {
  const date = gasto.fecha?.toDate?.();
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

export default function Home({ user, onAddExpense, onOpenReports }) {
  const [gastos, setGastos] = useState([]);
  const mesActual = currentMonth();

  useEffect(() => {
    const q = query(collection(db, 'gastos'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGastos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user.uid]);

  const gastosMes = useMemo(() => (
    gastos
      .filter(gasto => expenseMonth(gasto) === mesActual)
      .sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0))
  ), [gastos, mesActual]);

  const totalUyu = useMemo(() => (
    gastosMes
      .filter(gasto => (gasto.moneda || 'UYU') === 'UYU')
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0)
  ), [gastosMes]);

  const totalUsd = useMemo(() => (
    gastosMes
      .filter(gasto => gasto.moneda === 'USD')
      .reduce((total, gasto) => total + Number(gasto.monto || 0), 0)
  ), [gastosMes]);

  const porCategoria = useMemo(() => {
    const grupos = new Map();
    gastosMes.forEach((gasto) => {
      const key = gasto.categoriaGrupo || gasto.categoria || 'Sin categoría';
      grupos.set(key, (grupos.get(key) || 0) + Number(gasto.monto || 0));
    });
    return [...grupos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [gastosMes]);

  return (
    <div className="pt-4 animate-in fade-in duration-500 space-y-5">
      <section className="rounded-[2rem] bg-zinc-900 text-white p-5 shadow-xl shadow-zinc-900/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Gastado este mes</p>
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
            onClick={onOpenReports}
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

      {porCategoria.length > 0 && (
        <section className="rounded-[2rem] bg-white border border-zinc-100 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-zinc-900">Dónde se está yendo</h2>
            <button type="button" onClick={onOpenReports} className="text-xs font-black text-emerald-600">Ver más</button>
          </div>
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

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-black text-zinc-900">Últimos gastos</h2>
            <p className="text-sm font-medium text-zinc-500">{gastosMes.length} registros este mes</p>
          </div>
        </div>

        {gastosMes.length === 0 && (
          <div className="rounded-[2rem] bg-white border border-zinc-100 p-8 text-center">
            <FileText size={28} className="mx-auto text-zinc-300" />
            <p className="mt-3 font-black text-zinc-800">Todavía no cargaste gastos este mes.</p>
            <p className="mt-1 text-sm text-zinc-400">Empezá con el próximo gasto y la lista se arma sola.</p>
          </div>
        )}

        {gastosMes.slice(0, 12).map(gasto => (
          <article key={gasto.id} className="rounded-3xl bg-white border border-zinc-100 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-black text-zinc-900 truncate">{gasto.subcategoria || gasto.categoria || 'Gasto'}</p>
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
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
