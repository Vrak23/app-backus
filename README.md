# Backus Ventas PWA

**Reto:** Catálogo inteligente y pedidos confiables sin conexión.  
**Institución:** SENATI – Escuela de Tecnologías de la Información  
**Curso:** Seminario de Complementación Práctica / Aplicaciones Web Progresivas  
**Instructor:** Jorge Luque Chambi  
**Estudiante:** Rodrigo Daniel Ormeño Llanos  

---

## 1. Descripción del Proyecto

Backus Ventas PWA es una Aplicación Web Progresiva construida con **Angular 19** diseñada para la fuerza de ventas móvil y distribución comercial en zonas de cobertura celular intermitente o nula:

- **Búsqueda y filtros combinables (BV-01, BV-02):** Permite filtrar simultáneamente por texto y por categorías (Cervezas, Gaseosas, Aguas) con opción de limpiar filtros.
- **Selector de cantidades enteras positivas (BV-03):** Control de selección por producto que valida números enteros mayores a cero antes de agregar al carrito.
- **Resumen y cálculo de subtotales (BV-04):** Muestra el desglose por línea de pedido (`subtotal = precio × cantidad`) e importe total con dos decimales exactos.
- **Persistencia en IndexedDB (`backusVentasDB`) (BV-05):** Los pedidos se estructuran con fecha, líneas, total, origen y estado inicial `PENDIENTE`, persistiendo íntegramente tras recargar el navegador.
- **Control honesto de sincronización (BV-06):** Sin API empresarial remota conectada, los pedidos conservan estado `PENDIENTE` y la interfaz comunica de manera transparente que están guardados localmente.
- **Captura y manejo de errores (BV-07):** Captura excepciones en transacciones de IndexedDB informando al usuario en lugar de confirmar falsos éxitos.

---

## 2. Comandos de Ejecución

### Modo Desarrollo
```bash
npm start
# o:
npx ng serve
```
Acceder a: `http://localhost:4200`

### Compilación para Producción (PWA)
```bash
npm run build
```

### Servidor Local PWA (Service Worker activo)
```bash
npx http-server ./dist/backus-ventas-pwa/browser -p 8081 -c-1
```
Abrir `http://localhost:8081` en Google Chrome o Microsoft Edge.

---

## 3. Matriz de Cumplimiento de Reglas y Aceptación

| ID | Regla | Resultado Verificable | Estado |
|---|---|---|---|
| **BV-01** | Búsqueda por nombre | Al escribir *"pilsen"* o *"cristal"*, la lista muestra coincidencias insensibles a mayúsculas. | ✅ Implementado |
| **BV-02** | Búsqueda y categoría combinables | Permite buscar por texto dentro de la categoría seleccionada (ej. *"Cerveza"* + *"cusqueña"*). | ✅ Implementado |
| **BV-03** | Cantidad entera positiva | Se rechazan cero, negativos, decimales y caracteres no numéricos al ingresar cantidades. | ✅ Implementado |
| **BV-04** | Subtotal = precio × cantidad | Cada línea desglosa cantidad, precio unitario y subtotal a 2 decimales; el total suma correctamente todos los subtotales. | ✅ Implementado |
| **BV-05** | Persistencia antes de confirmar | Tras recargar el navegador (`F5`), el pedido persiste completo en la tabla de historial desde IndexedDB. | ✅ Implementado |
| **BV-06** | Sin API no hay sincronización real | El pedido conserva honestamente el estado `PENDIENTE` en `backusVentasDB`. | ✅ Implementado |
| **BV-07** | Error de IndexedDB | Se capturan errores en la transacción sin emitir confirmaciones falsas al usuario. | ✅ Implementado |

---

## 4. Preguntas de Reflexión Técnica

### 9. ¿Por qué persistir un pedido antes de confirmar el guardado?
> Porque en una aplicación orientada a la movilidad y a vendedores en ruta, confirmar visualmente al usuario sin antes haber asegurado la persistencia en almacenamiento permanente (IndexedDB) genera una falsa sensación de seguridad. Si el dispositivo pierde batería, el navegador se cierra o el proceso es terminado por el sistema operativo, los datos en memoria RAM se perderían irrecuperablemente.

### 10. ¿Qué diferencia hay entre Cache Storage e IndexedDB?
> - **Cache Storage:** Diseñado para almacenar pares Request/Response HTTP (páginas HTML, estilos CSS, scripts JS, imágenes vectoriales y respuestas JSON estáticas) que son interceptados por el Service Worker.
> - **IndexedDB:** Base de datos NoSQL transaccional orientada a objetos JSON estructurados en el cliente, óptima para registrar transacciones, pedidos, carritos locales, filtros y colecciones de datos consultables por índices y claves primarias.

### 11. ¿Qué debería enviarse a una API cuando se implemente la sincronización?
> Debe enviarse un payload JSON que contenga:
> - Identificador único de idempotencia (`uuid` del pedido generado en cliente) para prevenir duplicados.
> - `cliente` o código de punto de venta.
> - `fechaCreacion` en formato ISO 8601.
> - Array de `lineas` (`productoId`, `cantidad`, `precioUnitario`, `subtotal`).
> - `total` liquidado y firma/token JWT del vendedor autenticado.

### 12. ¿Cómo evitarías duplicar pedidos tras varios intentos?
> 1. Asignando un **UUID/ID de idempotencia único** a cada pedido en el momento exacto en que se crea en el cliente.
> 2. Bloqueando el botón de envío en la interfaz mientras la solicitud esté en vuelo (estado *pending*).
> 3. En el backend, configurando una clave única o cabecera `Idempotency-Key`: si el servidor recibe dos peticiones con el mismo identificador, devuelve la respuesta de la primera sin volver a insertar en la base de datos central.

---

## 5. Estructura del Código

```text
backus-ventas-pwa/
├── public/
│   ├── data/
│   │   ├── catalogo.json         # Catálogo de productos oficial
│   │   └── precios.json          # Actualizaciones de precios
│   ├── images/                   # Gráficos vectoriales SVG (cristal, pilsen, etc.)
│   └── manifest.webmanifest      # App Manifest para instalación PWA
├── src/
│   ├── app/
│   │   ├── services/
│   │   │   ├── catalogo.service.ts # Carga de catálogo con fallback
│   │   │   └── storage.service.ts  # Persistencia transaccional en IndexedDB
│   │   ├── app.component.html    # Vistas: catálogo, carrito modal e historial
│   │   ├── app.component.scss    # Estilos de marca Backus
│   │   └── app.component.ts      # Lógica de negocio y reglas BV-01 a BV-07
│   ├── index.html
│   └── styles.scss
├── angular.json
├── ngsw-config.json              # Configuración de Service Worker y Cache
└── package.json
```
