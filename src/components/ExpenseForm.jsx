import { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { CarFront, FileText, Home } from 'lucide-react';

const normalizar = (valor) => valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function ExpenseForm({ user }) {
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [kilometraje, setKilometraje] = useState('');
  const [vehiculoId, setVehiculoId] = useState('');
  const [hogarId, setHogarId] = useState('');
  const [estadoCuentaFile, setEstadoCuentaFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // Estados para las listas dinámicas
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [hogares, setHogares] = useState([]);

  useEffect(() => {
    // Cargar opciones desde Firestore
    const unsubCat = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      const cats = snapshot.docs.map(doc => doc.data().nombre);
      setCategorias(cats);
      setCategoria((actual) => actual || cats[0] || '');
    });
    
    const unsubUbi = onSnapshot(collection(db, 'ubicaciones'), (snapshot) => {
      const ubis = snapshot.docs.map(doc => doc.data().nombre);
      setUbicaciones(ubis);
      setUbicacion((actual) => actual || ubis[0] || '');
    });

    return () => { unsubCat(); unsubUbi(); };
  }, []);

  useEffect(() => {
    const vehiculosQuery = query(collection(db, 'vehiculos'), where('propietarios', 'array-contains', user.uid));
    const hogaresQuery = query(collection(db, 'hogares'), where('propietarios', 'array-contains', user.uid));

    const unsubVehiculos = onSnapshot(vehiculosQuery, (snapshot) => {
      setVehiculos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setVehiculoId((actual) => actual || snapshot.docs[0]?.id || '');
    });

    const unsubHogares = onSnapshot(hogaresQuery, (snapshot) => {
      setHogares(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setHogarId((actual) => actual || snapshot.docs[0]?.id || '');
    });

    return () => { unsubVehiculos(); unsubHogares(); };
  }, [user.uid]);

  const categoriaNormalizada = normalizar(categoria);
  const esAuto = categoriaNormalizada.includes('auto') || categoriaNormalizada.includes('vehiculo');
  const esHogar = categoriaNormalizada.includes('hogar') || categoriaNormalizada.includes('casa');
  const esTarjeta = categoriaNormalizada.includes('tarjeta') || categoriaNormalizada.includes('credito');

  const handleEstadoCuentaChange = (e) => {
    setEstadoCuentaFile(e.target.files?.[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const montoNumerico = Number(monto);
    if (!monto || Number.isNaN(montoNumerico) || montoNumerico <= 0) return;
    if (esAuto && !vehiculoId) {
      alert('Seleccioná o registrá un vehículo para asociar este gasto.');
      return;
    }
    if (esHogar && !hogarId) {
      alert('Seleccioná o registrá un hogar para asociar este gasto.');
      return;
    }
    
    setLoading(true);
    try {
      let estadoCuenta = null;

      if (esTarjeta && estadoCuentaFile) {
        const estadoCuentaRef = ref(storage, `estados-cuenta/${user.uid}/${Date.now()}_${estadoCuentaFile.name}`);
        const snapshot = await uploadBytes(estadoCuentaRef, estadoCuentaFile);
        estadoCuenta = {
          nombre: estadoCuentaFile.name,
          tipo: estadoCuentaFile.type || 'application/pdf',
          url: await getDownloadURL(snapshot.ref),
          path: snapshot.ref.fullPath,
        };
      }

      const batch = writeBatch(db);
      const gastoRef = doc(collection(db, 'gastos'));

      batch.set(gastoRef, {
        userId: user.uid,
        monto: montoNumerico,
        categoria,
        ubicacion,
        vehiculoId: esAuto && vehiculoId ? vehiculoId : null,
        hogarId: esHogar && hogarId ? hogarId : null,
        estadoCuenta,
        origen: esTarjeta ? 'tarjeta_credito' : 'manual',
        fecha: serverTimestamp(),
      });

      if (esAuto && vehiculoId && kilometraje) {
        batch.update(doc(db, 'vehiculos', vehiculoId), { kilometraje_actual: Number(kilometraje) });
      }

      await batch.commit();

      setMonto('');
      setKilometraje('');
      setEstadoCuentaFile(null);
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
          <div className={`transition-all duration-300 overflow-hidden ${esAuto ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center">
              <CarFront className="text-emerald-700 mr-3" size={28} />
              <div className="flex-1">
                <label className="block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Vehículo</label>
                <select
                  value={vehiculoId}
                  onChange={(e) => setVehiculoId(e.target.value)}
                  className="w-full mb-2 text-sm font-bold text-emerald-900 bg-transparent outline-none"
                >
                  {vehiculos.length === 0 && <option value="">Registrá un vehículo primero</option>}
                  {vehiculos.map(vehiculo => (
                    <option key={vehiculo.id} value={vehiculo.id}>{vehiculo.nombre || `${vehiculo.marca} ${vehiculo.modelo}`}</option>
                  ))}
                </select>
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

          <div className={`transition-all duration-300 overflow-hidden ${esHogar ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center">
              <Home className="text-blue-700 mr-3" size={28} />
              <div className="flex-1">
                <label className="block text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">Hogar</label>
                <select
                  value={hogarId}
                  onChange={(e) => setHogarId(e.target.value)}
                  className="w-full text-sm font-bold text-blue-900 bg-transparent outline-none"
                >
                  {hogares.length === 0 && <option value="">Registrá un hogar primero</option>}
                  {hogares.map(hogar => (
                    <option key={hogar.id} value={hogar.id}>{hogar.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className={`transition-all duration-300 overflow-hidden ${esTarjeta ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex items-center">
              <FileText className="text-indigo-700 mr-3" size={28} />
              <div className="flex-1">
                <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">Estado de cuenta</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleEstadoCuentaChange}
                  className="w-full text-sm text-indigo-900 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                />
                {estadoCuentaFile && <p className="mt-2 text-xs font-medium text-indigo-700">{estadoCuentaFile.name}</p>}
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
