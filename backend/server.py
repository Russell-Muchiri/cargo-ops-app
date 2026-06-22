from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============== MODELS ==============

UnitType = Literal["bag", "crate"]
ColorCode = Literal["red", "blue", "yellow", "green", "orange", "purple"]
TripStatus = Literal["booking_open", "confirmed", "in_transit", "delivered"]
TruckStatus = Literal["waiting", "loading", "all_loaded", "departed", "arrived", "unloading", "complete"]
CoordinatorRole = Literal["farm", "nairobi"]

COLOR_CYCLE: List[ColorCode] = ["red", "blue", "yellow", "green", "orange", "purple"]


class Seller(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    truck_id: str
    name: str
    phone: str
    commodity: str
    units: int
    unit_type: UnitType
    color_code: ColorCode
    referred_by: str = ""
    mpesa_reference: str = ""
    fee: float = 0.0
    checked_in: bool = False
    loaded: bool = False
    extraction_confirmed: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SellerCreate(BaseModel):
    name: str
    phone: str
    commodity: str
    units: int
    unit_type: UnitType
    referred_by: str = ""
    mpesa_reference: str = ""
    fee: float = 0.0


class SellerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    commodity: Optional[str] = None
    units: Optional[int] = None
    unit_type: Optional[UnitType] = None
    referred_by: Optional[str] = None
    mpesa_reference: Optional[str] = None
    fee: Optional[float] = None
    checked_in: Optional[bool] = None
    loaded: Optional[bool] = None
    extraction_confirmed: Optional[bool] = None


class Truck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trip_id: str
    number_plate: str
    driver_name: str
    driver_phone: str
    assigned_coordinator: str = ""  # Nairobi coordinator name
    max_units: int = 150
    status: TruckStatus = "waiting"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TruckCreate(BaseModel):
    number_plate: str
    driver_name: str
    driver_phone: str
    assigned_coordinator: str = ""
    max_units: int = 150


class TruckUpdate(BaseModel):
    number_plate: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    assigned_coordinator: Optional[str] = None
    max_units: Optional[int] = None
    status: Optional[TruckStatus] = None


class Trip(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # ISO date
    route_name: str = "Kinangop → Wakulima"
    departure_time: str = "18:00"
    status: TripStatus = "booking_open"
    admin_pin: str = "1234"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TripCreate(BaseModel):
    date: str
    route_name: str = "Kinangop → Wakulima"
    departure_time: str = "18:00"
    admin_pin: str = "1234"


class TripUpdate(BaseModel):
    date: Optional[str] = None
    route_name: Optional[str] = None
    departure_time: Optional[str] = None
    status: Optional[TripStatus] = None
    admin_pin: Optional[str] = None


class Coordinator(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: CoordinatorRole
    phone: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CoordinatorCreate(BaseModel):
    name: str
    role: CoordinatorRole
    phone: str = ""


class CoordinatorUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[CoordinatorRole] = None
    phone: Optional[str] = None


class PinVerify(BaseModel):
    pin: str


# ============== HELPERS ==============

def clean(doc):
    if doc and "_id" in doc:
        doc.pop("_id")
    return doc


async def next_color_for_truck(truck_id: str) -> ColorCode:
    """Auto-assign next unused color on the truck; cycles if all used."""
    used = await db.sellers.distinct("color_code", {"truck_id": truck_id})
    for c in COLOR_CYCLE:
        if c not in used:
            return c
    # all 6 used — cycle by count
    count = await db.sellers.count_documents({"truck_id": truck_id})
    return COLOR_CYCLE[count % 6]


# ============== TRIPS ==============

@api_router.get("/health")
async def health():
    return {"status": "ok"}


@api_router.post("/trips", response_model=Trip)
async def create_trip(payload: TripCreate):
    trip = Trip(**payload.model_dump())
    await db.trips.insert_one(trip.model_dump())
    return trip


@api_router.get("/trips", response_model=List[Trip])
async def list_trips():
    docs = await db.trips.find({}, {"_id": 0}).sort("date", -1).to_list(500)
    return docs


@api_router.get("/trips/{trip_id}", response_model=Trip)
async def get_trip(trip_id: str):
    doc = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Trip not found")
    return doc


@api_router.patch("/trips/{trip_id}", response_model=Trip)
async def update_trip(trip_id: str, payload: TripUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.trips.update_one({"id": trip_id}, {"$set": updates})
    doc = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Trip not found")
    return doc


@api_router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str):
    # cascade delete
    trucks = await db.trucks.find({"trip_id": trip_id}, {"_id": 0, "id": 1}).to_list(1000)
    truck_ids = [t["id"] for t in trucks]
    if truck_ids:
        await db.sellers.delete_many({"truck_id": {"$in": truck_ids}})
    await db.trucks.delete_many({"trip_id": trip_id})
    await db.trips.delete_one({"id": trip_id})
    return {"ok": True}


@api_router.post("/trips/{trip_id}/verify-pin")
async def verify_pin(trip_id: str, payload: PinVerify):
    doc = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Trip not found")
    return {"valid": doc.get("admin_pin", "1234") == payload.pin}


# ============== MANIFEST (aggregate) ==============

@api_router.get("/trips/{trip_id}/manifest")
async def trip_manifest(trip_id: str):
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(404, "Trip not found")
    trucks = await db.trucks.find({"trip_id": trip_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    truck_ids = [t["id"] for t in trucks]
    sellers = []
    if truck_ids:
        sellers = await db.sellers.find({"truck_id": {"$in": truck_ids}}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    coordinators = await db.coordinators.find({}, {"_id": 0}).to_list(500)

    # attach sellers to trucks
    trucks_with_sellers = []
    for t in trucks:
        t_sellers = [s for s in sellers if s["truck_id"] == t["id"]]
        total_units = sum(s["units"] for s in t_sellers)
        checked_in_count = sum(1 for s in t_sellers if s.get("checked_in"))
        loaded_count = sum(1 for s in t_sellers if s.get("loaded"))
        extracted_count = sum(1 for s in t_sellers if s.get("extraction_confirmed"))
        trucks_with_sellers.append({
            **t,
            "sellers": t_sellers,
            "total_units": total_units,
            "seller_count": len(t_sellers),
            "checked_in_count": checked_in_count,
            "loaded_count": loaded_count,
            "extracted_count": extracted_count,
        })

    # coordinator earnings: 1000 KSH per completed truck (status == complete) assigned to them
    coord_earnings = []
    for c in coordinators:
        if c["role"] == "nairobi":
            assigned = [t for t in trucks_with_sellers if t.get("assigned_coordinator") == c["name"]]
            completed = sum(1 for t in assigned if t.get("status") == "complete")
            coord_earnings.append({
                **c,
                "trucks_assigned": len(assigned),
                "trucks_completed": completed,
                "earnings": completed * 1000,
            })
        else:
            coord_earnings.append({**c, "trucks_assigned": 0, "trucks_completed": 0, "earnings": 0})

    return {
        "trip": trip,
        "trucks": trucks_with_sellers,
        "coordinators": coord_earnings,
        "total_sellers": len(sellers),
        "total_units": sum(s["units"] for s in sellers),
    }


# ============== TRUCKS ==============

@api_router.post("/trips/{trip_id}/trucks", response_model=Truck)
async def create_truck(trip_id: str, payload: TruckCreate):
    trip = await db.trips.find_one({"id": trip_id})
    if not trip:
        raise HTTPException(404, "Trip not found")
    count = await db.trucks.count_documents({"trip_id": trip_id})
    if count >= 10:
        raise HTTPException(400, "Maximum 10 trucks per trip")
    truck = Truck(trip_id=trip_id, **payload.model_dump())
    await db.trucks.insert_one(truck.model_dump())
    return truck


@api_router.patch("/trucks/{truck_id}", response_model=Truck)
async def update_truck(truck_id: str, payload: TruckUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.trucks.update_one({"id": truck_id}, {"$set": updates})
    doc = await db.trucks.find_one({"id": truck_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Truck not found")
    return doc


@api_router.delete("/trucks/{truck_id}")
async def delete_truck(truck_id: str):
    await db.sellers.delete_many({"truck_id": truck_id})
    await db.trucks.delete_one({"id": truck_id})
    return {"ok": True}


# ============== SELLERS ==============

@api_router.post("/trucks/{truck_id}/sellers", response_model=Seller)
async def create_seller(truck_id: str, payload: SellerCreate):
    truck = await db.trucks.find_one({"id": truck_id})
    if not truck:
        raise HTTPException(404, "Truck not found")
    color = await next_color_for_truck(truck_id)
    seller = Seller(truck_id=truck_id, color_code=color, **payload.model_dump())
    await db.sellers.insert_one(seller.model_dump())
    return seller


@api_router.patch("/sellers/{seller_id}", response_model=Seller)
async def update_seller(seller_id: str, payload: SellerUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.sellers.update_one({"id": seller_id}, {"$set": updates})
    doc = await db.sellers.find_one({"id": seller_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Seller not found")
    return doc


@api_router.delete("/sellers/{seller_id}")
async def delete_seller(seller_id: str):
    await db.sellers.delete_one({"id": seller_id})
    return {"ok": True}


# ============== COORDINATORS ==============

@api_router.post("/coordinators", response_model=Coordinator)
async def create_coordinator(payload: CoordinatorCreate):
    coord = Coordinator(**payload.model_dump())
    await db.coordinators.insert_one(coord.model_dump())
    return coord


@api_router.get("/coordinators", response_model=List[Coordinator])
async def list_coordinators():
    docs = await db.coordinators.find({}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return docs


@api_router.patch("/coordinators/{coord_id}", response_model=Coordinator)
async def update_coordinator(coord_id: str, payload: CoordinatorUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await db.coordinators.update_one({"id": coord_id}, {"$set": updates})
    doc = await db.coordinators.find_one({"id": coord_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Coordinator not found")
    return doc


@api_router.delete("/coordinators/{coord_id}")
async def delete_coordinator(coord_id: str):
    await db.coordinators.delete_one({"id": coord_id})
    return {"ok": True}


# ============== SEED ==============

@api_router.post("/seed-coordinators")
async def seed_coordinators():
    count = await db.coordinators.count_documents({})
    if count > 0:
        return {"seeded": False, "reason": "already has coordinators"}
    seeds = [
        {"name": "Mwangi (Farm)", "role": "farm", "phone": ""},
        {"name": "Wanjiku", "role": "nairobi", "phone": ""},
        {"name": "Kamau", "role": "nairobi", "phone": ""},
    ]
    for s in seeds:
        c = Coordinator(**s)
        await db.coordinators.insert_one(c.model_dump())
    return {"seeded": True, "count": len(seeds)}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
