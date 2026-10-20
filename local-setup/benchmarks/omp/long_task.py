"""s-fleet-session: a 10-prompt session over a 32-module project, long enough to grow past 128K tokens, so the
compaction threshold decides when (and whether) omp compacts. Imported by make_tasks.py (the task) and
validate_checks.py (the reference solution). Deterministic: the same files every time."""
import json
import random
import textwrap
from pathlib import Path

NAMES = ["atlas", "bison", "condor", "dingo", "egret", "falcon", "gecko", "heron", "ibis", "jackal", "kestrel",
         "lynx", "marten", "narwhal", "ocelot", "puffin", "quokka", "raven", "stoat", "tapir", "urchin", "vole",
         "walrus", "xerus", "yak", "zebu", "avocet", "bittern", "caracal", "dunlin", "eland", "fossa"]
assert len(NAMES) == 32 and not any(a != b and a in b for a in NAMES for b in NAMES)

FUELS = (["electric"] * 8 + ["diesel"] * 10 + ["petrol"] * 8 + ["hybrid"] * 6)
# needs_service bugs: name -> wrong comparison (the docstring says: at least SERVICE_KM since the last service)
SERVICE_BUGS = {
    "bison": "odometer_km - last_service_km > SERVICE_KM",
    "heron": "odometer_km >= SERVICE_KM",
    "lynx": "odometer_km - last_service_km >= SERVICE_KM + 1000",
    "puffin": "last_service_km - odometer_km >= SERVICE_KM",
    "tapir": "odometer_km - last_service_km >= SERVICE_KM // 2",
    "xerus": "odometer_km - last_service_km >= MAX_LOAD_KG",
    "caracal": "odometer_km - last_service_km >= SERVICE_KM * 1.1",
}
# load_cost bugs: name -> which mistake
COST_BUGS = {"dingo": "no_min", "egret": "flat_tier", "ocelot": "floor", "quokka": "no_max",
             "stoat": "swap", "zebu": "tier_edge"}


def spec():
    rng = random.Random(7)
    fuels = FUELS[:]
    rng.shuffle(fuels)
    out = {}
    low_electric = 0
    for i, name in enumerate(NAMES):
        fuel = fuels[i]
        if fuel == "electric":
            service = rng.choice([12000, 14000, 15000, 16000, 18000]) if low_electric < 5 else rng.choice([22000, 25000, 30000])
            low_electric += 1
        else:
            service = rng.choice([10000, 12000, 15000, 20000, 25000, 30000])
        max_load = rng.choice([1800, 2500, 3500, 4200, 5500, 6400, 7200, 8000, 9500, 12000])
        family = ["flat", "tier", "block"][i % 3]
        if family == "flat":
            cost = {"family": "flat", "rate": rng.choice([0.08, 0.12, 0.15, 0.2, 0.25]), "min": rng.choice([25, 40, 60, 75])}
        elif family == "tier":
            cost = {"family": "tier", "t": rng.choice([500, 1000, 1500]), "r1": rng.choice([0.3, 0.25, 0.2]),
                    "r2": rng.choice([0.1, 0.12, 0.15])}
        else:
            cost = {"family": "block", "kg": rng.choice([250, 400, 500]), "price": rng.choice([18.0, 22.5, 30.0, 35.0])}
        out[name] = {"fuel": fuel, "service": service, "max_load": max_load, "cost": cost, "seed": i}
    # the bug families must match the cost family they break
    fam = {"no_min": "flat", "swap": "flat", "flat_tier": "tier", "tier_edge": "tier", "floor": "block", "no_max": None}
    for n, b in COST_BUGS.items():
        assert fam[b] in (None, out[n]["cost"]["family"]), (n, b, out[n]["cost"]["family"])
    return out


def final_service(s):
    return max(s["service"], 20000) if s["fuel"] == "electric" else s["service"]


def expected_cost(c, kg):
    import math
    if c["family"] == "flat":
        v = max(kg * c["rate"], c["min"])
    elif c["family"] == "tier":
        v = min(kg, c["t"]) * c["r1"] + max(kg - c["t"], 0) * c["r2"]
    else:
        v = math.ceil(kg / c["kg"]) * c["price"]
    return round(v, 2)


# ------------------------------------------------------------------------------------------------ module text
POOL_PURPOSE = ["regional deliveries between the northern depots", "night runs to the harbour warehouses",
                "the city centre loop with short stops", "long-haul trips across the inland routes",
                "refrigerated food deliveries", "building-site supply runs", "parcel collection from retail partners",
                "airport cargo transfers", "furniture and white-goods deliveries", "medical supply runs to clinics"]
