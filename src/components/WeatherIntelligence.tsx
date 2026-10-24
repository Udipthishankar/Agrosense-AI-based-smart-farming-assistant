import React, { useState, useEffect } from "react";
import { CloudSun, Droplets, Wind, Gauge, Search, AlertCircle, Compass, CloudRain } from "lucide-react";
import { WeatherData } from "../types";
import { fetchWeather } from "../services/weatherService";
import { saveFieldActivity } from "../services/fieldLogService";

export const WeatherIntelligence: React.FC = () => {
  const [city, setCity] = useState("Bengaluru");
  const [searchInput, setSearchInput] = useState("Bengaluru");
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quickCities = [
    "Bengaluru",
    "Pune",
    "Punjab",
    "Delhi",
    "Hyderabad",
    "Mumbai",
    "Nagpur",
    "Chennai",
    "Jaipur",
  ];

  const fetchWeatherForLocation = async (loc: string, logActivity = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeather(loc);
      setWeather(data);
      setCity(data.location || loc);
      if (logActivity) {
        try {
          await saveFieldActivity({
            activity: "Weather lookup",
            location: data.location || loc,
            crop: "Weather advisory",
            details: {
              source: "Weather",
              temperature: data.temperature,
              humidity: data.humidity,
              rainfall_chance: data.rainfall_chance,
              wind_speed: data.wind_speed,
              pressure: data.pressure,
              notes: `${data.description}; feels like ${data.feels_like}°C.`,
              advice: data.advisory,
            },
          });
        } catch (saveErr: unknown) {
          console.error("Failed to save weather lookup to Field Logic:", saveErr);
          const message = saveErr instanceof Error ? saveErr.message : "Unknown save error";
          setError(`Weather loaded, but it could not be saved to Field Logic: ${message}`);
        }
      }
    } catch (err: unknown) {
      console.error("Weather fetch error:", err);
      const message = err instanceof Error ? err.message : "Error fetching weather data";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherForLocation("Bengaluru");
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    fetchWeatherForLocation(searchInput.trim(), true);
  };

  const handleCityClick = (c: string) => {
    setSearchInput(c);
    fetchWeatherForLocation(c, true);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <CloudSun className="w-3.5 h-3.5" />
          Agricultural Micro-Climate Forecast
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-emerald-950">
          Localized Weather & Field Advisory
        </h2>
        <p className="text-gray-600 text-sm max-w-xl mx-auto">
          Hyper-local climate monitoring paired with actionable agricultural guidelines for irrigation scheduling, fertilizer broadcasting, and pesticide spraying.
        </p>
      </div>

      {/* Search & Quick Cities */}
      <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="weather-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search region / district / city (e.g. Pune, Ludhiana, Nashik)..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <button
            type="submit"
            id="weather-search-btn"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <span>Search</span>}
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-xs font-semibold text-gray-400">Popular Farming Regions:</span>
          {quickCities.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleCityClick(c)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                city.toLowerCase() === c.toLowerCase()
                  ? "bg-emerald-700 text-white"
                  : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200/60"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">{weather ? "Field Logic Save Notice" : "Weather Service Notice"}</p>
            <p className="text-xs text-red-700">{error}</p>
          </div>
        </div>
      )}

      {weather && (
        <div className="space-y-6">
          {/* Main Weather Hero Card */}
          <div className="bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-600/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold">
                <Compass className="w-4 h-4" />
                <span>Current Regional Climate</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold">{weather.location}</h3>
              <p className="text-emerald-100 text-sm">{weather.description} • Feels like {weather.feels_like}°C</p>
            </div>

            <div className="flex items-baseline gap-2 bg-emerald-900/60 px-6 py-4 rounded-2xl border border-emerald-500/40 backdrop-blur-sm">
              <span className="text-4xl sm:text-5xl font-black">{weather.temperature}</span>
              <span className="text-2xl font-light text-emerald-300">°C</span>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-gray-500">
                <span className="text-xs font-semibold">Humidity</span>
                <Droplets className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{weather.humidity}%</div>
              <p className="text-[11px] text-gray-400">Atmospheric moisture</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-gray-500">
                <span className="text-xs font-semibold">Rain Probability</span>
                <CloudRain className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{weather.rainfall_chance}%</div>
              <p className="text-[11px] text-gray-400">Precipitation likelihood</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-gray-500">
                <span className="text-xs font-semibold">Wind Speed</span>
                <Wind className="w-4 h-4 text-teal-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{weather.wind_speed} <span className="text-xs font-normal text-gray-500">m/s</span></div>
              <p className="text-[11px] text-gray-400">Surface wind velocity</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-gray-500">
                <span className="text-xs font-semibold">Pressure</span>
                <Gauge className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{weather.pressure} <span className="text-xs font-normal text-gray-500">hPa</span></div>
              <p className="text-[11px] text-gray-400">Barometric status</p>
            </div>
          </div>

          {/* Actionable Agricultural Advisory Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border-2 border-emerald-500/50 shadow-md space-y-4">
            <div className="flex items-center gap-2 text-emerald-950 font-bold text-lg border-b border-emerald-100 pb-3">
              <span className="text-2xl">🚜</span>
              <span>Agronomic Field Action Guidelines for {weather.location}</span>
            </div>

            <div className="bg-emerald-50/80 rounded-2xl p-5 border border-emerald-200 text-emerald-950 text-sm leading-relaxed font-medium space-y-2">
              <p>{weather.advisory}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                <span className="font-bold text-gray-800 block">💧 Irrigation Window</span>
                <p className="text-gray-600">
                  {weather.rainfall_chance > 50
                    ? "Postpone watering; natural rainfall expected."
                    : "Safe for regular drip/furrow irrigation."}
                </p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                <span className="font-bold text-gray-800 block">🌿 Spraying Window</span>
                <p className="text-gray-600">
                  {weather.wind_speed > 10 || weather.rainfall_chance > 40
                    ? "Not recommended (high drift/wash-off risk)."
                    : "Excellent conditions for foliar nutrient sprays."}
                </p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
                <span className="font-bold text-gray-800 block">🌾 Harvesting Readiness</span>
                <p className="text-gray-600">
                  {weather.humidity < 65 && weather.rainfall_chance < 25
                    ? "Ideal dry conditions for harvesting and grain threshing."
                    : "Ensure covered storage after cutting."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
