import { useEffect, useState } from 'react';
import { db, storage } from '../firebase';
import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { CarFront, CreditCard, Edit3, Home, Image as ImageIcon, MapPin, Plus, Trash2, X } from 'lucide-react';

const EMPTY_VEHICULO = { nombre: '', marca: '', modelo: '', anio: '', tipo_motor: 'Nafta', kilometraje_actual: '', fotoUrl: '' };
const EMPTY_HOGAR = { nombre: '', direccion: '', fotoUrl: '', servicios: [] };
const EMPTY_TARJETA = { nombre: '', banco: '', marca: 'Visa', ultimos4: '', diaCierre: '', diaVencimiento: '' };
const EMPTY_SERVICIO = { nombre: '', numeroCuenta: '', diaPago: '', proveedor: '' };

const compressImage = (file, maxSize = 900, quality = 0.72) => new Promise((resolve, reject) => {
  const image = new Image();
  const reader = new FileReader();

  reader.onload = () => {
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('No se pudo comprimir la imagen.'));
          return;
        }
        resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    image.onerror = reject;
    image.src = reader.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function EntitiesManager({ user }) {
  const [tab, setTab] = useState('vehiculos');
  const [vehiculos, setVehiculos] = useState([]);
  const [hogares, setHogares] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [formVehiculo, setFormVehiculo] = useState(EMPTY_VEHICULO);
  const [formHogar, setFormHogar] = useState(EMPTY_HOGAR);
  const [formTarjeta, setFormTarjeta] = useState(EMPTY_TARJETA);
  const [fotoVehiculoFile, setFotoVehiculoFile] = useState(null);
  const [fotoHogarFile, setFotoHogarFile] = useState(null);
  const [servicioForm, setServicioForm] = useState(EMPTY_SERVICIO);
  const [showServicioForm, setShowServicioForm] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const reset = () => {
    setEditandoId(null);
    setFormVehiculo(EMPTY_VEHICULO);
    setFormHogar(EMPTY_HOGAR);
    setFormTarjeta(EMPTY_TARJETA);
    setFotoVehiculoFile(null);
    setFotoHogarFile(null);
    setServicioForm(EMPTY_SERVICIO);
    setShowServicioForm(false);
  };

  const cambiarTab = (nuevoTab) => {
    setTab(nuevoTab);
    reset();
  };

  const editarVehiculo = (vehiculo) => {
    setEditandoId(vehiculo.id);
    setFormVehiculo({
      nombre: vehiculo.nombre || '',
      marca: vehiculo.marca || '',
      modelo: vehiculo.modelo || '',
      anio: vehiculo.anio || '',
      tipo_motor: vehiculo.tipo_motor || 'Nafta',
      kilometraje_actual: vehiculo.kilometraje_actual || '',
      fotoUrl: vehiculo.fotoUrl || '',
    });
  };

  const editarHogar = (hogar) => {
    setEditandoId(hogar.id);
    setFormHogar({ nombre: hogar.nombre || '', direccion: hogar.direccion || '', fotoUrl: hogar.fotoUrl || '', servicios: hogar.servicios || [] });
  };

  const editarTarjeta = (tarjeta) => {
    setEditandoId(tarjeta.id);
    setFormTarjeta({
      nombre: tarjeta.nombre || '',
      banco: tarjeta.banco || '',
      marca: tarjeta.marca || 'Visa',
      ultimos4: tarjeta.ultimos4 || '',
      diaCierre: tarjeta.diaCierre || '',
      diaVencimiento: tarjeta.diaVencimiento || '',
    });
  };

  const uploadCompressedImage = async (file, folder) => {
    if (!file) return null;
    const compressed = await compressImage(file);
    const imageRef = ref(storage, `${folder}/${user.uid}/${Date.now()}_${compressed.name}`);
    try {
      const snapshot = await uploadBytes(imageRef, compressed);
      return getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error('No se pudo subir la imagen comprimida:', error);
      return null;
    }
  };

  const agregarServicio = () => {
    if (!servicioForm.nombre.trim()) return;
    setFormHogar((actual) => ({
      ...actual,
      servicios: [...(actual.servicios || []), { ...servicioForm, diaPago: Number(servicioForm.diaPago) || '' }],
    }));
    setServicioForm(EMPTY_SERVICIO);
    setShowServicioForm(false);
  };

  const quitarServicio = (index) => {
    setFormHogar((actual) => ({
      ...actual,
      servicios: (actual.servicios || []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const guardarVehiculo = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fotoUrl = await uploadCompressedImage(fotoVehiculoFile, 'vehiculos');
      const payload = {
        propietarios: [user.uid],
        nombre: formVehiculo.nombre,
        marca: formVehiculo.marca,
        modelo: formVehiculo.modelo,
        anio: Number(formVehiculo.anio),
        tipo_motor: formVehiculo.tipo_motor,
        kilometraje_actual: Number(formVehiculo.kilometraje_actual),
        fotoUrl: fotoUrl || formVehiculo.fotoUrl || null,
      };
      if (editandoId && editandoId !== 'nuevo') await updateDoc(doc(db, 'vehiculos', editandoId), payload);
      else await addDoc(collection(db, 'vehiculos'), payload);
      reset();
    } catch (error) {
      alert('Error al guardar vehículo: ' + error.message);
    }
    setLoading(false);
  };

  const guardarHogar = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fotoUrl = await uploadCompressedImage(fotoHogarFile, 'hogares');
      const payload = {
        propietarios: [user.uid],
        nombre: formHogar.nombre,
        direccion: formHogar.direccion,
        fotoUrl: fotoUrl || formHogar.fotoUrl || null,
        servicios: formHogar.servicios || [],
      };
      if (editandoId && editandoId !== 'nuevo') await updateDoc(doc(db, 'hogares', editandoId), payload);
      else await addDoc(collection(db, 'hogares'), payload);
      reset();
    } catch (error) {
      alert('Error al guardar hogar: ' + error.message);
    }
    setLoading(false);
  };

  const guardarTarjeta = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      propietarios: [user.uid],
      nombre: formTarjeta.nombre,
      banco: formTarjeta.banco,
      marca: formTarjeta.marca,
      ultimos4: formTarjeta.ultimos4,
      diaCierre: Number(formTarjeta.diaCierre),
      diaVencimiento: Number(formTarjeta.diaVencimiento),
    };
    try {
      if (editandoId && editandoId !== 'nuevo') await updateDoc(doc(db, 'tarjetas', editandoId), payload);
      else await addDoc(collection(db, 'tarjetas'), payload);
      reset();
    } catch (error) {
      alert('Error al guardar tarjeta: ' + error.message);
    }
    setLoading(false);
  };

  const creando = editandoId === 'nuevo';

  return (
    <div className="pt-4 animate-in fade-in duration-500">
      <h2 className="text-2xl font-extrabold text-zinc-800 mb-6">Mis Entidades</h2>

      <div className="grid grid-cols-3 bg-zinc-200/50 p-1 rounded-2xl mb-6">
        <button onClick={() => cambiarTab('vehiculos')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${tab === 'vehiculos' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}>
          <CarFront size={18} /> Autos
        </button>
        <button onClick={() => cambiarTab('hogares')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${tab === 'hogares' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}>
          <Home size={18} /> Casas
        </button>
        <button onClick={() => cambiarTab('tarjetas')} className={`flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${tab === 'tarjetas' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}>
          <CreditCard size={18} /> Tarjetas
        </button>
      </div>

      {tab === 'vehiculos' && (
        <div className="space-y-6">
          {!editandoId && vehiculos.map(vehiculo => (
            <div key={vehiculo.id} className="bg-white rounded-3xl p-5 shadow-sm border border-zinc-100 flex gap-4 items-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex-shrink-0 flex items-center justify-center text-emerald-600 border border-emerald-100 overflow-hidden">
                {vehiculo.fotoUrl ? <img src={vehiculo.fotoUrl} alt={vehiculo.nombre} className="w-full h-full object-cover" /> : <CarFront size={30} />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">{vehiculo.tipo_motor || 'Motor'}</span>
                <h3 className="text-lg font-bold text-zinc-800 leading-tight">{vehiculo.nombre || 'Vehículo sin nombre'}</h3>
                <p className="text-sm text-zinc-500">{vehiculo.marca || 'Marca'} {vehiculo.modelo || 'Modelo'} {vehiculo.anio ? `(${vehiculo.anio})` : ''}</p>
                <p className="text-xs font-bold text-zinc-600 mt-1">{typeof vehiculo.kilometraje_actual === 'number' ? `${vehiculo.kilometraje_actual.toLocaleString()} KM` : 'Sin km'}</p>
              </div>
              <button onClick={() => editarVehiculo(vehiculo)} className="p-3 rounded-full bg-zinc-50 text-zinc-500">
                <Edit3 size={18} />
              </button>
            </div>
          ))}

          {!editandoId && <button onClick={() => setEditandoId('nuevo')} className="w-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold py-4 rounded-3xl flex items-center justify-center gap-2"><Plus size={20} /> Registrar Vehículo</button>}

          {editandoId && (
            <form onSubmit={guardarVehiculo} className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-zinc-800 text-lg">{creando ? 'Nuevo Vehículo' : 'Editar Vehículo'}</h3>
                <button type="button" onClick={reset} className="p-2 text-zinc-400"><X size={20} /></button>
              </div>
              <label className="flex items-center gap-3 p-4 bg-zinc-50 border border-dashed border-zinc-300 rounded-2xl cursor-pointer">
                <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center overflow-hidden text-zinc-400 border border-zinc-100">
                  {fotoVehiculoFile ? <img src={URL.createObjectURL(fotoVehiculoFile)} alt="Preview" className="w-full h-full object-cover" /> : formVehiculo.fotoUrl ? <img src={formVehiculo.fotoUrl} alt="Vehículo" className="w-full h-full object-cover" /> : <ImageIcon size={22} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-zinc-700">Foto del vehículo</p>
                  <p className="text-xs text-zinc-400">Se comprime antes de subir.</p>
                </div>
                <input type="file" accept="image/*" onChange={(e) => setFotoVehiculoFile(e.target.files?.[0] || null)} className="hidden" />
              </label>
              <input value={formVehiculo.nombre} onChange={e => setFormVehiculo({ ...formVehiculo, nombre: e.target.value })} placeholder="Apodo" required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <input value={formVehiculo.marca} onChange={e => setFormVehiculo({ ...formVehiculo, marca: e.target.value })} placeholder="Marca" required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
                <input value={formVehiculo.modelo} onChange={e => setFormVehiculo({ ...formVehiculo, modelo: e.target.value })} placeholder="Modelo" required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={formVehiculo.anio} onChange={e => setFormVehiculo({ ...formVehiculo, anio: e.target.value })} placeholder="Año" required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
                <select value={formVehiculo.tipo_motor} onChange={e => setFormVehiculo({ ...formVehiculo, tipo_motor: e.target.value })} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none">
                  <option value="Nafta">Nafta</option>
                  <option value="Gasoil">Gasoil</option>
                  <option value="Eléctrico">Eléctrico</option>
                  <option value="Híbrido">Híbrido</option>
                </select>
              </div>
              <input type="number" value={formVehiculo.kilometraje_actual} onChange={e => setFormVehiculo({ ...formVehiculo, kilometraje_actual: e.target.value })} placeholder="Kilometraje" required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
              <button type="submit" disabled={loading} className="w-full p-4 rounded-2xl font-bold text-white bg-emerald-500 disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar'}</button>
            </form>
          )}
        </div>
      )}

      {tab === 'hogares' && (
        <div className="space-y-6">
          {!editandoId && hogares.map(hogar => (
            <div key={hogar.id} className="bg-white rounded-3xl p-5 shadow-sm border border-zinc-100 flex gap-4 items-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex-shrink-0 flex items-center justify-center text-blue-600 border border-blue-100 overflow-hidden">
                {hogar.fotoUrl ? <img src={hogar.fotoUrl} alt={hogar.nombre} className="w-full h-full object-cover" /> : <Home size={28} />}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-zinc-800 leading-tight">{hogar.nombre || 'Hogar sin nombre'}</h3>
                <p className="text-sm text-zinc-500 flex items-center gap-1"><MapPin size={14} /> {hogar.direccion || 'Sin dirección'}</p>
                <p className="text-xs font-bold text-zinc-600 mt-1">{(hogar.servicios || []).length} servicios</p>
              </div>
              <button onClick={() => editarHogar(hogar)} className="p-3 rounded-full bg-zinc-50 text-zinc-500"><Edit3 size={18} /></button>
            </div>
          ))}
          {!editandoId && <button onClick={() => setEditandoId('nuevo')} className="w-full bg-blue-50 border border-blue-200 text-blue-700 font-bold py-4 rounded-3xl flex items-center justify-center gap-2"><Plus size={20} /> Registrar Hogar</button>}
          {editandoId && (
            <form onSubmit={guardarHogar} className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-zinc-800 text-lg">{creando ? 'Nuevo Hogar' : 'Editar Hogar'}</h3>
                <button type="button" onClick={reset} className="p-2 text-zinc-400"><X size={20} /></button>
              </div>
              <label className="flex items-center gap-3 p-4 bg-zinc-50 border border-dashed border-zinc-300 rounded-2xl cursor-pointer">
                <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center overflow-hidden text-zinc-400 border border-zinc-100">
                  {fotoHogarFile ? <img src={URL.createObjectURL(fotoHogarFile)} alt="Preview" className="w-full h-full object-cover" /> : formHogar.fotoUrl ? <img src={formHogar.fotoUrl} alt="Hogar" className="w-full h-full object-cover" /> : <ImageIcon size={22} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-zinc-700">Foto del hogar</p>
                  <p className="text-xs text-zinc-400">Se comprime antes de subir.</p>
                </div>
                <input type="file" accept="image/*" onChange={(e) => setFotoHogarFile(e.target.files?.[0] || null)} className="hidden" />
              </label>
              <input value={formHogar.nombre} onChange={e => setFormHogar({ ...formHogar, nombre: e.target.value })} placeholder="Nombre" required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
              <input value={formHogar.direccion} onChange={e => setFormHogar({ ...formHogar, direccion: e.target.value })} placeholder="Dirección" className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
              <div className="space-y-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Servicios</p>
                {(formHogar.servicios || []).map((servicio, index) => (
                  <div key={`${servicio.nombre}-${index}`} className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl border border-blue-100">
                    <div>
                      <p className="font-bold text-zinc-800">{servicio.nombre}</p>
                      <p className="text-xs text-zinc-500">{servicio.proveedor || 'Proveedor'} · Cuenta {servicio.numeroCuenta || '-'}</p>
                      <p className="text-xs font-bold text-blue-700">Pago día {servicio.diaPago || '-'}</p>
                    </div>
                    <button type="button" onClick={() => quitarServicio(index)} className="p-2 text-red-500"><Trash2 size={16} /></button>
                  </div>
                ))}
                {!showServicioForm && (
                  <button type="button" onClick={() => setShowServicioForm(true)} className="w-full p-3 rounded-xl bg-white border border-blue-200 text-blue-700 font-bold flex items-center justify-center gap-2">
                    <Plus size={18} /> Agregar servicio
                  </button>
                )}
                {showServicioForm && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={servicioForm.nombre} onChange={e => setServicioForm({ ...servicioForm, nombre: e.target.value })} placeholder="Servicio (UTE)" className="p-3 bg-white border border-blue-100 rounded-xl outline-none" />
                      <input value={servicioForm.proveedor} onChange={e => setServicioForm({ ...servicioForm, proveedor: e.target.value })} placeholder="Proveedor" className="p-3 bg-white border border-blue-100 rounded-xl outline-none" />
                      <input value={servicioForm.numeroCuenta} onChange={e => setServicioForm({ ...servicioForm, numeroCuenta: e.target.value })} placeholder="Nro. cuenta" className="p-3 bg-white border border-blue-100 rounded-xl outline-none" />
                      <input type="number" min="1" max="31" value={servicioForm.diaPago} onChange={e => setServicioForm({ ...servicioForm, diaPago: e.target.value })} placeholder="Día pago" className="p-3 bg-white border border-blue-100 rounded-xl outline-none" />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={agregarServicio} className="flex-1 p-3 rounded-xl bg-blue-600 text-white font-bold">Guardar servicio</button>
                      <button type="button" onClick={() => setShowServicioForm(false)} className="px-4 rounded-xl bg-white border border-blue-100 text-zinc-500 font-bold">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" disabled={loading} className="w-full p-4 rounded-2xl font-bold text-white bg-blue-600 disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar'}</button>
            </form>
          )}
        </div>
      )}

      {tab === 'tarjetas' && (
        <div className="space-y-6">
          {!editandoId && tarjetas.map(tarjeta => (
            <div key={tarjeta.id} className="bg-white rounded-3xl p-5 shadow-sm border border-zinc-100 flex gap-4 items-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex-shrink-0 flex items-center justify-center text-indigo-600 border border-indigo-100"><CreditCard size={28} /></div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-zinc-800 leading-tight">{tarjeta.nombre || `${tarjeta.marca} ${tarjeta.ultimos4 || ''}`}</h3>
                <p className="text-sm text-zinc-500">{tarjeta.banco || 'Banco'} · {tarjeta.marca || 'Marca'} {tarjeta.ultimos4 ? `•••• ${tarjeta.ultimos4}` : ''}</p>
                <p className="text-xs font-bold text-zinc-600 mt-1">Cierra {tarjeta.diaCierre || '-'} · Vence {tarjeta.diaVencimiento || '-'}</p>
              </div>
              <button onClick={() => editarTarjeta(tarjeta)} className="p-3 rounded-full bg-zinc-50 text-zinc-500"><Edit3 size={18} /></button>
            </div>
          ))}
          {!editandoId && <button onClick={() => setEditandoId('nuevo')} className="w-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold py-4 rounded-3xl flex items-center justify-center gap-2"><Plus size={20} /> Registrar Tarjeta</button>}
          {editandoId && (
            <form onSubmit={guardarTarjeta} className="bg-white p-6 rounded-3xl shadow-sm border border-zinc-100 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-zinc-800 text-lg">{creando ? 'Nueva Tarjeta' : 'Editar Tarjeta'}</h3>
                <button type="button" onClick={reset} className="p-2 text-zinc-400"><X size={20} /></button>
              </div>
              <input value={formTarjeta.nombre} onChange={e => setFormTarjeta({ ...formTarjeta, nombre: e.target.value })} placeholder="Nombre/apodo" required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
              <input value={formTarjeta.banco} onChange={e => setFormTarjeta({ ...formTarjeta, banco: e.target.value })} placeholder="Banco" required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <select value={formTarjeta.marca} onChange={e => setFormTarjeta({ ...formTarjeta, marca: e.target.value })} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none">
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="American Express">American Express</option>
                  <option value="Oca">Oca</option>
                  <option value="Otra">Otra</option>
                </select>
                <input maxLength={4} value={formTarjeta.ultimos4} onChange={e => setFormTarjeta({ ...formTarjeta, ultimos4: e.target.value })} placeholder="Últimos 4" className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" min="1" max="31" value={formTarjeta.diaCierre} onChange={e => setFormTarjeta({ ...formTarjeta, diaCierre: e.target.value })} placeholder="Día cierre" required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
                <input type="number" min="1" max="31" value={formTarjeta.diaVencimiento} onChange={e => setFormTarjeta({ ...formTarjeta, diaVencimiento: e.target.value })} placeholder="Día venc." required className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none" />
              </div>
              <button type="submit" disabled={loading} className="w-full p-4 rounded-2xl font-bold text-white bg-indigo-600 disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar'}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
