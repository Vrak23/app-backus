import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  imagen?: string;
  descripcion?: string;
  actualizado?: string;
}

export interface PrecioUpdate {
  productoId: number;
  precio: number;
  stock: number;
  actualizado: string;
}

const CATALOGO_DEFAULT: Producto[] = [
  {
    id: 1,
    nombre: "Cristal 620 ml",
    categoria: "Cerveza",
    precio: 7.50,
    stock: 120,
    imagen: "images/cristal.svg",
    descripcion: "Cerveza rubia lager tradicional, 'La Rubia de Todos los Peruanos'."
  },
  {
    id: 2,
    nombre: "Pilsen Callao 620 ml",
    categoria: "Cerveza",
    precio: 8.00,
    stock: 95,
    imagen: "images/pilsen.svg",
    descripcion: "La cerveza más auténtica, el sabor de la verdadera amistad."
  },
  {
    id: 3,
    nombre: "Cusqueña Dorada 620 ml",
    categoria: "Cerveza",
    precio: 9.00,
    stock: 60,
    imagen: "images/cusquena.svg",
    descripcion: "Cerveza premium de alta calidad elaborada con 100% pura malta."
  },
  {
    id: 4,
    nombre: "Guaraná Backus 500 ml",
    categoria: "Gaseosa",
    precio: 3.50,
    stock: 150,
    imagen: "images/guarana.svg",
    descripcion: "Bebida gasificada con sabor refrescante a fruto de guaraná natural."
  },
  {
    id: 5,
    nombre: "San Mateo Mineral 600 ml",
    categoria: "Agua",
    precio: 2.50,
    stock: 180,
    imagen: "images/sanmateo.svg",
    descripcion: "Agua mineral de manantial envasada en origen a más de 3,300 m.s.n.m."
  }
];

@Injectable({
  providedIn: 'root'
})
export class CatalogoService {
  private http = inject(HttpClient);
  private online$ = new BehaviorSubject<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.online$.next(true));
      window.addEventListener('offline', () => this.online$.next(false));
    }
  }

  isOnline(): Observable<boolean> {
    return this.online$.asObservable();
  }

  setOnlineStatus(status: boolean): void {
    this.online$.next(status);
  }

  obtenerCatalogo(): Observable<Producto[]> {
    return this.http.get<Producto[]>('/data/catalogo.json').pipe(
      catchError(() => {
        return this.http.get<Producto[]>('data/catalogo.json').pipe(
          catchError((err) => {
            console.warn('Cargando catálogo estático por contingencia:', err);
            return of(CATALOGO_DEFAULT);
          })
        );
      })
    );
  }

  obtenerPrecios(): Observable<PrecioUpdate[]> {
    return this.http.get<PrecioUpdate[]>('/data/precios.json').pipe(
      catchError(() => of([]))
    );
  }
}
