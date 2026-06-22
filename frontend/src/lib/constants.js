export const COLOR_CHIPS = ["red", "blue", "yellow", "green", "orange", "purple"];

export const COLOR_HEX = {
  red: "#E53E3E",
  blue: "#3182CE",
  yellow: "#D69E2E",
  green: "#38A169",
  orange: "#DD6B20",
  purple: "#805AD5",
};

export const TRIP_STATUSES = [
  { key: "booking_open", label: "Booking Open", pill: "pill-waiting" },
  { key: "confirmed", label: "Confirmed", pill: "pill-progress" },
  { key: "in_transit", label: "In Transit", pill: "pill-transit" },
  { key: "delivered", label: "Delivered", pill: "pill-complete" },
];

export const TRUCK_STATUSES_FARM = [
  { key: "waiting", label: "Waiting", pill: "pill-waiting" },
  { key: "loading", label: "Loading", pill: "pill-progress" },
  { key: "all_loaded", label: "All Loaded", pill: "pill-progress" },
  { key: "departed", label: "Departed", pill: "pill-transit" },
];

export const TRUCK_STATUSES_NAIROBI = [
  { key: "departed", label: "Awaiting Arrival", pill: "pill-transit" },
  { key: "arrived", label: "Arrived", pill: "pill-progress" },
  { key: "unloading", label: "Unloading", pill: "pill-progress" },
  { key: "complete", label: "Complete", pill: "pill-complete" },
];

export const TRUCK_STATUS_META = {
  waiting: { label: "Waiting", pill: "pill-waiting" },
  loading: { label: "Loading", pill: "pill-progress" },
  all_loaded: { label: "All Loaded", pill: "pill-progress" },
  departed: { label: "Departed", pill: "pill-transit" },
  arrived: { label: "Arrived", pill: "pill-progress" },
  unloading: { label: "Unloading", pill: "pill-progress" },
  complete: { label: "Complete", pill: "pill-complete" },
};

export const formatKsh = (n) =>
  "KSH " + (Number(n) || 0).toLocaleString("en-US");

export const formatDate = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

export const formatTime = (t) => t || "—";
