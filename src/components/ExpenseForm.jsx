import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { CarFront, CreditCard, FileText, Home, Wallet } from 'lucide-react';

const TIPOS_DESTINO = [
  { id: 'general', label: 'General', icon: Wallet },
  { id: 'vehiculo', label: 'Vehículo', icon: CarFront },
  { id: 'hogar', label: 'Casa', icon: Home },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
];

const normalizar = (valor = '') => valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const getSubcategoriaNombre = (subcategoria) => (
  typeof subcategoria === 'string' ? subcategoria : subcategoria?.nombre || ''
);

const campoExtra = (subcategoria, tipoDestino) => {
  const nombre = normalizar(subcategoria);
  if (tipoDestino === 'vehiculo' && (nombre.includes('nafta') || nombre.includes('combustible'))) {
    return ['kilometraje', 'litros', 'precioLitro'];
  }
  if (tipoDestino === 'vehiculo' && nombre.includes('service')) {
    return ['kilometraje', 'proveedor', 'proximoServiceKm'];
  }
  if (tipoDestino === 'vehiculo' && (nombre.includes('seguro') || nombre.includes('patente'))) {
    return ['periodo', 'vencimiento'];
  }
  if (tipoDestino === 'hogar' && (nombre.includes('alquiler') || nombre.includes('ute') || nombre.includes('ose') || nombre.includes('internet') || nombre.includes('impuesto'))) {
    return ['periodo', 'vencimiento'];
  }
  if (tipoDestino === 'hogar' && (nombre.includes('mantenimiento') || nombre.includes('reparacion'))) {
    return ['proveedor', 'detalle'];
  }
  return [];
};

