import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

export default function ExpenseForm({ user }) {
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [kilometraje, setKilometraje] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados para las listas dinámicas
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);

  useEffect(() => {
    // Cargar opciones desde Firestore
    const unsubCat = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      const cats = snapshot.docs.map(doc => doc.data().nombre);
      setCategorias(cats);
      if (cats.length > 0 && !categoria) setCategoria(cats[0]); // Seleccionar el primero por defecto
    });
    
    const unsubUbi = onSnapshot(collection(db, 'ubicaciones'), (snapshot) => {
      const ubis = snapshot.docs.map(doc => doc.data().nombre);
      setUbicaciones(ubis);
      if (ubis.length > 0 && !ubicacion) setUbicacion(ubis[0]);
    });

    return () => { unsubCat(); unsubUbi(); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!monto || isNaN(monto)) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'gastos'), {
        userId: user.uid,
        monto: parseFloat(monto),
        categoria,
        ubicacion, // Cambiado de "hogar" a "ubicacion" para mayor flexibilidad
        fecha: serverTimestamp(),
      });

      if (categoria.toLowerCase() === 'auto' && kilometraje) {
        const vehiculoRef = doc(db, 'vehiculos', 'auto_principal'); 
        await updateDoc(vehiculoRef, { kilometraje_actual: Number(kilometraje) });
      }

      setMonto('');
      setKilometraje('');
      alert('¡Gasto guardado con éxito!');
    } catch (error) {
      console.error("Detalle del error:", error);
      alert('Error al guardar. Revisá la consola para más detalles: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="pt-4 animate-in fade-in duration-500">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        
        {/* Input Monto Gigante */}
        <div className="flex flex-col items-center justify-center py-8">
          <span className="text-zinc-400 font-medium mb-2">¿Cuánto gastaste?</span>
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

        <div className="space-y-6 mb-8 bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
          
          {/* Select de Categoría */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1">Categoría</label>
            <div className="relative">
              <select 
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-zinc-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
              >
                {categorias.length === 0 && <option value="">Cargando...</option>}
                {categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              {/* Flecha personalizada para el select */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>

          {/* Input condicional para el Auto */}
          <div className={`transition-all duration-300 overflow-hidden ${categoria.toLowerCase() === 'auto' ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center">
              <span className="text-2xl mr-3">🚗</span>
              <div className="flex-1">
                <label className="block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Km al cargar</label>
                <input 
                  type="number" 
                  value={kilometraje}
                  onChange={(e) => setKilometraje(e.target.value)}
                  className="w-full text-lg font-bold text-emerald-900 bg-transparent outline-none placeholder-emerald-300"
                  placeholder="Ej: 85000"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          {/* Select de Ubicación */}
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1">Lugar del Gasto</label>
            <div className="relative">
              <select 
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-zinc-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
              >
                {ubicaciones.length === 0 && <option value="">Cargando...</option>}
                {ubicaciones.map(ubi => <option key={ubi} value={ubi}>{ubi}</option>)}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>

        </div>

        {/* Botón Guardar Flotante */}
        <button 
          type="submit" 
          disabled={loading || !monto || categorias.length === 0}
          className="w-full bg-emerald-500 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none"
        >
          {loading ? 'Registrando...' : 'Registrar Gasto'}
        </button>
      </form>
    </div>
  );
}