import { useState, useEffect } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { CarFront, Home, Plus, Image as ImageIcon } from 'lucide-react';

export default function EntitiesManager({ user }) {
  const [tab, setTab] = useState('vehiculos'); // 'vehiculos' o 'hogares'
  const [vehiculos, setVehiculos] = useState([]);
  const [creando, setCreando] = useState(false);
  const [loading, setLoading] = useState(false);

  // Formulario de Vehículo
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [tipoMotor, setTipoMotor] = useState('Nafta');
  const [kmActual, setKmActual] = useState('');
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);

  useEffect(() => {
    // Escuchar los vehículos del usuario (donde su uid esté en el array 'propietarios')
    const q = query(collection(db, 'vehiculos'), where('propietarios', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVehiculos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user.uid]);

  const handleFotoChange = (e) => {
    if (e.target.files[0]) {
      setFotoFile(e.target.files[0]);
      setFotoPreview(URL.createObjectURL(e.target.files[0])); // Preview local
    }
  };

  const handleGuardarVehiculo = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let fotoUrl = null;

      // 1. Si hay foto, la subimos a Storage primero
      if (fotoFile) {
        const fotoRef = ref(storage, `vehiculos/${user.uid}/${Date.now()}_${fotoFile.name}`);
        const snapshot = await uploadBytes(fotoRef, fotoFile);
        fotoUrl = await getDownloadURL(snapshot.ref);
      }

      // 2. Guardamos el documento en Firestore
      await addDoc(collection(db, 'vehiculos'), {
        propietarios: [user.uid], // Array para compartir a futuro
        nombre,
        marca,
        modelo,
        anio: Number(anio),
        tipo_motor: tipoMotor,
        kilometraje_actual: Number(kmActual),
        proximo_service_km: null, // Lo dejaremos para después
        fotoUrl
      });

      // Limpiar form
      setNombre(''); setMarca(''); setModelo(''); setAnio('');
      setKmActual(''); setFotoFile(null); setFotoPreview(null);
      setCreando(false);
    } catch (error) {
      console.error("Error al crear vehículo:", error);
      alert("Error: " + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="pt-4 animate-in fade-in duration-500">
      <h2 className="text-2xl font-extrabold text-zinc-800 mb-6">Mis Entidades</h2>

      {/* Tabs Selector */}
      <div className="flex bg-zinc-200/50 p-1 rounded-2xl mb-6">
        <button 
          onClick={() => setTab('vehiculos')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${tab === 'vehiculos' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
        >
          <CarFront size={18} /> Vehículos
        </button>
        <button 
          onClick={() => setTab('hogares')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${tab === 'hogares' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
        >
          <Home size={18} /> Hogares
        </button>
      </div>

      {tab === 'vehiculos' && (
        <div className="space-y-6">
          
          {/* Listado de Tarjetas de Vehículos */}
          {!creando && vehiculos.map(vehiculo => (
            <div key={vehiculo.id} className="bg-white rounded-3xl p-5 shadow-sm border border-zinc-100 flex gap-4 items-center">
              <div className="w-24 h-24 rounded-2xl bg-zinc-100 flex-shrink-0 overflow-hidden border border-zinc-200">
                {vehiculo.fotoUrl ? (
                  <img src={vehiculo.fotoUrl} alt={vehiculo.nombre} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400">
                    <CarFront size={32} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">{vehiculo.tipo_motor}</span>
                <h3 className="text-lg font-bold text-zinc-800 leading-tight">{vehiculo.nombre}</h3>
                <p className="text-sm text-zinc-500 mb-2">{vehiculo.marca} {vehiculo.modelo} ({vehiculo.anio})</p>
                <div className="inline-block bg-zinc-100 px-3 py-1 rounded-lg">
                  <span className="text-xs font-bold text-zinc-600">{vehiculo.kilometraje_actual.toLocaleString()} KM</span>
                </div>
              </div>
            </div>
          ))}

          {/* Botón Agregar */}
          {!creando && (
            <button 
              onClick={() => setCreando(true)}
              className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold py-4 rounded-3xl flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all"
            >
              <Plus size={20} /> Registrar Nuevo Vehículo
            </button>
          )}

          {/* Formulario de Creación */}
          {creando && (
            <form onSubmit={handleGuardarVehiculo} className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 space-y-4">
              <h3 className="font-bold text-zinc-800 text-lg mb-4">Nuevo Vehículo</h3>
              
              {/* Foto Upload (UI/UX) */}
              <div className="flex justify-center mb-6">
                <label className="relative w-32 h-32 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:bg-zinc-100 transition-all">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <ImageIcon className="text-zinc-400 mb-2" size={32} />
                      <span className="text-xs font-medium text-zinc-500">Subir Foto</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 ml-1">Apodo del vehículo</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Golcito" required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 ml-1">Marca</label>
                  <input type="text" value={marca} onChange={e => setMarca(e.target.value)} required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 ml-1">Modelo</label>
                  <input type="text" value={modelo} onChange={e => setModelo(e.target.value)} required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 ml-1">Año</label>
                  <input type="number" value={anio} onChange={e => setAnio(e.target.value)} required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 ml-1">Motor</label>
                  <select value={tipoMotor} onChange={e => setTipoMotor(e.target.value)} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="Nafta">Nafta</option>
                    <option value="Gasoil">Gasoil</option>
                    <option value="Eléctrico">Eléctrico</option>
                    <option value="Híbrido">Híbrido</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1 ml-1">Kilometraje Inicial</label>
                <input type="number" value={kmActual} onChange={e => setKmActual(e.target.value)} placeholder="Ej: 85000" required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setCreando(false)} className="flex-1 p-4 rounded-2xl font-bold text-zinc-500 bg-zinc-100 hover:bg-zinc-200">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 p-4 rounded-2xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50">
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'hogares' && (
        <div className="text-center py-10">
          <Home className="mx-auto text-zinc-300 mb-4" size={48} />
          <p className="text-zinc-500 font-medium">Gestor de hogares próximamente...</p>
        </div>
      )}
    </div>
  );
}