export interface Municipality {
  id: string;
  name: string;
  description: string;
  state: {
    id: string;
    name: string;
    description: string;
  };
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface Route {
  id: string;
  name: string;
  description: string;
  duration: string;
}

export interface Poi {
  id: string;
  name: string;
  description: string;

  history?: string;
  importance?: string;
  recommendations?: string;
  schedule?: string;
  cost?: string;
  tips?: string;

  latitude: string;
  longitude: string;
  image: string;
  video: string;
  municipality: Municipality;
  category: Category;
  route: Route;
  /** Distancia al punto de referencia, calculada por el cliente o el backend. */
  distance_km?: number;
}

export interface PoiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Poi[];
}