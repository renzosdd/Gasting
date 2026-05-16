export const TIPOS_DESTINO = [
  { id: 'general', label: 'General' },
  { id: 'vehiculo', label: 'Vehículo' },
  { id: 'hogar', label: 'Casa' },
  { id: 'tarjeta', label: 'Tarjeta' },
];

export const normalizar = (valor = '') => valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const normalizarProducto = (valor = '') => normalizar(valor)
  .replace(/[^a-z0-9\s.,]/g, ' ')
  .replace(/\b(un|una|el|la|los|las|de|del|x)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const canonicalProductKey = (nombre = '', marca = '', unidad = '') => {
  const text = normalizar(`${marca} ${nombre}`)
    .replace(/coca[\s-]?cola|coca cola|coca/g, 'coca cola')
    .replace(/(\d+)[,.](\d+)\s*(l|lt|lts|litro|litros)\b/g, '$1.$2 l')
    .replace(/(\d+)\s*(cc|ml)\b/g, (_, amount) => `${Number(amount) / 1000} l`)
    .replace(/(\d+)\s*(kg|kilo|kilos)\b/g, '$1 kg')
    .replace(/(\d+)\s*(g|gr|gramos)\b/g, '$1 g')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\b(un|una|el|la|los|las|de|del|x|pack)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return `${text}|${unidad || 'unidad'}`;
};

export const getSubcategoriaNombre = (subcategoria) => (
  typeof subcategoria === 'string' ? subcategoria : subcategoria?.nombre || ''
);

export const getCategoriasFiltradas = (categorias, tipoDestino) => (
  categorias.filter(categoria => (categoria.tipoDestino || 'general') === tipoDestino)
);

export const getSubcategorias = (categoria) => (
  Array.isArray(categoria?.subcategorias) ? categoria.subcategorias.map(getSubcategoriaNombre).filter(Boolean) : []
);

export const todayInputValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const dateToInputValue = (fecha) => {
  const date = fecha?.toDate?.() || (fecha instanceof Date ? fecha : null);
  if (!date) return todayInputValue();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const dateInputToDate = (value) => {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day, 12, 0, 0, 0);
};

export const findCategoriaByName = (categorias, nombre) => (
  categorias.find(categoria => normalizar(categoria.nombre) === normalizar(nombre))
);

export const suggestionToExpensePayload = ({ sugerencia, userId, categorias, sourceFileName = '' }) => {
  const categoria = findCategoriaByName(categorias, sugerencia.categoriaGrupo);
  const categoriaNombre = categoria?.nombre || sugerencia.categoriaGrupo || 'Sin categoría';
  const origen = sugerencia.source === 'voz' ? 'voz_ia' : 'documento_ia';

  return {
    userId,
    monto: Number(sugerencia.monto || 0),
    moneda: sugerencia.moneda || 'UYU',
    tipoDestino: sugerencia.tipoDestino || 'general',
    categoriaId: categoria?.id || null,
    categoriaGrupo: categoriaNombre,
    categoria: sugerencia.subcategoria || categoriaNombre,
    subcategoria: sugerencia.subcategoria || null,
    detalles: {
      descripcion: sugerencia.descripcion || '',
      notas: sugerencia.notas || '',
      confianza: Number(sugerencia.confianza || 0),
      fuente: origen,
    },
    estadoCuenta: sourceFileName ? {
      nombre: sourceFileName,
      estado: 'analizado_sin_storage',
    } : null,
    origen,
    estadoRevision: origen === 'documento_ia' || origen === 'voz_ia' ? 'pendiente_revision' : 'confirmado',
  };
};
