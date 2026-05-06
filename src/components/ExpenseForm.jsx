import { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function ExpenseForm({ user }) {
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('Supermercado');
  const [hogar, setHogar] = useState('Ciudad de la Costa');
  const [kilometraje, setKilometraje] = useState('');
  const [loading, setLoading] = useState(false);

  const categorias = ['Supermercado', 'Auto', 'Casa', 'Mascotas', 'Asado & Salidas', 'Camping & Viajes', 'Servicios'];
  const hogares = ['Ciudad de la Costa', 'Montevideo', 'Otro'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!monto || isNaN(monto)) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'gastos'), {
        userId: user.uid,
        monto: parseFloat(monto),
        categoria,
        hogar,
        fecha: serverTimestamp(),
      });

      if (categoria === 'Auto' && kilometraje) {
        const vehiculoRef = doc(db, 'vehiculos', 'auto_principal'); 
        await updateDoc(vehiculoRef, { kilometraje_actual: Number(kilometraje) });
      }

      setMonto('');
      setKilometraje('');
      // Aquí podrías agregar un toast nativo o una pequeña vibración (haptic feedback) en el futuro
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <div className="pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        
        {/* Input Monto Gigante */}
        <div className="flex flex-col items-center justify-center py-8">
          <span className="text-zinc-400 font-medium mb-2">Cuánto gastaste?</span>
          <div className="flex items-center justify-center text-emerald-500">
            <span className="text-4xl font-bold mr-1">$</span>
            <input 
              type="number" 
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="text-6xl font-black bg-transparent w-full max-w-[200px] text-center outline-none placeholder-zinc-300"
              placeholder="0"
              inputMode="decimal"
              autoFocus
            />
          </div>
        </div>

        {/* Categorías con Scroll Horizontal (Pills) */}
        <div className="mb-6">
          <div className="flex overflow-x-auto pb-4 gap-2 no-scrollbar snap-x">
            {categorias.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoria(cat)}
                className={`snap-start whitespace-nowrap px-5 py-3 rounded-2xl text-sm font-semibold transition-all ${
                  categoria === cat 
                    ? 'bg-zinc-900 text-white shadow-md' 
                    : 'bg-white text-zinc-500 border border-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Input condicional para el Auto */}
        <div className={`transition-all duration-300 overflow-hidden ${categoria === 'Auto' ? 'max-h-24 mb-6 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 flex items-center shadow-sm">
            <span className="text-2xl mr-3">🚗</span>
            <div className="flex-1">
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Km al cargar</label>
              <input 
                type="number" 
                value={kilometraje}
                onChange={(e) => setKilometraje(e.target.value)}
                className="w-full text-lg font-bold text-zinc-800 outline-none"
                placeholder="Ej: 85000"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>

        {/* Selector de Hogar */}
        <div className="mb-8">
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 ml-1">Lugar del Gasto</label>
          <div className="grid grid-cols-2 gap-2">
            {hogares.slice(0, 2).map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setHogar(h)}
                className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${hogar === h ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-white text-zinc-600 border border-zinc-200'}`}
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {/* Botón Guardar Flotante */}
        <button 
          type="submit" 
          disabled={loading || !monto}
          className="w-full bg-emerald-500 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none"
        >
          {loading ? 'Registrando...' : 'Registrar Gasto'}
        </button>
      </form>
    </div>
  );
}