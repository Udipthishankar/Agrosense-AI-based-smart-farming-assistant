# AgroSense - Farming Tools & Advisory

AgroSense is a full-stack farming information application with soil-based crop suitability matching, weather information, educational plant-condition references, keyword-based farmer guidance, and activity tracking.

## Quick Start (Windows)

### Requirements

- Node.js 18 or later and npm
- Python 3.10 or later, installed with the Windows Python Launcher (`py`)

AgroSense uses **Flask** for its API and **SQLite** for data storage. SQLite is included with Python: there is no MySQL server, database account, password, or Docker setup.

### Install

Open PowerShell in the project folder (the folder containing `package.json`) and run:

```powershell
npm install
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Optionally copy `.env.example` to `.env` to configure `OPENWEATHER_API_KEY`. Weather lookups use Open-Meteo when no key is configured. Do not share or commit `.env`.

Crop recommendations use a deterministic weighted match against the crop ranges in `app.py`. Farmer Help Chat selects from local keyword-based guidance. Disease scenarios are fixed educational examples; this version does not identify diseases from uploaded images. Weather is retrieved from Open-Meteo when available, with a regional estimate fallback.

### Run in development

```powershell
npm run dev
```

Open **http://localhost:3000**. This command starts the Flask API and the Vite frontend together. The SQLite database is created automatically at `data/agrosense.db`. Crop, disease, weather, and manual field records are stored in `farmer_records`; Farmer Help Chat questions and replies have their own `farmer_chat_records` table. Existing field records are imported and existing chat advisories are moved into the chat table once.

Activity history has no 200-record limit. Each saved activity receives its own timestamp, and selecting a record opens its full details.

### Importing real activity history

In **Field Logic**, download **CSV Template**, fill it with genuine activity history, then use **Import CSV**. The importer supports up to 1,000 records per file and validates the complete file before saving any rows.

The CSV columns are `category,location,crop,activity,timestamp,question,reply,details_json`. Use `crop`, `disease`, `weather`, `chat`, or `manual` for `category`. Crop, disease, weather, and manual rows require `location` and `crop`; chat rows require `question` and `reply`. `activity` and `timestamp` are optional; a missing timestamp is set to the import time. `details_json` can contain a JSON object with category-specific information. Imported chat records are stored in the separate `farmer_chat_records` table.

### Build and run for production

```powershell
npm run build
npm start
```

Open **http://localhost:3000**.

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend/API:** Python and Flask
- **Database:** SQLite via Python's standard library