POOL_NOTES = [
    "Drivers report the cab is comfortable on long shifts, but the mirrors need adjusting before every trip.",
    "The loading ramp is slow in cold weather; allow extra time at the first stop of a winter morning.",
    "Insurance requires a signed manifest for every trip, including empty return legs.",
    "The telematics unit reports position every thirty seconds and stores a day of data when offline.",
    "Tyres are rotated at every service; the spare is checked monthly by the depot crew.",
    "Route planners should avoid the low bridge on the old ring road for this model.",
    "The vehicle may be lent to another depot for at most two weeks without a new inspection.",
    "Fuel cards are tied to the vehicle, not the driver; report a lost card the same day.",
    "Cargo straps are inspected at the start of each shift and replaced when frayed.",
    "The dashboard warning for low coolant is known to trigger early; check the level before reporting it.",
    "Parking at the customer's site needs a permit on weekdays between seven and ten.",
    "Accident reports go to the fleet office within twenty-four hours, with photos of both vehicles.",
]
CHECKS = ["brakes", "lights", "horn", "mirrors", "wipers", "tyre pressure", "tyre tread", "seat belts", "fire extinguisher",
          "first aid kit", "warning triangle", "load straps", "doors and locks", "fluid levels", "battery terminals",
          "dashboard warnings", "tachograph", "number plates", "spare wheel", "reversing camera"]


def cost_code(c, bug):
    lim = ("    if kg < 0:\n        raise ValueError(\"load must be >= 0\")\n"
           + ("" if bug == "no_max" else "    if kg > MAX_LOAD_KG:\n        raise ValueError(\"load above MAX_LOAD_KG\")\n"))
    if c["family"] == "flat":
        consts = f"RATE_PER_KG = {c['rate']}\nMIN_CHARGE = {c['min']}\n"
        doc = ("Cost of carrying kg kilograms: RATE_PER_KG per kg, but never less than MIN_CHARGE.\n\n"
               "    Raises ValueError for a negative load or a load above MAX_LOAD_KG. Rounded to cents.")
        body = {"no_min": "kg * RATE_PER_KG", "swap": "max(kg * MIN_CHARGE, RATE_PER_KG)"}.get(bug, "max(kg * RATE_PER_KG, MIN_CHARGE)")
    elif c["family"] == "tier":
        consts = f"TIER_KG = {c['t']}\nTIER_RATE = {c['r1']}\nOVER_RATE = {c['r2']}\n"
        doc = ("Cost of carrying kg kilograms: the first TIER_KG kg at TIER_RATE per kg, every kg above that at\n"
               "    OVER_RATE per kg. Raises ValueError for a negative load or a load above MAX_LOAD_KG. Rounded to cents.")
        body = {"flat_tier": "kg * (TIER_RATE if kg <= TIER_KG else OVER_RATE)",
                "tier_edge": "min(kg, TIER_KG - 100) * TIER_RATE + max(kg - TIER_KG + 100, 0) * OVER_RATE"}.get(
            bug, "min(kg, TIER_KG) * TIER_RATE + max(kg - TIER_KG, 0) * OVER_RATE")
    else:
        consts = f"BLOCK_KG = {c['kg']}\nBLOCK_PRICE = {c['price']}\n"
        doc = ("Cost of carrying kg kilograms: BLOCK_PRICE for every started block of BLOCK_KG kg (a part block\n"
               "    costs a whole block). Raises ValueError for a negative load or a load above MAX_LOAD_KG. Rounded to cents.")
        body = "(kg // BLOCK_KG) * BLOCK_PRICE" if bug == "floor" else "math.ceil(kg / BLOCK_KG) * BLOCK_PRICE"
    fn = f'\n\ndef load_cost(kg):\n    """{doc}\n    """\n{lim}    return round({body}, 2)\n'
    return consts, fn


