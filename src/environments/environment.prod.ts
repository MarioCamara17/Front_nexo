export const environment = {
  production: true,
  // Nota: el backend de Render actual (back-nexo.onrender.com) no tiene el
  // nuevo agente de chat ni /api/v1/places/nearby/. Mientras se despliega el
  // backend nuevo, se usan URLs relativas para que el proxy/servidor de la
  // misma origen resuelva /api y /media. Reemplazar con la URL del backend
  // Django en producción una vez esté desplegado (p. ej. 'https://api.nexo.mx').
  apiUrl: '',
  apiVersion: 'v1'
};
