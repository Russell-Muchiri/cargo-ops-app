import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Truck, Plus, Settings as SettingsIcon, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatDate, TRIP_STATUSES } from "@/lib/constants";

export default function Home() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    route_name: "Kinangop → Wakulima",
    departure_time: "18:00",
    admin_pin: "1234",
  });
  const navigate = useNavigate();

  const load = async () => {
    try {
      const data = await api.listTrips();
      setTrips(data);
    } catch (e) {
      toast.error("Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.seedCoordinators().catch(() => {});
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(form.admin_pin)) {
      toast.error("Admin PIN must be 4 digits");
      return;
    }
    setCreating(true);
    try {
      const trip = await api.createTrip(form);
      toast.success("Trip created");
      navigate(`/trip/${trip.id}`);
    } catch (e) {
      toast.error("Failed to create trip");
    } finally {
      setCreating(false);
    }
  };

  const statusMeta = (s) => TRIP_STATUSES.find((x) => x.key === s) || TRIP_STATUSES[0];

  return (
    <div className="app-shell">
      <div className="topbar flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            style={{ background: "var(--brand)" }}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
          >
            <Truck size={20} color="white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-display leading-none">Cargo Ops</h1>
            <p className="text-xs muted leading-tight mt-0.5">Kinangop → Wakulima</p>
          </div>
        </div>
        <Link
          to="/settings"
          className="btn btn-outline"
          data-testid="nav-settings-btn"
          style={{ minWidth: 44, padding: "0 12px" }}
        >
          <SettingsIcon size={18} />
        </Link>
      </div>

      <div className="mt-4">
        <h2 className="section-title">Active Trips</h2>

        {!showCreate && (
          <button
            data-testid="open-create-trip-btn"
            className="btn btn-primary w-full mb-4"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={18} /> New Trip
          </button>
        )}

        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="card p-4 mb-4 fade-in"
            data-testid="create-trip-form"
          >
            <div className="mb-3">
              <label className="label">Date</label>
              <input
                type="date"
                className="field"
                data-testid="trip-date-input"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div className="mb-3">
              <label className="label">Route</label>
              <input
                className="field"
                data-testid="trip-route-input"
                value={form.route_name}
                onChange={(e) => setForm({ ...form, route_name: e.target.value })}
              />
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="label">Departure</label>
                <input
                  type="time"
                  className="field"
                  data-testid="trip-time-input"
                  value={form.departure_time}
                  onChange={(e) =>
                    setForm({ ...form, departure_time: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Admin PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  className="field"
                  data-testid="trip-pin-input"
                  value={form.admin_pin}
                  onChange={(e) =>
                    setForm({ ...form, admin_pin: e.target.value.replace(/\D/g, "") })
                  }
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-outline flex-1"
                data-testid="cancel-create-trip-btn"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="btn btn-primary flex-1"
                data-testid="submit-create-trip-btn"
              >
                {creating ? "Creating..." : "Create Trip"}
              </button>
            </div>
          </form>
        )}

        {loading && <p className="muted text-sm">Loading…</p>}
        {!loading && trips.length === 0 && !showCreate && (
          <div className="card p-6 text-center">
            <p className="muted text-sm">No trips yet. Create your first trip to get started.</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {trips.map((t) => {
            const meta = statusMeta(t.status);
            return (
              <Link
                key={t.id}
                to={`/trip/${t.id}`}
                className="card p-4 flex items-center justify-between"
                data-testid={`trip-card-${t.id}`}
              >
                <div>
                  <div className="font-display text-lg leading-tight">
                    {formatDate(t.date)}
                  </div>
                  <div className="muted text-sm mt-1">
                    {t.route_name} • {t.departure_time}
                  </div>
                  <div className={`pill ${meta.pill} mt-3`} style={{ width: "auto", padding: "4px 12px", minHeight: 28, fontSize: 11 }}>
                    {meta.label}
                  </div>
                </div>
                <ArrowRight size={20} className="muted" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
