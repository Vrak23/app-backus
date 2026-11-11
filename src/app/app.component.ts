import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SwUpdate } from '@angular/service-worker';
import { CatalogoService, Producto } from './services/catalogo.service';
import { StorageService, Pedido, LineaPedido, EstadoPedido } from './services/storage.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private catalogoService = inject(CatalogoService);
  private storageService = inject(StorageService);
  private swUpdate = inject(SwUpdate);
  private cdr = inject(ChangeDetectorRef);

  // Catálogo y filtros (BV-01, BV-02)
  productos: Producto[] = [];
  productosFiltrados: Producto[] = [];
  cargando: boolean = false;
  busquedaTexto: string = '';
  categoriaSeleccionada: string = 'TODAS';
  categoriasDisponibles: string[] = ['TODAS', 'Cerveza', 'Gaseosa', 'Agua'];

  // Selección de cantidades en catálogo (BV-03)
  cantidadesSeleccionadas: { [productoId: number]: number } = {};

  // Carrito de compras / Resumen de pedido (BV-03, BV-04)
  lineasCarrito: LineaPedido[] = [];
  nombreCliente: string = '';
  errorFormulario: string = '';
  mostrarCarrito: boolean = false;

  // Conectividad (BV-06)
  isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  swActivo: boolean = false;
  swMensaje: string = '';

  // Historial de pedidos persistidos en IndexedDB (BV-05, BV-06)
  pedidosHistorial: Pedido[] = [];
  pedidoSeleccionadoDetalle: Pedido | null = null;
  mostrarModalDetalle: boolean = false;

  // Notificaciones al usuario (BV-07)
  notificacion: { texto: string; tipo: 'success' | 'warning' | 'error' | 'info' } | null = null;
  mostrarModalTecnico: boolean = false;

  ngOnInit(): void {
    this.verificarConectividad();
    this.cargarCatalogo();
    this.verificarServiceWorker();
    this.cargarHistorialIndexedDB();
  }

  // --- CONECTIVIDAD Y SERVICE WORKER ---
  verificarConectividad(): void {
    this.catalogoService.isOnline().subscribe((online) => {
      this.isOnline = online;
      if (online) {
        this.mostrarAviso(
          'Conexión recuperada. Listo para intentar sincronizar. (Sin API activa, los pedidos se mantienen en estado PENDIENTE).',
          'info'
        );
      } else {
        this.mostrarAviso(
          'Modo sin conexión. Todos los pedidos se persistirán en IndexedDB de forma local.',
          'warning'
        );
      }
      this.cdr.detectChanges();
    });
  }

  toggleModoConexion(): void {
    const nuevoEstado = !this.isOnline;
    this.catalogoService.setOnlineStatus(nuevoEstado);
  }

  verificarServiceWorker(): void {
    if (this.swUpdate.isEnabled) {
      this.swActivo = true;
      this.swMensaje = 'Angular Service Worker activo y cacheando recursos (ngsw-worker.js)';
      this.swUpdate.versionUpdates.subscribe((evt) => {
        if (evt.type === 'VERSION_READY') {
          if (confirm('Nueva versión de Backus Ventas disponible. ¿Desea actualizar?')) {
            window.location.reload();
          }
        }
      });
    } else {
      this.swActivo = false;
      this.swMensaje = 'Service Worker inactivo (modo desarrollo o navegador sin SSL/localhost).';
    }
  }

  // --- CATÁLOGO, BÚSQUEDA Y FILTROS (BV-01, BV-02) ---
  cargarCatalogo(): void {
    this.cargando = true;
    this.catalogoService.obtenerCatalogo().subscribe({
      next: (data) => {
        this.productos = data || [];
        this.productos.forEach((p) => {
          if (!this.cantidadesSeleccionadas[p.id]) {
            this.cantidadesSeleccionadas[p.id] = 1;
          }
        });
        this.filtrarProductos();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al cargar catálogo:', err);
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  filtrarProductos(): void {
    const busq = this.busquedaTexto.trim().toLowerCase();
    this.productosFiltrados = this.productos.filter((prod) => {
      const matchCategoria =
        this.categoriaSeleccionada === 'TODAS' ||
        prod.categoria.toLowerCase() === this.categoriaSeleccionada.toLowerCase();

      const matchNombre =
        !busq ||
        prod.nombre.toLowerCase().includes(busq) ||
        prod.categoria.toLowerCase().includes(busq);

      return matchCategoria && matchNombre;
    });
  }

  seleccionarCategoria(cat: string): void {
    this.categoriaSeleccionada = cat;
    this.filtrarProductos();
  }

  limpiarFiltros(): void {
    this.busquedaTexto = '';
    this.categoriaSeleccionada = 'TODAS';
    this.filtrarProductos();
  }

  // --- VALIDACIÓN DE CANTIDADES Y CARRITO (BV-03, BV-04) ---
  modificarCantidadInput(productoId: number, delta: number): void {
    const actual = this.cantidadesSeleccionadas[productoId] || 1;
    const nueva = actual + delta;
    if (nueva >= 1) {
      this.cantidadesSeleccionadas[productoId] = Math.floor(nueva);
    }
  }

  agregarAlCarrito(producto: Producto): void {
    const rawCantidad = this.cantidadesSeleccionadas[producto.id];
    
    // Regla BV-03: Solo enteros positivos mayores a cero
    if (!Number.isInteger(rawCantidad) || rawCantidad <= 0) {
      this.mostrarAviso(
        `Cantidad inválida para ${producto.nombre}. Debe ser un número entero mayor que cero.`,
        'error'
      );
      return;
    }

    const cantidad = Math.floor(rawCantidad);
    const subtotal = Math.round(producto.precio * cantidad * 100) / 100;

    const itemExistente = this.lineasCarrito.find((l) => l.productoId === producto.id);
    if (itemExistente) {
      itemExistente.cantidad += cantidad;
      itemExistente.subtotal = Math.round(itemExistente.precioUnitario * itemExistente.cantidad * 100) / 100;
    } else {
      this.lineasCarrito.push({
        productoId: producto.id,
        producto: producto.nombre,
        precioUnitario: producto.precio,
        cantidad: cantidad,
        subtotal: subtotal
      });
    }

    this.mostrarAviso(`Agregado al pedido: ${cantidad}x ${producto.nombre}`, 'success');
  }

  removerLinea(productoId: number): void {
    this.lineasCarrito = this.lineasCarrito.filter((l) => l.productoId !== productoId);
  }

  cambiarCantidadEnCarrito(linea: LineaPedido, delta: number): void {
    const nueva = linea.cantidad + delta;
    if (nueva >= 1) {
      linea.cantidad = nueva;
      linea.subtotal = Math.round(linea.precioUnitario * linea.cantidad * 100) / 100;
    } else {
      this.removerLinea(linea.productoId);
    }
  }

  calcularTotalPedido(): number {
    return this.lineasCarrito.reduce((acc, l) => acc + l.subtotal, 0);
  }

  totalUnidadesCarrito(): number {
    return this.lineasCarrito.reduce((acc, l) => acc + l.cantidad, 0);
  }

  // --- REGISTRO Y PERSISTENCIA EN INDEXEDDB (BV-05, BV-06, BV-07) ---
  async registrarPedido(): Promise<void> {
    this.errorFormulario = '';

    // Impedir registrar pedidos vacíos (BV-04, BV-05)
    if (this.lineasCarrito.length === 0) {
      this.errorFormulario = 'No se puede registrar un pedido vacío.';
      this.mostrarAviso(this.errorFormulario, 'error');
      return;
    }

    // Validar que no existan cantidades inválidas en las líneas
    for (const linea of this.lineasCarrito) {
      if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) {
        this.errorFormulario = `Cantidad no válida en ${linea.producto}.`;
        this.mostrarAviso(this.errorFormulario, 'error');
        return;
      }
    }

    const cliente = this.nombreCliente.trim() || 'Cliente Mostrador / Bodega';
    const total = this.calcularTotalPedido();

    const nuevoPedido: Omit<Pedido, 'id'> = {
      fecha: new Date().toISOString(),
      cliente: cliente,
      lineas: JSON.parse(JSON.stringify(this.lineasCarrito)),
      total: total,
      estado: 'PENDIENTE', // Regla BV-06: sin API real conserva PENDIENTE
      origen: this.isOnline ? 'ONLINE' : 'OFFLINE'
    };

    try {
      // Guardar primero en IndexedDB antes de confirmar (BV-05)
      const idGenerado = await this.storageService.guardarPedido(nuevoPedido);
      console.log(`Pedido #${idGenerado} persistido en IndexedDB exitosamente.`);

      // Recargar historial desde IndexedDB
      await this.cargarHistorialIndexedDB();

      // Limpiar formulario y carrito
      this.lineasCarrito = [];
      this.nombreCliente = '';
      this.mostrarCarrito = false;

      // Mensaje coherente según reglas (BV-06, BV-07)
      if (this.isOnline) {
        this.mostrarAviso(
          `Pedido #${idGenerado} guardado en el dispositivo (IndexedDB). [Aviso: Al no disponer de API empresarial remota, el pedido se mantiene en estado PENDIENTE].`,
          'success'
        );
      } else {
        this.mostrarAviso(
          `Pedido #${idGenerado} guardado localmente (OFFLINE). Persistido de forma segura en IndexedDB.`,
          'success'
        );
      }
    } catch (error) {
      console.error('Error al persistir en IndexedDB:', error);
      // Regla BV-07: Se informa el error y no se confirma éxito
      this.mostrarAviso('Error crítico en IndexedDB: No se pudo persistir el pedido. Intente nuevamente.', 'error');
    }
  }

  async cargarHistorialIndexedDB(): Promise<void> {
    try {
      this.pedidosHistorial = await this.storageService.obtenerPedidos();
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Error cargando historial de pedidos:', err);
      this.pedidosHistorial = [];
    }
  }

  // --- CONSULTA DE DETALLE (BV-05) ---
  verDetallePedido(pedido: Pedido): void {
    this.pedidoSeleccionadoDetalle = pedido;
    this.mostrarModalDetalle = true;
  }

  cerrarDetalle(): void {
    this.mostrarModalDetalle = false;
    this.pedidoSeleccionadoDetalle = null;
  }

  // --- AUXILIARES Y NOTIFICACIONES ---
  mostrarAviso(texto: string, tipo: 'success' | 'warning' | 'error' | 'info' = 'info'): void {
    this.notificacion = { texto, tipo };
    setTimeout(() => {
      if (this.notificacion?.texto === texto) {
        this.notificacion = null;
        this.cdr.detectChanges();
      }
    }, 6000);
  }

  cerrarAviso(): void {
    this.notificacion = null;
  }

  formatearFecha(isoString: string): string {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  }
}
