import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Copy, Truck as TruckIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const TEMPLATES = [
  {
    title: "Booking Received",
    trigger: "/confirm",
    body: `✓ Booking received.
Seller: [NAME]
Commodity: [COMMODITY]
Units: [UNITS]
Referred by: [COORDINATOR]
Fee: KSH [AMOUNT]
Pay to Till: [TILL NUMBER]
Send M-Pesa confirmation screenshot to lock your slot.
Collection: Engineer Trading Center
Date: [DATE]`,
  },
  {
    title: "Slot Locked After Payment",
    trigger: "/locked",
    body: `✓ Slot confirmed. Payment received.
Your booking is locked.
Arrive at Engineer Trading Center by 6:00 PM on [DATE] with your goods.
Our coordinator will check you in and handle marking on arrival.
Bring: [UNITS] [bags/crates] of [COMMODITY]
See you there.`,
  },
  {
    title: "Trip Day Reminder",
    trigger: "/remind",
    body: `Reminder: Your cargo trip is TODAY.
Collection point: Engineer Trading Center
Deadline: 6:00 PM — no late arrivals accepted.
Bring: [UNITS] [bags/crates] of [COMMODITY]
Our coordinator will receive you on arrival.`,
  },
  {
    title: "Postponement Notice",
    trigger: "/postpone",
    body: `Notice: This week's trip has been postponed.
Your payment of KSH [AMOUNT] is held as credit for next week's trip.
Next scheduled trip: [DATE]
We will confirm your slot automatically.
Apologies for the inconvenience.`,
  },
  {
    title: "Booking Closed",
    trigger: "/closed",
    body: `Bookings for [DATE] trip are now closed.
Next booking window opens [DATE].
Reply then to reserve your slot.`,
  },
];

export default function Settings() {
  const [coords, setCoords] = useState([]);
  const [form, setForm] = useState({ name: "", role: "nairobi", phone: "" });
  const [showForm, setShowForm] = useState(false);

  const load = () => api.listCoordinators().then(setCoords);
  useEffect(() => { load(); }, []);

  const onAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api.createCoordinator(form);
    setForm({ name: "", role: "nairobi", phone: "" });
    setShowForm(false);
    toast.success("Coordinator added");
    load();
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this coordinator?")) return;
    await api.deleteCoordinator(id);
    load();
  };

  const copyTemplate = (body) => {
    navigator.clipboard.writeText(body);
    toast.success("Template copied");
  };

  return (
    <div className="app-shell">
      <div className="topbar flex justify-between items-center">
        <Link to="/" className="btn btn-ghost" data-testid="settings-back">
          <ArrowLeft size={18} /> Back
        </Link>
        <h1 className="font-display text-xl">Settings</h1>
        <div style={{ width: 80 }} />
      </div>

      <h3 className="section-title mt-2">Coordinators</h3>

      {!showForm && (
        <button
          className="btn btn-primary w-full mb-3"
          onClick={() => setShowForm(true)}
          data-testid="add-coord-btn"
        >
          <Plus size={16} /> Add Coordinator
        </button>
      )}

      {showForm && (
        <form onSubmit={onAdd} className="card p-4 mb-3 fade-in" data-testid="coord-form">
          <div className="mb-3">
            <label className="label">Name</label>
            <input
              className="field"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="coord-name-input"
            />
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label">Role</label>
              <select
                className="field"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                data-testid="coord-role-select"
              >
                <option value="nairobi">Nairobi</option>
                <option value="farm">Farm</option>
              </select>
            </div>
            <div>
              <label className="label">Phone (optional)</label>
              <input
                className="field"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                data-testid="coord-phone-input"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-outline flex-1" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary flex-1" data-testid="save-coord-btn">
              Save
            </button>
          </div>
        </form>
      )}

      {coords.length === 0 && <p className="muted text-sm">No coordinators yet.</p>}

      {coords.map((c) => (
        <div
          key={c.id}
          className="card p-3 mb-2 flex items-center justify-between"
          data-testid={`coord-item-${c.id}`}
        >
          <div>
            <div className="font-bold">{c.name}</div>
            <div className="muted text-xs uppercase tracking-wider">
              {c.role}{c.phone ? ` • ${c.phone}` : ""}
            </div>
          </div>
          <button
            className="btn-ghost p-2"
            style={{ color: "#DC2626" }}
            onClick={() => onDelete(c.id)}
            data-testid={`delete-coord-${c.id}`}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}

      <h3 className="section-title mt-6">WhatsApp Templates</h3>
      <div className="card p-4 mb-3" style={{ background: "#F0F9FF", borderColor: "#BFDBFE" }}>
        <p className="text-sm" style={{ color: "#1E40AF" }}>
          Save these as Quick Replies in your WhatsApp Business app. Type the trigger
          (e.g. <span className="kbd">/confirm</span>) in any chat to insert.
        </p>
      </div>

      {TEMPLATES.map((t, i) => (
        <div key={i} className="card p-4 mb-3" data-testid={`template-${i}`}>
          <div className="flex justify-between items-center mb-2">
            <div>
              <div className="font-display text-base">{t.title}</div>
              <span className="kbd mt-1 inline-block">{t.trigger}</span>
            </div>
            <button
              className="btn btn-outline"
              onClick={() => copyTemplate(t.body)}
              data-testid={`copy-template-${i}`}
            >
              <Copy size={14} /> Copy
            </button>
          </div>
          <pre
            className="text-xs whitespace-pre-wrap p-3 rounded"
            style={{ background: "#F8FAFC", border: "1px solid var(--border)", fontFamily: "IBM Plex Sans, sans-serif" }}
          >
            {t.body}
          </pre>
        </div>
      ))}
    </div>
  );
}
