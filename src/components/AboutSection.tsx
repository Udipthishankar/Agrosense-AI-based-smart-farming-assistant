import React, { useState } from "react";
import { MessageSquareText, Send, CheckCircle2, HelpCircle } from "lucide-react";
import { saveFieldActivity } from "../services/fieldLogService";

export const AboutSection: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setSaving(true);
    setError(null);
    try {
      await saveFieldActivity({
        activity: "About & support message",
        location: "AgroSense Support",
        crop: "Farmer feedback",
        details: {
          source: "About",
          notes: `Submitted by ${name.trim()}`,
          question: message.trim(),
          contact_email: email.trim(),
        },
      });
      setSubmitted(true);
      setTimeout(() => {
        setName("");
        setEmail("");
        setMessage("");
      }, 1000);
    } catch (err: unknown) {
      console.error("Failed to save support message to Field Logic:", err);
      const saveMessage = err instanceof Error ? err.message : "Unknown save error";
      setError(`Your message could not be saved to Field Logic: ${saveMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const faqs = [
    {
      q: "How does AgroSense calculate crop recommendations?",
      a: "AgroSense uses multi-parameter agronomic matching based on soil macronutrients (Nitrogen, Phosphorus, Potassium), soil pH, ambient temperature, humidity, and expected rainfall against scientific crop growth bands for 10+ core crops.",
    },
    {
      q: "How accurate is the leaf disease detection tool?",
      a: "This version does not classify uploaded images. The built-in scenarios are educational references only; for a real diagnosis, consult a qualified agricultural specialist.",
    },
    {
      q: "Can I use AgroSense for different soil types?",
      a: "Yes! Whether you farm in heavy black cotton soil, alluvial river plains, sandy loam, or red soil, you can enter your exact soil health card metrics or choose quick regional presets.",
    },
    {
      q: "What future features are coming to AgroSense?",
      a: "Future updates will include regional Indian language voice synthesis, satellite vegetation index (NDVI) mapping, and automated smart drip irrigation valve integrations.",
    },
  ];

  return (
    <div className="space-y-12 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
          <MessageSquareText className="w-3.5 h-3.5" />
          Mission & Technology
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-emerald-950">About AgroSense</h2>
        <p className="text-gray-600 text-sm max-w-xl mx-auto">
          Practical crop suitability calculations, weather information, educational disease references, and activity tracking for growers.
        </p>
      </div>

      {/* Mission & Architecture */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-100 shadow-sm space-y-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl font-bold">
            🌱
          </div>
          <h3 className="text-xl font-bold text-emerald-950">Our Mission</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            AgroSense brings common farming reference information and simple soil-based crop matching into one place. Its crop recommendations use deterministic suitability ranges, weather comes from public forecast services or a regional fallback, and its chat replies use local keyword rules. Disease examples are educational and do not diagnose uploaded images.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-100 shadow-sm space-y-4">
          <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center text-xl font-bold">
            ⚡
          </div>
          <h3 className="text-xl font-bold text-emerald-950">Core Capabilities</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Multi-variable crop suitability matching algorithms</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Educational reference information for common plant conditions</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Localized meteorological tracking & spray scheduling</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Persistent activity records & local keyword-based farming guidance</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="bg-emerald-50/60 rounded-3xl p-6 sm:p-8 border border-emerald-200/80 space-y-6">
        <div className="flex items-center gap-2 text-emerald-950 font-bold text-lg">
          <HelpCircle className="w-5 h-5 text-emerald-700" />
          <span>Frequently Asked Questions</span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-100 space-y-2">
              <h4 className="font-bold text-gray-900 text-sm">{faq.q}</h4>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Form */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-100 shadow-sm space-y-6">
        <div className="space-y-1">
          <h3 className="font-bold text-lg text-emerald-950">Farmer Support & Feedback</h3>
          <p className="text-xs text-gray-500">
            Have questions about field diagnostics or suggestions for AgroSense? Send us a message below.
          </p>
        </div>

        {submitted ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-2 text-emerald-900">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-base">Message Saved to Field Logic!</h4>
            <p className="text-xs text-emerald-700">
              Thank you. Your feedback is stored in the field activity log for reference.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. farmer@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Message / Question</label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can AgroSense assist your farming operations?"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-sm transition-all disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{saving ? "Saving..." : "Save Message to Field Logic"}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
