import { TestBed } from '@angular/core/testing';
import { MapRoutingService } from './map-routing.service';

describe('MapRoutingService', () => {
  let service: MapRoutingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MapRoutingService);
  });

  it('rejects invalid coordinates and insufficient stops', async () => {
    await expectAsync(service.calculate([[17.8, -91.5]], 'car')).toBeRejected();
    await expectAsync(service.calculate([[NaN, -91.5], [17.8, -91.6]], 'foot')).toBeRejected();
  });

  it('uses confirmed geometry, distance and duration from Valhalla', async () => {
    const api = {
      code: 'Ok',
      routes: [{
        distance: 12500,
        duration: 1800,
        geometry: { type: 'LineString', coordinates: [[-91.5, 17.8], [-91.6, 17.9]] }
      }]
    };
    spyOn(window, 'fetch').and.resolveTo(
      new Response(JSON.stringify(api), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const result = await service.calculate([[17.8, -91.5], [17.9, -91.6]], 'foot');
    expect(result.provider).toBe('valhalla');
    expect(result.distanceKm).toBe(12.5);
    expect(result.durationMinutes).toBe(30);
    expect(result.coordinates).toEqual([[17.8, -91.5], [17.9, -91.6]]);
  });

  it('does not silently fall back to a car route for walking requests', async () => {
    const request = spyOn(window, 'fetch').and.rejectWith(new Error('No hay ruta'));
    await expectAsync(
      service.calculate([[17.8, -91.5], [17.9, -91.6]], 'foot')
    ).toBeRejected();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('falls back to the OSRM driving provider only for car mode', async () => {
    const api = {
      code: 'Ok',
      routes: [{
        distance: 3400,
        duration: 600,
        geometry: { type: 'LineString', coordinates: [[-91.5, 17.8], [-91.6, 17.9]] }
      }]
    };
    const request = spyOn(window, 'fetch');
    request.and.returnValues(
      Promise.reject(new Error('Valhalla unavailable')),
      Promise.resolve(new Response(JSON.stringify(api), { status: 200 }))
    );

    const result = await service.calculate([[17.8, -91.5], [17.9, -91.6]], 'car');
    expect(result.provider).toBe('osrm');
    expect(result.distanceKm).toBe(3.4);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
