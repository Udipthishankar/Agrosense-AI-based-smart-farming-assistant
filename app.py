import base64
import argparse
import csv
import io
import json
import os
import random
import sqlite3
import urllib.error
import urllib.parse
import urllib.request
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / ".env")

DATA_DIR = ROOT_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DATABASE_PATH = Path(os.getenv("AGROSENSE_DB_PATH", str(DATA_DIR / "agrosense.db")))
if not DATABASE_PATH.is_absolute():
    DATABASE_PATH = ROOT_DIR / DATABASE_PATH

DIST_DIR = ROOT_DIR / "dist"
PUBLIC_DIR = ROOT_DIR / "public"
MAX_IMAGE_SIZE = 10 * 1024 * 1024
MAX_RECORD_IMPORT_SIZE = 5 * 1024 * 1024
MAX_RECORD_IMPORT_ROWS = 1000

RECORD_IMPORT_CATEGORIES = {
    "crop": ("Crop recommendation", "Crop Rules"),
    "disease": ("Disease reference", "Disease Reference"),
    "weather": ("Weather lookup", "Weather"),
    "manual": ("Manual field log", "Manual Entry"),
}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024

CROP_DATA = {
    "rice": {"temp": (20, 30), "humidity": (50, 90), "ph": (5, 7.5), "rainfall": (100, 300), "N": (40, 120), "P": (20, 60), "K": (20, 60)},
    "wheat": {"temp": (15, 25), "humidity": (30, 60), "ph": (6, 8), "rainfall": (40, 100), "N": (40, 120), "P": (20, 60), "K": (20, 60)},
    "cotton": {"temp": (20, 35), "humidity": (40, 80), "ph": (5.5, 8.5), "rainfall": (50, 200), "N": (60, 150), "P": (15, 60), "K": (40, 100)},
    "maize": {"temp": (18, 27), "humidity": (40, 80), "ph": (6, 7.5), "rainfall": (60, 100), "N": (60, 150), "P": (20, 60), "K": (20, 60)},
    "sugarcane": {"temp": (20, 30), "humidity": (60, 100), "ph": (6, 8.5), "rainfall": (100, 250), "N": (100, 200), "P": (40, 80), "K": (60, 120)},
    "groundnut": {"temp": (22, 32), "humidity": (40, 70), "ph": (5.5, 8), "rainfall": (50, 100), "N": (20, 60), "P": (15, 40), "K": (20, 60)},
    "soybean": {"temp": (18, 28), "humidity": (50, 80), "ph": (5.5, 7.5), "rainfall": (40, 80), "N": (20, 60), "P": (15, 40), "K": (15, 50)},
    "ragi": {"temp": (15, 28), "humidity": (50, 90), "ph": (6, 8), "rainfall": (50, 120), "N": (40, 100), "P": (15, 40), "K": (20, 60)},
    "tomato": {"temp": (20, 30), "humidity": (50, 85), "ph": (6, 6.8), "rainfall": (100, 150), "N": (150, 200), "P": (50, 80), "K": (100, 150)},
    "onion": {"temp": (12, 24), "humidity": (40, 70), "ph": (6, 7), "rainfall": (60, 100), "N": (100, 150), "P": (50, 75), "K": (80, 120)},
}

DISEASE_DATA = {
    "leaf_rust": {
        "description": "Brown to orange-red pustules on upper and lower leaf surfaces, causing premature defoliation.",
        "treatment": "Apply systemic fungicide spray (Propiconazole 25% EC or Tebuconazole). Ensure adequate plant spacing for airflow. Collect and destroy heavily infected leaves.",
        "severity": "Medium",
    },
    "powdery_mildew": {
        "description": "White talcum powder-like fungal coating covering leaves, buds, and stems.",
        "treatment": "Spray wettable sulfur powder (2g/L) or organic neem oil extract (5ml/L). Prune overcrowded foliage to improve sun exposure and reduce canopy humidity.",
        "severity": "Low to Medium",
    },
    "late_blight": {
        "description": "Rapidly spreading water-soaked dark brown to black lesions with fuzzy white fungal growth underneath in moist conditions.",
        "treatment": "Immediately apply copper-based fungicide or Mancozeb. Avoid overhead sprinkler irrigation. Remove infected vines. Ensure strict field drainage.",
        "severity": "High",
    },
    "early_blight": {
        "description": "Concentric target-like brown rings on older lower leaves, surrounded by yellow chlorotic halos.",
        "treatment": "Remove affected lower foliage. Spray Chlorothalonil or Azoxystrobin. Practice 3-year crop rotation with non-solanaceous crops.",
        "severity": "Medium",
    },
    "bacterial_wilt": {
        "description": "Rapid wilting of entire foliage during sunny midday hours while stems remain green, vascular browning inside stem.",
        "treatment": "No direct chemical cure. Promptly uproot and burn infected crops. Disinfect farm tools. Use wilt-resistant seeds and solarize soil before replanting.",
        "severity": "High",
    },
    "fungal_spot": {
        "description": "Small circular brown to black spots with concentric margins and yellow margins on leaves.",
        "treatment": "Spray copper oxychloride (3g/L) or Carbendazim. Water at base of plants to keep foliage dry. Clean fallen leaf debris.",
        "severity": "Medium",
    },
    "healthy": {
        "description": "Plant tissue shows strong chlorophyll pigmentation, crisp turgidity, and no visible pathogenic lesions or pest infestation.",
        "treatment": "Maintain balanced NPK fertilization, consistent moisture scheduling, and regular scouting.",
        "severity": "None",
    },
}