def module_text(name, s, buggy=True, service=None):
    rng = random.Random(1000 + s["seed"])
    title = name.capitalize()
    purpose = rng.choice(POOL_PURPOSE)
    notes = rng.sample(POOL_NOTES, 6)
    service = s["service"] if service is None else service
    cmp = SERVICE_BUGS.get(name, "odometer_km - last_service_km >= SERVICE_KM") if buggy else \
        "odometer_km - last_service_km >= SERVICE_KM"
    consts, cost_fn = cost_code(s["cost"], COST_BUGS.get(name) if buggy else None)
    w = [round(rng.uniform(0.5, 3.0), 2) for _ in range(6)]
    hours = {d: (rng.choice([5, 6, 7]), rng.choice([17, 18, 19, 20, 22])) for d in
             ("monday", "tuesday", "wednesday", "thursday", "friday")}
    sat = rng.choice([None, (8, 13), (7, 12)])
    checks = rng.sample(CHECKS, 14)
    per100 = {"electric": "kwh", "diesel": "litres", "petrol": "litres", "hybrid": "litres"}[s["fuel"]]
    base = round(rng.uniform(8, 32), 1)
    grams = 0 if s["fuel"] == "electric" else rng.choice([95, 120, 160, 210, 260, 310])
    lines = [f'"""{title}: the vehicle used for {purpose}.', "", "Operating notes:", ""]
    lines += [f"- {n}" for n in notes]
    lines += ["", "Everything in this module is pure: no function reads files, the clock or the network, so the",
              "fleet tools can call it from tests and reports alike.", '"""', "import math", "",
              "from fleet.common import clamp, km_to_miles, round_to", "", f'NAME = "{name}"', f'FUEL = "{s["fuel"]}"',
              f"MAX_LOAD_KG = {s['max_load']}", f"SERVICE_KM = {service}", consts.rstrip(),
              f"BASE_CONSUMPTION = {base}  # {per100} per 100 km, empty",
              f"CO2_G_PER_KM = {grams}", f"ROUTE_WEIGHTS = {w}", ""]
    t = "\n".join(lines) + f'''

def needs_service(odometer_km, last_service_km):
    """True when the vehicle is due for a service: at least SERVICE_KM km driven since the last service.

    Both readings are odometer values in km; last_service_km is the reading at the last service.
    """
    return {cmp}
''' + cost_fn + f'''

def fuel_estimate(distance_km, load_kg):
    """{per100.capitalize()} needed for a trip of distance_km with load_kg on board.

    Consumption grows linearly with the load: a full load (MAX_LOAD_KG) uses 35% more than an empty vehicle.
    The result is rounded to one decimal, which is what the fuel planner shows to drivers.
    """
    if distance_km < 0 or load_kg < 0:
        raise ValueError("distance and load must be >= 0")
    factor = 1 + 0.35 * clamp(load_kg / MAX_LOAD_KG, 0.0, 1.0)
    return round(BASE_CONSUMPTION * factor * distance_km / 100, 1)


def emissions_g(distance_km):
    """Grams of CO2 for a trip, from the type-approval figure. Electric vehicles report 0 at the tailpipe."""
    return int(CO2_G_PER_KM * distance_km)


def route_score(stops, distance_km):
    """A score from 0 to 100 that the planner uses to rank candidate routes for this vehicle (higher is better).

    Short routes with few stops score high; every stop costs ROUTE_WEIGHTS[0] points, every 10 km costs
    ROUTE_WEIGHTS[1] points, and routes longer than 400 km lose a further ROUTE_WEIGHTS[2] points per 50 km.
    """
    score = 100.0
    score -= stops * ROUTE_WEIGHTS[0]
    score -= distance_km / 10 * ROUTE_WEIGHTS[1]
    if distance_km > 400:
        score -= (distance_km - 400) / 50 * ROUTE_WEIGHTS[2]
    return round_to(clamp(score, 0.0, 100.0), 0.5)


def tyre_wear(distance_km, load_kg):
    """Estimated tread loss in millimetres. Heavier loads wear tyres faster; the curve was fitted to the
    depot's measurements over two years and is only meant for planning tyre orders."""
    load_share = clamp(load_kg / MAX_LOAD_KG, 0.0, 1.0)
    return round(distance_km / 10000 * (ROUTE_WEIGHTS[3] + load_share * ROUTE_WEIGHTS[4]), 2)


DEPOT_HOURS = {hours!r}
SATURDAY_HOURS = {sat!r}


def depot_open(day, hour):
    """Whether this vehicle's home depot is open on day (a lower-case English weekday) at hour (0-23).

    Sundays are always closed; Saturdays follow SATURDAY_HOURS, which is None when the depot is closed.
    """
    if day == "sunday":
        return False
    if day == "saturday":
        return SATURDAY_HOURS is not None and SATURDAY_HOURS[0] <= hour < SATURDAY_HOURS[1]
    start, end = DEPOT_HOURS[day]
    return start <= hour < end


def shift_ok(hours_driven, breaks_minutes):
    """Whether a driver's shift on this vehicle follows the rules: at most 9 hours of driving, and at least
    45 minutes of breaks once more than 4.5 hours were driven."""
    if hours_driven > 9:
        return False
    if hours_driven > 4.5 and breaks_minutes < 45:
        return False
    return True


INSPECTION = {checks!r}


def inspection_checklist():
    """The items a driver checks before the first trip of the day, in the order of the paper form."""
    return list(INSPECTION)


def format_manifest(items):
    """Lines for the printed manifest: one per item as 'NAME x QTY (KG kg)', then a total line.

    items is a list of (name, quantity, kg_each). Names are padded to 20 characters so the columns line up.
    """
    out, total = [], 0.0
    for item, qty, kg in items:
        out.append(f"{{item:<20}} x {{qty:>3}} ({{qty * kg:.1f}} kg)")
        total += qty * kg
    out.append(f"{{'total':<20}}       ({{total:.1f}} kg)")
    return out


def validate_manifest(items):
    """Problems with a manifest, as a list of messages (empty when it is fine): a missing name, a quantity
    below 1, a negative weight, or a total above MAX_LOAD_KG."""
    problems = []
    total = 0.0
    for i, (item, qty, kg) in enumerate(items):
        if not item:
            problems.append(f"line {{i + 1}}: no name")
        if qty < 1:
            problems.append(f"line {{i + 1}}: quantity below 1")
        if kg < 0:
            problems.append(f"line {{i + 1}}: negative weight")
        total += max(qty, 0) * max(kg, 0)
    if total > MAX_LOAD_KG:
        problems.append(f"total {{total:.1f}} kg is above MAX_LOAD_KG ({{MAX_LOAD_KG}})")
    return problems


def range_miles(distance_km):
    """distance_km in miles, for the UK partner's reports (rounded to whole miles)."""
    return round(km_to_miles(distance_km))


def summary():
    """One line about this vehicle for the fleet overview."""
    return f"{{NAME}}: {{FUEL}}, up to {{MAX_LOAD_KG}} kg, service every {{SERVICE_KM}} km"
''' + extra_text(rng, s)
    return t


