export const TIPOS_DESTINO = [
  { id: 'general', label: 'General' },
  { id: 'vehiculo', label: 'Vehículo' },
  { id: 'hogar', label: 'Casa' },
  { id: 'tarjeta', label: 'Tarjeta' },
];

export const normalizar = (valor = '') => valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const getSubcategoriaNombre = (subcategoria) => (
  typeof subcategoria === 'string' ? subcategoria : subcategoria?.nombre || ''
);

export const getCategoriasFiltradas = (categorias, tipoDestino) => (
  categorias.filter(categoria => (categoria.tipoDestino || 'general') === tipoDestino)
);

export const getSubcategorias = (categoria) => (
  Array.isArray(categoria?.subcategorias) ? categoria.subcategorias.map(getSubcategoriaNombre).filter(Boolean) : []
);

export const findCategoriaByName = (categorias, nombre) => (
  categorias.find(categoria => normalizar(categoria.nombre) === normalizar(nombre))
);

export const suggestionToExpensePayload = ({ sugerencia, userId, categorias, sourceFileName = '' }) => {
  const categoria = findCategoriaByName(categorias, sugerencia.categoriaGrupo);
  const categoriaNombre = categoria?.nombre || sugerencia.categoriaGrupo || 'Sin categoría';

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
      fuente: 'documento_ia',
    },
    estadoCuenta: {
      nombre: sourceFileName,
      estado: 'analizado_sin_storage',
    },
    origen: 'documento_ia',
  };
};
