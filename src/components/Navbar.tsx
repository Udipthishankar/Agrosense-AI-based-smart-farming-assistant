import React from "react";
import { Sprout, ShieldAlert, CloudSun, BookOpen, MessageSquareText, Home } from "lucide-react";

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isBackendHealthy: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, isBackendHealthy }) => {
  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "crop", label: "Crop Recommendations", icon: Sprout },
    { id: "disease", label: "Disease References", icon: ShieldAlert },
    { id: "weather", label: "Weather", icon: CloudSun },
    { id: "records", label: "Field Logic", icon: BookOpen },
    { id: "about", label: "About", icon: MessageSquareText },
  ];

  return (
    <header className="bg-emerald-900 text-white sticky top-0 z-50 shadow-md border-b border-emerald-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setActiveTab("home")}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-700/80 border border-emerald-500/40 flex items-center justify-center text-xl shadow-inner group-hover:scale-105 transition-transform">
              🌾
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-wide text-white font-sans">AgroSense</span>
                <span className="text-[11px] font-semibold bg-emerald-600/60 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Field Tools
                </span>
              </div>
              <p className="text-xs text-emerald-300 hidden sm:block">Smart Farming & Crop Advisory</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-btn-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-emerald-800 text-white shadow-sm border border-emerald-600/50"
                      : "text-emerald-100 hover:bg-emerald-800/60 hover:text-white"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-emerald-300"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Status Badge */}
          <div className="flex items-center gap-2 sm:gap-3">

            <div className="flex items-center gap-2 bg-emerald-950/60 px-3 py-1.5 rounded-full border border-emerald-700/50 text-xs">
              <span className={`w-2 h-2 rounded-full ${isBackendHealthy ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span className="text-emerald-200 font-medium hidden sm:inline">
                {isBackendHealthy ? "API Active" : "Connecting..."}
              </span>
            </div>

            {/* Quick Standalone HTML Links Menu */}
            <div className="hidden lg:flex items-center gap-1 border-l border-emerald-700/60 pl-3">
              <a
                href="/crop.html"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-300 hover:text-white underline underline-offset-2 px-1"
                title="Open standalone original Crop page"
              >
                Classic HTML
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Scrollbar */}
      <div className="md:hidden flex overflow-x-auto px-4 py-2 gap-1 border-t border-emerald-800/80 bg-emerald-950/40">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                isActive ? "bg-emerald-800 text-white font-semibold" : "text-emerald-200 hover:bg-emerald-800/40"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