BRIEFING = [
    "Walk around the vehicle before starting and note any new damage on the form.",
    "Check that the manifest matches the load before leaving the depot.",
    "Keep the cab tidy: loose items become dangerous under hard braking.",
    "Phone calls only through the hands-free kit, and never in reverse.",
    "Report a delay of more than twenty minutes to the planner straight away.",
    "At a customer's site, follow their safety rules even when they differ from ours.",
    "Never leave the engine running while the vehicle is unattended.",
    "Fill in the trip log at the end of every trip, not at the end of the day.",
    "Use the loading dock's wheel chocks whenever they are provided.",
    "Take the planned route unless the navigation unit reports a closure.",
    "Keep receipts for tolls and parking; they are reimbursed monthly.",
    "Wear the high-visibility vest outside the cab on every site.",
    "Lock the cargo area at every stop, even for a short delivery.",
    "Check the weather report before long trips and plan breaks accordingly.",
]


def extra_text(rng, s):
    toll = [round(rng.uniform(0.04, 0.22), 3) for _ in range(3)]
    fee = rng.choice([1.5, 2.0, 2.5, 3.0])
    idle = rng.choice([5, 8, 10, 15])
    brief = rng.sample(BRIEFING, 9)
    every = rng.choice([3, 4, 6])
    return f'''

TOLL_RATES = {{"motorway": {toll[0]}, "bridge": {toll[1]}, "city": {toll[2]}}}  # per km
PARKING_FEE_PER_HOUR = {fee}
IDLE_LIMIT_MINUTES = {idle}
INSPECTION_EVERY_MONTHS = {every}


def toll_estimate(segments):
    """Toll for a route, from its segments: a list of (kind, km) where kind is a key of TOLL_RATES. Unknown kinds
    cost nothing (local roads). Rounded to cents, like the toll operator's invoices."""
    total = 0.0
    for kind, km in segments:
        total += TOLL_RATES.get(kind, 0.0) * km
    return round(total, 2)


def parking_fee(minutes):
    """Parking cost for a stop of the given length. Every started hour is charged; the first 10 minutes are free
    at most customer sites, so stops up to 10 minutes cost nothing."""
    if minutes <= 10:
        return 0.0
    return math.ceil(minutes / 60) * PARKING_FEE_PER_HOUR


def idle_warning(idle_minutes):
    """The message the telematics unit shows after idling, or None below IDLE_LIMIT_MINUTES."""
    if idle_minutes < IDLE_LIMIT_MINUTES:
        return None
    return f"engine idling for {{idle_minutes}} minutes: switch it off"


def next_inspection(month, year):
    """(month, year) of the next periodic inspection after the given one, INSPECTION_EVERY_MONTHS later."""
    m = month - 1 + INSPECTION_EVERY_MONTHS
    return m % 12 + 1, year + m // 12


def classify_route(distance_km, stops):
    """A short label for the planner's board: 'local' for short routes, 'regional', or 'long-haul'.

    A route with many stops counts as local even when it is long, because the vehicle rarely leaves town.
    """
    if stops >= 15 or distance_km < 60:
        return "local"
    if distance_km < 300:
        return "regional"
    return "long-haul"


def load_plan(items, max_kg=None):
    """Split items into trips so that no trip carries more than max_kg (default MAX_LOAD_KG).

    items is a list of (name, kg). Items are placed heaviest first into the first trip with room, which is good
    enough for the depot's daily volumes. An item heavier than max_kg on its own raises ValueError.
    """
    limit = MAX_LOAD_KG if max_kg is None else max_kg
    trips = []
    for item, kg in sorted(items, key=lambda x: -x[1]):
        if kg > limit:
            raise ValueError(f"{{item}} ({{kg}} kg) is heavier than one trip can carry")
        for trip in trips:
            if trip["kg"] + kg <= limit:
                trip["items"].append(item)
                trip["kg"] += kg
                break
        else:
            trips.append({{"items": [item], "kg": kg}})
    return trips


def trip_log_line(date, driver, distance_km, stops, load_kg):
    """One line of the trip log, tab-separated, in the column order of the paper log book."""
    return "\\t".join([date, NAME, driver, f"{{distance_km:.1f}}", str(stops), f"{{load_kg:.0f}}"])


def weekly_report(trips):
    """Totals for a week of trips: a dict with trips, km, stops, kg and the average load share of MAX_LOAD_KG.

    trips is a list of dicts with the keys distance_km, stops and load_kg, as the trip log importer makes them.
    """
    n = len(trips)
    km = sum(t["distance_km"] for t in trips)
    stops = sum(t["stops"] for t in trips)
    kg = sum(t["load_kg"] for t in trips)
    share = (kg / n / MAX_LOAD_KG) if n else 0.0
    return {{"trips": n, "km": round(km, 1), "stops": stops, "kg": round(kg, 1), "load_share": round(share, 3)}}


BRIEFING = {brief!r}


def driver_briefing():
    """The briefing read to a new driver before their first trip with this vehicle, numbered from 1."""
    return [f"{{i}}. {{line}}" for i, line in enumerate(BRIEFING, 1)]


def maintenance_due(odometer_km, last_service_km, month, year, last_inspection):
    """What the workshop should plan for this vehicle: a list that may hold 'service' and 'inspection'.

    last_inspection is the (month, year) of the last periodic inspection.
    """
    due = []
    if needs_service(odometer_km, last_service_km):
        due.append("service")
    nm, ny = next_inspection(*last_inspection)
    if (year, month) >= (ny, nm):
        due.append("inspection")
    return due
'''


