import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { Trash2, Plus } from 'lucide-react';

export default function AdminPanel() {
  const [categorias, setCategorias] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [nuevaCat, setNuevaCat] = useState('');
  const [nuevaUbi, setNuevaUbi] = useState('');

  // onSnapshot escucha los cambios en tiempo real
  useEffect(() => {
    const unsubCat = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      setCategorias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubUbi = onSnapshot(collection(db, 'ubicaciones'), (snapshot) => {
      setUbicaciones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => { unsubCat(); unsubUbi(); };
  }, []);

  const handleAdd = async (coleccion, valor, setValor) => {
    if (!valor.trim()) return;
    try {
      await addDoc(collection(db, coleccion), { nombre: valor });
      setValor('');
    } catch (error) {
      alert('Error al guardar: ' + error.message);
    }
  };

  const handleDelete = async (coleccion, id) => {
    if (window.confirm('¿Eliminar este ítem?')) {
      await deleteDoc(doc(db, coleccion, id));
    }
  };

  return (
    <div className="pt-4 animate-in fade-in duration-500 space-y-8">
      
      {/* Sección Categorías */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
        <h2 className="text-xl font-bold text-zinc-800 mb-4">Categorías</h2>
        <div className="flex gap-2 mb-4">
          <input 
            type="text" value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)}
            className="flex-1 p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Nueva categoría..."
          />
          <button onClick={() => handleAdd('categorias', nuevaCat, setNuevaCat)} className="bg-zinc-900 text-white p-3 rounded-xl hover:bg-zinc-800">
            <Plus size={20} />
          </button>
        </div>
        <ul className="space-y-2">
          {categorias.map(c => (
            <li key={c.id} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <span className="font-medium text-zinc-700">{c.nombre}</span>
              <button onClick={() => handleDelete('categorias', c.id)} className="text-red-400 hover:text-red-600">
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Sección Ubicaciones */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100">
        <h2 className="text-xl font-bold text-zinc-800 mb-4">Ubicaciones</h2>
        <div className="flex gap-2 mb-4">
          <input 
            type="text" value={nuevaUbi} onChange={(e) => setNuevaUbi(e.target.value)}
            className="flex-1 p-3 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Nueva ubicación..."
          />
          <button onClick={() => handleAdd('ubicaciones', nuevaUbi, setNuevaUbi)} className="bg-zinc-900 text-white p-3 rounded-xl hover:bg-zinc-800">
            <Plus size={20} />
          </button>
        </div>
        <ul className="space-y-2">
          {ubicaciones.map(u => (
            <li key={u.id} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <span className="font-medium text-zinc-700">{u.nombre}</span>
              <button onClick={() => handleDelete('ubicaciones', u.id)} className="text-red-400 hover:text-red-600">
                <Trash2 size={18} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      
    </div>
  );
}