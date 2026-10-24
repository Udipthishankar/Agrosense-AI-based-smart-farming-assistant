import React, { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { HomeOverview } from "./components/HomeOverview";
import { CropRecommendations } from "./components/CropRecommendations";
import { DiseaseDetection } from "./components/DiseaseDetection";
import { WeatherIntelligence } from "./components/WeatherIntelligence";
import { FarmerRecords } from "./components/FarmerRecords";
import { AboutSection } from "./components/AboutSection";
import { ChatWidget } from "./components/ChatWidget";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("home");
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(false);
  const [activePopup, setActivePopup] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          setIsBackendHealthy(true);
        }
      } catch {
        setIsBackendHealthy(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const toggleFooterPopup = (popupId: string) => {
    setActivePopup((prev) => (prev === popupId ? null : popupId));
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans selection:bg-emerald-200 selection:text-emerald-950">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isBackendHealthy={isBackendHealthy}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {activeTab === "home" && <HomeOverview setActiveTab={setActiveTab} />}
        {activeTab === "crop" && <CropRecommendations />}
        {activeTab === "disease" && <DiseaseDetection />}
        {activeTab === "weather" && <WeatherIntelligence />}
        {activeTab === "records" && <FarmerRecords />}
        {activeTab === "about" && <AboutSection />}
      </main>

      {/* Persistent Floating Chatbot */}
      <ChatWidget onNavigateToRecords={() => setActiveTab("records")} />

      {/* Footer */}
      <footer className="bg-emerald-950 text-emerald-100/80 mt-auto border-t border-emerald-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Col 1: About */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-lg">
                <span>🌾</span>
                <span>AgroSense</span>
              </div>
              <p className="text-xs text-emerald-300/80 leading-relaxed">
                Farming reference tools for soil-based crop matching, weather information, educational plant-condition examples, and activity records.
              </p>
              <div className="pt-1 flex gap-3 text-xs text-emerald-400">
                <a
                  href="/crop.html"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-200 underline"
                >
                  Classic Web View
                </a>
              </div>
            </div>

            {/* Col 2: Quick Links */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-emerald-200 border-b border-emerald-800 pb-1.5">
                Quick Navigation
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button onClick={() => setActiveTab("home")} className="hover:text-white transition-colors">
                    › Overview & Workflow
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab("crop")} className="hover:text-white transition-colors">
                    › Crop Recommendation Engine
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab("disease")} className="hover:text-white transition-colors">
                    › Disease Reference Guide
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab("weather")} className="hover:text-white transition-colors">
                    › Agricultural Weather
                  </button>
                </li>
                <li>
                  <button onClick={() => setActiveTab("records")} className="hover:text-white transition-colors">
                    › Field Logic Activity Log
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Helpful Resources (Interactive Accordions) */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-emerald-200 border-b border-emerald-800 pb-1.5">
                Helpful Resources
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => toggleFooterPopup("popup-faqs")}
                    className="hover:text-white text-left block w-full transition-colors"
                  >
                    › Soil & Disease FAQs
                  </button>
                  {activePopup === "popup-faqs" && (
                    <div className="mt-1.5 p-3 rounded-xl bg-emerald-900/90 border border-emerald-700 text-[11px] text-emerald-100">
                      Learn how soil N-P-K ranges match specific crop profiles and how to test moisture before irrigation.
                    </div>
                  )}
                </li>

                <li>
                  <button
                    onClick={() => toggleFooterPopup("popup-guides")}
                    className="hover:text-white text-left block w-full transition-colors"
                  >
                    › User Field Manual
                  </button>
                  {activePopup === "popup-guides" && (
                    <div className="mt-1.5 p-3 rounded-xl bg-emerald-900/90 border border-emerald-700 text-[11px] text-emerald-100">
                      Snap clear photos in indirect sunlight and test topsoil 15cm deep for accurate nutrient values.
                    </div>
                  )}
                </li>

                <li>
                  <button
                    onClick={() => toggleFooterPopup("popup-support")}
                    className="hover:text-white text-left block w-full transition-colors"
                  >
                    › 24/7 Advisory Desk
                  </button>
                  {activePopup === "popup-support" && (
                    <div className="mt-1.5 p-3 rounded-xl bg-emerald-900/90 border border-emerald-700 text-[11px] text-emerald-100">
                      Click the bottom-right chat bubble for general preset guidance on fertilizers or pests.
                    </div>
                  )}
                </li>
              </ul>
            </div>

            {/* Col 4: Farming Scope & Terms */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-emerald-200 border-b border-emerald-800 pb-1.5">
                Information & Privacy
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => toggleFooterPopup("popup-terms")}
                    className="hover:text-white text-left block w-full transition-colors"
                  >
                    › Terms of Advisory
                  </button>
                  {activePopup === "popup-terms" && (
                    <div className="mt-1.5 p-3 rounded-xl bg-emerald-900/90 border border-emerald-700 text-[11px] text-emerald-100">
                      AgroSense recommendations are provided as scientific decision-support tools for farmers based on input metrics.
                    </div>
                  )}
                </li>

                <li>
                  <button
                    onClick={() => toggleFooterPopup("popup-future")}
                    className="hover:text-white text-left block w-full transition-colors"
                  >
                    › Future Capabilities
                  </button>
                  {activePopup === "popup-future" && (
                    <div className="mt-1.5 p-3 rounded-xl bg-emerald-900/90 border border-emerald-700 text-[11px] text-emerald-100">
                      Planned updates include drone imagery multispectral indexing, regional voice languages, and IoT valve hooks.
                    </div>
                  )}
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-emerald-900/60 flex flex-col sm:flex-row items-center justify-between text-xs text-emerald-400/80 gap-3">
            <p>© 2026 AgroSense. Practical tools for modern agriculture.</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Farming Advisory Services Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
