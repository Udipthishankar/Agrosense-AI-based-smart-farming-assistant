import React, { useState, useEffect, useRef } from "react";
import { BookOpen, Plus, Trash2, Download, Calendar, MapPin, Sprout, Filter, CheckCircle2, AlertCircle, Maximize2, X, Upload, FileDown } from "lucide-react";
import { FarmerRecord } from "../types";

type RecordCategory = "crop" | "disease" | "weather" | "chat" | "manual";

const RECORD_CATEGORIES: { id: RecordCategory; label: string; emptyMessage: string }[] = [
  { id: "crop", label: "Crop Recommendations", emptyMessage: "Crop recommendations you save will appear here." },
  { id: "disease", label: "Disease References", emptyMessage: "Educational disease examples you view will appear here." },
  { id: "weather", label: "Weather", emptyMessage: "Weather lookups you save will appear here." },
  { id: "chat", label: "Farmer Help Chat", emptyMessage: "Your saved Farmer Help Chat questions and replies will appear here." },
  { id: "manual", label: "Manual Records", emptyMessage: "Manually added field logs will appear here." },
];

function belongsToCategory(record: FarmerRecord, category: RecordCategory): boolean {
  const source = record.details?.source;
  if (category === "crop") {
    return source === "Crop Rules" || record.activity === "Crop recommendation";
  }
  if (category === "disease") {
    return source === "Disease Reference" ||
      source === "Disease Diagnosis" ||
      record.activity === "Disease reference" ||
      record.activity === "Disease detection";
  }
  if (category === "weather") {
    return source === "Weather" || record.activity === "Weather lookup";
  }
  if (category === "chat") {
    return source === "Farmer Chat" || record.activity === "Farmer Help Chat";
  }
  return !belongsToCategory(record, "crop") &&
    !belongsToCategory(record, "disease") &&
    !belongsToCategory(record, "weather") &&
    !belongsToCategory(record, "chat");
}

function formatRecordValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function isDemoRecord(record: FarmerRecord): boolean {
  return record.details?.demo === true || record.details?.question?.startsWith("[DEMO SAMPLE ") === true;
}

