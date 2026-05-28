export const API_BASE = import.meta.env.MODE === "production"
  ? "/api-backend"
  : "http://localhost/planificacion/api-backend";