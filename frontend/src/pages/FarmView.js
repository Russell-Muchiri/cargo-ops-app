import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Phone, Info, CheckCircle2, Truck as TruckIcon, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { formatDate, TRUCK_STATUSES_FARM, TRUCK_STATUS_META, COLOR_HEX } from "@/lib/constants";
import Chip from "@/components/Chip";
import ProgressBar from "@/components/ProgressBar";

export default function FarmView() {
  const { tripId } = useParams();
  const { data, refresh } = usePolling(() => api.manifest(tripId), 10000, [tripId]);

  if (!data) return <div className="app-shell pt-10 muted">Loading…</div>;
  const trip = data.trip;
  const trucks = data.trucks || [];

  const toggleCheckin = async (seller) => {
    const nextChecked = !seller.checked_in;
    await api.updateSeller(seller.id, {
      checked_in: nextChecked,
      // un-loaded if we are uncheckin-ing
      ...(nextChecked ? {} : { loaded: false }),
    });
    refresh();
  };

  const toggleLoaded = async (seller) => {
    if (!seller.checked_in) {
      toast.info("Check in seller first");
      return;
    }
    await api.updateSeller(seller.id, { loaded: !seller.loaded });
    refresh();
  };

  const advanceTruckStatus = async (truck) => {
    const flow = TRUCK_STATUSES_FARM;
    let idx = flow.findIndex((s) => s.key === truck.status);
    if (idx === -1) idx = -1; // treat as before waiting
    const next = flow[Math.min(idx + 1, flow.length - 1)];
    if (next.key === truck.status) {
      toast.info("Truck is already departed");
      return;
    }
    await api.updateTruck(truck.id, { status: next.key });
    refresh();
  };

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="text-xs muted uppercase tracking-wider font-bold">Farm Coordinator</div>
        <div className="font-display text-2xl leading-tight" data-testid="farm-date">{formatDate(trip.date)}</div>
        <div className="text-sm muted mt-1">
          Departs {trip.departure_time} • Engineer Trading Center
        </div>
      </div>

      {/* Kit info */}
      <div
        className="card p-4 mb-3"
        style={{ background: "#FEF3C7", borderColor: "#FCD34D" }}
        data-testid="kit-info"
      >
        <div className="flex items-start gap-2">
          <Info size={18} style={{ color: "#92400E", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="font-bold text-sm" style={{ color: "#92400E" }}>
              Your kit: 6 rolls of colored tape
            </div>
            <p className="text-sm mt-1" style={{ color: "#78350F" }}>
              Match the tape color to each seller&apos;s chip. Tape EVERY bag and crate
              before loading.
            </p>
            <div className="flex gap-2 mt-3">
              {Object.entries(COLOR_HEX).map(([k, v]) => (
                <Chip key={k} color={k} large testId={`kit-chip-${k}`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {trucks.length === 0 && (
        <div className="card p-6 text-center muted text-sm">
          No trucks assigned to this trip yet.
        </div>
      )}

      {trucks.map((t) => {
        const meta = TRUCK_STATUS_META[t.status] || TRUCK_STATUS_META.waiting;
        const sellers = t.sellers || [];
        const isDeparted = ["departed", "arrived", "unloading", "complete"].includes(t.status);
        return (
          <div className="card mb-3" key={t.id} data-testid={`farm-truck-${t.id}`}>
            <div className="truck-card">
              <button
                onClick={() => advanceTruckStatus(t)}
                className={`pill ${meta.pill} mb-3`}
                disabled={isDeparted}
                data-testid={`farm-truck-status-${t.id}`}
                style={isDeparted ? { cursor: "default", opacity: 0.9 } : {}}
              >
                {meta.label}{!isDeparted && " — tap to advance"}
                {!isDeparted && <ChevronRight size={16} />}
              </button>

              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="plate truck-plate">{t.number_plate}</div>
                  <a href={`tel:${t.driver_phone}`} className="muted text-sm mt-1 flex items-center gap-1" data-testid={`call-driver-${t.id}`}>
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
                  <span>Checked in</span>
                  <span>{t.checked_in_count} / {sellers.length}</span>
                </div>
                <ProgressBar value={t.checked_in_count} max={sellers.length} variant="checkin" />
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-xs muted mb-1">
                  <span>Loaded</span>
                  <span>{t.loaded_count} / {sellers.length}</span>
                </div>
                <ProgressBar value={t.loaded_count} max={sellers.length} variant="loaded" />
              </div>

              <div className="divider" />

              {sellers.length === 0 && (
                <p className="muted text-sm text-center py-2">No sellers on this truck yet.</p>
              )}

              {sellers.map((s) => (
                <div
                  key={s.id}
                  className="py-3"
                  style={{ borderTop: "1px solid var(--border)" }}
                  data-testid={`farm-seller-${s.id}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Chip color={s.color_code} large />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{s.name}</div>
                      <div className="muted text-sm truncate">
                        {s.units} {s.unit_type}{s.units !== 1 ? "s" : ""} · {s.commodity}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleCheckin(s)}
                      className={`action-btn checkin flex-1 ${s.checked_in ? "on checkin" : ""}`}
                      data-testid={`checkin-btn-${s.id}`}
                    >
                      {s.checked_in && <CheckCircle2 size={16} />}
                      {s.checked_in ? "Checked In" : "Check In"}
                    </button>
                    <button
                      onClick={() => toggleLoaded(s)}
                      disabled={!s.checked_in}
                      className={`action-btn flex-1 ${s.loaded ? "on" : ""}`}
                      data-testid={`loaded-btn-${s.id}`}
                    >
                      {s.loaded && <CheckCircle2 size={16} />}
                      {s.loaded ? "Loaded" : "Loaded?"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
