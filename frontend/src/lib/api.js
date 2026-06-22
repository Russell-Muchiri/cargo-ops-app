import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API });

export const api = {
  // trips
  listTrips: () => http.get("/trips").then((r) => r.data),
  getTrip: (id) => http.get(`/trips/${id}`).then((r) => r.data),
  createTrip: (body) => http.post("/trips", body).then((r) => r.data),
  updateTrip: (id, body) => http.patch(`/trips/${id}`, body).then((r) => r.data),
  deleteTrip: (id) => http.delete(`/trips/${id}`).then((r) => r.data),
  verifyPin: (id, pin) =>
    http.post(`/trips/${id}/verify-pin`, { pin }).then((r) => r.data),
  manifest: (id) => http.get(`/trips/${id}/manifest`).then((r) => r.data),

  // trucks
  createTruck: (tripId, body) =>
    http.post(`/trips/${tripId}/trucks`, body).then((r) => r.data),
  updateTruck: (id, body) =>
    http.patch(`/trucks/${id}`, body).then((r) => r.data),
  deleteTruck: (id) => http.delete(`/trucks/${id}`).then((r) => r.data),

  // sellers
  createSeller: (truckId, body) =>
    http.post(`/trucks/${truckId}/sellers`, body).then((r) => r.data),
  updateSeller: (id, body) =>
    http.patch(`/sellers/${id}`, body).then((r) => r.data),
  deleteSeller: (id) => http.delete(`/sellers/${id}`).then((r) => r.data),

  // coordinators
  listCoordinators: () => http.get("/coordinators").then((r) => r.data),
  createCoordinator: (body) =>
    http.post("/coordinators", body).then((r) => r.data),
  updateCoordinator: (id, body) =>
    http.patch(`/coordinators/${id}`, body).then((r) => r.data),
  deleteCoordinator: (id) =>
    http.delete(`/coordinators/${id}`).then((r) => r.data),
  seedCoordinators: () => http.post("/seed-coordinators").then((r) => r.data),
};
