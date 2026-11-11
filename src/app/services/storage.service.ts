import { Injectable } from '@angular/core';

export interface LineaPedido {
  productoId: number;
  producto: string;
  precioUnitario: number;
  cantidad: number;
  subtotal: number;
}

export type EstadoPedido = 'PENDIENTE' | 'SINCRONIZADO' | 'ERROR';

export interface Pedido {
  id?: number;
  fecha: string;
  lineas: LineaPedido[];
  total: number;
  estado: EstadoPedido;
  origen: 'ONLINE' | 'OFFLINE';
  cliente?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly dbName = 'backusVentasDB';
  private readonly dbVersion = 2; // Versión 2 con estructura de Pedidos de ampliación
  private readonly storeName = 'pedidos';

  async abrirDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB no soportado'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true
          });
          store.createIndex('estado', 'estado', { unique: false });
          store.createIndex('fecha', 'fecha', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('Error al abrir IndexedDB (Backus):', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Guarda un pedido estructurado en IndexedDB con estado inicial PENDIENTE (BV-05, BV-06)
   */
  async guardarPedido(pedido: Omit<Pedido, 'id'>): Promise<number> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const nuevoRegistro: Pedido = {
        ...pedido,
        fecha: pedido.fecha || new Date().toISOString(),
        estado: 'PENDIENTE', // Sin API real se mantiene siempre PENDIENTE (BV-06)
        origen: pedido.origen || 'ONLINE',
      };

      const request = store.add(nuevoRegistro);

      request.onsuccess = () => {
        resolve(request.result as number);
      };

      transaction.onerror = () => {
        console.error('Error en transacción de IndexedDB:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Recupera todos los pedidos guardados en IndexedDB
   */
  async obtenerPedidos(): Promise<Pedido[]> {
    try {
      const db = await this.abrirDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const lista: Pedido[] = request.result || [];
          lista.sort((a, b) => (b.id || 0) - (a.id || 0));
          resolve(lista);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Error al obtener pedidos de IndexedDB:', err);
      return [];
    }
  }

  /**
   * Obtiene el detalle de un pedido específico por ID
   */
  async obtenerPedidoPorId(id: number): Promise<Pedido | null> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Elimina un pedido tras confirmación
   */
  async eliminarPedido(id: number): Promise<void> {
    const db = await this.abrirDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}