export default function ExpenseForm({ user }) {
  const [monto, setMonto] = useState('');
  const [tipoDestino, setTipoDestino] = useState('general');
  const [categoriaId, setCategoriaId] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [vehiculoId, setVehiculoId] = useState('');
  const [hogarId, setHogarId] = useState('');
  const [tarjetaId, setTarjetaId] = useState('');
  const [estadoCuentaFile, setEstadoCuentaFile] = useState(null);
  const [subcategoriaSugerida, setSubcategoriaSugerida] = useState('');
  const [detalles, setDetalles] = useState({});
  const [loading, setLoading] = useState(false);

  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [hogares, setHogares] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);

  useEffect(() => {
    const unsubCat = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      setCategorias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
    const tarjetasQuery = query(collection(db, 'tarjetas'), where('propietarios', 'array-contains', user.uid));

    const unsubVehiculos = onSnapshot(vehiculosQuery, (snapshot) => {
      setVehiculos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubHogares = onSnapshot(hogaresQuery, (snapshot) => {
      setHogares(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubTarjetas = onSnapshot(tarjetasQuery, (snapshot) => {
      setTarjetas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubVehiculos(); unsubHogares(); unsubTarjetas(); };
  }, [user.uid]);

  const categoriasFiltradas = useMemo(() => (
    categorias.filter(categoria => (categoria.tipoDestino || 'general') === tipoDestino)
  ), [categorias, tipoDestino]);

  const categoriaSeleccionada = categorias.find(categoria => categoria.id === categoriaId);
  const subcategorias = useMemo(() => (
    Array.isArray(categoriaSeleccionada?.subcategorias) ? categoriaSeleccionada.subcategorias : []
  ), [categoriaSeleccionada]);
  const camposExtra = campoExtra(subcategoria, tipoDestino);

  useEffect(() => {
    const primera = categoriasFiltradas[0];
    setCategoriaId((actual) => categoriasFiltradas.some(c => c.id === actual) ? actual : primera?.id || '');
  }, [categoriasFiltradas]);

  useEffect(() => {
    const primeraSubcategoria = getSubcategoriaNombre(subcategorias[0]);
    setSubcategoria((actual) => subcategorias.some(sub => getSubcategoriaNombre(sub) === actual) ? actual : primeraSubcategoria);
    setDetalles({});
  }, [categoriaId, subcategorias]);

  const handleDetalleChange = (campo, valor) => {
    setDetalles((actual) => ({ ...actual, [campo]: valor }));
  };

  const handleEstadoCuentaChange = (e) => {
    setEstadoCuentaFile(e.target.files?.[0] || null);
  };

  const getCategoriaNombre = () => categoriaSeleccionada?.nombre || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const montoNumerico = Number(monto);
    if (!monto || Number.isNaN(montoNumerico) || montoNumerico <= 0) return;
    
    setLoading(true);
    try {
      const estadoCuenta = tipoDestino === 'tarjeta' && estadoCuentaFile
        ? {
            nombre: estadoCuentaFile.name,
            tipo: estadoCuentaFile.type || 'application/pdf',
            estado: 'pendiente_storage',
          }
        : null;

      const batch = writeBatch(db);
      const gastoRef = doc(collection(db, 'gastos'));
      const vehiculoSeleccionado = vehiculos.find(vehiculo => vehiculo.id === vehiculoId);
      const hogarSeleccionado = hogares.find(hogar => hogar.id === hogarId);
      const tarjetaSeleccionada = tarjetas.find(tarjeta => tarjeta.id === tarjetaId);
      const subcategoriaFinal = subcategoriaSugerida.trim() || subcategoria;

      batch.set(gastoRef, {
        userId: user.uid,
        monto: montoNumerico,
        tipoDestino,
        categoriaId: categoriaId || null,
        categoriaGrupo: getCategoriaNombre(),
        categoria: subcategoriaFinal || getCategoriaNombre(),
        subcategoria: subcategoriaFinal || null,
        ubicacion,
        vehiculoId: tipoDestino === 'vehiculo' && vehiculoId ? vehiculoId : null,
        vehiculoNombre: tipoDestino === 'vehiculo' && vehiculoSeleccionado ? vehiculoSeleccionado.nombre || `${vehiculoSeleccionado.marca} ${vehiculoSeleccionado.modelo}` : null,
        hogarId: tipoDestino === 'hogar' && hogarId ? hogarId : null,
        hogarNombre: tipoDestino === 'hogar' && hogarSeleccionado ? hogarSeleccionado.nombre : null,
        tarjetaId: tipoDestino === 'tarjeta' && tarjetaId ? tarjetaId : null,
        tarjetaNombre: tipoDestino === 'tarjeta' && tarjetaSeleccionada ? tarjetaSeleccionada.nombre || `${tarjetaSeleccionada.banco} ${tarjetaSeleccionada.marca}` : null,
        detalles,
        gastoFijo: Boolean(detalles.gastoFijo),
        estadoCuenta,
        estadoCuentaPendiente: tipoDestino === 'tarjeta' && !estadoCuenta,
        origen: tipoDestino === 'tarjeta' ? 'tarjeta_credito' : 'manual',
        fecha: serverTimestamp(),
      });

      if (subcategoriaSugerida.trim()) {
        await addDoc(collection(db, 'subcategoria_sugerencias'), {
          userId: user.uid,
          categoriaId,
          categoriaNombre: getCategoriaNombre(),
          tipoDestino,
          nombre: subcategoriaSugerida.trim(),
          estado: 'pendiente',
          fecha: serverTimestamp(),
        });
      }

      if (tipoDestino === 'vehiculo' && vehiculoId && detalles.kilometraje) {
        batch.update(doc(db, 'vehiculos', vehiculoId), { kilometraje_actual: Number(detalles.kilometraje) });
      }

      await batch.commit();

      setMonto('');
      setEstadoCuentaFile(null);
      setSubcategoriaSugerida('');
      setDetalles({});
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
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1">Tipo de gasto</label>
            <div className="grid grid-cols-4 gap-2">
              {TIPOS_DESTINO.map(tipo => {
                const Icon = tipo.icon;
                return (
                  <button
                    key={tipo.id}
                    type="button"
                    onClick={() => setTipoDestino(tipo.id)}
                    className={`h-16 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${tipoDestino === tipo.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-50 text-zinc-500'}`}
                  >
                    <Icon size={18} />
                    <span className="text-[11px] font-bold">{tipo.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1">Categoría</label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-zinc-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {categoriasFiltradas.length === 0 && <option value="">Creá categorías en Admin</option>}
              {categoriasFiltradas.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1">Subcategoría</label>
            <select
              value={subcategoria}
              onChange={(e) => setSubcategoria(e.target.value)}
              className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-zinc-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {subcategorias.length === 0 && <option value="">Sin subcategoría</option>}
              {subcategorias.map(sub => {
                const nombre = getSubcategoriaNombre(sub);
                return <option key={nombre} value={nombre}>{nombre}</option>;
              })}
            </select>
            <input
              value={subcategoriaSugerida}
              onChange={(e) => setSubcategoriaSugerida(e.target.value)}
              className="w-full mt-2 p-3 bg-white border border-dashed border-zinc-300 rounded-2xl text-zinc-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Sugerir otra subcategoría..."
            />
            {subcategoriaSugerida && <p className="mt-2 text-xs font-medium text-zinc-500">Se guarda en este gasto y queda pendiente para que un admin la apruebe.</p>}
          </div>

          {tipoDestino === 'vehiculo' && (
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
              <label className="block text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Vehículo opcional</label>
              <select
                value={vehiculoId}
                onChange={(e) => setVehiculoId(e.target.value)}
                className="w-full p-3 bg-white border border-emerald-100 rounded-xl text-emerald-900 font-medium outline-none"
              >
                <option value="">Sin asociar</option>
                {vehiculos.map(vehiculo => (
                  <option key={vehiculo.id} value={vehiculo.id}>{vehiculo.nombre || `${vehiculo.marca} ${vehiculo.modelo}`}</option>
                ))}
              </select>
            </div>
          )}

          {tipoDestino === 'hogar' && (
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <label className="block text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Casa opcional</label>
              <select
                value={hogarId}
                onChange={(e) => setHogarId(e.target.value)}
                className="w-full p-3 bg-white border border-blue-100 rounded-xl text-blue-900 font-medium outline-none"
              >
                <option value="">Sin asociar</option>
                {hogares.map(hogar => (
                  <option key={hogar.id} value={hogar.id}>{hogar.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {tipoDestino === 'tarjeta' && (
            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 space-y-3">
              <div>
                <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Tarjeta opcional</label>
                <select
                  value={tarjetaId}
                  onChange={(e) => setTarjetaId(e.target.value)}
                  className="w-full p-3 bg-white border border-indigo-100 rounded-xl text-indigo-900 font-medium outline-none"
                >
                  <option value="">Sin asociar</option>
                  {tarjetas.map(tarjeta => (
                    <option key={tarjeta.id} value={tarjeta.id}>{tarjeta.nombre || `${tarjeta.banco} ${tarjeta.marca}`}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-start">
                <FileText className="text-indigo-700 mr-3 mt-1" size={28} />
                <div className="flex-1">
                <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">Estado de cuenta opcional</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleEstadoCuentaChange}
                  className="w-full text-sm text-indigo-900 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                />
                <p className="mt-2 text-xs text-indigo-700">No se sube a Firebase Storage. Queda registrado el nombre para cargarlo cuando definamos almacenamiento.</p>
                {estadoCuentaFile && <p className="mt-2 text-xs font-medium text-indigo-700">{estadoCuentaFile.name}</p>}
                </div>
              </div>
            </div>
          )}

          {camposExtra.length > 0 && (
            <div className="space-y-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Datos extra</p>
              {camposExtra.includes('kilometraje') && (
                <input type="number" value={detalles.kilometraje || ''} onChange={(e) => handleDetalleChange('kilometraje', e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none" placeholder="Kilometraje actual" />
              )}
              {camposExtra.includes('litros') && (
                <input type="number" value={detalles.litros || ''} onChange={(e) => handleDetalleChange('litros', e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none" placeholder="Litros" />
              )}
              {camposExtra.includes('precioLitro') && (
                <input type="number" value={detalles.precioLitro || ''} onChange={(e) => handleDetalleChange('precioLitro', e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none" placeholder="Precio por litro" />
              )}
              {camposExtra.includes('proveedor') && (
                <input type="text" value={detalles.proveedor || ''} onChange={(e) => handleDetalleChange('proveedor', e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none" placeholder="Proveedor / taller" />
              )}
              {camposExtra.includes('proximoServiceKm') && (
                <input type="number" value={detalles.proximoServiceKm || ''} onChange={(e) => handleDetalleChange('proximoServiceKm', e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none" placeholder="Próximo service en km" />
              )}
              {camposExtra.includes('periodo') && (
                <input type="month" value={detalles.periodo || ''} onChange={(e) => handleDetalleChange('periodo', e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none" />
              )}
              {camposExtra.includes('vencimiento') && (
                <input type="date" value={detalles.vencimiento || ''} onChange={(e) => handleDetalleChange('vencimiento', e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none" />
              )}
              {camposExtra.includes('detalle') && (
                <textarea value={detalles.detalle || ''} onChange={(e) => handleDetalleChange('detalle', e.target.value)} className="w-full p-3 bg-white border border-zinc-200 rounded-xl outline-none resize-none" rows={3} placeholder="Detalle" />
              )}
            </div>
          )}

          <label className="flex items-center gap-3 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl">
            <input
              type="checkbox"
              checked={Boolean(detalles.gastoFijo)}
              onChange={(e) => handleDetalleChange('gastoFijo', e.target.checked)}
              className="w-5 h-5 accent-emerald-500"
            />
            <span className="text-sm font-bold text-zinc-700">Es gasto fijo</span>
          </label>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1">Lugar del gasto</label>
            <select
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-zinc-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {ubicaciones.length === 0 && <option value="">Sin ubicaciones</option>}
              {ubicaciones.map(ubi => <option key={ubi} value={ubi}>{ubi}</option>)}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !monto || !categoriaId}
          className="w-full bg-emerald-500 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none"
        >
          {loading ? 'Registrando...' : 'Registrar Gasto'}
        </button>
      </form>
    </div>
  );
}