COMMON_PY = '''
"""Helpers shared by every vehicle module."""


def clamp(x, lo, hi):
    """x limited to the range lo..hi."""
    return max(lo, min(hi, x))


def km_to_miles(km):
    """Kilometres to miles."""
    return km / 1.609344


def round_to(x, step):
    """x rounded to the nearest multiple of step."""
    return round(x / step) * step
'''


def files():
    s = spec()
    f = {"README.md": "# fleet\n\nThe vehicle rules of a small delivery fleet: one module per vehicle in "
                      "fleet/vehicles/.\n",
         "fleet/__init__.py": "", "fleet/vehicles/__init__.py": "", "fleet/common.py": COMMON_PY}
    for n in NAMES:
        f[f"fleet/vehicles/{n}.py"] = module_text(n, s[n])
    return f


PROMPTS = [
    """
    This repo has one module per vehicle in fleet/vehicles/. Read every one of those modules in full, then write
    docs/FLEET.md with a table that has one row per vehicle and the columns: vehicle (the module name), fuel,
    max load in kg, service interval in km.
    """,
    """
    In every vehicle module, needs_service() must do exactly what its docstring says. Some of them do not. Check
    each module and fix every needs_service() that does not match its docstring; leave the correct ones alone.
    """,
    """
    Create fleet/registry.py with a function all_vehicles() that returns a dict mapping each vehicle's module name
    (for example "atlas") to the imported module. It must find the modules by scanning fleet/vehicles/, not from a
    hard-coded list, so a new module there shows up without other changes.
    """,
    """
    Create fleet/report.py so that `python -m fleet.report service FILE` reads a CSV file with the header
    vehicle,odometer_km,last_service_km and prints one line per vehicle that needs service, in the form
    NAME KM_SINCE_SERVICE (for example: atlas 15200), sorted by KM_SINCE_SERVICE from high to low, then by name.
    A vehicle name that is not in the fleet prints an error to stderr and exits with code 1. Use registry.py.
    """,
    """
    New rule from the fleet office: an electric vehicle's SERVICE_KM must be at least 20000. Raise SERVICE_KM to
    20000 in every electric vehicle that is below that (leave the others as they are), and update docs/FLEET.md.
    """,
    """
    Write unittest tests in tests/test_fleet.py: needs_service() at its boundary for every vehicle (exactly
    SERVICE_KM since the last service, and one km less), and the service report. Run them with
    python -m unittest discover -s tests and make sure they pass.
    """,
    """
    load_cost() in each vehicle module must also follow its docstring exactly. Check every vehicle's load_cost()
    against its docstring and fix every one that does not; leave the correct ones alone.
    """,
    """
    Write diesel_heavy.txt in the repo root: the module names of every diesel vehicle whose MAX_LOAD_KG is above
    5000, one per line.
    """,
    """
    Add a cost command to fleet/report.py: `python -m fleet.report cost VEHICLE KG` prints the vehicle's
    load_cost for KG kilograms with exactly two decimals (for example 125.50). An unknown vehicle, or a load
    load_cost refuses, prints an error to stderr and exits with code 1.
    """,
    """
    Add tests for load_cost and the cost command to tests/test_fleet.py, run the whole test suite with
    python -m unittest discover -s tests, and fix anything that fails.
    """,
]