export const FarmerRecords: React.FC = () => {
  const [records, setRecords] = useState<FarmerRecord[]>([]);
  const [chatRecords, setChatRecords] = useState<FarmerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FarmerRecord | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<RecordCategory>("crop");
  const [filterQuery, setFilterQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [newLocation, setNewLocation] = useState("");
  const [newCrop, setNewCrop] = useState("Sugarcane");
  const [newArea, setNewArea] = useState("2.5 acres");
  const [newSoilType, setNewSoilType] = useState("Black Cotton Soil");
  const [newIrrigation, setNewIrrigation] = useState("Drip Irrigation");
  const [newNotes, setNewNotes] = useState("");

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const [recordsResponse, chatResponse] = await Promise.all([
        fetch("/api/records"),
        fetch("/api/chat/records"),
      ]);
      if (!recordsResponse.ok || !chatResponse.ok) {
        throw new Error(`Server returned ${!recordsResponse.ok ? recordsResponse.status : chatResponse.status}`);
      }
      const [recordsData, chatData] = await Promise.all([
        recordsResponse.json(),
        chatResponse.json(),
      ]);
      setRecords(recordsData);
      setChatRecords(chatData);
      setError(null);
    } catch (err) {
      console.error("Failed to load records:", err);
      setError("Could not load Field Logic activities. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    if (!selectedRecord) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedRecord(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedRecord]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation.trim() || !newCrop.trim()) return;

    try {
      const payload = {
        activity: "Manual field log",
        location: newLocation.trim(),
        crop: newCrop.trim(),
        details: {
          area: newArea,
          soil_type: newSoilType,
          irrigation: newIrrigation,
          notes: newNotes,
        },
      };

      const res = await fetch("/api/records/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      setShowAddModal(false);
      setNewLocation("");
      setNewNotes("");
      setSelectedCategory("manual");
      await fetchRecords();
    } catch (err: unknown) {
      console.error("Error creating record:", err);
      const message = err instanceof Error ? err.message : "Unknown save error";
      setError(`Could not save the field log: ${message}`);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setImporting(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/records/import", {
        method: "POST",
        body: formData,
      });
      const result: { imported?: number; error?: string } = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Server returned ${response.status}`);
      }
      setStatusMessage(`Imported ${result.imported ?? 0} real activity records.`);
      await fetchRecords();
    } catch (err: unknown) {
      console.error("Failed to import activity records:", err);
      const message = err instanceof Error ? err.message : "Unknown import error";
      setError(`Could not import activity records: ${message}`);
    } finally {
      input.value = "";
      setImporting(false);
    }
  };

  const handleDeleteRecord = async (id: number) => {
    try {
      const isChatRecord = selectedCategory === "chat";
      const endpoint = isChatRecord ? `/api/chat/records/${id}` : `/api/records/${id}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      if (isChatRecord) {
        setChatRecords((prev) => prev.filter((record) => record.id !== id));
      } else {
        setRecords((prev) => prev.filter((record) => record.id !== id));
      }
    } catch (err: unknown) {
      console.error("Delete record error:", err);
      const message = err instanceof Error ? err.message : "Unknown delete error";
      setError(`Could not delete the field log: ${message}`);
    }
  };

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ["ID", "Activity", "Location", "Crop", "Timestamp", "Origin", "Area", "Soil Type", "Irrigation", "Notes", "Details", "Contact Email"];
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = filtered.map((r) => [
      r.id,
      r.activity || "Field log",
      r.location,
      r.crop,
      r.timestamp,
      r.details?.source,
      r.details?.area,
      r.details?.soil_type,
      r.details?.irrigation,
      r.details?.notes,
      r.details?.advice || r.details?.question,
      r.details?.contact_email,
    ].map(escapeCsv));

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\r\n");
    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `agrosense_${selectedCategory}_records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const query = filterQuery.toLowerCase();
  const categorySource = selectedCategory === "chat" ? chatRecords : records;
  const categoryRecords = categorySource.filter((record) => belongsToCategory(record, selectedCategory));
  const filtered = categoryRecords.filter(
    (record) =>
      record.location.toLowerCase().includes(query) ||
      record.crop.toLowerCase().includes(query) ||
      (record.activity || "").toLowerCase().includes(query)
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5" />
            Field Logic
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-emerald-950">Saved Activities</h2>
          <p className="text-gray-600 text-xs sm:text-sm">
            Crop recommendations, disease scans, and weather lookups are organized in separate tabs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportFile}
            className="hidden"
            aria-label="Choose activity records CSV"
          />
          <a
            href="/field-logic-records-template.csv"
            download
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>CSV Template</span>
          </a>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{importing ? "Importing..." : "Import CSV"}</span>
          </button>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Manual Record</span>
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Demo samples are labeled in each card. Import real history using the CSV template; categories: crop, disease, weather, chat, or manual.
      </p>
      {statusMessage && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-sm">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2" role="tablist" aria-label="Saved activity categories">
        {RECORD_CATEGORIES.map((category) => {
          const sourceRecords = category.id === "chat" ? chatRecords : records;
          const count = sourceRecords.filter((record) => belongsToCategory(record, category.id)).length;
          const isSelected = selectedCategory === category.id;
          return (
            <button
              key={category.id}
              id={`records-tab-${category.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls="records-panel"
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left text-xs sm:text-sm font-semibold transition-colors ${
                isSelected
                  ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                  : "border-emerald-100 bg-white text-emerald-950 hover:bg-emerald-50"
              }`}
            >
              <span>{category.label}</span>
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] ${isSelected ? "bg-white/20" : "bg-emerald-100 text-emerald-800"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter by activity, plot location, or crop..."
          className="w-full text-xs sm:text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
        />
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Records List */}
      <section id="records-panel" role="tabpanel" aria-labelledby={`records-tab-${selectedCategory}`}>
      {loading ? (
        <div className="p-12 text-center text-gray-500 text-sm">Loading field logs...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-dashed border-emerald-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto text-2xl">
            📋
          </div>
          <h4 className="font-bold text-gray-800 text-base">
            {filterQuery ? "No Matching Records" : `No ${RECORD_CATEGORIES.find((category) => category.id === selectedCategory)?.label} Yet`}
          </h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {filterQuery
              ? "No records in this category match your search."
              : RECORD_CATEGORIES.find((category) => category.id === selectedCategory)?.emptyMessage}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm hover:shadow-md transition-shadow space-y-3 flex flex-col justify-between cursor-pointer"
              onClick={() => setSelectedRecord(record)}
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-base font-bold">
                      🌱
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{record.activity || record.crop}</h4>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        <span>{record.location}</span>
                      </div>
                      {isDemoRecord(record) && (
                        <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                          Demo sample · synthetic data
                        </span>
                      )}
                      {record.activity && record.crop && record.activity !== record.crop && (
                        <div className="text-[11px] text-gray-500">{record.crop}</div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteRecord(record.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="Delete record"
                    aria-label={`Delete record ${record.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Details Subgrid */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {record.details?.source && (
                    <div className="col-span-2 flex items-center justify-between pb-1 mb-1 border-b border-gray-200/60">
                      <span className="text-gray-500 text-[10px] uppercase font-bold">Origin</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          record.details.source === "Farmer Chat" || record.details.source === "About"
                            ? "bg-purple-100 text-purple-800"
                            : record.details.source === "Crop Rules"
                            ? "bg-emerald-100 text-emerald-800"
                            : record.details.source === "Weather"
                            ? "bg-sky-100 text-sky-800"
                            : record.details.source === "Disease Diagnosis" ||
                              record.details.source === "Disease Reference"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {record.details.source === "Farmer Chat" ? "💬 Farmer Chat Advisory" : record.details.source}
                      </span>
                    </div>
                  )}

                  {record.details?.area && (
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">Plot Area</span>
                      <span className="font-medium text-gray-800">{record.details.area}</span>
                    </div>
                  )}
                  {record.details?.soil_type && (
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">Soil Type</span>
                      <span className="font-medium text-gray-800">{record.details.soil_type}</span>
                    </div>
                  )}
                  {record.details?.irrigation && (
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">Irrigation</span>
                      <span className="font-medium text-gray-800">{record.details.irrigation}</span>
                    </div>
                  )}
                  {record.details?.ph && (
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">Soil pH</span>
                      <span className="font-medium text-gray-800">{record.details.ph}</span>
                    </div>
                  )}
                  {record.details?.temperature !== undefined && (
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">Temperature</span>
                      <span className="font-medium text-gray-800">{record.details.temperature}°C</span>
                    </div>
                  )}
                  {record.details?.humidity !== undefined && (
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">Humidity</span>
                      <span className="font-medium text-gray-800">{record.details.humidity}%</span>
                    </div>
                  )}
                  {record.details?.rainfall_chance !== undefined && (
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">Rain Chance</span>
                      <span className="font-medium text-gray-800">{record.details.rainfall_chance}%</span>
                    </div>
                  )}
                  {record.details?.severity && (
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">Severity</span>
                      <span className="font-medium text-gray-800">{record.details.severity}</span>
                    </div>
                  )}
                  {record.details?.match_score !== undefined && (
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">Suitability Match</span>
                      <span className="font-medium text-gray-800">
                        {record.details.match_score.toFixed(1)}/100
                      </span>
                    </div>
                  )}
                </div>

                {record.details?.question && (
                  <div className="text-xs bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/60 space-y-1">
                    <span className="text-[10px] font-bold text-amber-900 uppercase block">Farmer Question:</span>
                    <p className="text-gray-800 font-medium">{record.details.question}</p>
                  </div>
                )}

                {record.details?.contact_email && (
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold">Contact: </span>
                    {record.details.contact_email}
                  </p>
                )}

                {record.details?.advice && (
                  <div className="text-xs bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/60 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-900 uppercase block">Activity Details:</span>
                    <p className="text-gray-700 whitespace-pre-line leading-relaxed">{record.details.advice}</p>
                  </div>
                )}

                {!record.details?.advice && record.details?.notes && (
                  <p className="text-xs text-gray-600 italic bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100/60">
                    "{record.details.notes}"
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                <span className="flex flex-col gap-1">
                  {!isDemoRecord(record) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(record.timestamp).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  <span className="font-medium text-emerald-700">Record #{record.id}</span>
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedRecord(record);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50"
                  aria-label={`Open full-screen details for record ${record.id}`}
                >
                  View full record
                  <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </section>

      {selectedRecord && (
        <div
          className="fixed inset-0 z-[60] overflow-y-auto bg-white"
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-detail-title"
        >
          <div className="sticky top-0 z-10 border-b border-emerald-100 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {RECORD_CATEGORIES.find((category) => category.id === selectedCategory)?.label} · Record #{selectedRecord.id}
                </p>
                <h2 id="record-detail-title" className="truncate text-lg font-bold text-emerald-950 sm:text-xl">
                  {selectedRecord.activity || selectedRecord.crop}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                aria-label="Close full-screen record details"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-800 to-teal-800 p-6 text-white shadow-lg sm:p-9">
              <p className="text-sm font-semibold text-emerald-100">Complete activity record</p>
              <h3 className="mt-2 text-3xl font-bold">{selectedRecord.crop}</h3>
              <p className="mt-3 flex items-center gap-2 text-emerald-50">
                <MapPin className="h-4 w-4 shrink-0" />
                {selectedRecord.location}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Saved date and time</span>
                <p className="mt-2 flex items-center gap-2 font-semibold text-gray-900">
                  <Calendar className="h-4 w-4 text-emerald-700" />
                  <time dateTime={selectedRecord.timestamp}>
                    {new Date(selectedRecord.timestamp).toLocaleString(undefined, {
                      dateStyle: "full",
                      timeStyle: "short",
                    })}
                  </time>
                </p>
              </div>
              {selectedRecord.details?.source && (
                <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Activity source</span>
                  <p className="mt-2 font-semibold text-gray-900">
                    {selectedRecord.details.source === "Farmer Chat" ? "Farmer Help Chat" : selectedRecord.details.source}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold text-emerald-950">Full activity information</h3>
              {Object.entries(selectedRecord.details ?? {})
                .filter(([key]) => key !== "source")
                .map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                      {key.replace(/_/g, " ")}
                    </h4>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-gray-800">
                      {formatRecordValue(value) || "No information provided."}
                    </p>
                  </div>
                ))}
              {Object.keys(selectedRecord.details ?? {}).filter((key) => key !== "source").length === 0 && (
                <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
                  This record has no additional details.
                </p>
              )}
            </div>

            <div className="border-t border-gray-200 pt-5 text-sm text-gray-500">
              Record ID: {selectedRecord.id}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-lg text-emerald-950">Add Field Log</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Field / Region Location</label>
                <input
                  type="text"
                  required
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Pune Plot 4, Maharashtra"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Selected Crop</label>
                  <input
                    type="text"
                    required
                    value={newCrop}
                    onChange={(e) => setNewCrop(e.target.value)}
                    placeholder="e.g. Rice, Wheat, Cotton"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Plot Area</label>
                  <input
                    type="text"
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value)}
                    placeholder="e.g. 4 acres"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Soil Type</label>
                  <input
                    type="text"
                    value={newSoilType}
                    onChange={(e) => setNewSoilType(e.target.value)}
                    placeholder="e.g. Black Soil, Alluvial"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Irrigation Method</label>
                  <input
                    type="text"
                    value={newIrrigation}
                    onChange={(e) => setNewIrrigation(e.target.value)}
                    placeholder="e.g. Drip, Canal, Sprinkler"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Farmer Notes / Schedule</label>
                <textarea
                  rows={3}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Tested soil NPK, scheduled urea broadcast next week..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
