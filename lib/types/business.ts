// Schema for a business/deal listing. No real data exists yet — onboarding
// is manual and none of these fields are populated anywhere in the app.
export interface Business {
  id: string
  name: string
  category: string
  description: string
  /** Not every onboarded business will have coordinates from day one. */
  location?: { lat: number; lng: number }
}