def check_code():
    s = spec()
    data = {n: {"fuel": v["fuel"], "max_load": v["max_load"], "service": final_service(v), "cost": v["cost"]}
            for n, v in s.items()}
    return f'''
import math, re, shutil, tempfile
SPEC = json.loads({json.dumps(json.dumps(data))})
def need(cond, msg):
    if not cond:
        print(msg); sys.exit(1)
def expected_cost(c, kg):
    if c["family"] == "flat":
        v = max(kg * c["rate"], c["min"])
    elif c["family"] == "tier":
        v = min(kg, c["t"]) * c["r1"] + max(kg - c["t"], 0) * c["r2"]
    else:
        v = math.ceil(kg / c["kg"]) * c["price"]
    return round(v, 2)
# 1 + 5: docs/FLEET.md, with the raised electric intervals
doc = (REPO / "docs" / "FLEET.md").read_text() if (REPO / "docs" / "FLEET.md").exists() else ""
need(doc, "no docs/FLEET.md")
for n, v in SPEC.items():
    rows = [l for l in doc.splitlines() if re.search(r"\\b" + n + r"\\b", l, re.I)]
    need(rows, f"FLEET.md: no row for {{n}}")
    nums = {{int(x) for x in re.findall(r"\\d+", re.sub(r"(?<=\\d)[,_ ](?=\\d{{3}})", "", rows[0]))}}
    need(v["max_load"] in nums and v["service"] in nums and v["fuel"] in rows[0].lower(), f"FLEET.md row for {{n}}: {{rows[0]}}")
# 2 + 5 + 7: every module's constants, needs_service and load_cost
probe = """
import importlib, json, sys
out = {{}}
for n in json.loads(sys.argv[1]):
    m = importlib.import_module("fleet.vehicles." + n)
    S = m.SERVICE_KM
    r = {{"service": S, "max_load": m.MAX_LOAD_KG, "fuel": m.FUEL,
         "ns": [m.needs_service(40000 + S, 40000), m.needs_service(40000 + S - 1, 40000), m.needs_service(S, 0),
                m.needs_service(S - 1, 0), m.needs_service(40000 + 3 * S, 40000), m.needs_service(40000 + S // 2, 40000)],
         "cost": {{}}}}
    for kg in json.loads(sys.argv[2])[n]:
        try:
            r["cost"][str(kg)] = m.load_cost(kg)
        except ValueError:
            r["cost"][str(kg)] = "ValueError"
    out[n] = r
print(json.dumps(out))
"""
points = {{}}
for n, v in SPEC.items():
    c, mx = v["cost"], v["max_load"]
    p = {{-1, 0, 1, 7, 99, mx, mx + 1, mx // 2, mx - 3}}
    if c["family"] == "tier":
        p |= {{c["t"] - 100, c["t"] - 1, c["t"], c["t"] + 1, c["t"] + 250}}
    if c["family"] == "block":
        p |= {{c["kg"] - 1, c["kg"], c["kg"] + 1, 3 * c["kg"]}}
    if c["family"] == "flat":
        p |= {{int(c["min"] / c["rate"]) - 1, int(c["min"] / c["rate"]) + 5}}
    points[n] = sorted(p)
r = run(sys.executable, "-c", probe, json.dumps(list(SPEC)), json.dumps(points))
need(r.returncode == 0, "import failed: " + r.stderr[-400:])
got = json.loads(r.stdout)
for n, v in SPEC.items():
    g = got[n]
    need(g["service"] == v["service"] and g["max_load"] == v["max_load"] and g["fuel"] == v["fuel"], f"{{n}}: constants {{g}}")
    need(g["ns"] == [True, False, True, False, True, False], f"{{n}}: needs_service {{g['ns']}}")
    for kg in points[n]:
        want = "ValueError" if kg < 0 or kg > v["max_load"] else expected_cost(v["cost"], kg)
        have = g["cost"][str(kg)]
        need(have == want if want == "ValueError" else isinstance(have, (int, float)) and abs(have - want) < 0.006,
             f"{{n}}: load_cost({{kg}}) = {{have}}, want {{want}}")
# 3: registry finds a new module without other changes
with tempfile.TemporaryDirectory() as d:
    cp = Path(d) / "r"
    shutil.copytree(REPO, cp, ignore=shutil.ignore_patterns(".git", "__pycache__"))
    (cp / "fleet" / "vehicles" / "zz_probe.py").write_text("SERVICE_KM = 1\\ndef needs_service(a, b):\\n    return True\\n")
    r = subprocess.run([sys.executable, "-c", "import json; from fleet.registry import all_vehicles; v = all_vehicles();"
                        "print(json.dumps(sorted(v)), hasattr(v['atlas'], 'needs_service'))"], cwd=cp,
                       capture_output=True, text=True, timeout=60)
    need(r.returncode == 0, "registry: " + r.stderr[-300:])
    keys = json.loads(r.stdout.split("\\n")[0].rsplit(" ", 1)[0])
    need(sorted(set(SPEC) | {{"zz_probe"}}) == keys and r.stdout.strip().endswith("True"), "registry keys: " + r.stdout[:300])
# 4: the service report
csv_rows, want = [], []
for i, n in enumerate(sorted(SPEC)[:12]):
    S = SPEC[n]["service"]
    last = 10000 * (i + 1)
    odo = last + (S + 37 * i if i % 3 == 0 else S if i % 3 == 1 else S - 1)
    csv_rows.append(f"{{n}},{{odo}},{{last}}")
    if odo - last >= S:
        want.append((odo - last, n))
want = [f"{{n}} {{k}}" for k, n in sorted(want, key=lambda x: (-x[0], x[1]))]
with tempfile.TemporaryDirectory() as d:
    f = Path(d) / "odo.csv"
    f.write_text("vehicle,odometer_km,last_service_km\\n" + "\\n".join(csv_rows) + "\\n")
    r = run(sys.executable, "-m", "fleet.report", "service", str(f))
    need(r.returncode == 0, "report service: " + r.stderr[-300:])
    need([l.strip() for l in r.stdout.splitlines() if l.strip()] == want, f"report service: {{r.stdout!r}} want {{want}}")
    f.write_text("vehicle,odometer_km,last_service_km\\nnosuchvan,100,0\\n")
    r = run(sys.executable, "-m", "fleet.report", "service", str(f))
    need(r.returncode == 1 and r.stderr.strip(), f"report unknown vehicle: exit {{r.returncode}}")
# 8: diesel_heavy.txt
p = REPO / "diesel_heavy.txt"
need(p.exists(), "no diesel_heavy.txt")
want = {{n for n, v in SPEC.items() if v["fuel"] == "diesel" and v["max_load"] > 5000}}
need({{l.strip() for l in p.read_text().splitlines() if l.strip()}} == want, f"diesel_heavy.txt: want {{sorted(want)}}")
# 9: the cost command
for n in ("atlas", "dingo", "egret", "ocelot"):
    v = SPEC[n]
    kg = v["max_load"] // 3
    r = run(sys.executable, "-m", "fleet.report", "cost", n, str(kg))
    need(r.returncode == 0 and r.stdout.strip() == f"{{expected_cost(v['cost'], kg):.2f}}", f"cost {{n}} {{kg}}: {{r.stdout!r}} {{r.stderr[-200:]}}")
    r = run(sys.executable, "-m", "fleet.report", "cost", n, str(v["max_load"] + 1))
    need(r.returncode == 1 and r.stderr.strip(), f"cost over max for {{n}}: exit {{r.returncode}}")
r = run(sys.executable, "-m", "fleet.report", "cost", "nosuchvan", "10")
need(r.returncode == 1 and r.stderr.strip(), "cost unknown vehicle")
# 6 + 10: the test suite
t = REPO / "tests" / "test_fleet.py"
need(t.exists(), "no tests/test_fleet.py")
src = t.read_text()
need("needs_service" in src and "load_cost" in src, "tests do not cover needs_service and load_cost")
r = run(sys.executable, "-m", "unittest", "discover", "-s", "tests")
m = re.search(r"Ran (\\d+) test", r.stderr)
need(r.returncode == 0 and m and int(m.group(1)) >= 3, "tests: " + r.stderr[-400:])
'''


