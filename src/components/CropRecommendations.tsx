import React, { useState } from "react";
import { Sprout, Sparkles, CheckCircle2, BookmarkPlus, RotateCcw, AlertCircle, Info } from "lucide-react";
import { CropRecommendationRequest, CropRecommendationResponse } from "../types";
import { saveFieldActivity } from "../services/fieldLogService";

interface CropRecommendationsProps {
  onSaveRecord?: (cropName: string, details: Record<string, unknown>) => void;
}

export const CropRecommendations: React.FC<CropRecommendationsProps> = ({ onSaveRecord }) => {
  const [formData, setFormData] = useState<CropRecommendationRequest>({
    nitrogen: 78,
    phosphorus: 41,
    potassium: 43,
    temperature: 24.0,
    humidity: 65,
    ph: 6.5,
    rainfall: 180,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CropRecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [fieldLocation, setFieldLocation] = useState("");

  const presets = [
    {
      name: "Monsoon Paddy (Rice)",
      icon: "🌾",
      data: { nitrogen: 80, phosphorus: 45, potassium: 45, temperature: 26, humidity: 82, ph: 6.2, rainfall: 220 },
    },
    {
      name: "Winter Wheat Soil",
      icon: "🍞",
      data: { nitrogen: 85, phosphorus: 50, potassium: 40, temperature: 18, humidity: 48, ph: 6.8, rainfall: 65 },
    },
    {
      name: "Cotton Black Soil",
      icon: "☁️",
      data: { nitrogen: 110, phosphorus: 35, potassium: 70, temperature: 29, humidity: 58, ph: 7.4, rainfall: 95 },
    },
    {
      name: "Sugarcane Valley",
      icon: "🎋",
      data: { nitrogen: 145, phosphorus: 60, potassium: 95, temperature: 27, humidity: 75, ph: 6.9, rainfall: 170 },
    },
    {
      name: "High Nutrient Tomato",
      icon: "🍅",
      data: { nitrogen: 170, phosphorus: 65, potassium: 125, temperature: 24, humidity: 68, ph: 6.4, rainfall: 125 },
    },
  ];

  const handlePresetSelect = async (presetData: CropRecommendationRequest) => {
    setFormData(presetData);
    setResult(null);
    setError(null);
    setSavedSuccess(false);
    await runRecommendation(presetData);
  };

  const handleInputChange = (field: keyof CropRecommendationRequest, val: string) => {
    const num = parseFloat(val) || 0;
    setFormData((prev) => ({ ...prev, [field]: num }));
  };

  const runRecommendation = async (parameters: CropRecommendationRequest) => {
    setLoading(true);
    setError(null);
    setSavedSuccess(false);
    setResult(null);

    try {
      const res = await fetch("/api/crop/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parameters),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data: CropRecommendationResponse = await res.json();
      setResult(data);
      await saveRecommendationToFieldLogic(data);
    } catch (err: unknown) {
      console.error("Crop recommendation error:", err);
      const message = err instanceof Error ? err.message : "Failed to compute recommendation";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runRecommendation(formData);
  };

  const saveRecommendationToFieldLogic = async (recommendation: CropRecommendationResponse) => {
    setSavingRecord(true);
    try {
      const details = {
        source: "Crop Rules" as const,
        match_score: recommendation.match_score,
        nitrogen: recommendation.input_params?.nitrogen ?? formData.nitrogen,
        phosphorus: recommendation.input_params?.phosphorus ?? formData.phosphorus,
        potassium: recommendation.input_params?.potassium ?? formData.potassium,
        temperature: recommendation.input_params?.temperature ?? formData.temperature,
        humidity: recommendation.input_params?.humidity ?? formData.humidity,
        ph: recommendation.input_params?.ph ?? formData.ph,
        rainfall: recommendation.input_params?.rainfall ?? formData.rainfall,
        soil_type: (recommendation.input_params?.ph ?? formData.ph) > 7.0 ? "Alkaline Loam" : "Slightly Acidic Loam",
        irrigation: (recommendation.input_params?.rainfall ?? formData.rainfall) < 80 ? "Drip Irrigation Required" : "Rainfed + Furrow",
        notes: `Calculated by matching the entered soil and climate values to crop suitability ranges (${recommendation.match_score.toFixed(1)}/100 match score).`,
        advice: recommendation.all_recommendations
          .map((item, index) => `${index + 1}. ${item.crop}: ${item.score.toFixed(1)} points`)
          .join("\n"),
      };

      await saveFieldActivity({
        activity: "Crop recommendation",
        location: fieldLocation.trim() || "Unspecified Field",
        crop: recommendation.recommended_crop,
        details,
      });

      setSavedSuccess(true);
      setError(null);
      if (onSaveRecord) {
        onSaveRecord(recommendation.recommended_crop, details);
      }
    } catch (err: unknown) {
      console.error("Failed to save crop recommendation to Field Logic:", err);
      const message = err instanceof Error ? err.message : "Unknown save error";
      setError(`Recommendation calculated, but it could not be saved to Field Logic: ${message}`);
    } finally {
      setSavingRecord(false);
    }
  };

  const handleSaveToRecords = async () => {
    if (!result) return;
    await saveRecommendationToFieldLogic(result);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Page Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <Sprout className="w-3.5 h-3.5" />
          Smart Agronomic Decision Support
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-emerald-950">
          Soil Nutrients & Climate Crop Recommender
        </h2>
        <p className="text-gray-600 text-sm max-w-xl mx-auto">
          Enter your soil test parameters (N, P, K, pH) and local climate data to identify crops with the highest agronomic compatibility and yield score.
        </p>
      </div>

      {/* Preset Quick-Load Buttons */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-emerald-100 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <Info className="w-3.5 h-3.5 text-emerald-600" />
          <span>Quick Soil Presets (Click to Test):</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => handlePresetSelect(preset.data)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 transition-all hover:scale-102 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{preset.icon}</span>
              <span>{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Input Form Column */}
        <div className="lg:col-span-6 bg-white rounded-3xl p-6 sm:p-8 border border-emerald-100 shadow-sm space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <h3 className="font-bold text-lg text-emerald-950 flex items-center gap-2 border-b border-emerald-100 pb-3">
              <span>🌾</span> Field Parameters
            </h3>

            <div>
              <label htmlFor="crop-field-location" className="block text-xs font-semibold text-gray-700 mb-1">
                Field / Plot Location
              </label>
              <input
                id="crop-field-location"
                type="text"
                value={fieldLocation}
                onChange={(e) => setFieldLocation(e.target.value)}
                placeholder="e.g. North Field Plot A"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Nutrients Sub-Grid */}
            <div className="space-y-4">
              <label className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                Primary Soil Nutrients (NPK in kg/ha or mg/kg)
              </label>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nitrogen (N)</label>
                  <input
                    type="number"
                    id="nitrogen-input"
                    value={formData.nitrogen}
                    onChange={(e) => handleInputChange("nitrogen", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                  <span className="text-[10px] text-gray-400">Typical: 20-180</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phosphorus (P)</label>
                  <input
                    type="number"
                    id="phosphorus-input"
                    value={formData.phosphorus}
                    onChange={(e) => handleInputChange("phosphorus", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                  <span className="text-[10px] text-gray-400">Typical: 15-80</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Potassium (K)</label>
                  <input
                    type="number"
                    id="potassium-input"
                    value={formData.potassium}
                    onChange={(e) => handleInputChange("potassium", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                  <span className="text-[10px] text-gray-400">Typical: 15-150</span>
                </div>
              </div>
            </div>

            {/* Climate & Soil Chemistry Sub-Grid */}
            <div className="space-y-4 pt-2">
              <label className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                Climate & Soil Chemistry
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    id="temp-input"
                    value={formData.temperature}
                    onChange={(e) => handleInputChange("temperature", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Humidity (%)</label>
                  <input
                    type="number"
                    id="humidity-input"
                    value={formData.humidity}
                    onChange={(e) => handleInputChange("humidity", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Soil pH (0 - 14)</label>
                  <input
                    type="number"
                    step="0.1"
                    id="ph-input"
                    value={formData.ph}
                    onChange={(e) => handleInputChange("ph", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Expected Rain (mm)</label>
                  <input
                    type="number"
                    step="1"
                    id="rainfall-input"
                    value={formData.rainfall}
                    onChange={(e) => handleInputChange("rainfall", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                id="get-recommendation-btn"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Analyzing Agronomic Profiles...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    <span>Calculate Best Crop Match</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Recommendation Error</p>
                <p className="text-xs text-red-700">{error}</p>
              </div>
            </div>
          )}

          {result ? (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-500/60 shadow-lg space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl">
                    🌱
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                      Primary Recommendation
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-950">
                      {result.recommended_crop}
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-gray-500 block">Match Score</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-700">
                    {result.match_score.toFixed(1)}
                    <span className="text-xs font-normal text-gray-500">/100</span>
                  </span>
                </div>
              </div>

              {/* Top Crop Ranked Comparison */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Top Recommended Crop Rankings
                </h4>
                <div className="space-y-2.5">
                  {result.all_recommendations.map((rec, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-gray-700">
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[10px] flex items-center justify-center font-bold">
                            {i + 1}
                          </span>
                          {rec.crop}
                        </span>
                        <span className="font-semibold text-emerald-800">{rec.score.toFixed(1)} pts</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            i === 0 ? "bg-emerald-600" : "bg-emerald-400"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(10, rec.score))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save To Records Action */}
              <div className="pt-4 border-t border-emerald-100 space-y-3 bg-emerald-50/50 p-4 rounded-2xl">
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveToRecords}
                    disabled={savedSuccess || savingRecord}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition-all disabled:bg-emerald-900"
                  >
                    {savedSuccess ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Saved to Records!</span>
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        <span>{savingRecord ? "Saving..." : "Save to Field Logic"}</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500">
                  Recommendations are saved to Field Logic automatically. You can retry here if a save fails.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-dashed border-emerald-200 text-center space-y-4 flex flex-col items-center justify-center min-h-[320px]">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-3xl">
                🌱
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="font-bold text-gray-800 text-base">Awaiting Soil Parameters</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Fill in your nitrogen, phosphorus, potassium, pH, and rainfall metrics on the left, then click <strong>"Calculate Best Crop Match"</strong>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
