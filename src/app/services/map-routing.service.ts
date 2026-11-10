import { Injectable } from '@angular/core';

/** Perfil de desplazamiento. Los caminos sin pavimentar dependen de los datos OSM y del acceso permitido. */
export type TravelMode = 'car' | 'secondary' | 'bicycle' | 'foot';
export type MapStyle = 'street' | 'terrain' | 'satellite';
export type MapPoint = [number, number]; // [latitud, longitud]

export interface CalculatedRoute {
  coordinates: MapPoint[];
  distanceKm: number;
  durationMinutes: number;
  provider: 'valhalla' | 'osrm';
  note: string;
}

interface RoutingResponse {
  code?: string;
  message?: string;
  routes?: Array<{
    distance: number; // Metros (formato OSRM)
    duration: number; // Segundos
    geometry: { type: string; coordinates: number[][] };
  }>;
}

@Injectable({ providedIn: 'root' })
export class MapRoutingService {
  private readonly valhallaUrl = 'https://valhalla1.openstreetmap.de/route';
  private readonly osrmUrl = 'https://router.project-osrm.org/route/v1/driving/';

  async calculate(stops: MapPoint[], mode: TravelMode, externalSignal?: AbortSignal): Promise<CalculatedRoute> {
    if (stops.length < 2 || stops.length > 12 || stops.some(([lat, lon]) =>
      !Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180
    )) {
      throw new Error('La ruta requiere entre 2 y 12 puntos con coordenadas válidas.');
    }

    try {
      return await this.valhalla(stops, mode, externalSignal);
    } catch (error) {
      if (externalSignal?.aborted) throw error;
      // Sólo el perfil automóvil se puede sustituir sin cambiar la modalidad solicitada.
      if (mode === 'car') {
        return this.osrm(stops, externalSignal);
      }
      throw error;
    }
  }

  private async valhalla(stops: MapPoint[], mode: TravelMode, externalSignal?: AbortSignal): Promise<CalculatedRoute> {
    const costing = mode === 'bicycle' ? 'bicycle' : mode === 'foot' ? 'pedestrian' : 'auto';
    const body: Record<string, unknown> = {
      locations: stops.map(([lat, lon]) => ({ lat, lon, type: 'break' })),
      costing,
      format: 'osrm',
      shape_format: 'geojson',
      language: 'es-ES',
      directions_type: 'none',
      units: 'km'
    };

    // No fuerza terracerías: sólo favorece trayectos más cortos evitando vías rápidas.
    // Valhalla sigue respetando restricciones de acceso mapeadas para automóviles.
    if (mode === 'secondary') {
      body['costing_options'] = { auto: { use_highways: 0, use_distance: 0.5 } };
    }

    const controller = new AbortController();
    const abort = () => controller.abort();
    externalSignal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 18000);

    try {
      const response = await fetch(this.valhallaUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error('Valhalla: HTTP ' + response.status);

      const data = (await response.json()) as RoutingResponse;
      return this.parseRoute(data, 'valhalla', mode);
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abort);
    }
  }

  private async osrm(stops: MapPoint[], externalSignal?: AbortSignal): Promise<CalculatedRoute> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    externalSignal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 15000);

    try {
      const points = stops.map(([lat, lon]) => lon + ',' + lat).join(';');
      const url = this.osrmUrl + points + '?overview=full&geometries=geojson&steps=false';
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('OSRM: HTTP ' + response.status);
      return this.parseRoute((await response.json()) as RoutingResponse, 'osrm', 'car');
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', abort);
    }
  }

  private parseRoute(data: RoutingResponse, provider: 'valhalla' | 'osrm', mode: TravelMode): CalculatedRoute {
    const route = data.routes?.[0];
    const coordinates = route?.geometry?.coordinates;

    if (!route || !Array.isArray(coordinates) || coordinates.length < 2 ||
        !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
      throw new Error(data.message || 'El servicio no encontró un recorrido transitable.');
    }

    const shape: MapPoint[] = coordinates.map((point) => [Number(point[1]), Number(point[0])]);
    if (shape.some(([lat, lon]) => !Number.isFinite(lat) || !Number.isFinite(lon))) {
      throw new Error('El proveedor devolvió geometría inválida.');
    }

    const label: Record<TravelMode, string> = {
      car: 'Recorrido calculado para automóvil.',
      secondary: 'Trayecto calculado favoreciendo caminos secundarios; no confirma que sean terracerías ni su estado.',
      bicycle: 'Recorrido calculado para bicicleta donde los datos permiten acceso.',
      foot: 'Recorrido calculado para caminar por caminos y senderos registrados.'
    };

    return {
      coordinates: shape,
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      durationMinutes: Math.max(1, Math.round(route.duration / 60)),
      provider,
      note: label[mode] + ' Verifica acceso, clima y condiciones reales antes de salir.'
    };
  }
}
