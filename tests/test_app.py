import base64
import csv
import io
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
import app as agrosense


class AgroSenseApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_database_path = agrosense.DATABASE_PATH
        self.original_data_dir = agrosense.DATA_DIR
        agrosense.DATA_DIR = Path(self.temp_dir.name)
        agrosense.DATABASE_PATH = Path(self.temp_dir.name) / "test.db"
        (agrosense.DATA_DIR / "records.json").write_text(
            json.dumps(
                [
                    {
                        "id": 12,
                        "location": "Pune",
                        "crop": "Sugarcane",
                        "timestamp": "2026-01-01T00:00:00.000Z",
                        "details": {"area": "3 acres"},
                    }
                ]
            ),
            encoding="utf-8",
        )
        agrosense.initialize_database()
        self.client = agrosense.app.test_client()

    def tearDown(self):
        agrosense.DATABASE_PATH = self.original_database_path
        agrosense.DATA_DIR = self.original_data_dir
        self.temp_dir.cleanup()

    def test_imports_legacy_records_once_and_supports_crud(self):
        response = self.client.get("/api/records")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()[0]["id"], 12)
        self.assertEqual(response.get_json()[0]["details"]["area"], "3 acres")

        agrosense.initialize_database()
        self.assertEqual(len(self.client.get("/api/records").get_json()), 1)

        created = self.client.post(
            "/api/records/save",
            json={
                "location": "Farm A",
                "crop": "Rice",
                "activity": "Sowing",
                "details": {"area": "2 acres"},
            },
        )
        self.assertEqual(created.status_code, 201)
        record_id = created.get_json()["record"]["id"]
        self.assertEqual(self.client.get("/api/records").get_json()[0]["crop"], "Rice")

        deleted = self.client.delete(f"/api/records/{record_id}")
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(len(self.client.get("/api/records").get_json()), 1)

    def test_crop_recommendation_validates_and_returns_top_five(self):
        invalid = self.client.post("/api/crop/recommend", json={"nitrogen": "not-a-number"})
        self.assertEqual(invalid.status_code, 400)

        response = self.client.post(
            "/api/crop/recommend",
            json={
                "nitrogen": 90,
                "phosphorus": 42,
                "potassium": 43,
                "temperature": 26,
                "humidity": 65,
                "ph": 6.5,
                "rainfall": 180,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["all_recommendations"]), 5)

    def test_chat_uses_fallback_and_saves_advisory(self):
        response = self.client.post("/api/chat", json={"message": "How should I irrigate rice?"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("reply", response.get_json())
        self.assertEqual(response.get_json()["autoSavedRecord"]["details"]["source"], "Farmer Chat")
        self.assertEqual(len(self.client.get("/api/records").get_json()), 1)
        chats = self.client.get("/api/chat/records").get_json()
        self.assertEqual(len(chats), 1)
        chat_id = chats[0]["id"]
        self.assertEqual(chats[0]["details"]["question"], "How should I irrigate rice?")

        deleted = self.client.delete(f"/api/chat/records/{chat_id}")
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(self.client.get("/api/chat/records").get_json(), [])

    def test_demo_chat_records_are_marked_separately_from_real_chats(self):
        with agrosense.database_connection() as connection:
            connection.execute(
                """INSERT INTO farmer_chat_records (crop, question, reply, timestamp, demo)
                   VALUES (?, ?, ?, ?, ?)""",
                (
                    "Rice",
                    "How should I irrigate rice in this demo?",
                    "This is synthetic demo guidance only.",
                    datetime.now(timezone.utc).isoformat(),
                    1,
                ),
            )

        chat_record = self.client.get("/api/chat/records").get_json()[0]
        self.assertIs(chat_record["details"]["demo"], True)
        self.assertIn("not a real farmer question", chat_record["details"]["notes"])

    def test_existing_chat_records_move_to_separate_table_once(self):
        with agrosense.database_connection() as connection:
            connection.execute(
                "DELETE FROM app_migrations WHERE name = ?",
                ("split-farmer-chat-records-v1",),
            )
            connection.execute(
                """INSERT INTO farmer_records (id, location, crop, activity, timestamp, details)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    20,
                    "Farmer Help Chat",
                    "Rice",
                    "Farmer Help Chat",
                    "2026-01-02T00:00:00.000Z",
                    json.dumps(
                        {
                            "source": "Farmer Chat",
                            "question": "How often should I water rice?",
                            "advice": "Check soil moisture before watering.",
                        }
                    ),
                ),
            )

        agrosense.initialize_database()
        chat_records = self.client.get("/api/chat/records").get_json()
        self.assertEqual(len(chat_records), 1)
        self.assertEqual(chat_records[0]["id"], 20)
        self.assertEqual(chat_records[0]["details"]["question"], "How often should I water rice?")
        self.assertEqual(len(self.client.get("/api/records").get_json()), 1)

        agrosense.initialize_database()
        self.assertEqual(len(self.client.get("/api/chat/records").get_json()), 1)

    def test_legacy_activity_labels_are_normalized(self):
        with agrosense.database_connection() as connection:
            connection.execute(
                """INSERT INTO farmer_records (id, location, crop, activity, timestamp, details)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    21,
                    "Farm A",
                    "Rice",
                    "Crop recommendation",
                    "2026-01-02T00:00:00.000Z",
                    json.dumps({
                        "source": "Soil AI",
                        "confidence": 97,
                        "notes": "Computed with AgroSense AI with 97.0/100 score.",
                    }),
                ),
            )
            connection.execute(
                """INSERT INTO farmer_records (id, location, crop, activity, timestamp, details)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    22,
                    "Farm B",
                    "Tomato",
                    "Disease detection",
                    "2026-01-03T00:00:00.000Z",
                    json.dumps({
                        "source": "Disease Diagnosis",
                        "confidence": 88,
                        "notes": "Legacy prototype result.",
                    }),
                ),
            )
            connection.execute(
                "DELETE FROM app_migrations WHERE name = ?",
                ("normalize-activity-records-v1",),
            )
            connection.execute(
                "DELETE FROM app_migrations WHERE name = ?",
                ("rename-disease-reference-source-v1",),
            )

        agrosense.initialize_database()
        records = {record["id"]: record for record in self.client.get("/api/records").get_json()}
        crop_details = records[21]["details"]
        self.assertEqual(crop_details["source"], "Crop Rules")
        self.assertEqual(crop_details["match_score"], 97)
        self.assertNotIn("confidence", crop_details)
        self.assertNotIn("AI", crop_details["notes"])
        disease_details = records[22]["details"]
        self.assertEqual(disease_details["source"], "Disease Reference")
        self.assertEqual(records[22]["activity"], "Disease reference")
        self.assertNotIn("confidence", disease_details)
        self.assertIn("not a verified image diagnosis", disease_details["notes"])

    def test_database_stores_more_than_200_activities_with_search_timestamps(self):
        started_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        for index in range(205):
            agrosense.create_farmer_record(
                f"Farm {index}",
                "Rice",
                activity="Crop recommendation",
                details={"source": "Crop Rules", "nitrogen": index},
            )
            agrosense.save_chat_advisory(
                f"How should I grow rice on farm {index}?",
                f"Advice for farm {index}.",
            )

        field_records = self.client.get("/api/records").get_json()
        chat_records = self.client.get("/api/chat/records").get_json()
        self.assertEqual(
            len([record for record in field_records if record.get("activity") == "Crop recommendation"]),
            205,
        )
        self.assertEqual(len(chat_records), 205)

        field_timestamps = [
            datetime.fromisoformat(record["timestamp"])
            for record in field_records
            if record.get("activity") == "Crop recommendation"
        ]
        chat_timestamps = [datetime.fromisoformat(record["timestamp"]) for record in chat_records]
        self.assertTrue(all(timestamp >= started_at for timestamp in field_timestamps + chat_timestamps))
        self.assertEqual(len(set(field_timestamps)), 205)
        self.assertEqual(len(set(chat_timestamps)), 205)

    def test_csv_import_saves_all_five_categories_to_their_tables(self):
        rows = [
            {
                "category": "crop",
                "location": "Pune",
                "crop": "Rice",
                "activity": "",
                "timestamp": "",
                "question": "",
                "reply": "",
                "details_json": json.dumps({"nitrogen": 80}),
            },
            {
                "category": "disease",
                "location": "Farm B",
                "crop": "Tomato",
                "activity": "",
                "timestamp": "",
                "question": "",
                "reply": "",
                "details_json": json.dumps({"severity": "Medium"}),
            },
            {
                "category": "weather",
                "location": "Delhi",
                "crop": "Weather advisory",
                "activity": "",
                "timestamp": "",
                "question": "",
                "reply": "",
                "details_json": json.dumps({"temperature": 28}),
            },
            {
                "category": "chat",
                "location": "",
                "crop": "",
                "activity": "",
                "timestamp": "",
                "question": "How should I irrigate rice?",
                "reply": "Check soil moisture before watering.",
                "details_json": "",
            },
            {
                "category": "manual",
                "location": "Farm C",
                "crop": "Cotton",
                "activity": "Irrigation log",
                "timestamp": "",
                "question": "",
                "reply": "",
                "details_json": json.dumps({"notes": "Irrigated north plot"}),
            },
        ]
        output = io.StringIO(newline="")
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        started_at = datetime.now(timezone.utc) - timedelta(seconds=1)

        response = self.client.post(
            "/api/records/import",
            data={"file": (io.BytesIO(output.getvalue().encode("utf-8")), "activities.csv")},
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 201, response.get_json())
        self.assertEqual(
            response.get_json()["counts"],
            {"crop": 1, "disease": 1, "weather": 1, "manual": 1, "chat": 1},
        )
        records = self.client.get("/api/records").get_json()
        imported_records = [record for record in records if record["details"].get("source") in {
            "Crop Rules", "Disease Reference", "Weather", "Manual Entry"
        }]
        self.assertEqual(len(imported_records), 4)
        self.assertTrue(all(datetime.fromisoformat(record["timestamp"]) >= started_at for record in imported_records))
        self.assertEqual(len(self.client.get("/api/chat/records").get_json()), 1)

    def test_csv_import_accepts_160_real_rows_for_each_category(self):
        categories = ("crop", "disease", "weather", "chat", "manual")
        rows = []
        for category in categories:
            for index in range(160):
                rows.append({
                    "category": category,
                    "location": f"Farm {index}" if category != "chat" else "",
                    "crop": "Rice" if category != "chat" else "",
                    "activity": "",
                    "timestamp": "",
                    "question": f"How should I care for rice on farm {index}?" if category == "chat" else "",
                    "reply": f"Advice for farm {index}." if category == "chat" else "",
                    "details_json": "",
                })
        output = io.StringIO(newline="")
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

        response = self.client.post(
            "/api/records/import",
            data={"file": (io.BytesIO(output.getvalue().encode("utf-8")), "activities.csv")},
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 201, response.get_json())
        self.assertEqual(response.get_json()["imported"], 800)
        self.assertEqual(response.get_json()["counts"], {
            "crop": 160,
            "disease": 160,
            "weather": 160,
            "manual": 160,
            "chat": 160,
        })
        self.assertEqual(len(self.client.get("/api/chat/records").get_json()), 160)
        self.assertEqual(len(self.client.get("/api/records").get_json()), 641)

    def test_csv_import_rejects_invalid_batch_without_partial_writes(self):
        csv_data = (
            "category,location,crop,activity,timestamp,question,reply,details_json\n"
            'crop,Pune,Rice,,,,,"{""source"":""ignored""}"\n'
            "unknown,Delhi,Wheat,,,,,\n"
        )
        before_fields = len(self.client.get("/api/records").get_json())
        before_chats = len(self.client.get("/api/chat/records").get_json())

        response = self.client.post(
            "/api/records/import",
            data={"file": (io.BytesIO(csv_data.encode("utf-8")), "invalid.csv")},
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Row 3", response.get_json()["error"])
        self.assertEqual(len(self.client.get("/api/records").get_json()), before_fields)
        self.assertEqual(len(self.client.get("/api/chat/records").get_json()), before_chats)

    def test_csv_template_is_available(self):
        response = self.client.get("/field-logic-records-template.csv")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"category,location,crop,activity,timestamp,question,reply,details_json", response.data)
        response.close()

    def test_uploaded_image_is_not_misrepresented_as_diagnosed(self):
        image = base64.b64encode(b"test leaf image").decode("ascii")
        before_records = self.client.get("/api/records").get_json()
        response = self.client.post(
            "/api/disease/detect",
            json={"imageBase64": f"data:image/jpeg;base64,{image}"},
        )
        self.assertEqual(response.status_code, 501)
        self.assertIn("not available", response.get_json()["error"])
        self.assertEqual(self.client.get("/api/records").get_json(), before_records)
        self.assertEqual(self.client.get("/api/health").get_json()["status"], "healthy")

    def test_disease_sample_endpoint_returns_educational_reference(self):
        response = self.client.post("/api/disease/sample", json={"scenario": "early_blight"})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["disease"], "Early Blight")
        self.assertTrue(response.get_json()["sample"])
        self.assertNotIn("confidence", response.get_json())
        invalid = self.client.post("/api/disease/sample", json={"scenario": "unknown"})
        self.assertEqual(invalid.status_code, 400)


if __name__ == "__main__":
    unittest.main()
