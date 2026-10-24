import { FarmerRecord } from "../types";

export interface FieldActivity {
  activity: string;
  location: string;
  crop: string;
  details: NonNullable<FarmerRecord["details"]>;
}

export async function saveFieldActivity(activity: FieldActivity): Promise<void> {
  const response = await fetch("/api/records/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(activity),
  });

  if (!response.ok) {
    throw new Error(`Field Logic save failed (${response.status})`);
  }
}
