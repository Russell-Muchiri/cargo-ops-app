import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Copy, Plus, Trash2, Truck as TruckIcon, Users, Package, Phone,
  ChevronDown, ChevronUp, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import {
  formatDate, formatKsh, TRIP_STATUSES, TRUCK_STATUS_META,
} from "@/lib/constants";
import Chip from "@/components/Chip";
import ProgressBar from "@/components/ProgressBar";

const PIN_KEY = (id) => `cargoops_pin_${id}`;

export default function AdminTrip() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => !!localStorage.getItem(PIN_KEY(tripId)));
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [coordinators, setCoordinators] = useState([]);
  const [showTruckForm, setShowTruckForm] = useState(false);
  const [showSellerFormFor, setShowSellerFormFor] = useState(null); // truck id
  const [expanded, setExpanded] = useState({}); // truck id -> bool
  const [view, setView] = useState("manifest"); // 'manifest' | 'setup' | 'coords'

  const { data, refresh } = usePolling(
    () => (authed ? api.manifest(tripId) : Promise.resolve(null)),
    10000,
    [tripId, authed]
  );

  useEffect(() => {
    if (authed) api.listCoordinators().then(setCoordinators).catch(() => {});
  }, [authed]);

  const verifyPin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.verifyPin(tripId, pinInput);
      if (res.valid) {
        localStorage.setItem(PIN_KEY(tripId), "1");
        setAuthed(true);
        setPinError("");
      } else {
        setPinError("Wrong PIN");
      }
    } catch {
      setPinError("Trip not found");
    }
  };

  if (!authed) {
    return (
      <div className="app-shell flex items-center" style={{ minHeight: "100vh" }}>
        <form onSubmit={verifyPin} className="card p-6 w-full" data-testid="pin-gate-form">
          <h2 className="font-display text-2xl mb-1">Admin PIN</h2>
          <p className="muted text-sm mb-4">Enter the 4-digit admin PIN to manage this trip.</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            className="field text-center text-2xl tracking-widest"
            data-testid="pin-input"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          {pinError && <p className="text-sm mt-2" style={{ color: "#DC2626" }}>{pinError}</p>}
          <button type="submit" className="btn btn-primary w-full mt-4" data-testid="pin-submit-btn">
            Unlock
          </button>
          <Link to="/" className="btn btn-ghost w-full mt-2">Back</Link>
        </form>
      </div>
    );
  }

  if (!data) return <div className="app-shell pt-10 muted">Loading…</div>;

  const trip = data.trip;
  const trucks = data.trucks || [];
  const totalUnits = data.total_units || 0;
  const totalSellers = data.total_sellers || 0;
  const tripMeta = TRIP_STATUSES.find((s) => s.key === trip.status) || TRIP_STATUSES[0];

  const advanceTripStatus = async () => {
    const idx = TRIP_STATUSES.findIndex((s) => s.key === trip.status);
    const next = TRIP_STATUSES[(idx + 1) % TRIP_STATUSES.length];
    await api.updateTrip(tripId, { status: next.key });
    refresh();
  };

  const copyLink = (path, label) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(`${label} link copied`),
      () => toast.error("Copy failed")
    );
  };

  const onAddTruck = async (form) => {
    try {
      await api.createTruck(tripId, form);
      toast.success("Truck added");
      setShowTruckForm(false);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to add truck");
    }
  };

  const onAddSeller = async (truckId, form) => {
    try {
      await api.createSeller(truckId, form);
      toast.success("Seller added");
      setShowSellerFormFor(null);
      refresh();
    } catch (e) {
      toast.error("Failed to add seller");
    }
  };

  const deleteTruck = async (id) => {
    if (!window.confirm("Delete this truck and all its sellers?")) return;
    await api.deleteTruck(id);
    toast.success("Truck removed");
    refresh();
  };

  const deleteSeller = async (id) => {
    if (!window.confirm("Remove this seller?")) return;
    await api.deleteSeller(id);
    refresh();
  };

  const nairobiCoords = coordinators.filter((c) => c.role === "nairobi");

  return (
    <div className="app-shell">
      <div className="topbar flex items-center justify-between">
        <button onClick={() => navigate("/")} className="btn btn-ghost" data-testid="back-btn">
          <ArrowLeft size={18} /> Trips
        </button>
        <div className="text-right">
          <div className="text-xs muted uppercase tracking-wider font-bold">Admin</div>
          <div className="font-display text-base">{formatDate(trip.date)}</div>
        </div>
      </div>

      {/* Dashboard */}
      <div className="card p-4 mt-2" data-testid="trip-dashboard">
        <div className="flex justify-between items-baseline mb-3">
          <div>
            <div className="font-display text-2xl leading-tight">{trip.route_name}</div>
            <div className="muted text-sm">Departs {trip.departure_time}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Trucks" value={trucks.length} testId="stat-trucks" />
          <Stat label="Sellers" value={totalSellers} testId="stat-sellers" />
          <Stat label="Units" value={totalUnits} testId="stat-units" />
        </div>

        <button
          onClick={advanceTripStatus}
          className={`pill ${tripMeta.pill}`}
          data-testid="trip-status-pill"
        >
          {tripMeta.label} — tap to advance
        </button>
      </div>

      {/* Copy links */}
      <div className="card p-4 mt-3">
        <h3 className="section-title">Share Links</h3>
        <div className="flex flex-col gap-2">
          <button
            className="btn btn-outline justify-between"
            onClick={() => copyLink(`/trip/${trip.id}/farm`, "Farm")}
            data-testid="copy-farm-link"
          >
            <span>Farm Coordinator</span> <Copy size={16} />
          </button>
          <button
            className="btn btn-outline justify-between"
            onClick={() => copyLink(`/trip/${trip.id}/nairobi`, "Nairobi")}
            data-testid="copy-nairobi-link"
          >
            <span>Nairobi Coordinator</span> <Copy size={16} />
          </button>
          <button
            className="btn btn-outline justify-between"
            onClick={() => copyLink(`/trip/${trip.id}`, "Admin")}
            data-testid="copy-admin-link"
          >
            <span>Admin (this view)</span> <Copy size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4">
        <div className="tab-bar" data-testid="admin-tabs">
          <button
            className={view === "manifest" ? "active" : ""}
            onClick={() => setView("manifest")}
            data-testid="tab-manifest"
          >
            Manifest
          </button>
          <button
            className={view === "setup" ? "active" : ""}
            onClick={() => setView("setup")}
            data-testid="tab-setup"
          >
            Setup
          </button>
          <button
            className={view === "coords" ? "active" : ""}
            onClick={() => setView("coords")}
            data-testid="tab-coords"
          >
            Earnings
          </button>
        </div>
      </div>

      {view === "setup" && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="section-title m-0">Trucks ({trucks.length}/10)</h3>
            {!showTruckForm && trucks.length < 10 && (
              <button
                className="btn btn-primary"
                style={{ padding: "0 12px" }}
                onClick={() => setShowTruckForm(true)}
                data-testid="add-truck-btn"
              >
                <Plus size={16} /> Add Truck
              </button>
            )}
          </div>

          {showTruckForm && (
            <TruckForm
              coordinators={nairobiCoords}
              onCancel={() => setShowTruckForm(false)}
              onSubmit={onAddTruck}
            />
          )}

          {trucks.map((t) => (
            <SetupTruckBlock
              key={t.id}
              truck={t}
              coordinators={nairobiCoords}
              showSellerForm={showSellerFormFor === t.id}
              onOpenSellerForm={() => setShowSellerFormFor(t.id)}
              onCloseSellerForm={() => setShowSellerFormFor(null)}
              onAddSeller={(form) => onAddSeller(t.id, form)}
              onDeleteTruck={() => deleteTruck(t.id)}
              onDeleteSeller={deleteSeller}
            />
          ))}
        </div>
      )}

      {view === "manifest" && (
        <div className="mt-3">
          {trucks.length === 0 && (
            <div className="card p-6 text-center muted text-sm">
              No trucks yet. Go to Setup to add the first one.
            </div>
          )}
          {trucks.map((t) => (
            <ManifestTruckCard
              key={t.id}
              truck={t}
              expanded={!!expanded[t.id]}
              toggle={() =>
                setExpanded({ ...expanded, [t.id]: !expanded[t.id] })
              }
            />
          ))}
        </div>
      )}

      {view === "coords" && (
        <div className="mt-3">
          <h3 className="section-title">Coordinator Earnings — Today</h3>
          {(data.coordinators || []).filter((c) => c.role === "nairobi").length === 0 && (
            <div className="card p-6 text-center muted text-sm">
              No Nairobi coordinators yet.{" "}
              <Link to="/settings" className="underline" style={{ color: "var(--brand)" }}>
                Add one in Settings.
              </Link>
            </div>
          )}
          {(data.coordinators || [])
            .filter((c) => c.role === "nairobi")
            .map((c) => (
              <div
                key={c.id}
                className="card p-4 mb-2 flex items-center justify-between"
                data-testid={`coord-earnings-${c.id}`}
              >
                <div>
                  <div className="font-display text-lg">{c.name}</div>
                  <div className="muted text-sm">
                    {c.trucks_completed} of {c.trucks_assigned} trucks complete
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl" style={{ color: "var(--brand)" }}>
                    {formatKsh(c.earnings)}
                  </div>
                  <div className="muted tiny">today</div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

const Stat = ({ label, value, testId }) => (
  <div
    className="rounded-lg p-2 text-center"
    style={{ background: "#F1F5F9" }}
    data-testid={testId}
  >
    <div className="font-display text-2xl leading-none">{value}</div>
    <div className="muted text-xs uppercase tracking-wider mt-1">{label}</div>
  </div>
);

function TruckForm({ coordinators, onCancel, onSubmit }) {
  const [f, setF] = useState({
    number_plate: "",
    driver_name: "",
    driver_phone: "",
    assigned_coordinator: "",
    max_units: 150,
  });
  return (
    <form
      className="card p-4 mb-3 fade-in"
      data-testid="truck-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(f);
      }}
    >
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="label">Number Plate</label>
          <input
            className="field plate"
            required
            value={f.number_plate}
            onChange={(e) => setF({ ...f, number_plate: e.target.value.toUpperCase() })}
            data-testid="truck-plate-input"
            placeholder="KAB 123A"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Driver Name</label>
            <input
              className="field"
              required
              value={f.driver_name}
              onChange={(e) => setF({ ...f, driver_name: e.target.value })}
              data-testid="driver-name-input"
            />
          </div>
          <div>
            <label className="label">Driver Phone</label>
            <input
              className="field"
              required
              value={f.driver_phone}
              onChange={(e) => setF({ ...f, driver_phone: e.target.value })}
              data-testid="driver-phone-input"
              placeholder="0712..."
            />
          </div>
        </div>
        <div>
          <label className="label">Nairobi Coordinator</label>
          <select
            className="field"
            value={f.assigned_coordinator}
            onChange={(e) =>
              setF({ ...f, assigned_coordinator: e.target.value })
            }
            data-testid="assign-coord-select"
          >
            <option value="">— Unassigned —</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Max Units (capacity)</label>
          <input
            type="number"
            className="field"
            min={1}
            value={f.max_units}
            onChange={(e) => setF({ ...f, max_units: parseInt(e.target.value) || 0 })}
            data-testid="max-units-input"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button type="button" className="btn btn-outline flex-1" onClick={onCancel} data-testid="cancel-truck-btn">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary flex-1" data-testid="save-truck-btn">
          Save Truck
        </button>
      </div>
    </form>
  );
}

function SellerForm({ onCancel, onSubmit }) {
  const [f, setF] = useState({
    name: "",
    phone: "",
    commodity: "",
    units: 1,
    unit_type: "bag",
    referred_by: "",
    mpesa_reference: "",
    fee: 0,
  });
  return (
    <form
      className="card p-3 mb-2 fade-in"
      style={{ background: "#F8FAFC" }}
      data-testid="seller-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(f);
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="label">Seller Name</label>
          <input
            className="field"
            required
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            data-testid="seller-name-input"
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            className="field"
            required
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
            data-testid="seller-phone-input"
          />
        </div>
        <div>
          <label className="label">Commodity</label>
          <input
            className="field"
            required
            value={f.commodity}
            onChange={(e) => setF({ ...f, commodity: e.target.value })}
            data-testid="seller-commodity-input"
            placeholder="Cabbage, Potatoes…"
          />
        </div>
        <div>
          <label className="label">Units</label>
          <input
            type="number"
            min={1}
            className="field"
            required
            value={f.units}
            onChange={(e) => setF({ ...f, units: parseInt(e.target.value) || 0 })}
            data-testid="seller-units-input"
          />
        </div>
        <div>
          <label className="label">Unit Type</label>
          <select
            className="field"
            value={f.unit_type}
            onChange={(e) => setF({ ...f, unit_type: e.target.value })}
            data-testid="seller-unittype-select"
          >
            <option value="bag">Bag</option>
            <option value="crate">Crate</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Referred By (Coordinator name)</label>
          <input
            className="field"
            value={f.referred_by}
            onChange={(e) => setF({ ...f, referred_by: e.target.value })}
            data-testid="seller-referred-input"
            placeholder="e.g. Wanjiku"
          />
        </div>
        <div>
          <label className="label">M-Pesa Ref</label>
          <input
            className="field"
            value={f.mpesa_reference}
            onChange={(e) => setF({ ...f, mpesa_reference: e.target.value })}
            data-testid="seller-mpesa-input"
          />
        </div>
        <div>
          <label className="label">Fee (KSH)</label>
          <input
            type="number"
            min={0}
            className="field"
            value={f.fee}
            onChange={(e) => setF({ ...f, fee: parseFloat(e.target.value) || 0 })}
            data-testid="seller-fee-input"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button type="button" className="btn btn-outline flex-1" onClick={onCancel} data-testid="cancel-seller-btn">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary flex-1" data-testid="save-seller-btn">
          Save Seller
        </button>
      </div>
    </form>
  );
}

function SetupTruckBlock({
  truck, coordinators, showSellerForm, onOpenSellerForm, onCloseSellerForm,
  onAddSeller, onDeleteTruck, onDeleteSeller,
}) {
  const sellers = truck.sellers || [];
  const used = truck.total_units;
  const cap = truck.max_units || 150;
  const pct = cap > 0 ? (used / cap) * 100 : 0;
  const near = pct >= 80;
  return (
    <div className="card mb-3" data-testid={`truck-block-${truck.id}`}>
      <div className="truck-card">
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="plate truck-plate">{truck.number_plate}</div>
            <div className="muted text-sm mt-1">
              {truck.driver_name} • {truck.driver_phone}
            </div>
            <div className="text-sm mt-1">
              <span className="muted">Coordinator: </span>
              <span className="font-bold">
                {truck.assigned_coordinator || "Unassigned"}
              </span>
            </div>
          </div>
          <button
            className="btn-ghost p-2 rounded"
            onClick={onDeleteTruck}
            data-testid={`delete-truck-${truck.id}`}
            style={{ color: "#DC2626" }}
          >
            <Trash2 size={18} />
          </button>
        </div>

        <div className={`flex items-center justify-between text-sm mb-1 ${near ? "" : ""}`}>
          <span className="muted">{used} / {cap} units</span>
          {near && (
            <span className="flex items-center gap-1 font-bold" style={{ color: "#D97706" }}>
              <AlertTriangle size={14} /> Approaching capacity
            </span>
          )}
        </div>
        <ProgressBar value={used} max={cap} variant="loaded" testId={`cap-bar-${truck.id}`} />

        <div className="divider" />

        <div className="flex justify-between items-center mb-2">
          <div className="muted text-sm">
            <Users size={14} className="inline mr-1" />
            {sellers.length} seller{sellers.length === 1 ? "" : "s"}
          </div>
          {!showSellerForm && (
            <button className="btn btn-outline" onClick={onOpenSellerForm} data-testid={`add-seller-${truck.id}`}>
              <Plus size={16} /> Add Seller
            </button>
          )}
        </div>

        {showSellerForm && (
          <SellerForm onCancel={onCloseSellerForm} onSubmit={onAddSeller} />
        )}

        {sellers.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 py-2"
            style={{ borderTop: "1px solid var(--border)" }}
            data-testid={`seller-row-${s.id}`}
          >
            <Chip color={s.color_code} />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{s.name}</div>
              <div className="muted text-xs truncate">
                {s.units} {s.unit_type}{s.units !== 1 ? "s" : ""} · {s.commodity}
                {s.referred_by ? ` · ref: ${s.referred_by}` : ""}
              </div>
            </div>
            <button
              className="btn-ghost p-2"
              style={{ color: "#DC2626" }}
              onClick={() => onDeleteSeller(s.id)}
              data-testid={`delete-seller-${s.id}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManifestTruckCard({ truck, expanded, toggle }) {
  const sellers = truck.sellers || [];
  const meta = TRUCK_STATUS_META[truck.status] || TRUCK_STATUS_META.waiting;
  return (
    <div className="card mb-3" data-testid={`manifest-truck-${truck.id}`}>
      <div className="truck-card">
        <div className={`pill ${meta.pill} mb-3`} style={{ cursor: "default" }}>{meta.label}</div>
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="plate truck-plate">{truck.number_plate}</div>
            <div className="muted text-sm mt-1">
              {truck.driver_name} • {truck.driver_phone}
            </div>
            <div className="text-sm mt-1">
              <span className="muted">Coord: </span>
              <span className="font-bold">
                {truck.assigned_coordinator || "—"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl">{truck.total_units}</div>
            <div className="muted text-xs">units</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-xs muted mb-1">
            <span>Checked in</span>
            <span>{truck.checked_in_count} / {sellers.length}</span>
          </div>
          <ProgressBar value={truck.checked_in_count} max={sellers.length} variant="checkin" />
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-xs muted mb-1">
            <span>Loaded</span>
            <span>{truck.loaded_count} / {sellers.length}</span>
          </div>
          <ProgressBar value={truck.loaded_count} max={sellers.length} variant="loaded" />
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-xs muted mb-1">
            <span>Extracted (Nairobi)</span>
            <span>{truck.extracted_count} / {sellers.length}</span>
          </div>
          <ProgressBar value={truck.extracted_count} max={sellers.length} variant="extracted" />
        </div>

        <button
          className="btn btn-ghost w-full mt-3"
          onClick={toggle}
          data-testid={`expand-truck-${truck.id}`}
        >
          {expanded ? <><ChevronUp size={16} /> Hide sellers</> : <><ChevronDown size={16} /> Show sellers</>}
        </button>

        {expanded && (
          <div className="mt-2">
            {sellers.length === 0 && <p className="muted text-sm">No sellers yet.</p>}
            {sellers.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 py-2"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <Chip color={s.color_code} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{s.name}</div>
                  <div className="muted text-xs truncate">
                    {s.units} {s.unit_type}{s.units !== 1 ? "s" : ""} · {s.commodity}
                  </div>
                </div>
                <div className="flex gap-1">
                  <StatusDot on={s.checked_in} label="C" title="Checked in" />
                  <StatusDot on={s.loaded} label="L" title="Loaded" />
                  <StatusDot on={s.extraction_confirmed} label="E" title="Extracted" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const StatusDot = ({ on, label, title }) => (
  <span
    title={title}
    className="inline-flex items-center justify-center font-bold"
    style={{
      width: 24,
      height: 24,
      borderRadius: 6,
      fontSize: 11,
      background: on ? "var(--brand)" : "#E2E8F0",
      color: on ? "white" : "#94A3B8",
    }}
  >
    {label}
  </span>
);
