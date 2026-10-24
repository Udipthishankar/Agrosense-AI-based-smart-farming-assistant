export interface CropRecommendationRequest {
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  temperature: number;
  humidity: number;
  ph: number;
  rainfall: number;
}

export interface CropMatch {
  crop: string;
  score: number;
}

export interface CropRecommendationResponse {
  recommended_crop: string;
  match_score: number;
  all_recommendations: CropMatch[];
  input_params?: CropRecommendationRequest;
}

export interface DiseaseDetectionResult {
  disease: string;
  description: string;
  treatment: string;
  severity: "Low" | "Low to Medium" | "Medium" | "High" | "None";
  sample?: boolean;
  source?: string;
}

export interface WeatherData {
  location: string;
  temperature: number;
  humidity: number;
  rainfall_chance: number;
  wind_speed: number;
  description: string;
  pressure: number;
  feels_like: number;
  advisory: string;
}

export interface FarmerRecord {
  id: number;
  location: string;
  crop: string;
  activity?: string;
  timestamp: string;
  details?: {
    area?: string;
    soil_type?: string;
    irrigation?: string;
    notes?: string;
    source?: "Crop Rules" | "Farmer Chat" | "Manual Entry" | "Disease Diagnosis" | "Disease Reference" | "Weather" | "About";
    question?: string;
    advice?: string;
    contact_email?: string;
    nitrogen?: number;
    phosphorus?: number;
    potassium?: number;
    ph?: number;
    match_score?: number;
    severity?: string;
    temperature?: number;
    humidity?: number;
    rainfall_chance?: number;
    wind_speed?: number;
    pressure?: number;
    [key: string]: unknown;
  };
}

export interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
}
