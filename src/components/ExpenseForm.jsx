import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../firebase';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, Timestamp, where, writeBatch } from 'firebase/firestore';
import { CarFront, CreditCard, FileText, Home, Mic, Plus, Sparkles, Wallet, X } from 'lucide-react';
import { extractTextFromDocument } from '../utils/localOcr';
import { canonicalProductKey, dateInputToDate, getSubcategoriaNombre, normalizar, normalizarProducto, suggestionToExpensePayload, todayInputValue } from '../utils/expenseUtils';

const TIPOS_DESTINO = [
  { id: 'general', label: 'General', icon: Wallet },
  { id: 'vehiculo', label: 'Vehículo', icon: CarFront },
  { id: 'hogar', label: 'Casa', icon: Home },
  { id: 'tarjeta', label: 'Tarjeta', icon: CreditCard },
];

const PLANTILLAS_RAPIDAS = [
  { label: 'Super', tipoDestino: 'general', categoria: 'Alimentación', subcategoria: 'Supermercado' },
  { label: 'Nafta', tipoDestino: 'vehiculo', categoria: 'Vehículo', subcategoria: 'Combustible' },
  { label: 'UTE', tipoDestino: 'hogar', categoria: 'Casa', subcategoria: 'UTE' },
  { label: 'OSE', tipoDestino: 'hogar', categoria: 'Casa', subcategoria: 'OSE' },
  { label: 'Tarjeta', tipoDestino: 'tarjeta', categoria: 'Tarjeta de crédito', subcategoria: 'Pago de tarjeta' },
];

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const fileSourceType = (file) => {
  if (!file) return 'document';
  return /\.(csv|tsv|xlsx|xls)$/i.test(file.name || '') ? 'spreadsheet' : 'document';
};

const fechaSugeridaToTimestamp = (fecha) => {
  if (!fecha) return serverTimestamp();
  const date = dateInputToDate(fecha);
  return Timestamp.fromDate(date);
};

