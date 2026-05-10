# Gasting

App móvil para registrar gastos personales y asociarlos a categorías, ubicaciones, vehículos y hogares.

## Configuración

1. Copiá `.env.example` a `.env.local`.
2. Completá las variables `VITE_FIREBASE_*` con los datos de tu proyecto Firebase.
3. Creá un documento `admins/{uid}` en Firestore para cada usuario administrador.
4. Desplegá reglas con Firebase CLI cuando estén listas:

```bash
firebase deploy --only firestore:rules,storage
```

## Modelo actual

- `gastos`: movimientos cargados por usuario. Guardan `tipoDestino`, `categoriaGrupo`, `subcategoria`, detalles específicos, y opcionalmente `vehiculoId`, `hogarId`, `tarjetaId` o `estadoCuenta`.
- `vehiculos`: autos compartibles por `propietarios`.
- `hogares`: hogares compartibles por `propietarios`.
- `tarjetas`: tarjetas de crédito compartibles por `propietarios`, con banco, marca, cierre y vencimiento usual.
- `categorias`: jerarquía administrable con `tipoDestino` (`general`, `vehiculo`, `hogar`, `tarjeta`) y `subcategorias`.
- `subcategoria_sugerencias`: propuestas de usuarios para que un admin las apruebe o rechace.
- `ubicaciones`: lugares editables solo por admin.
- `admins`: documentos por email o uid para habilitar administración. El email `renzodogliotti@gmail.com` queda como admin bootstrap en las reglas.

## Tarjetas de crédito

Los gastos de tarjeta pueden asociarse a una tarjeta registrada. Como Firebase Storage puede tener costo, por ahora el PDF no se sube: se guarda el nombre del archivo y el estado queda pendiente para una futura etapa de almacenamiento/análisis.

## Reportes

El dashboard filtra por el mes actual por defecto e incluye vistas por categoría, subcategoría, tipo de destino, autos, casas, evolución mensual, gastos fijos/variables, tarjetas y próximos vencimientos. La sección Histórico permite editar o eliminar gastos.
