import type { ImageSourcePropType } from 'react-native'

// The category rail's bundled photos, by CategoryTile.photo (lib/categories.ts):
// the same files as the website's public/categories. Metro resolves require()
// only from literal paths, so they're listed one by one.
export const CATEGORY_PHOTOS: Record<string, ImageSourcePropType> = {
  restaurants: require('../../assets/categories/restaurants.webp'),
  beach: require('../../assets/categories/beach.webp'),
  attractions: require('../../assets/categories/attractions.webp'),
  fashion: require('../../assets/categories/fashion.webp'),
  sport: require('../../assets/categories/sport.webp'),
  tourism: require('../../assets/categories/tourism.webp'),
  pampering: require('../../assets/categories/pampering.webp'),
  beauty: require('../../assets/categories/beauty.webp'),
  home: require('../../assets/categories/home.webp'),
  kids: require('../../assets/categories/kids.webp'),
  insurance: require('../../assets/categories/insurance.webp'),
  cars: require('../../assets/categories/cars.webp'),
}
