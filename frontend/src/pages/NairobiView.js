import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Phone, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import {
  formatDate, formatKsh, TRUCK_STATUSES_NAIROBI, TRUCK_STATUS_META,
} from "@/lib/constants";
import Chip from "@/components/Chip";
import ProgressBar from "@/components/ProgressBar";

const COORD_KEY = (tripId) => `cargoops_coord_${tripId}`;

export default function NairobiView() {
  const { tripId } = useParams();
  const [selectedCoord, setSelectedCoord] = useState(
    () => localStorage.getItem(COORD_KEY(tripId)) || ""
  );
  const { data, refresh } = usePolling(() => api.manifest(tripId), 10000, [tripId]);

  if (!data) return <div className="app-shell pt-10 muted">Loading…</div>;

  const trip = data.trip;
  const allCoords = (data.coordinators || []).filter((c) => c.role === "nairobi");
  const allTrucks = data.trucks || [];

  // If no selection yet, prompt to pick
  if (!selectedCoord) {
    return (
      <div className="app-shell">
        <div className="topbar">
          <div className="text-xs muted uppercase tracking-wider font-bold">Nairobi Coordinator</div>
          <div className="font-display text-2xl leading-tight">{formatDate(trip.date)}</div>
        </div>
        <div className="card p-4 mt-3" data-testid="coord-picker">
          <h3 className="font-display text-lg mb-2">Who are you?</h3>
          <p className="muted text-sm mb-3">Select your name to see your trucks.</p>
          {allCoords.length === 0 && (
            <p className="muted text-sm">No Nairobi coordinators on this trip. Ask the admin to add you.</p>
          )}
          <div className="flex flex-col gap-2">
            {allCoords.map((c) => (
              <button
                key={c.id}
                className="btn btn-outline justify-between"
                data-testid={`pick-coord-${c.id}`}
                onClick={() => {
                  localStorage.setItem(COORD_KEY(tripId), c.name);
                  setSelectedCoord(c.name);
                }}
              >
                {c.name} <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const meAgg = allCoords.find((c) => c.name === selectedCoord);
  const myTrucks = allTrucks.filter((t) => t.assigned_coordinator === selectedCoord);
  const earnings = meAgg?.earnings || 0;

  const toggleExtracted = async (seller, truck) => {
    if (!seller.loaded) {
      toast.info("Not yet loaded at farm");
      return;
    }
    if (truck.status === "complete") {
      toast.info("Truck already marked complete");
      return;
    }
    await api.updateSeller(seller.id, { extraction_confirmed: !seller.extraction_confirmed });
    refresh();
  };

  const advanceTruckStatus = async (truck) => {
    const flow = TRUCK_STATUSES_NAIROBI;
    let idx = flow.findIndex((s) => s.key === truck.status);
    if (idx === -1) {
      // before departed — disallow
      toast.info("Truck hasn't departed yet");
      return;
    }
    if (idx === flow.length - 1) {
      toast.info("Truck is already complete");
      return;
    }
    // Block 'complete' unless all extracted
    const next = flow[idx + 1];
    if (next.key === "complete") {
      const allExtracted = (truck.sellers || []).every((s) => s.extraction_confirmed);
      if (!allExtracted) {
        toast.error("Mark all sellers extracted before completing");
        return;
      }
    }
    await api.updateTruck(truck.id, { status: next.key });
    refresh();
  };

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs muted uppercase tracking-wider font-bold">Nairobi · {selectedCoord}</div>
            <div className="font-display text-2xl leading-tight" data-testid="nairobi-date">{formatDate(trip.date)}</div>
            <div className="text-sm muted mt-1">Arrives ~{trip.departure_time}</div>
          </div>
          <button
            className="btn btn-ghost text-xs"
            onClick={() => {
              localStorage.removeItem(COORD_KEY(tripId));
              setSelectedCoord("");
            }}
            data-testid="switch-coord-btn"
          >
            Switch
          </button>
        </div>
      </div>

      <div
        className="card p-4 mb-3 flex justify-between items-center"
        data-testid="nairobi-earnings-card"
      >
        <div>
          <div className="muted text-xs uppercase tracking-wider font-bold">Earnings Today</div>
          <div className="font-display text-3xl" style={{ color: "var(--brand)" }}>
            {formatKsh(earnings)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl">{myTrucks.length}</div>
          <div className="muted text-xs">truck{myTrucks.length === 1 ? "" : "s"} today</div>
        </div>
      </div>

      {myTrucks.length === 0 && (
        <div className="card p-6 text-center muted text-sm">
          No trucks assigned to you on this trip.
        </div>
      )}

      {myTrucks.map((t) => {
        const meta = TRUCK_STATUS_META[t.status] || TRUCK_STATUS_META.waiting;
        const sellers = t.sellers || [];
        const allExtracted = sellers.length > 0 && sellers.every((s) => s.extraction_confirmed);
        const isComplete = t.status === "complete";
        return (
          <div className="card mb-3" key={t.id} data-testid={`nairobi-truck-${t.id}`}>
            <div className="truck-card">
              <button
                onClick={() => advanceTruckStatus(t)}
                className={`pill ${meta.pill} mb-3`}
                disabled={isComplete}
                data-testid={`nairobi-truck-status-${t.id}`}
                style={isComplete ? { cursor: "default" } : {}}
              >
                {t.status === "departed" ? "Awaiting Arrival" : meta.label}
                {!isComplete && " — tap to advance"}
                {!isComplete && <ChevronRight size={16} />}
              </button>

              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="plate truck-plate">{t.number_plate}</div>
                  <a href={`tel:${t.driver_phone}`} className="muted text-sm mt-1 flex items-center gap-1" data-testid={`call-driver-n-${t.id}`}>
                    <Phone size={14} /> {t.driver_name} • {t.driver_phone}
                  </a>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl">{t.total_units}</div>
                  <div className="muted text-xs">units</div>
                </div>
              </div>

              <div className="mb-2">
                <div className="flex justify-between text-xs muted mb-1">
                  <span>Extracted</span>
                  <span>{t.extracted_count} / {sellers.length}</span>
                </div>
                <ProgressBar value={t.extracted_count} max={sellers.length} variant="extracted" />
              </div>

              <div className="divider" />

              {sellers.map((s) => (
                <div
                  key={s.id}
                  className="py-3 flex items-center gap-3"
                  style={{ borderTop: "1px solid var(--border)" }}
                  data-testid={`nairobi-seller-${s.id}`}
                >
                  <Chip color={s.color_code} large />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{s.name}</div>
                    <div className="muted text-sm truncate">
                      {s.units} {s.unit_type}{s.units !== 1 ? "s" : ""} · {s.commodity}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleExtracted(s, t)}
                    disabled={!s.loaded || isComplete}
                    className={`action-btn extract ${s.extraction_confirmed ? "on extract" : ""}`}
                    data-testid={`extract-btn-${s.id}`}
                  >
                    {s.extraction_confirmed && <CheckCircle2 size={16} />}
                    {s.extraction_confirmed ? "Extracted" : "Extract"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
