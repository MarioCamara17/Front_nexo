# NEXO · Mapa y recorridos v2

Este cambio añade búsqueda de puntos turísticos, símbolos por categoría, mapas de calles y relieve, ubicación del visitante (si lo autoriza), ubicación manual de referencia y rutas por diferentes perfiles.

## Uso
1. En **Mapa**, pulsa **Mi ubicación** para solicitar la ubicación. No se consulta hasta que pulses el botón.
2. Si el navegador no proporciona coordenadas, pulsa **Opciones → Elegir ubicación en el mapa** y toca el lugar de referencia.
3. En **Opciones** elige **Auto**, **Caminos secundarios**, **Bicicleta** o **A pie**, y selecciona **Calles** o **Relieve**.
4. Pulsa **Crear ruta**, selecciona marcadores, cambia el orden con ↑/↓ o usa **Ordenar paradas** (orden aproximado por distancia en línea recta).
5. Si quieres partir de la ubicación indicada, marca **Iniciar el recorrido desde mi ubicación**. El trazado se recalcula automáticamente.
6. El mapa muestra kilómetros y tiempo solo si el proveedor confirma un recorrido.

## Limitaciones y seguridad
- «Caminos secundarios» intenta favorecer rutas menores sin priorizar autopistas. **No es un detector de terracerías**, no valida la superficie ni puede garantizar que un camino esté abierto o sea transitable.
- Los senderos y caminos dependen de OpenStreetMap y del proveedor Valhalla. No indica rutas por caminos no cartografiados, ni el derecho de paso.
- **No utilizar la línea roja punteada para navegación:** aparece cuando no se dispone de trazado verificable. No representa una vía.
- Tiempo y kilómetros son aproximaciones del proveedor; comprobar acceso, clima, condiciones reales y restricciones del sitio.
- El optimizador de paradas actual minimiza distancias geográficas entre POI, **no** distancias por la red vial. Para optimización vial real se necesitará una matriz de distancias por perfil.
- La modalidad de viaje elegida y la geometría calculada no se guardan aún en el backend de rutas personalizadas; volverán a calcularse al abrir la ruta.
- Ubicación del usuario solo se solicita por interacción explícita. Para móviles en LAN mediante HTTP (no localhost) la geolocalización puede estar bloqueada por requisitos de contexto seguro: usar HTTPS, el modo manual o las pruebas del navegador.
- El servicio de Valhalla es comunitario, no cuenta con una garantía de disponibilidad; para producción se aconseja proveedor con SLA o instancia propia.
- Los mapas base requieren conexión (OSM / OpenTopoMap) a menos que exista una implementación de mapas locales autorizada.

## Archivos
- `src/app/services/map-routing.service.ts`: Valhalla + respaldo OSRM solo automóvil, métricas y validaciones
- `src/app/components/leaflet-map/leaflet-map.component.ts/.scss`: mapas, marcadores, ubicación y visualización de rutas
- `src/app/pages/mapa/mapa.page.ts/.html/.scss`: búsqueda, controles, constructor y selección de ubicación

## Pruebas sugeridas
```powershell
cd Front_nexo
npm.cmd install
npm.cmd run build
ionic.cmd serve --host 0.0.0.0 --port 8100
```

- Se ve el mapa y los marcadores sin usar geolocalización.
- Los filtros y la búsqueda no eliminan rutas guardadas.
- **Mi ubicación** solicita permiso y dibuja círculo de precisión.
- La ubicación manual funciona aun cuando Edge rechace el permiso.
- Cambiar modo de Auto a Pie vuelve a calcular la ruta, sin reutilizar un trazado de coche.
- Si el proveedor está desconectado, aparece línea punteada de **advertencia**, sin kilómetros inventados.
- Crear y guardar ruta sigue usando el contrato `places: string[]`.
- Abrir ruta desde la sección **Rutas** conserva sus paradas y las redibuja en el mapa.
