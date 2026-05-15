import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { GitMerge, Plus, Shield, Trash2 } from 'lucide-react';
import { getSubcategoriaNombre, normalizar } from '../utils/expenseUtils';

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
  const [mergeCategoriaOrigen, setMergeCategoriaOrigen] = useState('');
  const [mergeCategoriaDestino, setMergeCategoriaDestino] = useState('');
  const [mergeSubCategoriaId, setMergeSubCategoriaId] = useState('');
  const [mergeSubOrigen, setMergeSubOrigen] = useState('');
  const [mergeSubDestino, setMergeSubDestino] = useState('');

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
    categorias
      .filter(categoria => !categoria.mergedInto)
      .sort((a, b) => `${a.tipoDestino || 'general'}-${a.nombre}`.localeCompare(`${b.tipoDestino || 'general'}-${b.nombre}`))
  ), [categorias]);

  const categoriasParecidas = useMemo(() => {
    const grupos = new Map();
    categoriasOrdenadas.forEach((categoria) => {
      const key = `${categoria.tipoDestino || 'general'}:${normalizar(categoria.nombre).replace(/\s+/g, ' ').trim()}`;
      const existentes = grupos.get(key) || [];
      grupos.set(key, [...existentes, categoria]);
    });
    return [...grupos.values()].filter(grupo => grupo.length > 1);
  }, [categoriasOrdenadas]);

  const categoriaSubMerge = useMemo(() => (
    categoriasOrdenadas.find(categoria => categoria.id === mergeSubCategoriaId)
  ), [categoriasOrdenadas, mergeSubCategoriaId]);

  const subcategoriasMerge = useMemo(() => (
    Array.isArray(categoriaSubMerge?.subcategorias)
      ? categoriaSubMerge.subcategorias.map(getSubcategoriaNombre).filter(Boolean)
      : []
  ), [categoriaSubMerge]);

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
    const existe = subcategorias.some(sub => normalizar(getSubcategoriaNombre(sub)) === normalizar(nombre));
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
    const nuevas = subcategorias.filter(sub => getSubcategoriaNombre(sub) !== subcategoriaNombre);
    await updateDoc(doc(db, 'categorias', categoria.id), { subcategorias: nuevas });
  };

  const aprobarSugerencia = async (sugerencia) => {
    const categoria = categorias.find(cat => cat.id === sugerencia.categoriaId);
    if (!categoria) return;

    const subcategorias = Array.isArray(categoria.subcategorias) ? categoria.subcategorias : [];
    const existe = subcategorias.some(sub => normalizar(getSubcategoriaNombre(sub)) === normalizar(sugerencia.nombre));

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

  const mergeCategorias = async () => {
    if (!mergeCategoriaOrigen || !mergeCategoriaDestino || mergeCategoriaOrigen === mergeCategoriaDestino) return;

    const origen = categoriasOrdenadas.find(categoria => categoria.id === mergeCategoriaOrigen);
    const destino = categoriasOrdenadas.find(categoria => categoria.id === mergeCategoriaDestino);
    if (!origen || !destino) return;

    const subcategoriasDestino = Array.isArray(destino.subcategorias) ? destino.subcategorias : [];
    const subcategoriasOrigen = Array.isArray(origen.subcategorias) ? origen.subcategorias : [];
    const nombresDestino = new Set(subcategoriasDestino.map(sub => normalizar(getSubcategoriaNombre(sub))));
    const subcategoriasUnificadas = [
      ...subcategoriasDestino,
      ...subcategoriasOrigen.filter(sub => {
        const nombre = normalizar(getSubcategoriaNombre(sub));
        if (!nombre || nombresDestino.has(nombre)) return false;
        nombresDestino.add(nombre);
        return true;
      }),
    ];

    try {
      await updateDoc(doc(db, 'categorias', destino.id), {
        subcategorias: subcategoriasUnificadas,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'categorias', origen.id), {
        mergedInto: destino.id,
        mergedIntoNombre: destino.nombre,
        mergedAt: serverTimestamp(),
      });
      setMergeCategoriaOrigen('');
      setMergeCategoriaDestino('');
    } catch (error) {
      alert('Error al unificar categorías: ' + error.message);
    }
  };

  const mergeSubcategorias = async () => {
    if (!categoriaSubMerge || !mergeSubOrigen || !mergeSubDestino || mergeSubOrigen === mergeSubDestino) return;

    const subcategorias = Array.isArray(categoriaSubMerge.subcategorias) ? categoriaSubMerge.subcategorias : [];
    const destinoExiste = subcategorias.some(sub => normalizar(getSubcategoriaNombre(sub)) === normalizar(mergeSubDestino));
    const nuevas = subcategorias.filter(sub => normalizar(getSubcategoriaNombre(sub)) !== normalizar(mergeSubOrigen));

    if (!destinoExiste) {
      nuevas.push({ nombre: mergeSubDestino, fija: false });
    }

    try {
      await updateDoc(doc(db, 'categorias', categoriaSubMerge.id), {
        subcategorias: nuevas,
        updatedAt: serverTimestamp(),
      });
      setMergeSubOrigen('');
      setMergeSubDestino('');
    } catch (error) {
      alert('Error al unificar subcategorías: ' + error.message);
    }
  };

  return (
    <div className="pt-4 animate-in fade-in duration-500 space-y-8">
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
        <div className="flex items-center gap-2 mb-4">
          <GitMerge size={20} className="text-emerald-600" />
          <h2 className="text-xl font-bold text-zinc-800">Unificar duplicados</h2>
        </div>

        {categoriasParecidas.length > 0 && (
          <div className="mb-5 rounded-2xl bg-amber-50 border border-amber-100 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">Posibles duplicados</p>
            <div className="space-y-1">
              {categoriasParecidas.map((grupo) => (
                <p key={grupo.map(item => item.id).join('-')} className="text-sm text-amber-900">
                  {grupo.map(item => item.nombre).join(' / ')} · {grupo[0].tipoDestino || 'general'}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Categorías</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              value={mergeCategoriaOrigen}
              onChange={(e) => setMergeCategoriaOrigen(e.target.value)}
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Categoría a fusionar</option>
              {categoriasOrdenadas.map(categoria => (
                <option key={categoria.id} value={categoria.id}>{categoria.nombre} · {categoria.tipoDestino || 'general'}</option>
              ))}
            </select>
            <select
              value={mergeCategoriaDestino}
              onChange={(e) => setMergeCategoriaDestino(e.target.value)}
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Categoría final</option>
              {categoriasOrdenadas.map(categoria => (
                <option key={categoria.id} value={categoria.id}>{categoria.nombre} · {categoria.tipoDestino || 'general'}</option>
              ))}
            </select>
          </div>
          <button
            onClick={mergeCategorias}
            disabled={!mergeCategoriaOrigen || !mergeCategoriaDestino || mergeCategoriaOrigen === mergeCategoriaDestino}
            className="w-full p-3 rounded-xl bg-zinc-900 text-white font-bold disabled:opacity-40"
          >
            Unificar categorías
          </button>
        </div>

        <div className="space-y-3 mt-6">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Subcategorías</p>
          <select
            value={mergeSubCategoriaId}
            onChange={(e) => {
              setMergeSubCategoriaId(e.target.value);
              setMergeSubOrigen('');
              setMergeSubDestino('');
            }}
            className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Elegí una categoría</option>
            {categoriasOrdenadas.map(categoria => (
              <option key={categoria.id} value={categoria.id}>{categoria.nombre} · {categoria.tipoDestino || 'general'}</option>
            ))}
          </select>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              value={mergeSubOrigen}
              onChange={(e) => setMergeSubOrigen(e.target.value)}
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Subcategoría a fusionar</option>
              {subcategoriasMerge.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
            </select>
            <select
              value={mergeSubDestino}
              onChange={(e) => setMergeSubDestino(e.target.value)}
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Subcategoría final</option>
              {subcategoriasMerge.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
            </select>
          </div>
          <button
            onClick={mergeSubcategorias}
            disabled={!mergeSubOrigen || !mergeSubDestino || mergeSubOrigen === mergeSubDestino}
            className="w-full p-3 rounded-xl bg-zinc-900 text-white font-bold disabled:opacity-40"
          >
            Unificar subcategorías
          </button>
        </div>
      </div>

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
