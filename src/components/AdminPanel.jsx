import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { Plus, Shield, Trash2 } from 'lucide-react';

const TIPOS_DESTINO = [
  { id: 'general', label: 'General' },
  { id: 'vehiculo', label: 'Vehículo' },
  { id: 'hogar', label: 'Casa' },
  { id: 'tarjeta', label: 'Tarjeta' },
];

const normalizarEmail = (email) => email.trim().toLowerCase();

export default function AdminPanel() {
  const [categorias, setCategorias] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [sugerencias, setSugerencias] = useState([]);
  const [categoriaSugerencias, setCategoriaSugerencias] = useState([]);
  const [categoriaNombre, setCategoriaNombre] = useState('');
  const [categoriaTipo, setCategoriaTipo] = useState('general');
  const [subcategoriaPorCategoria, setSubcategoriaPorCategoria] = useState({});
  const [nuevoAdmin, setNuevoAdmin] = useState('');

  useEffect(() => {
    const unsubCat = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      setCategorias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubAdmins = onSnapshot(collection(db, 'admins'), (snapshot) => {
      setAdmins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubSugerencias = onSnapshot(collection(db, 'subcategoria_sugerencias'), (snapshot) => {
      setSugerencias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubCategoriaSugerencias = onSnapshot(collection(db, 'categoria_sugerencias'), (snapshot) => {
      setCategoriaSugerencias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubCat(); unsubAdmins(); unsubSugerencias(); unsubCategoriaSugerencias(); };
  }, []);

  const categoriasOrdenadas = useMemo(() => (
    [...categorias].sort((a, b) => `${a.tipoDestino || 'general'}-${a.nombre}`.localeCompare(`${b.tipoDestino || 'general'}-${b.nombre}`))
  ), [categorias]);

  const handleAddCategoria = async () => {
    const nombre = categoriaNombre.trim();
    if (!nombre) return;

    try {
      await addDoc(collection(db, 'categorias'), {
        nombre,
        tipoDestino: categoriaTipo,
        subcategorias: [],
      });
      setCategoriaNombre('');
    } catch (error) {
      alert('Error al guardar categoría: ' + error.message);
    }
  };

  const handleAddSubcategoria = async (categoria) => {
    const nombre = subcategoriaPorCategoria[categoria.id]?.trim();
    if (!nombre) return;

    const subcategorias = Array.isArray(categoria.subcategorias) ? categoria.subcategorias : [];
    const existe = subcategorias.some(sub => (typeof sub === 'string' ? sub : sub.nombre) === nombre);
    if (existe) return;

    try {
      await updateDoc(doc(db, 'categorias', categoria.id), {
        subcategorias: [...subcategorias, { nombre, fija: false }],
      });
      setSubcategoriaPorCategoria((actual) => ({ ...actual, [categoria.id]: '' }));
    } catch (error) {
      alert('Error al guardar subcategoría: ' + error.message);
    }
  };

  const handleDeleteSubcategoria = async (categoria, subcategoriaNombre) => {
    const subcategorias = Array.isArray(categoria.subcategorias) ? categoria.subcategorias : [];
    const nuevas = subcategorias.filter(sub => (typeof sub === 'string' ? sub : sub.nombre) !== subcategoriaNombre);
    await updateDoc(doc(db, 'categorias', categoria.id), { subcategorias: nuevas });
  };

  const aprobarSugerencia = async (sugerencia) => {
    const categoria = categorias.find(cat => cat.id === sugerencia.categoriaId);
    if (!categoria) return;

    const subcategorias = Array.isArray(categoria.subcategorias) ? categoria.subcategorias : [];
    const existe = subcategorias.some(sub => (typeof sub === 'string' ? sub : sub.nombre) === sugerencia.nombre);

    if (!existe) {
      await updateDoc(doc(db, 'categorias', categoria.id), {
        subcategorias: [...subcategorias, { nombre: sugerencia.nombre, fija: false }],
      });
    }
    await updateDoc(doc(db, 'subcategoria_sugerencias', sugerencia.id), { estado: 'aprobada' });
  };

  const aprobarCategoria = async (sugerencia) => {
    await addDoc(collection(db, 'categorias'), {
      nombre: sugerencia.nombre,
      tipoDestino: sugerencia.tipoDestino || 'general',
      subcategorias: sugerencia.subcategorias || [],
    });
    await updateDoc(doc(db, 'categoria_sugerencias', sugerencia.id), { estado: 'aprobada' });
  };

  const handleAddAdmin = async () => {
    const email = normalizarEmail(nuevoAdmin);
    if (!email) return;
    try {
      await setDoc(doc(db, 'admins', email), { email });
      setNuevoAdmin('');
    } catch (error) {
      alert('Error al guardar admin: ' + error.message);
    }
  };

  const handleDelete = async (coleccion, id) => {
    if (window.confirm('¿Eliminar este ítem?')) {
      await deleteDoc(doc(db, coleccion, id));
    }
  };

  return (
    <div className="pt-4 animate-in fade-in duration-500 space-y-8">
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
        <h2 className="text-xl font-bold text-zinc-800 mb-4">Categorías</h2>
        <div className="space-y-3 mb-5">
          <input
            type="text"
            value={categoriaNombre}
            onChange={(e) => setCategoriaNombre(e.target.value)}
            className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Nueva categoría..."
          />
          <div className="flex gap-2">
            <select
              value={categoriaTipo}
              onChange={(e) => setCategoriaTipo(e.target.value)}
              className="flex-1 p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {TIPOS_DESTINO.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.label}</option>)}
            </select>
            <button onClick={handleAddCategoria} className="bg-zinc-900 text-white p-3 rounded-xl hover:bg-zinc-800">
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {categoriasOrdenadas.map(categoria => (
            <div key={categoria.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="flex justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">{categoria.tipoDestino || 'general'}</span>
                  <h3 className="font-bold text-zinc-800">{categoria.nombre}</h3>
                </div>
                <button onClick={() => handleDelete('categorias', categoria.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={subcategoriaPorCategoria[categoria.id] || ''}
                  onChange={(e) => setSubcategoriaPorCategoria((actual) => ({ ...actual, [categoria.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategoria(categoria)}
                  className="flex-1 p-2 bg-white border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Nueva subcategoría..."
                />
                <button onClick={() => handleAddSubcategoria(categoria)} className="bg-white border border-zinc-200 text-zinc-700 p-2 rounded-xl">
                  <Plus size={18} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {(categoria.subcategorias || []).map((sub) => {
                  const nombre = typeof sub === 'string' ? sub : sub.nombre;
                  return (
                    <button
                      key={nombre}
                      onClick={() => handleDeleteSubcategoria(categoria, nombre)}
                      className="px-3 py-1 rounded-full bg-white border border-zinc-200 text-xs font-semibold text-zinc-600 hover:text-red-500"
                    >
                      {nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
        <h2 className="text-xl font-bold text-zinc-800 mb-4">Categorías sugeridas</h2>
        <div className="space-y-2">
          {categoriaSugerencias.filter(s => s.estado === 'pendiente').length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-6">No hay categorías pendientes.</p>
          )}
          {categoriaSugerencias.filter(s => s.estado === 'pendiente').map(sugerencia => (
            <div key={sugerencia.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <p className="font-bold text-zinc-800">{sugerencia.nombre}</p>
              <p className="text-xs text-zinc-500 mb-3">{sugerencia.tipoDestino}</p>
              <div className="flex gap-2">
                <button onClick={() => aprobarCategoria(sugerencia)} className="flex-1 p-3 rounded-xl bg-emerald-500 text-white font-bold text-sm">Aprobar</button>
                <button onClick={() => updateDoc(doc(db, 'categoria_sugerencias', sugerencia.id), { estado: 'rechazada' })} className="flex-1 p-3 rounded-xl bg-zinc-200 text-zinc-600 font-bold text-sm">Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
        <h2 className="text-xl font-bold text-zinc-800 mb-4">Subcategorías sugeridas</h2>
        <div className="space-y-2">
          {sugerencias.filter(s => s.estado === 'pendiente').length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-6">No hay sugerencias pendientes.</p>
          )}
          {sugerencias.filter(s => s.estado === 'pendiente').map(sugerencia => (
            <div key={sugerencia.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
              <p className="font-bold text-zinc-800">{sugerencia.nombre}</p>
              <p className="text-xs text-zinc-500 mb-3">{sugerencia.categoriaNombre} · {sugerencia.tipoDestino}</p>
              <div className="flex gap-2">
                <button onClick={() => aprobarSugerencia(sugerencia)} className="flex-1 p-3 rounded-xl bg-emerald-500 text-white font-bold text-sm">Aprobar</button>
                <button onClick={() => updateDoc(doc(db, 'subcategoria_sugerencias', sugerencia.id), { estado: 'rechazada' })} className="flex-1 p-3 rounded-xl bg-zinc-200 text-zinc-600 font-bold text-sm">Rechazar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={20} className="text-zinc-700" />
          <h2 className="text-xl font-bold text-zinc-800">Admins</h2>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            type="email"
            value={nuevoAdmin}
            onChange={(e) => setNuevoAdmin(e.target.value)}
            className="flex-1 p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="email@dominio.com"
          />
          <button onClick={handleAddAdmin} className="bg-zinc-900 text-white p-3 rounded-xl hover:bg-zinc-800">
            <Plus size={20} />
          </button>
        </div>
        <ul className="space-y-2">
          {admins.map(admin => (
            <li key={admin.id} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <span className="font-medium text-zinc-700">{admin.email || admin.id}</span>
              <button onClick={() => handleDelete('admins', admin.id)} className="text-red-400 hover:text-red-600">
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
