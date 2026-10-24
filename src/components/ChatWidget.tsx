import React, { useState, useRef, useEffect } from "react";
import { MessageSquareText, X, Send, User, Check, ExternalLink, BookOpen } from "lucide-react";
import { ChatMessage } from "../types";

interface ChatWidgetProps {
  onNavigateToRecords?: () => void;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ onNavigateToRecords }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Namaste! 🙏 I provide preset, keyword-based farming guidance about crop recommendations, fertilizer schedules (NPK), common plant conditions, and irrigation planning. Replies are general information, not expert diagnosis.\n\nEvery consultation is automatically saved to your Field Records.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoSavedNotice, setAutoSavedNotice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    "🌾 Which crop fits black soil?",
    "🍂 How to cure leaf rust?",
    "🌱 Best NPK ratio for wheat?",
    "💧 When to irrigate before rain?",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || input;
    if (!messageText.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: messageText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.text,
          history: messages.slice(-4),
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        text: data.reply || "For optimal results, please check your local soil pH and humidity conditions.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
      setAutoSavedNotice(true);
      setTimeout(() => setAutoSavedNotice(false), 4000);
    } catch (err) {
      console.error("Chat error:", err);
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        text: "I can provide general preset guidance. Use Crop Recommendations to compare soil inputs, or the Disease Reference Guide to read educational examples. Uploaded leaves are not diagnosed.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      {/* Toggle Button */}
      {!isOpen && (
        <button
          id="open-chat-btn"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-xl hover:shadow-emerald-900/30 transition-all hover:scale-105 border border-emerald-500/50"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-800 flex items-center justify-center text-xs">
            💬
          </div>
          <span>Farmer Help Chat</span>
          <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-80 sm:w-96 h-[520px] bg-white rounded-3xl shadow-2xl border border-emerald-200/80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Top Bar */}
          <div className="bg-emerald-800 text-white px-4 py-3 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-700 flex items-center justify-center text-base">
                🌿
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight">AgroSense Assistant</h4>
                <p className="text-[11px] text-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  Auto-syncing to Field Records
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {onNavigateToRecords && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onNavigateToRecords();
                  }}
                  title="View Field Records"
                  className="text-emerald-200 hover:text-white px-2 py-1 rounded-lg hover:bg-emerald-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Records</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Auto-Save Notice Banner */}
          {autoSavedNotice && (
            <div className="bg-emerald-50 text-emerald-900 text-[11px] px-3.5 py-1.5 flex items-center justify-between border-b border-emerald-200 font-medium animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>Auto-saved advice to Field Records!</span>
              </div>
              {onNavigateToRecords && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onNavigateToRecords();
                  }}
                  className="text-emerald-800 underline font-bold hover:text-emerald-950 text-[10px]"
                >
                  View
                </button>
              )}
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-gray-50/70 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 items-start ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5 ${
                    msg.sender === "user" ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-900 font-bold"
                  }`}
                >
                  {msg.sender === "user" ? <User className="w-3 h-3" /> : "🌿"}
                </div>

                <div
                  className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-emerald-700 text-white rounded-tr-none"
                      : "bg-white text-gray-800 border border-emerald-100 rounded-tl-none space-y-1.5"
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                  
                  {/* Footer on bot messages: Automatic Save Indicator */}
                  {msg.sender === "bot" && (
                    <div className="pt-1.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                      {msg.id !== "welcome" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                          <Check className="w-3 h-3" /> Auto-saved to Records
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-800/80 font-medium">Local Keyword Guidance</span>
                      )}
                      <span className="text-gray-400 text-[9px]">{msg.timestamp}</span>
                    </div>
                  )}

                  {msg.sender === "user" && (
                    <span className="text-[9px] block text-right mt-1 text-emerald-200">
                      {msg.timestamp}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 items-center text-gray-500 bg-white p-2.5 rounded-2xl border border-gray-100 w-fit">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
                <span className="text-[11px] text-gray-500 pl-1">Consulting agricultural data...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 flex gap-1.5 overflow-x-auto">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/60 rounded-lg text-[10px] whitespace-nowrap transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-white border-t border-gray-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about crops, disease, soil..."
              className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-40 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