def reference(repo: Path):
    """The hand-written solution, for validate_checks.py."""
    s = spec()
    for n in NAMES:
        (repo / "fleet" / "vehicles" / f"{n}.py").write_text(module_text(n, s[n], buggy=False, service=final_service(s[n])))
    (repo / "docs").mkdir(exist_ok=True)
    (repo / "docs" / "FLEET.md").write_text(
        "| vehicle | fuel | max load kg | service km |\n|---|---|---|---|\n" +
        "".join(f"| {n} | {v['fuel']} | {v['max_load']:,} | {final_service(v)} |\n" for n, v in s.items()))
    (repo / "fleet" / "registry.py").write_text(textwrap.dedent('''
        import importlib
        import pkgutil
        from pathlib import Path


        def all_vehicles():
            here = Path(__file__).parent / "vehicles"
            return {m.name: importlib.import_module("fleet.vehicles." + m.name) for m in pkgutil.iter_modules([str(here)])}
        ''').lstrip())
    (repo / "fleet" / "report.py").write_text(textwrap.dedent('''
        import csv
        import sys

        from fleet.registry import all_vehicles


        def main(a):
            v = all_vehicles()
            if a[0] == "service":
                due = []
                with open(a[1]) as f:
                    for row in csv.DictReader(f):
                        m = v.get(row["vehicle"])
                        if m is None:
                            print("unknown vehicle " + row["vehicle"], file=sys.stderr)
                            return 1
                        odo, last = int(row["odometer_km"]), int(row["last_service_km"])
                        if m.needs_service(odo, last):
                            due.append((odo - last, row["vehicle"]))
                for k, n in sorted(due, key=lambda x: (-x[0], x[1])):
                    print(n, k)
            elif a[0] == "cost":
                m = v.get(a[1])
                if m is None:
                    print("unknown vehicle " + a[1], file=sys.stderr)
                    return 1
                try:
                    print(f"{m.load_cost(float(a[2])):.2f}")
                except ValueError as e:
                    print(e, file=sys.stderr)
                    return 1
            return 0


        if __name__ == "__main__":
            sys.exit(main(sys.argv[1:]))
        ''').lstrip())
    (repo / "tests").mkdir(exist_ok=True)
    (repo / "tests" / "test_fleet.py").write_text(textwrap.dedent('''
        import unittest

        from fleet.registry import all_vehicles


        class T(unittest.TestCase):
            def test_needs_service(self):
                for m in all_vehicles().values():
                    self.assertTrue(m.needs_service(m.SERVICE_KM, 0))
                    self.assertFalse(m.needs_service(m.SERVICE_KM - 1, 0))

            def test_load_cost(self):
                for m in all_vehicles().values():
                    with self.assertRaises(ValueError):
                        m.load_cost(m.MAX_LOAD_KG + 1)

            def test_registry(self):
                self.assertEqual(len(all_vehicles()), 32)
        ''').lstrip())
    (repo / "diesel_heavy.txt").write_text(
        "".join(n + "\n" for n, v in s.items() if v["fuel"] == "diesel" and v["max_load"] > 5000))
