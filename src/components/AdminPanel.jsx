import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { Database, GitMerge, Plus, Shield, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import { getSubcategoriaNombre, normalizar } from '../utils/expenseUtils';

const TIPOS_DESTINO = [
  { id: 'general', label: 'General' },
  { id: 'vehiculo', label: 'Vehículo' },
  { id: 'hogar', label: 'Casa' },
  { id: 'tarjeta', label: 'Tarjeta' },
];

const normalizarEmail = (email) => email.trim().toLowerCase();

const CATEGORIAS_BASE = [
  { nombre: 'Alimentación', tipoDestino: 'general', subcategorias: ['Supermercado', 'Restaurante', 'Delivery', 'Carnicería', 'Verdulería'] },
  { nombre: 'Transporte', tipoDestino: 'general', subcategorias: ['Ómnibus', 'Taxi/App', 'Estacionamiento', 'Peajes'] },
  { nombre: 'Salud', tipoDestino: 'general', subcategorias: ['Farmacia', 'Consulta médica', 'Estudios', 'Seguro médico'] },
  { nombre: 'Educación', tipoDestino: 'general', subcategorias: ['Cuotas', 'Materiales', 'Cursos'] },
  { nombre: 'Ropa y cuidado', tipoDestino: 'general', subcategorias: ['Ropa', 'Calzado', 'Peluquería'] },
  { nombre: 'Entretenimiento', tipoDestino: 'general', subcategorias: ['Streaming', 'Salidas', 'Eventos'] },
  { nombre: 'Vehículo', tipoDestino: 'vehiculo', subcategorias: ['Combustible', 'Service', 'Seguro', 'Patente', 'Reparación', 'Lavado'] },
  { nombre: 'Casa', tipoDestino: 'hogar', subcategorias: ['UTE', 'OSE', 'Internet', 'Alquiler', 'Gastos comunes', 'Mantenimiento', 'Impuestos'] },
  { nombre: 'Tarjeta de crédito', tipoDestino: 'tarjeta', subcategorias: ['Pago de tarjeta', 'Cuotas', 'Intereses', 'Comisiones'] },
];

const EMPTY_REGLA_GLOBAL = { patron: '', tipoDestino: 'general', categoriaGrupo: '', subcategoria: '', prioridad: 10 };

const normalizarSubcategorias = (items = []) => (
  items
    .map(item => {
      const nombre = getSubcategoriaNombre(item);
      return nombre ? { nombre, fija: Boolean(item?.fija) } : null;
    })
    .filter(Boolean)
);

const unificarSubcategoriasLista = (base = [], extra = []) => {
  const resultado = normalizarSubcategorias(base);
  const existentes = new Set(resultado.map(item => normalizar(item.nombre)));

  normalizarSubcategorias(extra).forEach((subcategoria) => {
    const key = normalizar(subcategoria.nombre);
    if (!key || existentes.has(key)) return;
    existentes.add(key);
    resultado.push(subcategoria);
  });

  return resultado;
};

const commitBatchUpdates = async (updatesMap) => {
  const updates = [...updatesMap.values()];
  let total = 0;

  for (let index = 0; index < updates.length; index += 450) {
    const batch = writeBatch(db);
    updates.slice(index, index + 450).forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
    total += Math.min(450, updates.length - index);
  }

  return total;
};

export default function AdminPanel({ user }) {
  const [categorias, setCategorias] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [sugerencias, setSugerencias] = useState([]);
  const [categoriaSugerencias, setCategoriaSugerencias] = useState([]);
  const [productosAgregados, setProductosAgregados] = useState([]);
  const [reglasGlobales, setReglasGlobales] = useState([]);
  const [productoEdits, setProductoEdits] = useState({});
  const [formReglaGlobal, setFormReglaGlobal] = useState(EMPTY_REGLA_GLOBAL);
  const [editandoReglaGlobalId, setEditandoReglaGlobalId] = useState('');
  const [categoriaNombre, setCategoriaNombre] = useState('');
  const [categoriaTipo, setCategoriaTipo] = useState('general');
  const [subcategoriaPorCategoria, setSubcategoriaPorCategoria] = useState({});
  const [nuevoAdmin, setNuevoAdmin] = useState('');
  const [mergeCategoriaOrigen, setMergeCategoriaOrigen] = useState('');
  const [mergeCategoriaDestino, setMergeCategoriaDestino] = useState('');
  const [mergeSubCategoriaId, setMergeSubCategoriaId] = useState('');
  const [mergeSubOrigen, setMergeSubOrigen] = useState('');
  const [mergeSubDestino, setMergeSubDestino] = useState('');
  const [priceJobStatus, setPriceJobStatus] = useState('');
  const [seedStatus, setSeedStatus] = useState('');

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
    const unsubProductos = onSnapshot(collection(db, 'producto_precios_agregados'), (snapshot) => {
      setProductosAgregados(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubReglas = onSnapshot(collection(db, 'reglas_categorizacion_globales'), (snapshot) => {
      setReglasGlobales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubCat(); unsubAdmins(); unsubSugerencias(); unsubCategoriaSugerencias(); unsubProductos(); unsubReglas(); };
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

  const categoriasReglaGlobal = useMemo(() => (
    categoriasOrdenadas.filter(categoria => (categoria.tipoDestino || 'general') === formReglaGlobal.tipoDestino)
  ), [categoriasOrdenadas, formReglaGlobal.tipoDestino]);

  const subcategoriasReglaGlobal = useMemo(() => {
    const categoria = categoriasReglaGlobal.find(item => item.nombre === formReglaGlobal.categoriaGrupo);
    return Array.isArray(categoria?.subcategorias) ? categoria.subcategorias.map(getSubcategoriaNombre).filter(Boolean) : [];
  }, [categoriasReglaGlobal, formReglaGlobal.categoriaGrupo]);

  const rankingSugerencias = useMemo(() => {
    const grupos = new Map();
    categoriaSugerencias
      .filter(item => item.estado === 'pendiente')
      .forEach((item) => {
        const key = `${item.tipoDestino || 'general'}:${normalizar(item.nombre)}`;
        const actual = grupos.get(key) || {
          nombre: item.nombre,
          tipoDestino: item.tipoDestino || 'general',
          cantidad: 0,
          tipo: 'Categoría',
        };
        actual.cantidad += 1;
        grupos.set(key, actual);
      });

    sugerencias
      .filter(item => item.estado === 'pendiente')
      .forEach((item) => {
        const key = `${item.tipoDestino || 'general'}:${normalizar(item.categoriaNombre)}:${normalizar(item.nombre)}`;
        const actual = grupos.get(key) || {
          nombre: item.nombre,
          categoriaNombre: item.categoriaNombre,
          tipoDestino: item.tipoDestino || 'general',
          cantidad: 0,
          tipo: 'Subcategoría',
        };
        actual.cantidad += 1;
        grupos.set(key, actual);
      });

    return [...grupos.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 8);
  }, [categoriaSugerencias, sugerencias]);

  const handleAddCategoria = async () => {
    const nombre = categoriaNombre.trim();
    if (!nombre) return;

    const existente = categoriasOrdenadas.find(categoria => (
      (categoria.tipoDestino || 'general') === categoriaTipo
      && normalizar(categoria.nombre) === normalizar(nombre)
    ));

    if (existente) {
      alert('Esa categoría ya existe. Podés agregar subcategorías dentro de la existente.');
      return;
    }

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
    let categoria = categorias.find(cat => cat.id === sugerencia.categoriaId);
    if (!categoria) {
      const categoriaSugeridaId = String(sugerencia.categoriaId || '').replace('sugerida-', '');
      const categoriaSugerida = categoriaSugerencias.find(item => item.id === categoriaSugeridaId);
      if (categoriaSugerida) {
        categoria = await aprobarCategoria(categoriaSugerida);
      }
    }
    if (!categoria) return;

    const subcategorias = Array.isArray(categoria.subcategorias) ? categoria.subcategorias : [];
    const existe = subcategorias.some(sub => normalizar(getSubcategoriaNombre(sub)) === normalizar(sugerencia.nombre));

    if (!existe) {
      await updateDoc(doc(db, 'categorias', categoria.id), {
        subcategorias: [...subcategorias, { nombre: sugerencia.nombre, fija: false }],
      });
    }
    await updateDoc(doc(db, 'subcategoria_sugerencias', sugerencia.id), {
      estado: 'aprobada',
      categoriaId: categoria.id,
      categoriaNombre: categoria.nombre,
    });
  };

  const aprobarCategoria = async (sugerencia) => {
    const tipoDestino = sugerencia.tipoDestino || 'general';
    const existente = categoriasOrdenadas.find(categoria => (
      (categoria.tipoDestino || 'general') === tipoDestino
      && normalizar(categoria.nombre) === normalizar(sugerencia.nombre)
    ));

    if (existente) {
      await updateDoc(doc(db, 'categorias', existente.id), {
        subcategorias: unificarSubcategoriasLista(existente.subcategorias, sugerencia.subcategorias),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'categoria_sugerencias', sugerencia.id), {
        estado: 'aprobada',
        categoriaId: existente.id,
      });
      await migrarReferenciasCategoriaSugerida(sugerencia, existente);
      return existente;
    }

    const docRef = await addDoc(collection(db, 'categorias'), {
      nombre: sugerencia.nombre,
      tipoDestino,
      subcategorias: normalizarSubcategorias(sugerencia.subcategorias),
    });
    await updateDoc(doc(db, 'categoria_sugerencias', sugerencia.id), { estado: 'aprobada', categoriaId: docRef.id });
    const destino = { id: docRef.id, nombre: sugerencia.nombre, tipoDestino };
    await migrarReferenciasCategoriaSugerida(sugerencia, destino);
    return destino;
  };

  const cargarCategoriasBase = async () => {
    setSeedStatus('Revisando categorías base...');
    try {
      const existentes = categoriasOrdenadas;
      let creadas = 0;
      let actualizadas = 0;

      for (const categoriaBase of CATEGORIAS_BASE) {
        const existente = existentes.find(categoria => (
          (categoria.tipoDestino || 'general') === categoriaBase.tipoDestino
          && normalizar(categoria.nombre) === normalizar(categoriaBase.nombre)
        ));

        if (existente) {
          const subcategorias = unificarSubcategoriasLista(existente.subcategorias, categoriaBase.subcategorias);
          if (subcategorias.length !== (existente.subcategorias || []).length) {
            await updateDoc(doc(db, 'categorias', existente.id), {
              subcategorias,
              updatedAt: serverTimestamp(),
            });
            actualizadas += 1;
          }
        } else {
          await addDoc(collection(db, 'categorias'), {
            nombre: categoriaBase.nombre,
            tipoDestino: categoriaBase.tipoDestino,
            subcategorias: normalizarSubcategorias(categoriaBase.subcategorias),
            createdAt: serverTimestamp(),
          });
          creadas += 1;
        }
      }

      setSeedStatus(`Listo: ${creadas} creadas, ${actualizadas} actualizadas.`);
    } catch (error) {
      setSeedStatus(error.message || 'No se pudieron cargar las categorías base.');
    }
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

  const migrarReferenciasCategoriaSugerida = async (sugerencia, destino) => {
    const updates = new Map();
    const addUpdate = (ref, data) => {
      const actual = updates.get(ref.path);
      updates.set(ref.path, { ref, data: { ...(actual?.data || {}), ...data } });
    };

    const gastosPorSugerencia = await getDocs(query(collection(db, 'gastos'), where('categoriaId', '==', `sugerida-${sugerencia.id}`)));
    gastosPorSugerencia.forEach((item) => addUpdate(item.ref, {
      categoriaId: destino.id,
      categoriaGrupo: destino.nombre,
      tipoDestino: destino.tipoDestino || sugerencia.tipoDestino || 'general',
      updatedAt: serverTimestamp(),
    }));

    const subcategoriasPorSugerencia = await getDocs(query(collection(db, 'subcategoria_sugerencias'), where('categoriaId', '==', sugerencia.id)));
    subcategoriasPorSugerencia.forEach((item) => addUpdate(item.ref, {
      categoriaId: destino.id,
      categoriaNombre: destino.nombre,
    }));

    const subcategoriasPorSugerida = await getDocs(query(collection(db, 'subcategoria_sugerencias'), where('categoriaId', '==', `sugerida-${sugerencia.id}`)));
    subcategoriasPorSugerida.forEach((item) => addUpdate(item.ref, {
      categoriaId: destino.id,
      categoriaNombre: destino.nombre,
    }));

    await commitBatchUpdates(updates);
  };

  const mergeCategorias = async () => {
    if (!mergeCategoriaOrigen || !mergeCategoriaDestino || mergeCategoriaOrigen === mergeCategoriaDestino) return;

    const origen = categoriasOrdenadas.find(categoria => categoria.id === mergeCategoriaOrigen);
    const destino = categoriasOrdenadas.find(categoria => categoria.id === mergeCategoriaDestino);
    if (!origen || !destino) return;

    const subcategoriasUnificadas = unificarSubcategoriasLista(destino.subcategorias, origen.subcategorias);

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

      const updates = new Map();
      const addUpdate = (ref, data) => {
        const actual = updates.get(ref.path);
        updates.set(ref.path, { ref, data: { ...(actual?.data || {}), ...data } });
      };

      const gastosPorId = await getDocs(query(collection(db, 'gastos'), where('categoriaId', '==', origen.id)));
      gastosPorId.forEach((item) => addUpdate(item.ref, {
        categoriaId: destino.id,
        categoriaGrupo: destino.nombre,
        categoria: item.data().categoria === origen.nombre ? destino.nombre : item.data().categoria,
        updatedAt: serverTimestamp(),
      }));

      const gastosPorNombre = await getDocs(query(collection(db, 'gastos'), where('categoriaGrupo', '==', origen.nombre)));
      gastosPorNombre.forEach((item) => addUpdate(item.ref, {
        categoriaId: destino.id,
        categoriaGrupo: destino.nombre,
        categoria: item.data().categoria === origen.nombre ? destino.nombre : item.data().categoria,
        updatedAt: serverTimestamp(),
      }));

      const presupuestosPorNombre = await getDocs(query(collection(db, 'presupuestos'), where('categoriaGrupo', '==', origen.nombre)));
      presupuestosPorNombre.forEach((item) => addUpdate(item.ref, {
        categoriaGrupo: destino.nombre,
        updatedAt: serverTimestamp(),
      }));

      const sugerenciasPorCategoria = await getDocs(query(collection(db, 'subcategoria_sugerencias'), where('categoriaId', '==', origen.id)));
      sugerenciasPorCategoria.forEach((item) => addUpdate(item.ref, {
        categoriaId: destino.id,
        categoriaNombre: destino.nombre,
      }));

      await commitBatchUpdates(updates);
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

      const updates = new Map();
      const addUpdate = (ref, data) => {
        const actual = updates.get(ref.path);
        updates.set(ref.path, { ref, data: { ...(actual?.data || {}), ...data } });
      };

      const gastosPorSubcategoria = await getDocs(query(collection(db, 'gastos'), where('subcategoria', '==', mergeSubOrigen)));
      gastosPorSubcategoria.forEach((item) => {
        const data = item.data();
        if (data.categoriaGrupo !== categoriaSubMerge.nombre && data.categoriaId !== categoriaSubMerge.id) return;
        addUpdate(item.ref, {
          categoria: data.categoria === mergeSubOrigen ? mergeSubDestino : data.categoria,
          subcategoria: mergeSubDestino,
          updatedAt: serverTimestamp(),
        });
      });

      const presupuestosPorSubcategoria = await getDocs(query(collection(db, 'presupuestos'), where('subcategoria', '==', mergeSubOrigen)));
      presupuestosPorSubcategoria.forEach((item) => {
        const data = item.data();
        if (data.categoriaGrupo !== categoriaSubMerge.nombre) return;
        addUpdate(item.ref, {
          subcategoria: mergeSubDestino,
          updatedAt: serverTimestamp(),
        });
      });

      const sugerenciasPorNombre = await getDocs(query(collection(db, 'subcategoria_sugerencias'), where('nombre', '==', mergeSubOrigen)));
      sugerenciasPorNombre.forEach((item) => {
        const data = item.data();
        if (data.categoriaId !== categoriaSubMerge.id && data.categoriaNombre !== categoriaSubMerge.nombre) return;
        addUpdate(item.ref, { nombre: mergeSubDestino });
      });

      await commitBatchUpdates(updates);
      setMergeSubOrigen('');
      setMergeSubDestino('');
    } catch (error) {
      alert('Error al unificar subcategorías: ' + error.message);
    }
  };

  const actualizarPreciosAgregados = async () => {
    setPriceJobStatus('Procesando precios...');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/.netlify/functions/aggregate-product-prices', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo actualizar.');
      setPriceJobStatus(`Listo: ${data.agregados} agregados con ${data.procesados} precios procesados.`);
    } catch (error) {
      setPriceJobStatus(error.message || 'No se pudo actualizar.');
    }
  };

  const guardarProductoCanonico = async (producto) => {
    const nombre = (productoEdits[producto.id] ?? producto.adminNombreCanonico ?? producto.nombreCanonico ?? '').trim();
    if (!nombre) return;
    await updateDoc(doc(db, 'producto_precios_agregados', producto.id), {
      adminNombreCanonico: nombre,
      revisadoPorAdmin: true,
      updatedAt: serverTimestamp(),
    });
    setProductoEdits((actual) => ({ ...actual, [producto.id]: '' }));
  };

  const guardarReglaGlobal = async (e) => {
    e.preventDefault();
    const patron = formReglaGlobal.patron.trim();
    if (!patron || !formReglaGlobal.categoriaGrupo) return;

    const payload = {
      patron,
      patronNormalizado: normalizar(patron),
      tipoDestino: formReglaGlobal.tipoDestino || 'general',
      categoriaGrupo: formReglaGlobal.categoriaGrupo,
      subcategoria: formReglaGlobal.subcategoria || '',
      prioridad: Number(formReglaGlobal.prioridad || 10),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editandoReglaGlobalId) await updateDoc(doc(db, 'reglas_categorizacion_globales', editandoReglaGlobalId), payload);
      else await addDoc(collection(db, 'reglas_categorizacion_globales'), { ...payload, createdAt: serverTimestamp() });
      setFormReglaGlobal(EMPTY_REGLA_GLOBAL);
      setEditandoReglaGlobalId('');
    } catch (error) {
      alert('Error al guardar regla: ' + error.message);
    }
  };

  const editarReglaGlobal = (regla) => {
    setEditandoReglaGlobalId(regla.id);
    setFormReglaGlobal({
      patron: regla.patron || '',
      tipoDestino: regla.tipoDestino || 'general',
      categoriaGrupo: regla.categoriaGrupo || '',
      subcategoria: regla.subcategoria || '',
      prioridad: regla.prioridad || 10,
    });
  };

  return (
    <div className="pt-4 animate-in fade-in duration-500 space-y-8">
      {rankingSugerencias.length > 0 && (
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-emerald-600" />
            <h2 className="text-xl font-bold text-zinc-800">Sugerencias más repetidas</h2>
          </div>
          <div className="space-y-2">
            {rankingSugerencias.map((item) => (
              <div key={`${item.tipo}-${item.tipoDestino}-${item.categoriaNombre || ''}-${item.nombre}`} className="flex items-center justify-between gap-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="min-w-0">
                  <p className="font-black text-zinc-900 truncate">{item.nombre}</p>
                  <p className="text-xs font-bold text-zinc-400">
                    {item.tipo} · {item.categoriaNombre ? `${item.categoriaNombre} · ` : ''}{item.tipoDestino}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">{item.cantidad}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={20} className="text-emerald-600" />
          <h2 className="text-xl font-bold text-zinc-800">Reglas globales</h2>
        </div>
        <form onSubmit={guardarReglaGlobal} className="space-y-3">
          <input
            value={formReglaGlobal.patron}
            onChange={(e) => setFormReglaGlobal({ ...formReglaGlobal, patron: e.target.value })}
            className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Texto a detectar..."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              value={formReglaGlobal.tipoDestino}
              onChange={(e) => setFormReglaGlobal({ ...formReglaGlobal, tipoDestino: e.target.value, categoriaGrupo: '', subcategoria: '' })}
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {TIPOS_DESTINO.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.label}</option>)}
            </select>
            <input
              type="number"
              value={formReglaGlobal.prioridad}
              onChange={(e) => setFormReglaGlobal({ ...formReglaGlobal, prioridad: e.target.value })}
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Prioridad"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <select
              value={formReglaGlobal.categoriaGrupo}
              onChange={(e) => setFormReglaGlobal({ ...formReglaGlobal, categoriaGrupo: e.target.value, subcategoria: '' })}
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Categoría</option>
              {categoriasReglaGlobal.map(categoria => <option key={categoria.id} value={categoria.nombre}>{categoria.nombre}</option>)}
            </select>
            <select
              value={formReglaGlobal.subcategoria}
              onChange={(e) => setFormReglaGlobal({ ...formReglaGlobal, subcategoria: e.target.value })}
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Subcategoría opcional</option>
              {subcategoriasReglaGlobal.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 p-3 rounded-xl bg-emerald-500 text-white font-bold">
              {editandoReglaGlobalId ? 'Actualizar regla' : 'Guardar regla'}
            </button>
            {editandoReglaGlobalId && (
              <button type="button" onClick={() => { setEditandoReglaGlobalId(''); setFormReglaGlobal(EMPTY_REGLA_GLOBAL); }} className="px-4 rounded-xl bg-zinc-100 text-zinc-500 font-bold">
                Cancelar
              </button>
            )}
          </div>
        </form>
        <div className="mt-5 space-y-2">
          {reglasGlobales.length === 0 && <p className="text-sm text-zinc-400 text-center py-4">No hay reglas globales.</p>}
          {[...reglasGlobales].sort((a, b) => Number(b.prioridad || 0) - Number(a.prioridad || 0)).map(regla => (
            <div key={regla.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
              <div className="flex-1 min-w-0">
                <p className="font-black text-zinc-900 truncate">{regla.patron}</p>
                <p className="text-xs font-bold text-zinc-500 truncate">{regla.tipoDestino} · {regla.categoriaGrupo}{regla.subcategoria ? ` · ${regla.subcategoria}` : ''}</p>
              </div>
              <button type="button" onClick={() => editarReglaGlobal(regla)} className="px-3 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 font-bold text-xs">
                Editar
              </button>
              <button type="button" onClick={() => handleDelete('reglas_categorizacion_globales', regla.id)} className="p-2 rounded-xl bg-red-50 text-red-500">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
        <div className="flex items-center gap-2 mb-4">
          <Database size={20} className="text-indigo-600" />
          <h2 className="text-xl font-bold text-zinc-800">Precios de supermercado</h2>
        </div>
        <p className="text-sm text-zinc-500 leading-6 mb-4">
          Agrupa precios de tickets en estadísticas anónimas. Solo publica productos con mínimo de muestras para evitar identificar compras individuales.
        </p>
        <button onClick={actualizarPreciosAgregados} className="w-full p-3 rounded-xl bg-indigo-600 text-white font-bold">
          Actualizar agregados
        </button>
        {priceJobStatus && <p className="mt-3 text-sm font-bold text-zinc-600">{priceJobStatus}</p>}
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
        <div className="flex items-center gap-2 mb-4">
          <Database size={20} className="text-zinc-700" />
          <h2 className="text-xl font-bold text-zinc-800">Productos canonizados</h2>
        </div>
        <div className="space-y-3">
          {productosAgregados.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-6">Todavía no hay productos agregados.</p>
          )}
          {[...productosAgregados]
            .sort((a, b) => (b.muestras || 0) - (a.muestras || 0))
            .slice(0, 50)
            .map(producto => (
              <div key={producto.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{producto.key}</p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={productoEdits[producto.id] ?? producto.adminNombreCanonico ?? producto.nombreCanonico ?? ''}
                    onChange={(e) => setProductoEdits((actual) => ({ ...actual, [producto.id]: e.target.value }))}
                    className="flex-1 p-3 bg-white border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                  <button onClick={() => guardarProductoCanonico(producto)} className="px-4 rounded-xl bg-zinc-900 text-white font-bold">
                    OK
                  </button>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {producto.muestras || 0} muestras · Promedio {producto.moneda === 'USD' ? 'US$' : '$'}{Number(producto.promedio || 0).toFixed(0)} · {producto.periodo}
                </p>
              </div>
            ))}
        </div>
      </div>

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-zinc-800">Categorías</h2>
            <p className="text-sm text-zinc-500">Mantené pocas categorías madres y usá subcategorías para el detalle real.</p>
          </div>
          <button onClick={cargarCategoriasBase} className="px-4 py-3 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-sm">
            Cargar base
          </button>
        </div>
        {seedStatus && <p className="mb-4 text-sm font-bold text-zinc-600">{seedStatus}</p>}
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
