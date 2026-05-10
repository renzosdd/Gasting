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

- `gastos`: movimientos cargados por usuario. Pueden guardar `vehiculoId`, `hogarId` y un `estadoCuenta` si vienen de tarjeta de crédito.
- `vehiculos`: autos compartibles por `propietarios`.
- `hogares`: hogares compartibles por `propietarios`.
- `categorias` y `ubicaciones`: catálogos editables solo por admin.
- `admins`: documentos por uid para habilitar administración.

## Tarjetas de crédito

Cuando la categoría contiene "tarjeta" o "crédito", el formulario permite subir un estado de cuenta PDF o imagen. Por ahora se guarda el archivo y su metadata en el gasto; el parseo del detalle, cuotas pendientes y gastos fijos queda preparado como siguiente etapa.