def connect_database():
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


@contextmanager
def database_connection():
    connection = connect_database()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with database_connection() as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS farmer_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                location TEXT NOT NULL,
                crop TEXT NOT NULL,
                activity TEXT,
                timestamp TEXT NOT NULL,
                details TEXT NOT NULL
            )"""
        )
        connection.execute(
            """CREATE TABLE IF NOT EXISTS farmer_chat_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                crop TEXT NOT NULL,
                question TEXT NOT NULL,
                reply TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                demo INTEGER NOT NULL DEFAULT 0
            )"""
        )
        connection.execute(
            """CREATE TABLE IF NOT EXISTS app_migrations (
                name TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            )"""
        )
        chat_demo_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(farmer_chat_records)")
        }
        if "demo" not in chat_demo_columns:
            connection.execute(
                "ALTER TABLE farmer_chat_records ADD COLUMN demo INTEGER NOT NULL DEFAULT 0"
            )
        migration_name = "import-json-farmer-records-v1"
        applied = connection.execute(
            "SELECT 1 FROM app_migrations WHERE name = ?", (migration_name,)
        ).fetchone()
        if not applied:
            legacy_file = DATA_DIR / "records.json"
            if legacy_file.exists():
                try:
                    records = json.loads(legacy_file.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError) as error:
                    raise RuntimeError(f"Could not read legacy field records at {legacy_file}") from error
                if not isinstance(records, list):
                    raise RuntimeError(f"Legacy field records must be a JSON array: {legacy_file}")

                for record in records:
                    if not isinstance(record, dict) or not isinstance(record.get("location"), str) or not isinstance(record.get("crop"), str):
                        raise RuntimeError("Legacy field records contain an invalid entry; no records were imported.")
                    timestamp = record.get("timestamp")
                    if not isinstance(timestamp, str):
                        timestamp = datetime.now(timezone.utc).isoformat()
                    details = record.get("details")
                    if not isinstance(details, dict):
                        details = {}
                    record_id = record.get("id")
                    if not isinstance(record_id, int) or record_id < 1:
                        record_id = None
                    connection.execute(
                        """INSERT INTO farmer_records (id, location, crop, activity, timestamp, details)
                           VALUES (?, ?, ?, ?, ?, ?)""",
                        (
                            record_id,
                            record["location"],
                            record["crop"],
                            record.get("activity") if isinstance(record.get("activity"), str) else None,
                            timestamp,
                            json.dumps(details),
                        ),
                    )
                if records:
                    app.logger.info("Imported %s legacy farmer records into SQLite.", len(records))

            connection.execute(
                "INSERT INTO app_migrations (name, applied_at) VALUES (?, ?)",
                (migration_name, datetime.now(timezone.utc).isoformat()),
            )

        chat_migration_name = "split-farmer-chat-records-v1"
        chat_migration_applied = connection.execute(
            "SELECT 1 FROM app_migrations WHERE name = ?", (chat_migration_name,)
        ).fetchone()
        if not chat_migration_applied:
            existing_records = connection.execute(
                "SELECT id, crop, timestamp, details FROM farmer_records"
            ).fetchall()
            migrated_ids = []
            for record in existing_records:
                details = json.loads(record["details"])
                if details.get("source") != "Farmer Chat":
                    continue
                question = details.get("question")
                reply = details.get("advice")
                if not isinstance(question, str) or not isinstance(reply, str):
                    app.logger.warning("Skipping legacy chat record %s because it is incomplete.", record["id"])
                    continue
                connection.execute(
                    """INSERT INTO farmer_chat_records (id, crop, question, reply, timestamp)
                       VALUES (?, ?, ?, ?, ?)""",
                    (record["id"], record["crop"], question, reply, record["timestamp"]),
                )
                migrated_ids.append(record["id"])

            if migrated_ids:
                placeholders = ",".join("?" for _ in migrated_ids)
                connection.execute(
                    f"DELETE FROM farmer_records WHERE id IN ({placeholders})",
                    migrated_ids,
                )
                app.logger.info("Moved %s legacy chat advisories into Farmer Help Chat.", len(migrated_ids))
            connection.execute(
                "INSERT INTO app_migrations (name, applied_at) VALUES (?, ?)",
                (chat_migration_name, datetime.now(timezone.utc).isoformat()),
            )

        label_migration_name = "normalize-activity-records-v1"
        labels_applied = connection.execute(
            "SELECT 1 FROM app_migrations WHERE name = ?", (label_migration_name,)
        ).fetchone()
        if not labels_applied:
            rows = connection.execute(
                "SELECT id, details FROM farmer_records"
            ).fetchall()
            for row in rows:
                details = json.loads(row["details"])
                changed = False
                if details.get("source") == "Soil AI":
                    details["source"] = "Crop Rules"
                    changed = True
                notes = details.get("notes")
                if isinstance(notes, str) and "AgroSense AI" in notes:
                    details["notes"] = notes.replace("AgroSense AI", "AgroSense crop suitability rules")
                    changed = True
                if details.get("source") == "Crop Rules" and "confidence" in details:
                    details["match_score"] = details.pop("confidence")
                    changed = True
                if details.get("source") == "Disease Diagnosis" and "confidence" in details:
                    details.pop("confidence")
                    if details.get("demo") is not True:
                        details["notes"] = (
                            f"{notes or ''} Historical prototype result; not a verified image diagnosis.".strip()
                        )
                    changed = True
                if changed:
                    connection.execute(
                        "UPDATE farmer_records SET details = ? WHERE id = ?",
                        (json.dumps(details), row["id"]),
                    )
            connection.execute(
                "INSERT INTO app_migrations (name, applied_at) VALUES (?, ?)",
                (label_migration_name, datetime.now(timezone.utc).isoformat()),
            )

        disease_reference_migration_name = "rename-disease-reference-source-v1"
        disease_reference_migration_applied = connection.execute(
            "SELECT 1 FROM app_migrations WHERE name = ?", (disease_reference_migration_name,)
        ).fetchone()
        if not disease_reference_migration_applied:
            rows = connection.execute(
                "SELECT id, activity, details FROM farmer_records"
            ).fetchall()
            for row in rows:
                details = json.loads(row["details"])
                activity = row["activity"]
                changed = False
                if details.get("source") == "Disease Diagnosis":
                    details["source"] = "Disease Reference"
                    changed = True
                if activity == "Disease detection":
                    activity = "Disease reference"
                    changed = True
                if changed:
                    connection.execute(
                        "UPDATE farmer_records SET activity = ?, details = ? WHERE id = ?",
                        (activity, json.dumps(details), row["id"]),
                    )
            connection.execute(
                "INSERT INTO app_migrations (name, applied_at) VALUES (?, ?)",
                (disease_reference_migration_name, datetime.now(timezone.utc).isoformat()),
            )


def serialize_record(row):
    details = json.loads(row["details"])
    return {
        "id": row["id"],
        "location": row["location"],
        "crop": row["crop"],
        **({"activity": row["activity"]} if row["activity"] else {}),
        "timestamp": row["timestamp"],
        "details": details,
    }


def create_farmer_record(location, crop, activity=None, details=None):
    timestamp = datetime.now(timezone.utc).isoformat()
    details_json = json.dumps(details or {})
    with database_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO farmer_records (location, crop, activity, timestamp, details) VALUES (?, ?, ?, ?, ?)",
            (location, crop, activity, timestamp, details_json),
        )
        record_id = cursor.lastrowid
    return {
        "id": record_id,
        "location": location,
        "crop": crop,
        **({"activity": activity} if activity else {}),
        "timestamp": timestamp,
        "details": details or {},
    }


def weather_advisory(temperature, humidity, rainfall_chance):
    advisory = []
    if temperature < 15:
        advisory.append("⚠️ Low temperature (<15°C) — Protect sensitive crops with mulch or covers. Reduce nighttime irrigation.")
    elif temperature > 35:
        advisory.append("⚠️ High temperature (>35°C) — Increase irrigation frequency to prevent heat stress. Apply organic mulching.")
    else:
        advisory.append("✓ Temperature (15-35°C) is optimal for crop metabolism and vegetative growth.")
    if humidity < 30:
        advisory.append("⚠️ Dry air (Humidity <30%) — Elevated risk of spider mites and thrips. Maintain adequate soil moisture.")
    elif humidity > 85:
        advisory.append("⚠️ High humidity (>85%) — Fungal spores proliferate quickly. Avoid excessive dense canopies and overhead spraying.")
    else:
        advisory.append("✓ Humidity is in the comfortable growth band (40-80%).")
    if rainfall_chance > 70:
        advisory.append(f"⚠️ Heavy rain likely ({rainfall_chance}% chance) — Postpone chemical spraying & fertilizer broadcast. Clear drainage channels.")
    elif rainfall_chance > 40:
        advisory.append(f"ℹ️ Moderate rain possibility ({rainfall_chance}% chance) — Monitor cloud cover before undertaking sensitive field operations.")
    else:
        advisory.append("✓ Low rainfall chance — Ideal window for fertilizer application, weeding, and pesticide spraying.")
    return " ".join(advisory)


def http_json(url, timeout=5, headers=None, body=None):
    request_headers = {"User-Agent": "AgroSense/1.0"}
    if headers:
        request_headers.update(headers)
    data = json.dumps(body).encode("utf-8") if body is not None else None
    if data is not None:
        request_headers["Content-Type"] = "application/json"
    http_request = urllib.request.Request(url, data=data, headers=request_headers)
    with urllib.request.urlopen(http_request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def fallback_weather(location):
    loc_lower = location.lower()
    base_temp, base_humidity = 27, 65
    if "pune" in loc_lower or "maharashtra" in loc_lower:
        base_temp, base_humidity = 28.5, 60
    elif "punjab" in loc_lower or "delhi" in loc_lower:
        base_temp, base_humidity = 24, 52
    elif "bengaluru" in loc_lower or "bangalore" in loc_lower:
        base_temp, base_humidity = 26.2, 68
    elif "chennai" in loc_lower or "mumbai" in loc_lower:
        base_temp, base_humidity = 31, 78
    data = {
        "location": location[:1].upper() + location[1:],
        "temperature": round(base_temp + random.uniform(-2, 2), 1),
        "humidity": min(95, max(30, round(base_humidity + random.uniform(-5, 5)))),
        "rainfall_chance": random.randrange(45),
        "wind_speed": round(random.uniform(4, 12), 1),
        "description": random.choice(["Partly Cloudy", "Sunny", "Clear Sky", "Scattered Clouds", "Mild Breeze"]),
        "pressure": random.randrange(1008, 1018),
        "feels_like": round(base_temp + 1.2, 1),
    }
    data["advisory"] = weather_advisory(data["temperature"], data["humidity"], data["rainfall_chance"])
    return data


def get_weather(location):
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if api_key:
        url = "https://api.openweathermap.org/data/2.5/weather?" + urllib.parse.urlencode(
            {"q": location, "appid": api_key, "units": "metric"}
        )
        try:
            current = http_json(url, timeout=5)
            main = current["main"]
            weather = current.get("weather", [{}])[0]
            data = {
                "location": current.get("name") or location,
                "temperature": round(main["temp"], 1),
                "humidity": main["humidity"],
                "rainfall_chance": current.get("clouds", {}).get("all", 20),
                "wind_speed": round(current.get("wind", {}).get("speed", 3.5), 1),
                "description": (weather.get("description") or "Partly Cloudy").capitalize(),
                "pressure": main.get("pressure", 1012),
                "feels_like": round(main.get("feels_like", main["temp"]), 1),
            }
            data["advisory"] = weather_advisory(data["temperature"], data["humidity"], data["rainfall_chance"])
            return data
        except (OSError, ValueError, KeyError, urllib.error.URLError) as error:
            app.logger.warning("OpenWeather lookup failed; trying keyless weather: %s", error)

    try:
        geo_url = "https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode(
            {"name": location, "count": 1, "language": "en", "format": "json"}
        )
        results = http_json(geo_url, timeout=4).get("results", [])
        if results:
            place = results[0]
            forecast_url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(
                {
                    "latitude": place["latitude"],
                    "longitude": place["longitude"],
                    "current": "temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,precipitation,weather_code",
                }
            )
            current = http_json(forecast_url, timeout=4).get("current")
            if current:
                temperature = round(current["temperature_2m"], 1)
                humidity = round(current["relative_humidity_2m"])
                precipitation = current.get("precipitation") or 0
                code = current.get("weather_code", 0)
                rainfall = min(95, round(precipitation * 25 + 30)) if precipitation else (60 if code >= 50 else 15)
                data = {
                    "location": place.get("name") or location,
                    "temperature": temperature,
                    "humidity": humidity,
                    "rainfall_chance": rainfall,
                    "wind_speed": round((current.get("wind_speed_10m") or 10) / 3.6, 1),
                    "description": "Clear Sky" if code == 0 else ("Partly Cloudy" if code < 4 else ("Rain / Drizzle" if code < 70 else "Overcast")),
                    "pressure": round(current.get("surface_pressure") or 1012),
                    "feels_like": round(temperature + (1.5 if humidity > 70 else -0.5), 1),
                }
                data["advisory"] = weather_advisory(temperature, humidity, rainfall)
                return data
    except (OSError, ValueError, KeyError, urllib.error.URLError) as error:
        app.logger.warning("Open-Meteo lookup failed; using regional estimate: %s", error)
    return fallback_weather(location)


def chat_fallback(message):
    msg = message.lower()
    if any(word in msg for word in ("disease", "fungus", "leaf spot", "rust", "blight")):
        return "🍂 **Plant Disease Care Guide**:\n1. **Prune & Isolate**: Immediately snip off infected leaves and burn or dispose of them away from the field.\n2. **Organic Spray**: Use a 0.5% neem oil solution or 2g/L copper oxychloride.\n3. **Moisture Control**: Switch to drip irrigation and avoid wetting the foliage in the late evening."
    if any(word in msg for word in ("fertilizer", "npk", "urea", "dap", "nitrogen")):
        return "🌱 **Nutrient & Fertilizer Management**:\n- **Nitrogen (N)**: Fuels lush green vegetative leaves. Best split into 2-3 top dressings.\n- **Phosphorus (P)**: Apply as basal dose (e.g. Single Super Phosphate or DAP) at sowing for strong root establishment.\n- **Potassium (K)**: Increases drought resistance and fruit/grain filling size.\n- Always incorporate well-rotted farmyard manure (FYM) before tilling."
    if any(word in msg for word in ("water", "irrigation", "rain", "drought")):
        return "💧 **Smart Irrigation Guidance**:\n- Check the rainfall forecast in our Weather tab before scheduling irrigation.\n- For water efficiency, adopt drip irrigation (saving 40-60% water while boosting yield).\n- Apply straw or dry leaf mulch around plant roots to retain soil moisture during hot spells."
    if any(word in msg for word in ("crop", "recommend", "plant", "sow", "seed")):
        return "🌾 **Crop Planning**:\n- Open **Crop Recommendations** and enter soil N-P-K values, pH, temperature, humidity, and rainfall. The tool ranks crops by a weighted match to its stored suitability ranges."
    if any(word in msg for word in ("pest", "insect", "worm", "borer", "aphid")):
        return "🐛 **Pest Management Strategy**:\n- Install yellow sticky traps for whiteflies and aphids.\n- Use pheromone traps to monitor stem borers and fruit flies.\n- Apply Bacillus thuringiensis (Bt) or neem-based formulations early in the infestation cycle."
    return "Namaste! For optimal crop health, make sure to test your soil pH regularly and maintain balanced N-P-K nutrient levels."


def save_chat_advisory(question, reply):
    crop = infer_chat_crop(question, reply)
    question = question.strip()
    reply = reply.strip()
    timestamp = datetime.now(timezone.utc).isoformat()
    with database_connection() as connection:
        cursor = connection.execute(
            """INSERT INTO farmer_chat_records (crop, question, reply, timestamp)
               VALUES (?, ?, ?, ?)""",
            (crop, question, reply, timestamp),
        )
        record_id = cursor.lastrowid
    return {
        "id": record_id,
        "location": "Farmer Help Chat",
        "crop": crop,
        "activity": "Farmer Help Chat",
        "timestamp": timestamp,
        "details": {
            "source": "Farmer Chat",
            "question": question,
            "advice": reply,
            "notes": f'Farmer Query: "{question}"',
        },
    }


def infer_chat_crop(question, reply):
    lower = (question + " " + reply).lower()
    crop = "General Advisory"
    crop_terms = [
        (("rice", "paddy"), "Rice"),
        (("wheat",), "Wheat"),
        (("cotton",), "Cotton"),
        (("sugarcane",), "Sugarcane"),
        (("maize", "corn"), "Maize"),
        (("ragi",), "Ragi"),
        (("tomato",), "Tomato"),
        (("leaf rust", "disease", "blight", "spot"), "Plant Condition Reference"),
        (("fertilizer", "npk", "urea", "dap"), "Fertilizer Schedule"),
        (("irrigation", "water", "drip"), "Irrigation Management"),
    ]
    for terms, detected_crop in crop_terms:
        if any(term in lower for term in terms):
            crop = detected_crop
            break
    return crop


@app.post("/api/crop/recommend")
def recommend_crop():
    payload = request.get_json(silent=True) or {}
    fields = ("nitrogen", "phosphorus", "potassium", "temperature", "humidity", "ph", "rainfall")
    try:
        values = {field: float(payload[field]) for field in fields}
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Provide numeric nitrogen, phosphorus, potassium, temperature, humidity, ph, and rainfall values."}), 400
    if not all(map(lambda value: value == value and abs(value) != float("inf"), values.values())):
        return jsonify({"error": "Crop recommendation inputs must be finite numbers."}), 400

    scores = {}
    dimensions = (
        ("temperature", "temp", 25, 2),
        ("humidity", "humidity", 20, 0.5),
        ("ph", "ph", 15, 5),
        ("rainfall", "rainfall", 15, 0.2),
        ("nitrogen", "N", 10, 0.1),
        ("phosphorus", "P", 7.5, 0.2),
        ("potassium", "K", 7.5, 0.2),
    )
    for crop, requirements in CROP_DATA.items():
        score = 0
        for input_name, requirement_name, weight, penalty in dimensions:
            value = values[input_name]
            minimum, maximum = requirements[requirement_name]
            if minimum <= value <= maximum:
                score += weight
            else:
                score += max(0, weight - abs(value - (minimum + maximum) / 2) * penalty)
        scores[crop] = round(score * 10) / 10

    sorted_crops = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    capitalize = lambda name: name[:1].upper() + name[1:]
    return jsonify(
        {
            "recommended_crop": capitalize(sorted_crops[0][0]),
            "match_score": sorted_crops[0][1],
            "all_recommendations": [{"crop": capitalize(crop), "score": score} for crop, score in sorted_crops[:5]],
            "input_params": values,
        }
    )


@app.post("/api/disease/detect")
def detect_disease():
    image_bytes = None
    mime_type = "image/jpeg"
    uploaded = request.files.get("image")
    if uploaded:
        image_bytes = uploaded.read(MAX_IMAGE_SIZE + 1)
        mime_type = uploaded.mimetype or mime_type
    else:
        image_base64 = (request.get_json(silent=True) or {}).get("imageBase64")
        if isinstance(image_base64, str):
            try:
                if image_base64.startswith("data:"):
                    header, separator, data = image_base64.partition(",")
                    if not separator:
                        raise ValueError("Malformed image data URL.")
                    metadata = header[5:].split(";")
                    mime_type = metadata[0]
                    if not mime_type.startswith("image/"):
                        raise ValueError("The data URL must contain an image.")
                    if any(parameter.lower() == "base64" for parameter in metadata[1:]):
                        image_bytes = base64.b64decode(data, validate=True)
                    else:
                        image_bytes = urllib.parse.unquote_to_bytes(data)
                else:
                    image_bytes = base64.b64decode(image_base64, validate=True)
            except (ValueError, base64.binascii.Error):
                return jsonify({"error": "The image data URL or base64 data is invalid."}), 400

    if image_bytes and len(image_bytes) > MAX_IMAGE_SIZE:
        return jsonify({"error": "Image must be 10 MB or smaller."}), 413
    return jsonify(
        {
            "error": "Image-based disease identification is not available. Use the educational sample scenarios or consult a qualified agricultural specialist."
        }
    ), 501


@app.post("/api/disease/sample")
def disease_sample():
    payload = request.get_json(silent=True) or {}
    scenario = payload.get("scenario")
    if not isinstance(scenario, str) or scenario not in DISEASE_DATA:
        return jsonify({"error": "Choose a supported educational disease scenario."}), 400

    info = DISEASE_DATA[scenario]
    return jsonify(
        {
            "disease": " ".join(part.capitalize() for part in scenario.split("_")),
            **info,
            "sample": True,
            "source": "educational-scenario",
        }
    )


@app.get("/api/weather/<path:location>")
def weather(location):
    return jsonify(get_weather(location or "Bengaluru"))


@app.get("/api/records")
def get_records():
    try:
        with database_connection() as connection:
            rows = connection.execute("SELECT * FROM farmer_records ORDER BY id DESC").fetchall()
        return jsonify([serialize_record(row) for row in rows])
    except (sqlite3.Error, ValueError) as error:
        app.logger.exception("Failed to load farmer records")
        return jsonify({"error": "Could not load farmer records.", "details": str(error)}), 500


@app.post("/api/records/save")
def save_record():
    payload = request.get_json(silent=True) or {}
    location = payload.get("location")
    crop = payload.get("crop")
    if not isinstance(location, str) or not location.strip() or not isinstance(crop, str) or not crop.strip():
        return jsonify({"error": "Missing required fields: location and crop are required."}), 400
    details = payload.get("details")
    if not isinstance(details, dict):
        details = {}
    activity = payload.get("activity")
    if not isinstance(activity, str) or not activity.strip():
        activity = None
    try:
        record = create_farmer_record(location.strip(), crop.strip(), activity.strip() if activity else None, details)
        return jsonify({"message": "Farmer record saved successfully", "record": record}), 201
    except sqlite3.Error as error:
        app.logger.exception("Failed to save farmer record")
        return jsonify({"error": "Could not persist the field record.", "details": str(error)}), 500


@app.post("/api/records/import")
def import_records():
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "Choose a CSV file to import."}), 400
    if Path(uploaded.filename).suffix.lower() != ".csv":
        return jsonify({"error": "Only CSV files can be imported."}), 400

    file_bytes = uploaded.read(MAX_RECORD_IMPORT_SIZE + 1)
    if len(file_bytes) > MAX_RECORD_IMPORT_SIZE:
        return jsonify({"error": "The CSV file must be 5 MB or smaller."}), 413
    try:
        csv_text = file_bytes.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(csv_text, newline=""))
        required_headers = {
            "category", "location", "crop", "activity", "timestamp",
            "question", "reply", "details_json",
        }
        headers = reader.fieldnames
        if not headers or not required_headers.issubset(headers):
            missing_headers = sorted(required_headers - set(headers or []))
            return jsonify({"error": f"CSV is missing required columns: {', '.join(missing_headers)}"}), 400
        if len(headers) != len(set(headers)):
            return jsonify({"error": "CSV column names must be unique."}), 400

        parsed_records = []
        for row_number, row in enumerate(reader, start=2):
            if None in row:
                raise ValueError(f"Row {row_number}: it contains more values than the header row.")
            if not any((value or "").strip() for value in row.values()):
                continue
            if len(parsed_records) >= MAX_RECORD_IMPORT_ROWS:
                return jsonify({"error": f"CSV can contain at most {MAX_RECORD_IMPORT_ROWS} records."}), 400

            category = (row.get("category") or "").strip().lower()
            if category not in {*RECORD_IMPORT_CATEGORIES, "chat"}:
                raise ValueError(f"Row {row_number}: category must be crop, disease, weather, chat, or manual.")

            timestamp_value = (row.get("timestamp") or "").strip()
            if timestamp_value:
                try:
                    timestamp = datetime.fromisoformat(timestamp_value.replace("Z", "+00:00"))
                except ValueError as error:
                    raise ValueError(f"Row {row_number}: timestamp must be an ISO-8601 date and time.") from error
                if timestamp.tzinfo is None:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                timestamp_value = timestamp.isoformat()
            else:
                timestamp_value = datetime.now(timezone.utc).isoformat()

            details_value = (row.get("details_json") or "").strip()
            try:
                details = json.loads(details_value) if details_value else {}
            except json.JSONDecodeError as error:
                raise ValueError(f"Row {row_number}: details_json must contain valid JSON.") from error
            if not isinstance(details, dict):
                raise ValueError(f"Row {row_number}: details_json must be a JSON object.")

            record = {"category": category, "timestamp": timestamp_value}
            if category == "chat":
                question = (row.get("question") or "").strip()
                reply = (row.get("reply") or "").strip()
                if not question or not reply:
                    raise ValueError(f"Row {row_number}: chat records require both question and reply.")
                record.update({
                    "question": question,
                    "reply": reply,
                    "crop": infer_chat_crop(question, reply),
                    "demo": details.get("demo") is True,
                })
            else:
                location = (row.get("location") or "").strip()
                crop = (row.get("crop") or "").strip()
                if not location or not crop:
                    raise ValueError(f"Row {row_number}: {category} records require location and crop.")
                default_activity, source = RECORD_IMPORT_CATEGORIES[category]
                activity = (row.get("activity") or "").strip() or default_activity
                details["source"] = source
                record.update({
                    "location": location,
                    "crop": crop,
                    "activity": activity,
                    "details": details,
                })
            parsed_records.append(record)

        if not parsed_records:
            return jsonify({"error": "The CSV contains no records to import."}), 400
    except (UnicodeDecodeError, csv.Error, ValueError) as error:
        return jsonify({"error": str(error)}), 400

    imported_counts = {category: 0 for category in (*RECORD_IMPORT_CATEGORIES, "chat")}
    try:
        with database_connection() as connection:
            for record in parsed_records:
                if record["category"] == "chat":
                    connection.execute(
                        """INSERT INTO farmer_chat_records (crop, question, reply, timestamp, demo)
                           VALUES (?, ?, ?, ?, ?)""",
                        (
                            record["crop"],
                            record["question"],
                            record["reply"],
                            record["timestamp"],
                            int(record["demo"]),
                        ),
                    )
                else:
                    connection.execute(
                        """INSERT INTO farmer_records (location, crop, activity, timestamp, details)
                           VALUES (?, ?, ?, ?, ?)""",
                        (
                            record["location"],
                            record["crop"],
                            record["activity"],
                            record["timestamp"],
                            json.dumps(record["details"]),
                        ),
                    )
                imported_counts[record["category"]] += 1
    except sqlite3.Error as error:
        app.logger.exception("Failed to import CSV activity records")
        return jsonify({"error": "Could not persist the imported records.", "details": str(error)}), 500

    return jsonify({"imported": len(parsed_records), "counts": imported_counts}), 201


@app.delete("/api/records/<record_id>")
def delete_record(record_id):
    try:
        numeric_id = int(record_id)
    except ValueError:
        return jsonify({"error": "Invalid record ID"}), 400
    try:
        with database_connection() as connection:
            connection.execute("DELETE FROM farmer_records WHERE id = ?", (numeric_id,))
        return jsonify({"message": "Record deleted successfully", "id": numeric_id})
    except sqlite3.Error as error:
        app.logger.exception("Failed to delete farmer record")
        return jsonify({"error": "Could not persist the field record deletion.", "details": str(error)}), 500


@app.get("/api/chat/records")
def get_chat_records():
    try:
        with database_connection() as connection:
            rows = connection.execute(
                "SELECT id, crop, question, reply, timestamp, demo FROM farmer_chat_records ORDER BY id DESC"
            ).fetchall()
        return jsonify(
            [
                {
                    "id": row["id"],
                    "location": "Farmer Help Chat",
                    "crop": row["crop"],
                    "activity": "Farmer Help Chat",
                    "timestamp": row["timestamp"],
                    "details": {
                        "source": "Farmer Chat",
                        **({"demo": True} if row["demo"] else {}),
                        "question": row["question"],
                        "advice": row["reply"],
                        "notes": (
                            f'DEMO SAMPLE - synthetic example only; not a real farmer question or response. '
                            f'Question: "{row["question"]}"'
                            if row["demo"]
                            else f'Farmer Query: "{row["question"]}"'
                        ),
                    },
                }
                for row in rows
            ]
        )
    except (sqlite3.Error, ValueError) as error:
        app.logger.exception("Failed to load Farmer Help Chat history")
        return jsonify({"error": "Could not load Farmer Help Chat history.", "details": str(error)}), 500


@app.delete("/api/chat/records/<record_id>")
def delete_chat_record(record_id):
    try:
        numeric_id = int(record_id)
    except ValueError:
        return jsonify({"error": "Invalid chat record ID"}), 400
    try:
        with database_connection() as connection:
            connection.execute("DELETE FROM farmer_chat_records WHERE id = ?", (numeric_id,))
        return jsonify({"message": "Chat record deleted successfully", "id": numeric_id})
    except sqlite3.Error as error:
        app.logger.exception("Failed to delete Farmer Help Chat record")
        return jsonify({"error": "Could not delete the Farmer Help Chat record.", "details": str(error)}), 500


@app.post("/api/chat")
def chat():
    payload = request.get_json(silent=True) or {}
    message = payload.get("message")
    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "Message is required"}), 400

    reply = chat_fallback(message)

    try:
        record = save_chat_advisory(message, reply)
        return jsonify({"reply": reply, "autoSavedRecord": record})
    except sqlite3.Error as error:
        app.logger.exception("Failed to save chat advisory")
        return jsonify({"error": "The reply was generated, but it could not be saved to Field Logic.", "reply": reply}), 500


@app.get("/api/health")
def health():
    return jsonify(
        {
            "status": "healthy",
            "message": "AgroSense farming advisory and record service is active",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "capabilities": ["crop_recommendation", "disease_reference_scenarios", "weather_intelligence", "farmer_records", "keyword_chat"],
        }
    )


@app.get("/")
def index():
    if (DIST_DIR / "index.html").exists():
        return send_from_directory(DIST_DIR, "index.html")
    return jsonify({"message": "AgroSense Flask API is running. Start the Vite development server to open the frontend."})


@app.get("/<path:filename>")
def static_files(filename):
    if (PUBLIC_DIR / filename).is_file():
        return send_from_directory(PUBLIC_DIR, filename)
    if (DIST_DIR / filename).is_file():
        return send_from_directory(DIST_DIR, filename)
    if (DIST_DIR / "index.html").exists():
        return send_from_directory(DIST_DIR, "index.html")
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"error": "Request is too large. Images must be 10 MB or smaller."}), 413


if __name__ == "__main__":
    initialize_database()
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.getenv("FLASK_PORT", "3000")))
    port = parser.parse_args().port
    app.run(host="127.0.0.1", port=port, debug=False)
