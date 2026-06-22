"""Backend tests for Cargo Ops PWA — trips, trucks, sellers, coordinators, manifest."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://load-manifest.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture
def trip(s):
    r = s.post(f"{API}/trips", json={"date": "2026-01-20", "admin_pin": "1234"})
    assert r.status_code == 200, r.text
    t = r.json()
    yield t
    s.delete(f"{API}/trips/{t['id']}")


# ---------- health ----------
def test_health(s):
    r = s.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ---------- trips ----------
def test_create_list_get_patch_trip(s, trip):
    tid = trip["id"]
    assert trip["status"] == "booking_open"
    assert trip["admin_pin"] == "1234"

    r = s.get(f"{API}/trips")
    assert r.status_code == 200
    assert any(t["id"] == tid for t in r.json())

    r = s.get(f"{API}/trips/{tid}")
    assert r.status_code == 200 and r.json()["id"] == tid

    r = s.patch(f"{API}/trips/{tid}", json={"status": "confirmed"})
    assert r.status_code == 200 and r.json()["status"] == "confirmed"


def test_verify_pin(s, trip):
    tid = trip["id"]
    r = s.post(f"{API}/trips/{tid}/verify-pin", json={"pin": "1234"})
    assert r.status_code == 200 and r.json()["valid"] is True
    r = s.post(f"{API}/trips/{tid}/verify-pin", json={"pin": "0000"})
    assert r.status_code == 200 and r.json()["valid"] is False


def test_delete_trip_cascades(s):
    r = s.post(f"{API}/trips", json={"date": "2026-01-21"})
    tid = r.json()["id"]
    tr = s.post(f"{API}/trips/{tid}/trucks", json={
        "number_plate": "KAA111A", "driver_name": "D", "driver_phone": "0700"
    }).json()
    s.post(f"{API}/trucks/{tr['id']}/sellers", json={
        "name": "S", "phone": "0700", "commodity": "Maize", "units": 5, "unit_type": "bag"
    })
    assert s.delete(f"{API}/trips/{tid}").status_code == 200
    assert s.get(f"{API}/trips/{tid}").status_code == 404


# ---------- trucks ----------
def test_truck_limit_10(s, trip):
    tid = trip["id"]
    for i in range(10):
        r = s.post(f"{API}/trips/{tid}/trucks", json={
            "number_plate": f"KAA{i:03d}", "driver_name": "D", "driver_phone": "0700"
        })
        assert r.status_code == 200, f"truck {i}: {r.text}"
    r = s.post(f"{API}/trips/{tid}/trucks", json={
        "number_plate": "KAA999", "driver_name": "D", "driver_phone": "0700"
    })
    assert r.status_code == 400


def test_truck_update_and_delete_cascades(s, trip):
    tid = trip["id"]
    tr = s.post(f"{API}/trips/{tid}/trucks", json={
        "number_plate": "KAB001", "driver_name": "D", "driver_phone": "0700"
    }).json()
    r = s.patch(f"{API}/trucks/{tr['id']}", json={"status": "loading"})
    assert r.status_code == 200 and r.json()["status"] == "loading"

    seller = s.post(f"{API}/trucks/{tr['id']}/sellers", json={
        "name": "S", "phone": "0700", "commodity": "X", "units": 1, "unit_type": "bag"
    }).json()
    s.delete(f"{API}/trucks/{tr['id']}")
    r = s.patch(f"{API}/sellers/{seller['id']}", json={"checked_in": True})
    assert r.status_code == 404


# ---------- sellers — color auto-assign ----------
def test_seller_color_auto_assign_cycle(s, trip):
    tid = trip["id"]
    tr = s.post(f"{API}/trips/{tid}/trucks", json={
        "number_plate": "KAC001", "driver_name": "D", "driver_phone": "0700"
    }).json()
    expected = ["red", "blue", "yellow", "green", "orange", "purple"]
    for i, c in enumerate(expected):
        r = s.post(f"{API}/trucks/{tr['id']}/sellers", json={
            "name": f"S{i}", "phone": "0700", "commodity": "X", "units": 1, "unit_type": "bag"
        })
        assert r.status_code == 200
        assert r.json()["color_code"] == c, f"seller {i}: expected {c}, got {r.json()['color_code']}"
    # 7th should cycle to red
    r = s.post(f"{API}/trucks/{tr['id']}/sellers", json={
        "name": "S6", "phone": "0700", "commodity": "X", "units": 1, "unit_type": "bag"
    })
    assert r.json()["color_code"] == "red"


def test_seller_update_flags(s, trip):
    tid = trip["id"]
    tr = s.post(f"{API}/trips/{tid}/trucks", json={
        "number_plate": "KAD001", "driver_name": "D", "driver_phone": "0700"
    }).json()
    seller = s.post(f"{API}/trucks/{tr['id']}/sellers", json={
        "name": "S", "phone": "0700", "commodity": "X", "units": 1, "unit_type": "bag"
    }).json()
    for flag in ["checked_in", "loaded", "extraction_confirmed"]:
        r = s.patch(f"{API}/sellers/{seller['id']}", json={flag: True})
        assert r.status_code == 200 and r.json()[flag] is True


# ---------- coordinators ----------
def test_seed_coordinators_idempotent(s):
    # ensure seed exists (may have already been seeded)
    r1 = s.post(f"{API}/seed-coordinators")
    assert r1.status_code == 200
    r2 = s.post(f"{API}/seed-coordinators")
    assert r2.status_code == 200 and r2.json()["seeded"] is False


def test_create_coordinator(s):
    name = f"TEST_{uuid.uuid4().hex[:6]}"
    r = s.post(f"{API}/coordinators", json={"name": name, "role": "nairobi"})
    assert r.status_code == 200 and r.json()["role"] == "nairobi"
    cid = r.json()["id"]
    assert any(c["id"] == cid for c in s.get(f"{API}/coordinators").json())
    s.delete(f"{API}/coordinators/{cid}")


# ---------- manifest aggregation ----------
def test_manifest_aggregation_and_earnings(s, trip):
    tid = trip["id"]
    # ensure a known nairobi coord
    coord_name = f"TEST_NBO_{uuid.uuid4().hex[:6]}"
    coord = s.post(f"{API}/coordinators", json={"name": coord_name, "role": "nairobi"}).json()

    tr = s.post(f"{API}/trips/{tid}/trucks", json={
        "number_plate": "KAE001", "driver_name": "D", "driver_phone": "0700",
        "assigned_coordinator": coord_name, "max_units": 100,
    }).json()

    sellers = []
    for i in range(3):
        sellers.append(s.post(f"{API}/trucks/{tr['id']}/sellers", json={
            "name": f"S{i}", "phone": "0700", "commodity": "X", "units": 10, "unit_type": "bag"
        }).json())

    # mark one checked_in, one loaded, one extracted
    s.patch(f"{API}/sellers/{sellers[0]['id']}", json={"checked_in": True})
    s.patch(f"{API}/sellers/{sellers[1]['id']}", json={"loaded": True})
    s.patch(f"{API}/sellers/{sellers[2]['id']}", json={"extraction_confirmed": True})

    m = s.get(f"{API}/trips/{tid}/manifest").json()
    truck = next(t for t in m["trucks"] if t["id"] == tr["id"])
    assert truck["total_units"] == 30
    assert truck["seller_count"] == 3
    assert truck["checked_in_count"] == 1
    assert truck["loaded_count"] == 1
    assert truck["extracted_count"] == 1

    # before completion — earnings 0
    me = next(c for c in m["coordinators"] if c["id"] == coord["id"])
    assert me["trucks_assigned"] == 1
    assert me["trucks_completed"] == 0
    assert me["earnings"] == 0

    # mark complete -> earnings 1000
    s.patch(f"{API}/trucks/{tr['id']}", json={"status": "complete"})
    m2 = s.get(f"{API}/trips/{tid}/manifest").json()
    me2 = next(c for c in m2["coordinators"] if c["id"] == coord["id"])
    assert me2["trucks_completed"] == 1
    assert me2["earnings"] == 1000

    s.delete(f"{API}/coordinators/{coord['id']}")


def test_manifest_404(s):
    assert s.get(f"{API}/trips/does-not-exist/manifest").status_code == 404