const fechaComparable = (fecha) => {
  if (!fecha) return '';
  const date = fecha?.toDate?.() || (fecha instanceof Date ? fecha : dateInputToDate(fecha));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const duplicateKey = ({ fecha, monto, moneda, descripcion = '', categoriaGrupo = '', subcategoria = '' }) => (
  [
    fechaComparable(fecha),
    Number(monto || 0).toFixed(2),
    moneda || 'UYU',
    normalizar(`${descripcion} ${categoriaGrupo} ${subcategoria}`).replace(/\s+/g, ' ').trim(),
  ].join('|')
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

const inputDateFromOffset = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function ExpenseForm({ user, initialAction = 'manual', onSaved }) {
  const fileInputRef = useRef(null);
  const autoStartedRef = useRef(false);
  const autoAnalyzedFileRef = useRef('');
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState('UYU');
  const [tipoDestino, setTipoDestino] = useState('general');
  const [categoriaId, setCategoriaId] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [vehiculoId, setVehiculoId] = useState('');
  const [hogarId, setHogarId] = useState('');
  const [tarjetaId, setTarjetaId] = useState('');
  const [fechaGasto, setFechaGasto] = useState(todayInputValue());
  const [comentario, setComentario] = useState('');
  const [estadoCuentaFile, setEstadoCuentaFile] = useState(null);
  const [subcategoriaSugerida, setSubcategoriaSugerida] = useState('');
  const [categoriaSugerida, setCategoriaSugerida] = useState('');
  const [showCategoriaInput, setShowCategoriaInput] = useState(false);
  const [showSubcategoriaInput, setShowSubcategoriaInput] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [documentStatus, setDocumentStatus] = useState('');
  const [documentSuggestions, setDocumentSuggestions] = useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState({});
  const [ocrText, setOcrText] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState('documento');
  const [processingReview, setProcessingReview] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [detalles, setDetalles] = useState({});
  const [loading, setLoading] = useState(false);

  const [categorias, setCategorias] = useState([]);
  const [categoriasUsuario, setCategoriasUsuario] = useState([]);
  const [gastosExistentes, setGastosExistentes] = useState([]);
  const [reglasUsuario, setReglasUsuario] = useState([]);
  const [reglasGlobales, setReglasGlobales] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [hogares, setHogares] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);

  useEffect(() => {
    const unsubCat = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      setCategorias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const sugerenciasQuery = query(collection(db, 'categoria_sugerencias'), where('userId', '==', user.uid));
    const unsubCatUsuario = onSnapshot(sugerenciasQuery, (snapshot) => {
      setCategoriasUsuario(snapshot.docs.map(doc => ({ id: `sugerida-${doc.id}`, sugerenciaId: doc.id, ...doc.data(), esSugerida: true })));
    });
    return () => { unsubCat(); unsubCatUsuario(); };
  }, [user.uid]);

  useEffect(() => {
    const gastosQuery = query(collection(db, 'gastos'), where('userId', '==', user.uid));
    const reglasQuery = query(collection(db, 'reglas_categorizacion'), where('userId', '==', user.uid));
    const unsubGastos = onSnapshot(gastosQuery, (snapshot) => {
      setGastosExistentes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubReglas = onSnapshot(reglasQuery, (snapshot) => {
      setReglasUsuario(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubReglasGlobales = onSnapshot(collection(db, 'reglas_categorizacion_globales'), (snapshot) => {
      setReglasGlobales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), global: true })));
    });
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

    return () => { unsubGastos(); unsubReglas(); unsubReglasGlobales(); unsubVehiculos(); unsubHogares(); unsubTarjetas(); };
  }, [user.uid]);

  const categoriasDisponibles = useMemo(() => {
    const globales = categorias.filter(categoria => !categoria.mergedInto);
    const globalKeys = new Set(globales.map(categoria => `${categoria.tipoDestino || 'general'}:${normalizar(categoria.nombre)}`));
    const propias = categoriasUsuario.filter(categoria => (
      categoria.estado !== 'rechazada'
      && !categoria.mergedInto
      && !globalKeys.has(`${categoria.tipoDestino || 'general'}:${normalizar(categoria.nombre)}`)
    ));
    return [...globales, ...propias];
  }, [categorias, categoriasUsuario]);

  const categoriasFiltradas = useMemo(() => (
    categoriasDisponibles.filter(categoria => (categoria.tipoDestino || 'general') === tipoDestino)
  ), [categoriasDisponibles, tipoDestino]);

  const categoriaSeleccionada = categoriasDisponibles.find(categoria => categoria.id === categoriaId);
  const subcategorias = useMemo(() => (
    Array.isArray(categoriaSeleccionada?.subcategorias) ? categoriaSeleccionada.subcategorias : []
  ), [categoriaSeleccionada]);
  const camposExtra = campoExtra(subcategoria, tipoDestino);
  const duplicateKeysExistentes = useMemo(() => (
    new Set(gastosExistentes.map(gasto => duplicateKey({
      fecha: gasto.fecha,
      monto: gasto.monto,
      moneda: gasto.moneda || 'UYU',
      descripcion: gasto.detalles?.descripcion || gasto.detalles?.comentario || gasto.categoria || '',
      categoriaGrupo: gasto.categoriaGrupo || '',
      subcategoria: gasto.subcategoria || '',
    })))
  ), [gastosExistentes]);

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

  const getCategoriaNombre = () => categoriaSeleccionada?.nombre || '';

  const encontrarCategoria = (nombre, destino = tipoDestino) => (
    categoriasDisponibles.find(categoria => (
      (categoria.tipoDestino || 'general') === destino
      && normalizar(categoria.nombre) === normalizar(nombre)
    ))
  );

  const aplicarPlantilla = (plantilla) => {
    const categoria = encontrarCategoria(plantilla.categoria, plantilla.tipoDestino);
    setTipoDestino(plantilla.tipoDestino);
    setCategoriaId(categoria?.id || '');
    setSubcategoria(plantilla.subcategoria);
  };

  const reglaParaTexto = (texto = '') => {
    const normalizado = normalizar(texto);
    return [...reglasUsuario, ...reglasGlobales]
      .filter(regla => regla.patron && normalizado.includes(normalizar(regla.patron)))
      .sort((a, b) => Number(b.prioridad || 0) - Number(a.prioridad || 0))[0];
  };

  const aplicarReglasLocales = (sugerencias) => sugerencias.map((sugerencia) => {
    const regla = reglaParaTexto(`${sugerencia.descripcion || ''} ${sugerencia.categoriaGrupo || ''} ${sugerencia.subcategoria || ''}`);
    if (!regla) return sugerencia;

    const deberiaAplicar = !sugerencia.categoriaGrupo || Number(sugerencia.confianza || 0) < 0.82;
    if (!deberiaAplicar) return sugerencia;

    return {
      ...sugerencia,
      tipoDestino: regla.tipoDestino || sugerencia.tipoDestino || 'general',
      categoriaGrupo: regla.categoriaGrupo || sugerencia.categoriaGrupo || '',
      subcategoria: regla.subcategoria || sugerencia.subcategoria || '',
      notas: `${sugerencia.notas || ''}${sugerencia.notas ? ' ' : ''}Aplicado por regla: ${regla.patron}.`.trim(),
    };
  });

  const sugerirCategoria = async () => {
    const nombre = categoriaSugerida.trim();
    if (!nombre) return;

    const existente = categoriasDisponibles.find(categoria => (
      (categoria.tipoDestino || 'general') === tipoDestino
      && normalizar(categoria.nombre) === normalizar(nombre)
    ));

    if (existente) {
      setCategoriaId(existente.id);
      setCategoriaSugerida('');
      setShowCategoriaInput(false);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'categoria_sugerencias'), {
        userId: user.uid,
        nombre,
        tipoDestino,
        subcategorias: [],
        estado: 'pendiente',
        fecha: serverTimestamp(),
      });
      setCategoriaId(`sugerida-${docRef.id}`);
      setCategoriaSugerida('');
      setShowCategoriaInput(false);
    } catch (error) {
      alert('Error al sugerir categoría: ' + error.message);
    }
  };

  const sugerirSubcategoria = async () => {
    const nombre = subcategoriaSugerida.trim();
    if (!nombre || !categoriaId) return;

    const existente = subcategorias.find(sub => normalizar(getSubcategoriaNombre(sub)) === normalizar(nombre));
    if (existente) {
      setSubcategoria(getSubcategoriaNombre(existente));
      setSubcategoriaSugerida('');
      setShowSubcategoriaInput(false);
      return;
    }

    try {
      await addDoc(collection(db, 'subcategoria_sugerencias'), {
        userId: user.uid,
        categoriaId: categoriaSeleccionada?.sugerenciaId || categoriaId,
        categoriaNombre: getCategoriaNombre(),
        tipoDestino,
        nombre,
        estado: 'pendiente',
        fecha: serverTimestamp(),
      });
      setSubcategoria(nombre);
      setShowSubcategoriaInput(false);
    } catch (error) {
      alert('Error al sugerir subcategoría: ' + error.message);
    }
  };

  const fechaDesdeTextoVoz = (texto) => {
    const limpio = normalizar(texto);
    if (limpio.includes('anteayer')) return inputDateFromOffset(-2);
    if (limpio.includes('ayer')) return inputDateFromOffset(-1);
    return todayInputValue();
  };

  const detectarCategoriaVoz = (texto) => {
    const limpio = normalizar(texto);
    const buscar = (categoriaNombre, subcategoriaNombre, tipoDestinoDefault = 'general') => {
      const categoria = encontrarCategoria(categoriaNombre, tipoDestinoDefault);
      return {
        tipoDestino: categoria?.tipoDestino || tipoDestinoDefault,
        categoriaGrupo: categoria?.nombre || categoriaNombre,
        subcategoria: subcategoriaNombre,
      };
    };

    if (/(nafta|combustible|ancap|axion|shell|petrobras)/.test(limpio)) return buscar('Vehículo', 'Combustible', 'vehiculo');
    if (/(service|taller|mecanico|mecanico|reparacion auto|cubierta|neumatico)/.test(limpio)) return buscar('Vehículo', 'Service', 'vehiculo');
    if (/(ute|luz|energia electrica)/.test(limpio)) return buscar('Casa', 'UTE', 'hogar');
    if (/(ose|agua)/.test(limpio)) return buscar('Casa', 'OSE', 'hogar');
    if (/(antel|internet|wifi|fibra)/.test(limpio)) return buscar('Casa', 'Internet', 'hogar');
    if (/(alquiler|gastos comunes)/.test(limpio)) return buscar('Casa', limpio.includes('gastos comunes') ? 'Gastos comunes' : 'Alquiler', 'hogar');
    if (/(tarjeta|visa|master|mastercard|oca)/.test(limpio)) return buscar('Tarjeta de crédito', 'Pago de tarjeta', 'tarjeta');
    if (/(super|supermercado|devoto|disco|tata|tienda inglesa|macro|gean|geánt|almacen|almacen)/.test(limpio)) return buscar('Alimentación', 'Supermercado', 'general');
    if (/(restaurant|restaurante|bar|cafe|café)/.test(limpio)) return buscar('Alimentación', 'Restaurante', 'general');
    if (/(delivery|pedido ya|pedidos ya|rappi)/.test(limpio)) return buscar('Alimentación', 'Delivery', 'general');
    if (/(farmacia|medicamento)/.test(limpio)) return buscar('Salud', 'Farmacia', 'general');
    if (/(colegio|escuela|liceo|curso|clase)/.test(limpio)) return buscar('Educación', 'Cuotas', 'general');
    if (/(ropa|calzado|zapato)/.test(limpio)) return buscar('Ropa y cuidado', limpio.includes('calzado') || limpio.includes('zapato') ? 'Calzado' : 'Ropa', 'general');
    if (/(mascota|veterinaria|perro|gato|alimento de mascota)/.test(limpio)) return buscar('Mascotas', limpio.includes('veterinaria') ? 'Veterinaria' : 'Alimento', 'general');

    const categoriaDetectada = categoriasDisponibles.find(categoria => limpio.includes(normalizar(categoria.nombre)));
    const subDetectada = categoriasDisponibles.flatMap(categoria => categoria.subcategorias || []).find(sub => {
      const nombre = getSubcategoriaNombre(sub);
      return nombre && limpio.includes(normalizar(nombre));
    });

    return {
      tipoDestino: categoriaDetectada?.tipoDestino || 'general',
      categoriaGrupo: categoriaDetectada?.nombre || '',
      subcategoria: subDetectada ? getSubcategoriaNombre(subDetectada) : '',
    };
  };

  const buildVoiceSuggestions = (texto) => {
    const limpio = normalizar(texto);
    const fechaDetectada = fechaDesdeTextoVoz(texto);
    const monedaGlobal = limpio.includes('dolar') || limpio.includes('dolares') || limpio.includes('usd') ? 'USD' : 'UYU';
    const matches = [...texto.matchAll(/(?:us\$|usd|\$)?\s*(\d+(?:[.,]\d+)?)(?:\s*(?:pesos|peso|dolares|dólares|usd))?(?:\s+(?:en|de|para|por)\s+)?([^,.;]+?)(?=(?:\s+(?:y|e|tambien|también|ademas|además)\s+(?:us\$|usd|\$)?\s*\d)|[,.;]|$)/gi)]
      .map((match) => ({
        monto: Number(String(match[1]).replace(',', '.')),
        descripcion: String(match[2] || texto)
          .replace(/\b(gaste|gasté|pague|pagué|compre|compré|ayer|hoy|anteayer)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim(),
      }))
      .filter(item => item.monto > 0);

    const items = matches.length > 0 ? matches : [{
      monto: Number((limpio.match(/(\d+(?:[.,]\d+)?)/)?.[1] || '').replace(',', '.')) || '',
      descripcion: texto,
    }];

    return items.map((item, index) => {
      const categoria = detectarCategoriaVoz(item.descripcion || texto);
      return {
        id: `voice-local-${Date.now()}-${index}`,
        descripcion: item.descripcion || texto,
        monto: item.monto,
        moneda: monedaGlobal,
        tipoDestino: categoria.tipoDestino,
        categoriaGrupo: categoria.categoriaGrupo,
        subcategoria: categoria.subcategoria,
        fecha: fechaDetectada,
        confianza: item.monto ? (matches.length > 1 ? 0.82 : 0.74) : 0.5,
        notas: matches.length > 1 ? 'Separado automáticamente desde la frase de voz.' : 'Revisá la categoría y el monto antes de guardar.',
        source: 'voz',
      };
    });
  };

  const buildVoiceSuggestion = (texto) => {
    const limpio = normalizar(texto);
    const fallback = buildVoiceSuggestions(texto)[0] || {};
    const montoMatch = limpio.match(/(\d+(?:[.,]\d+)?)/);
    const monedaDetectada = limpio.includes('dolar') || limpio.includes('dolares') || limpio.includes('usd') ? 'USD' : 'UYU';
    let tipoDetectado = 'general';

    if (limpio.includes('auto') || limpio.includes('vehiculo') || limpio.includes('nafta') || limpio.includes('combustible')) tipoDetectado = 'vehiculo';
    else if (limpio.includes('casa') || limpio.includes('hogar') || limpio.includes('ute') || limpio.includes('ose')) tipoDetectado = 'hogar';
    else if (limpio.includes('tarjeta') || limpio.includes('visa') || limpio.includes('master')) tipoDetectado = 'tarjeta';

    const categoriaDetectada = categoriasDisponibles.find(categoria => limpio.includes(normalizar(categoria.nombre)));
    const subDetectada = categoriasDisponibles.flatMap(categoria => categoria.subcategorias || []).find(sub => {
      const nombre = getSubcategoriaNombre(sub);
      return nombre && limpio.includes(normalizar(nombre));
    });

    return {
      ...fallback,
      id: `voice-${Date.now()}`,
      descripcion: texto,
      monto: montoMatch ? Number(montoMatch[1].replace(',', '.')) : '',
      moneda: monedaDetectada,
      tipoDestino: categoriaDetectada?.tipoDestino || tipoDetectado,
      categoriaGrupo: categoriaDetectada?.nombre || '',
      subcategoria: subDetectada ? getSubcategoriaNombre(subDetectada) : '',
      fecha: fechaDesdeTextoVoz(texto),
      confianza: montoMatch ? 0.78 : 0.55,
      notas: 'Revisá la categoría y el monto antes de guardar.',
      source: 'voz',
    };
  };

  const analizarTextoVoz = async (texto) => {
    const response = await fetch('/.netlify/functions/analyze-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceType: 'voice',
        fileName: 'audio_transcripto',
        mimeType: 'text/plain',
        extractedText: texto,
        categorias: categoriasDisponibles.map(categoria => ({
          nombre: categoria.nombre,
          tipoDestino: categoria.tipoDestino || 'general',
          subcategorias: (categoria.subcategorias || []).map(getSubcategoriaNombre),
        })),
        tarjetas: tarjetas.map(tarjeta => ({
          nombre: tarjeta.nombre,
          banco: tarjeta.banco,
          marca: tarjeta.marca,
          ultimos4: tarjeta.ultimos4,
        })),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'No se pudo interpretar el audio.');
    }

    return (data.gastos || []).map((gasto, index) => ({
      ...gasto,
      id: `voice-${Date.now()}-${index}`,
      source: 'voz',
    }));
  };

  const iniciarVoz = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus('Tu navegador no soporta dictado por voz.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-UY';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let receivedResult = false;
    recognition.onstart = () => {
      setReviewMode('voz');
      setReviewOpen(true);
      setProcessingReview(true);
      setProcessingLabel('Escuchando tu gasto...');
      setVoiceStatus('');
      setDocumentSuggestions([]);
      setSelectedSuggestions({});
    };
    recognition.onerror = () => {
      setProcessingReview(false);
      setProcessingLabel('');
      setVoiceStatus('No pude escuchar bien. Probá de nuevo.');
    };
    recognition.onresult = async (event) => {
      receivedResult = true;
      const texto = event.results[0][0].transcript;
      setProcessingLabel('Ordenando tus gastos...');
      try {
        const suggestions = await analizarTextoVoz(texto);
        const localSuggestions = buildVoiceSuggestions(texto);
        const baseSuggestions = localSuggestions.length > suggestions.length ? localSuggestions : suggestions.length > 0 ? suggestions : [buildVoiceSuggestion(texto)];
        const finalSuggestions = marcarDuplicados(aplicarReglasLocales(baseSuggestions));
        setDocumentSuggestions(finalSuggestions);
        setSelectedSuggestions(Object.fromEntries(finalSuggestions.map(item => [item.id, !item.posibleDuplicado])));
        setVoiceStatus('');
      } catch (error) {
        console.error('Error al interpretar voz con IA:', error);
        const fallback = marcarDuplicados(aplicarReglasLocales(buildVoiceSuggestions(texto)));
        setDocumentSuggestions(fallback);
        setSelectedSuggestions(Object.fromEntries(fallback.map(item => [item.id, !item.posibleDuplicado])));
        setVoiceStatus('No pude usar IA para la voz, te dejé una sugerencia básica.');
      } finally {
        setProcessingReview(false);
        setProcessingLabel('');
      }
    };
    recognition.onend = () => {
      if (!receivedResult) {
        setProcessingReview(false);
        setProcessingLabel('');
      }
      setTimeout(() => setVoiceStatus(''), 5000);
    };
    recognition.start();
  };

  const analizarDocumento = async () => {
    if (!estadoCuentaFile) {
      setDocumentStatus('Elegí un PDF o imagen para analizar.');
      return;
    }

    setReviewMode('documento');
    setReviewOpen(true);
    setProcessingReview(true);
    setProcessingLabel('Leyendo el documento...');
    setDocumentStatus('Leyendo el documento...');
    setDocumentSuggestions([]);
    setSelectedSuggestions({});

    try {
      const extractedText = await extractTextFromDocument(estadoCuentaFile, (status) => {
        setDocumentStatus(status);
        setProcessingLabel(status || 'Procesando la información...');
      });
      setOcrText(extractedText);
      setDocumentStatus('Detectando gastos...');
      setProcessingLabel('Detectando gastos...');

      const needsFallbackFile = extractedText.trim().length < 40;
      const fileData = needsFallbackFile ? await fileToBase64(estadoCuentaFile) : null;
      const response = await fetch('/.netlify/functions/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: estadoCuentaFile.name,
          mimeType: estadoCuentaFile.type || 'application/octet-stream',
          sourceType: fileSourceType(estadoCuentaFile),
          extractedText,
          fileData,
          categorias: categoriasDisponibles.map(categoria => ({
            nombre: categoria.nombre,
            tipoDestino: categoria.tipoDestino || 'general',
            subcategorias: (categoria.subcategorias || []).map(getSubcategoriaNombre),
          })),
          tarjetas: tarjetas.map(tarjeta => ({
            nombre: tarjeta.nombre,
            banco: tarjeta.banco,
            marca: tarjeta.marca,
            ultimos4: tarjeta.ultimos4,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo analizar el documento.');
      }

      const suggestions = marcarDuplicados(aplicarReglasLocales((data.gastos || []).map((gasto, index) => ({
        ...gasto,
        id: `suggestion-${Date.now()}-${index}`,
      }))));
      setDocumentSuggestions(suggestions);
      setSelectedSuggestions(Object.fromEntries(suggestions.map(item => [item.id, Number(item.confianza || 0) >= 0.65 && !item.posibleDuplicado])));
      setDocumentStatus(data.resumen || 'Documento analizado.');
      setProcessingReview(false);
      setProcessingLabel('');
    } catch (error) {
      console.error('Error al analizar documento:', error);
      setDocumentStatus(error.message || 'No se pudo analizar el documento.');
      setProcessingReview(false);
      setProcessingLabel('');
    }
  };

  useEffect(() => {
    if (initialAction === 'manual' || autoStartedRef.current) return;
    if (initialAction === 'voice') {
      autoStartedRef.current = true;
      setTimeout(() => iniciarVoz(), 250);
    }
    if (initialAction === 'document') {
      autoStartedRef.current = true;
      setTimeout(() => fileInputRef.current?.click(), 250);
    }
  }, [initialAction]);

  useEffect(() => {
    if (initialAction !== 'document' || !estadoCuentaFile) return;
    if (autoAnalyzedFileRef.current === estadoCuentaFile.name) return;
    autoAnalyzedFileRef.current = estadoCuentaFile.name;
    analizarDocumento();
  }, [estadoCuentaFile, initialAction]);

  const updateSuggestion = (id, patch) => {
    setDocumentSuggestions((actual) => actual.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const marcarDuplicados = (sugerencias) => {
    const seenInImport = new Set();
    return sugerencias.map((sugerencia) => {
      const key = duplicateKey({
        fecha: sugerencia.fecha,
        monto: sugerencia.monto,
        moneda: sugerencia.moneda || 'UYU',
        descripcion: sugerencia.descripcion || '',
        categoriaGrupo: sugerencia.categoriaGrupo || '',
        subcategoria: sugerencia.subcategoria || '',
      });
      const duplicadoExistente = duplicateKeysExistentes.has(key);
      const duplicadoEnImportacion = seenInImport.has(key);
      seenInImport.add(key);
      return {
        ...sugerencia,
        duplicateKey: key,
        posibleDuplicado: duplicadoExistente || duplicadoEnImportacion,
        duplicateReason: duplicadoExistente ? 'Ya existe un gasto muy parecido.' : duplicadoEnImportacion ? 'Se repite dentro de esta importación.' : '',
      };
    });
  };

  const guardarSugerenciasSeleccionadas = async () => {
    const sugerenciasRevisadas = marcarDuplicados(documentSuggestions);
    const seleccionadas = sugerenciasRevisadas.filter(item => selectedSuggestions[item.id]);
    if (seleccionadas.length === 0) return;

    const importRef = doc(collection(db, 'importaciones'));
    const sourceType = reviewMode === 'voz' ? 'voice' : fileSourceType(estadoCuentaFile);
    const operations = [{
      ref: importRef,
      data: {
        userId: user.uid,
        archivoNombre: estadoCuentaFile?.name || (reviewMode === 'voz' ? 'Carga por voz' : 'Carga inteligente'),
        sourceType,
        totalSugerencias: sugerenciasRevisadas.length,
        gastosGuardados: seleccionadas.length,
        posiblesDuplicados: seleccionadas.filter(item => item.posibleDuplicado).length,
        estado: 'pendiente_revision',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    }];

    seleccionadas.forEach((sugerencia) => {
      const gastoRef = doc(collection(db, 'gastos'));
      const productosConfiables = (sugerencia.productos || []).filter(producto => (
        producto?.nombre
        && Number(producto.confianza || 0) >= 0.72
        && Number(producto.precioTotal || 0) > 0
      ));
      operations.push({
        ref: gastoRef,
        data: {
          ...suggestionToExpensePayload({
            sugerencia,
            userId: user.uid,
            categorias: categoriasDisponibles,
            sourceFileName: estadoCuentaFile?.name || '',
          }),
          importBatchId: importRef.id,
          importSourceType: sourceType,
          posibleDuplicado: Boolean(sugerencia.posibleDuplicado),
          duplicateKey: sugerencia.duplicateKey || null,
          tieneProductos: productosConfiables.length > 0,
          fecha: fechaSugeridaToTimestamp(sugerencia.fecha),
          createdAt: serverTimestamp(),
        },
      });
      productosConfiables.forEach((producto) => {
        const productoRef = doc(collection(db, 'producto_precios'));
        const nombreNormalizado = normalizarProducto(producto.nombre);
        const productoKey = canonicalProductKey(producto.nombre, producto.marca, producto.unidad);
        operations.push({
          ref: productoRef,
          data: {
            userId: user.uid,
            gastoId: gastoRef.id,
            importBatchId: importRef.id,
            nombre: producto.nombre,
            nombreNormalizado,
            productoKey,
            marca: producto.marca || '',
            cantidad: Number(producto.cantidad || 1),
            unidad: producto.unidad || 'unidad',
            precioUnitario: Number(producto.precioUnitario || 0),
            precioTotal: Number(producto.precioTotal || 0),
            moneda: sugerencia.moneda || 'UYU',
            comercio: sugerencia.descripcion || '',
            confianza: Number(producto.confianza || 0),
            fecha: fechaSugeridaToTimestamp(sugerencia.fecha),
            createdAt: serverTimestamp(),
            origen: sugerencia.source === 'voz' ? 'voz_ia' : 'documento_ia',
            estadoAgregado: 'pendiente_anonimizar',
          },
        });
      });
    });

    for (let index = 0; index < operations.length; index += 450) {
      const batch = writeBatch(db);
      operations.slice(index, index + 450).forEach(({ ref, data }) => batch.set(ref, data));
      await batch.commit();
    }
    const restantes = sugerenciasRevisadas.filter(item => !selectedSuggestions[item.id]);
    setDocumentSuggestions(restantes);
    setSelectedSuggestions({});
    if (restantes.length === 0) {
      setReviewOpen(false);
      setEstadoCuentaFile(null);
      setOcrText('');
      onSaved?.({ reviewPending: true, sourceType, savedCount: seleccionadas.length });
    }
  };

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
      const detallesFinales = {
        ...detalles,
        comentario: comentario.trim(),
      };

      batch.set(gastoRef, {
        userId: user.uid,
        monto: montoNumerico,
        moneda,
        tipoDestino,
        categoriaId: categoriaId || null,
        categoriaGrupo: getCategoriaNombre(),
        categoria: subcategoriaFinal || getCategoriaNombre(),
        subcategoria: subcategoriaFinal || null,
        vehiculoId: tipoDestino === 'vehiculo' && vehiculoId ? vehiculoId : null,
        vehiculoNombre: tipoDestino === 'vehiculo' && vehiculoSeleccionado ? vehiculoSeleccionado.nombre || `${vehiculoSeleccionado.marca} ${vehiculoSeleccionado.modelo}` : null,
        hogarId: tipoDestino === 'hogar' && hogarId ? hogarId : null,
        hogarNombre: tipoDestino === 'hogar' && hogarSeleccionado ? hogarSeleccionado.nombre : null,
        tarjetaId: tipoDestino === 'tarjeta' && tarjetaId ? tarjetaId : null,
        tarjetaNombre: tipoDestino === 'tarjeta' && tarjetaSeleccionada ? tarjetaSeleccionada.nombre || `${tarjetaSeleccionada.banco} ${tarjetaSeleccionada.marca}` : null,
        detalles: detallesFinales,
        estadoCuenta,
        estadoCuentaPendiente: tipoDestino === 'tarjeta' && !estadoCuenta,
        origen: tipoDestino === 'tarjeta' ? 'tarjeta_credito' : 'manual',
        estadoRevision: 'confirmado',
        fecha: Timestamp.fromDate(dateInputToDate(fechaGasto)),
        createdAt: serverTimestamp(),
      });

      if (tipoDestino === 'vehiculo' && vehiculoId && detalles.kilometraje) {
        batch.update(doc(db, 'vehiculos', vehiculoId), { kilometraje_actual: Number(detalles.kilometraje) });
      }

      await batch.commit();

      setMonto('');
      setMoneda('UYU');
      setFechaGasto(todayInputValue());
      setComentario('');
      setEstadoCuentaFile(null);
      setSubcategoriaSugerida('');
      setCategoriaSugerida('');
      setDetalles({});
      onSaved?.();
      if (!onSaved) alert('¡Gasto guardado con éxito!');
    } catch (error) {
      console.error("Detalle del error:", error);
      alert('Error al guardar. Revisá la consola para más detalles: ' + error.message);
    }
    setLoading(false);
  };

  if (initialAction !== 'manual' && !reviewOpen && !estadoCuentaFile) {
    return (
      <div className="py-12 animate-in fade-in duration-300">
        <div className="rounded-[2rem] bg-white border border-zinc-100 p-8 text-center shadow-sm">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${initialAction === 'voice' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
            {initialAction === 'voice' ? <Mic size={28} /> : <Sparkles size={28} />}
          </div>
          <h3 className="mt-5 text-xl font-black text-zinc-900">
            {initialAction === 'voice' ? 'Activando micrófono' : 'Elegí un comprobante'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            {initialAction === 'voice'
              ? 'Decí uno o varios gastos. Después vas a poder revisar todo antes de guardar.'
              : 'Podés sacar una foto, subir una imagen, elegir un PDF o cargar una planilla. Después preparamos las sugerencias.'}
          </p>
          {initialAction === 'voice' ? (
            <div className="mt-6 flex items-center justify-center gap-2 text-emerald-600 font-bold text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Esperando permiso del navegador
            </div>
          ) : (
            <label className="mt-6 w-full p-4 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer">
              <FileText size={18} /> Subir archivo, foto o planilla
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*,.csv,.tsv,.xlsx,.xls"
                capture="environment"
                onChange={(e) => setEstadoCuentaFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 animate-in fade-in duration-500">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="flex flex-col items-center justify-center py-8">
          {initialAction !== 'manual' && (
            <div className="mb-5 w-full rounded-3xl bg-white border border-zinc-100 p-4 text-center shadow-sm">
              <p className="text-sm font-bold text-zinc-800">
                {initialAction === 'voice' ? 'Dictá uno o varios gastos y los preparamos para revisar.' : 'Subí un ticket, boleta, resumen o planilla y revisá las sugerencias.'}
              </p>
            </div>
          )}
          <span className="text-zinc-400 font-medium mb-2">¿Cuánto gastaste?</span>
          <div className="flex items-center justify-center text-emerald-500">
            <span className="text-4xl font-bold mr-1">{moneda === 'USD' ? 'US$' : '$'}</span>
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
          <div className="mt-4 flex bg-zinc-200/60 p-1 rounded-full">
            {['UYU', 'USD'].map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setMoneda(item)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${moneda === item ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
              >
                {item === 'UYU' ? 'Pesos' : 'Dólares'}
              </button>
            ))}
          </div>
          <div className="mt-5 w-full max-w-sm grid grid-cols-1 gap-3">
            <label className="text-left">
              <span className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1">Fecha del gasto</span>
              <input
                type="date"
                value={fechaGasto}
                onChange={(e) => setFechaGasto(e.target.value)}
                className="w-full p-4 bg-white border border-zinc-200 rounded-2xl text-zinc-800 font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="w-full p-4 bg-white border border-zinc-200 rounded-2xl text-zinc-800 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              rows={2}
              placeholder="Comentario opcional"
            />
          </div>
          <div className="mt-4 w-full max-w-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400 text-left">Plantillas rápidas</p>
            <div className="grid grid-cols-5 gap-2">
              {PLANTILLAS_RAPIDAS.map(plantilla => (
                <button
                  key={plantilla.label}
                  type="button"
                  onClick={() => aplicarPlantilla(plantilla)}
                  className="min-h-11 rounded-2xl bg-white border border-zinc-200 text-[11px] font-black text-zinc-700 active:scale-95 transition-all"
                >
                  {plantilla.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={iniciarVoz}
            className={`mt-5 px-4 py-3 rounded-full font-bold text-sm flex items-center gap-2 active:scale-95 transition-all ${initialAction === 'voice' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-zinc-900 text-white'}`}
          >
            <Mic size={18} /> Agregar por voz
          </button>
          <label className={`mt-3 px-4 py-3 rounded-full bg-white border font-bold text-sm flex items-center gap-2 active:scale-95 transition-all shadow-sm cursor-pointer ${initialAction === 'document' ? 'border-indigo-200 text-indigo-700' : 'border-zinc-200 text-zinc-800'}`}>
            <FileText size={18} /> Analizar documento o planilla
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*,.csv,.tsv,.xlsx,.xls"
              capture="environment"
              onChange={(e) => setEstadoCuentaFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>
          {estadoCuentaFile && (
            <div className="mt-3 w-full max-w-sm rounded-2xl border border-indigo-100 bg-indigo-50 p-3 text-center">
              <p className="text-xs font-bold text-indigo-700 break-words">{estadoCuentaFile.name}</p>
              <button
                type="button"
                onClick={analizarDocumento}
                className="mt-3 w-full p-3 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2"
              >
                <Sparkles size={18} /> Analizar con IA
              </button>
              {documentStatus && <p className="mt-2 text-xs font-medium text-indigo-700">{documentStatus}</p>}
            </div>
          )}
          {voiceStatus && <p className="mt-3 text-xs font-medium text-zinc-500 text-center">{voiceStatus}</p>}
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
            <div className="flex gap-2">
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="flex-1 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-zinc-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {categoriasFiltradas.length === 0 && <option value="">Agregá una categoría</option>}
                {categoriasFiltradas.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
              </select>
              <button type="button" onClick={() => setShowCategoriaInput(true)} className="w-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center">
                <Plus size={20} />
              </button>
            </div>
            {showCategoriaInput && (
              <div className="mt-2 flex gap-2">
                <input
                  value={categoriaSugerida}
                  onChange={(e) => setCategoriaSugerida(e.target.value)}
                  className="flex-1 p-3 bg-white border border-dashed border-zinc-300 rounded-2xl text-zinc-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Nueva categoría..."
                />
                <button type="button" onClick={sugerirCategoria} className="px-4 rounded-2xl bg-emerald-500 text-white font-bold">OK</button>
                <button type="button" onClick={() => setShowCategoriaInput(false)} className="px-3 rounded-2xl bg-zinc-100 text-zinc-500"><X size={18} /></button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 ml-1">Subcategoría</label>
            <div className="flex gap-2">
              <select
                value={subcategoria}
                onChange={(e) => setSubcategoria(e.target.value)}
                className="flex-1 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-zinc-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {subcategorias.length === 0 && <option value="">Sin subcategoría</option>}
                {subcategorias.map(sub => {
                  const nombre = getSubcategoriaNombre(sub);
                  return <option key={nombre} value={nombre}>{nombre}</option>;
                })}
                {subcategoriaSugerida && <option value={subcategoriaSugerida}>{subcategoriaSugerida}</option>}
              </select>
              <button type="button" onClick={() => setShowSubcategoriaInput(true)} className="w-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center">
                <Plus size={20} />
              </button>
            </div>
            {showSubcategoriaInput && (
              <div className="mt-2 flex gap-2">
                <input
                  value={subcategoriaSugerida}
                  onChange={(e) => setSubcategoriaSugerida(e.target.value)}
                  className="flex-1 p-3 bg-white border border-dashed border-zinc-300 rounded-2xl text-zinc-800 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Nueva subcategoría..."
                />
                <button type="button" onClick={sugerirSubcategoria} className="px-4 rounded-2xl bg-emerald-500 text-white font-bold">OK</button>
                <button type="button" onClick={() => setShowSubcategoriaInput(false)} className="px-3 rounded-2xl bg-zinc-100 text-zinc-500"><X size={18} /></button>
              </div>
            )}
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

        </div>

        <button
          type="submit"
          disabled={loading || !monto || !categoriaId}
          className="w-full bg-emerald-500 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none"
        >
          {loading ? 'Registrando...' : 'Registrar Gasto'}
        </button>
      </form>

      {reviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center px-3 pb-3">
          <div className="w-full max-w-lg max-h-[86vh] overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  {reviewMode === 'voz' ? 'Carga por voz' : 'Carga inteligente'}
                </p>
                <h3 className="text-xl font-black text-zinc-900">Revisá antes de guardar</h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {processingReview && (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-100 border-t-emerald-500 animate-spin" />
                <p className="mt-5 font-bold text-zinc-800">{processingLabel || 'Procesando...'}</p>
                <p className="mt-1 text-sm text-zinc-400">Enseguida vas a poder ajustar los datos.</p>
              </div>
            )}

            {!processingReview && documentSuggestions.length === 0 && (
              <div className="py-10 text-center">
                <p className="font-bold text-zinc-800">No encontré gastos claros.</p>
                <p className="mt-1 text-sm text-zinc-400">Podés intentar otra vez o cargarlo manualmente.</p>
              </div>
            )}

            {!processingReview && documentSuggestions.length > 0 && (
              <div className="space-y-3">
                {documentSuggestions.map((sugerencia) => {
                  const categoriaActual = categoriasDisponibles.find(cat => normalizar(cat.nombre) === normalizar(sugerencia.categoriaGrupo));
                  const categoriasParaTipo = categoriasDisponibles.filter(cat => (cat.tipoDestino || 'general') === (sugerencia.tipoDestino || 'general'));
                  const subcategoriasSugerencia = categoriaActual?.subcategorias || [];

                  return (
                    <div key={sugerencia.id} className={`p-3 bg-zinc-50 rounded-2xl border ${selectedSuggestions[sugerencia.id] ? 'border-emerald-200' : 'border-zinc-100 opacity-70'}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedSuggestions[sugerencia.id])}
                          onChange={(e) => setSelectedSuggestions((actual) => ({ ...actual, [sugerencia.id]: e.target.checked }))}
                          className="mt-2 w-5 h-5 accent-emerald-500"
                        />
                        <div className="flex-1 space-y-2">
                          <input
                            value={sugerencia.descripcion || ''}
                            onChange={(e) => updateSuggestion(sugerencia.id, { descripcion: e.target.value })}
                            className="w-full p-3 bg-white border border-zinc-100 rounded-xl outline-none font-bold text-zinc-800"
                            placeholder="Descripción"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={sugerencia.monto || ''}
                              onChange={(e) => updateSuggestion(sugerencia.id, { monto: Number(e.target.value) })}
                              className="w-full p-3 bg-white border border-zinc-100 rounded-xl outline-none font-bold"
                              placeholder="Monto"
                            />
                            <select
                              value={sugerencia.moneda || 'UYU'}
                              onChange={(e) => updateSuggestion(sugerencia.id, { moneda: e.target.value })}
                              className="w-full p-3 bg-white border border-zinc-100 rounded-xl outline-none font-bold"
                            >
                              <option value="UYU">Pesos</option>
                              <option value="USD">Dólares</option>
                            </select>
                          </div>
                          <input
                            type="date"
                            value={sugerencia.fecha || ''}
                            onChange={(e) => updateSuggestion(sugerencia.id, { fecha: e.target.value })}
                            className="w-full p-3 bg-white border border-zinc-100 rounded-xl outline-none font-bold"
                          />
                          <div className="flex flex-wrap gap-2">
                            <span className={`px-3 py-1 rounded-full text-[11px] font-black ${
                              Number(sugerencia.confianza || 0) >= 0.82
                                ? 'bg-emerald-100 text-emerald-700'
                                : Number(sugerencia.confianza || 0) >= 0.65
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-600'
                            }`}
                            >
                              Confianza {Math.round(Number(sugerencia.confianza || 0) * 100)}%
                            </span>
                            {sugerencia.source === 'voz' && <span className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-500 text-[11px] font-black">Voz</span>}
                          </div>
                          <select
                            value={sugerencia.tipoDestino || 'general'}
                            onChange={(e) => updateSuggestion(sugerencia.id, { tipoDestino: e.target.value, categoriaGrupo: '', subcategoria: '' })}
                            className="w-full p-3 bg-white border border-zinc-100 rounded-xl outline-none"
                          >
                            {TIPOS_DESTINO.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.label}</option>)}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={categoriaActual?.nombre || ''}
                              onChange={(e) => updateSuggestion(sugerencia.id, { categoriaGrupo: e.target.value, subcategoria: '' })}
                              className="w-full p-3 bg-white border border-zinc-100 rounded-xl outline-none"
                            >
                              <option value="">Categoría</option>
                              {categoriasParaTipo.map(cat => <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>)}
                            </select>
                            <select
                              value={sugerencia.subcategoria || ''}
                              onChange={(e) => updateSuggestion(sugerencia.id, { subcategoria: e.target.value })}
                              className="w-full p-3 bg-white border border-zinc-100 rounded-xl outline-none"
                            >
                              <option value="">Subcategoría</option>
                              {subcategoriasSugerencia.map(sub => {
                                const nombre = getSubcategoriaNombre(sub);
                                return <option key={nombre} value={nombre}>{nombre}</option>;
                              })}
                              {sugerencia.subcategoria && !subcategoriasSugerencia.some(sub => getSubcategoriaNombre(sub) === sugerencia.subcategoria) && (
                                <option value={sugerencia.subcategoria}>{sugerencia.subcategoria}</option>
                              )}
                            </select>
                          </div>
                          {(sugerencia.productos || []).filter(producto => Number(producto.confianza || 0) >= 0.72).length > 0 && (
                            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                              <p className="text-xs font-black text-emerald-700">
                                {(sugerencia.productos || []).filter(producto => Number(producto.confianza || 0) >= 0.72).length} productos detectados con buena confianza
                              </p>
                              <p className="mt-1 text-xs text-emerald-700/70">Se guardan para comparar precios de forma agregada.</p>
                            </div>
                          )}
                          {sugerencia.posibleDuplicado && (
                            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                              <p className="text-xs font-black text-amber-700">Posible duplicado</p>
                              <p className="mt-1 text-xs text-amber-700/75">{sugerencia.duplicateReason || 'Revisá antes de guardarlo.'}</p>
                            </div>
                          )}
                          {sugerencia.notas && <p className="text-xs text-zinc-400">{sugerencia.notas}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={guardarSugerenciasSeleccionadas}
                  disabled={!documentSuggestions.some(item => selectedSuggestions[item.id])}
                  className="w-full mt-2 p-4 rounded-2xl bg-emerald-500 text-white font-bold disabled:opacity-50"
                >
                  Guardar seleccionados ({documentSuggestions.filter(item => selectedSuggestions[item.id]).length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
