// Categories offered on the /business partner application. Shared by the form
// and /api/business/inquiry, which only accepts values from this list.
export const BUSINESS_CATEGORIES = [
  'Restaurants and Cafes',
  'Beach and Sea',
  'Attractions and Tours',
  'Fashion and Shopping',
  'Sport and Fitness',
  'Israel and Global Tourism',
  'Pampering Bundles',
  'Beauty and Skincare',
  'Home and Furnishing',
  'Kids and Baby',
  'Insurance and Savings',
  'Other',
] as const
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]
