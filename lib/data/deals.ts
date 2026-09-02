import { TranslationKey } from '@/lib/i18n/translations'

export interface Deal {
  img: string
  alt: string
  badge: string
  name: string
  loc: string
}

export interface DealRowData {
  cat: string
  titleKey: TranslationKey
  showNewDot?: boolean
  deals: Deal[]
}

export const dealRows: DealRowData[] = [
  {
    cat: 'new',
    titleKey: 'row_new',
    showNewDot: true,
    deals: [
      { img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80', alt: 'rooftop bar', badge: 'NEW', name: 'Sky Rooftop TLV', loc: 'TLV, Allenby' },
      { img: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80', alt: 'coworking', badge: 'NEW', name: 'Mindspace Coworking', loc: 'TLV, Sarona' },
      { img: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=400&q=80', alt: 'bike rental', badge: 'NEW', name: 'Tel-O-Fun Bike Pass', loc: 'Citywide' },
      { img: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80', alt: 'juice bar', badge: 'NEW', name: 'Cold Press Juice Bar', loc: 'TLV, Basel' },
      { img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80', alt: 'climbing gym', badge: 'NEW', name: 'Boulder Climbing Gym', loc: 'TLV, Kiryat Atidim' },
      { img: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&q=80', alt: 'wine bar', badge: 'NEW', name: 'Vino TLV Wine Bar', loc: 'TLV, Neve Tzedek' },
    ],
  },
  {
    cat: 'bestsellers',
    titleKey: 'row_bestsellers',
    deals: [
      { img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80', alt: 'gym', badge: '30% OFF', name: 'Holmes Place', loc: 'Multiple locations' },
      { img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80', alt: 'restaurant', badge: '20% OFF', name: 'Pasta Nostra', loc: 'TLV, Rothschild' },
      { img: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=80', alt: 'store', badge: '20% OFF', name: 'Fox Fashion', loc: 'All branches' },
      { img: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&q=80', alt: 'volleyball', badge: '30% OFF', name: 'Beach Volleyball TLV', loc: 'Gordon Beach' },
      { img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80', alt: 'boutique hotel', badge: '20% OFF', name: 'Boutique TLV Hotels', loc: 'Tel Aviv City Center' },
      { img: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80', alt: 'cosmetics', badge: '20% OFF', name: 'Top Cosmetics Chains', loc: 'All branches' },
    ],
  },
  {
    cat: 'beach',
    titleKey: 'row_beach',
    deals: [
      { img: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&q=80', alt: 'volleyball', badge: '30% OFF', name: 'Beach Volleyball TLV', loc: 'Gordon Beach' },
      { img: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=400&q=80', alt: 'surf', badge: '20% OFF', name: 'Surf Club Israel', loc: 'Hilton Beach' },
      { img: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&q=80', alt: 'diving', badge: '15% OFF', name: 'Diving Eilat', loc: 'Red Sea' },
      { img: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400&q=80', alt: 'padel', badge: 'First Session Free', name: 'Padel Beach Club', loc: 'Herzliya Marina' },
      { img: 'https://images.unsplash.com/photo-1472745942893-4b9f730c7668?w=400&q=80', alt: 'kayak', badge: '20% OFF', name: 'Kayak and SUP', loc: 'Netanya Beach' },
      { img: 'https://images.unsplash.com/photo-1530053969600-caed2596d242?w=400&q=80', alt: 'footvolley', badge: '25% OFF', name: 'Footvolley League', loc: 'TLV South Beach' },
    ],
  },
  {
    cat: 'tourism',
    titleKey: 'row_tourism',
    deals: [
      { img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&q=80', alt: 'boutique hotel', badge: '20% OFF', name: 'Boutique TLV Hotels', loc: 'Tel Aviv City Center' },
      { img: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400&q=80', alt: 'hostel', badge: '15% OFF', name: 'Heritage Hostels', loc: 'Jerusalem Old City' },
      { img: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', alt: 'desert glamping', badge: 'Free Breakfast', name: 'Desert Glamping', loc: 'Negev, Mitzpe Ramon' },
      { img: 'https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=400&q=80', alt: 'eilat', badge: '10% OFF', name: 'Eilat Boutique Resort', loc: 'Eilat, Red Sea' },
    ],
  },
  {
    cat: 'bundles',
    titleKey: 'row_bundles',
    deals: [
      { img: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&q=80', alt: 'beer bundle', badge: '25% OFF', name: 'Beer & Breezer Bundle', loc: 'TLV pickup, valid ID required' },
      { img: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400&q=80', alt: 'wine bundle', badge: '20% OFF', name: 'Wine Selection Pack', loc: 'TLV pickup, valid ID required' },
      { img: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80', alt: 'household', badge: '15% OFF', name: 'Household Essentials Pack', loc: 'Wipes and eco cleaning' },
      { img: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&q=80', alt: 'soft drinks', badge: 'Buy 2 Get 1', name: 'Soft Drink Pack', loc: 'Home delivery' },
      { img: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&q=80', alt: 'cookies', badge: '20% OFF', name: 'Gourmet Cookie Box', loc: 'Home delivery' },
    ],
  },
  {
    cat: 'beauty',
    titleKey: 'row_beauty',
    deals: [
      { img: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80', alt: 'cosmetics', badge: '20% OFF', name: 'Top Cosmetics Chains', loc: 'All branches' },
      { img: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&q=80', alt: 'sunscreen', badge: '25% OFF', name: 'Sunscreen & Tanning Oil Bundle', loc: 'Perfect for beach days' },
      { img: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80', alt: 'spa', badge: '30% OFF', name: 'Spa & Beauty Salon', loc: 'Tel Aviv' },
      { img: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&q=80', alt: 'pilates', badge: 'First Class Free', name: 'Pilates & Beauty Studio', loc: 'Tel Aviv' },
      { img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80', alt: 'skincare', badge: '15% OFF', name: 'Skincare Routine Set', loc: 'Online and stores' },
    ],
  },
  {
    cat: 'restaurants',
    titleKey: 'row_restaurants',
    deals: [
      { img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80', alt: 'restaurant', badge: '20% OFF', name: 'Pasta Nostra', loc: 'TLV, Rothschild' },
      { img: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80', alt: 'salad', badge: '15% OFF', name: 'Green Garden', loc: 'TLV, Florentin' },
      { img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80', alt: 'cafe', badge: 'Buy 1 Get 1', name: 'Cafefix', loc: 'Jerusalem, Mamilla' },
      { img: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&q=80', alt: 'sushi', badge: '25% OFF', name: 'Sushi Bar TLV', loc: 'TLV, Dizengoff' },
      { img: 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=400&q=80', alt: 'brunch', badge: 'Free Coffee', name: 'Brunch and Co.', loc: 'TLV, Neve Tzedek' },
      { img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80', alt: 'benedict', badge: '10% OFF', name: 'Benedict', loc: 'All branches' },
    ],
  },
  {
    cat: 'fashion',
    titleKey: 'row_fashion',
    deals: [
      { img: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=80', alt: 'store', badge: '20% OFF', name: 'Fox Fashion', loc: 'All branches' },
      { img: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&q=80', alt: 'fashion', badge: '15% OFF', name: 'Terminal X', loc: 'Online and stores' },
      { img: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=400&q=80', alt: 'clothing', badge: '10% OFF', name: 'Castro', loc: 'All branches' },
      { img: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&q=80', alt: 'renuar', badge: '25% OFF', name: 'Renuar', loc: 'Online and stores' },
      { img: 'https://images.unsplash.com/photo-1556306535-0f09a537f0a3?w=400&q=80', alt: 'accessories', badge: 'Free Shipping', name: 'Kfar HaShmanim', loc: 'Online' },
    ],
  },
  {
    cat: 'sport',
    titleKey: 'row_sport',
    deals: [
      { img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80', alt: 'gym', badge: '30% OFF', name: 'Holmes Place', loc: 'Multiple locations' },
      { img: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&q=80', alt: 'yoga', badge: 'First Class Free', name: 'TLV Yoga Studio', loc: 'Tel Aviv' },
      { img: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=80', alt: 'pilates', badge: '20% OFF', name: 'Studio Pilates IL', loc: 'TLV and Raanana' },
      { img: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=400&q=80', alt: 'boxing', badge: '2 Weeks Free', name: 'Boxing IL', loc: 'TLV, Jerusalem' },
      { img: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=400&q=80', alt: 'spin', badge: '25% OFF', name: 'Spin City TLV', loc: 'Tel Aviv North' },
      { img: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&q=80', alt: 'running', badge: '15% OFF', name: 'Run Tel Aviv Club', loc: 'Park HaYarkon' },
    ],
  },
  {
    cat: 'attractions',
    titleKey: 'row_attractions',
    deals: [
      { img: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&q=80', alt: 'bar', badge: '20% OFF', name: 'TLV Pub Crawl', loc: 'Florentin' },
      { img: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&q=80', alt: 'museum', badge: '25% OFF', name: 'Tel Aviv Museum', loc: 'Shaul HaMelech' },
      { img: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&q=80', alt: 'jaffa', badge: 'Free Entry', name: 'Old Jaffa Tour', loc: 'Jaffa' },
      { img: 'https://images.unsplash.com/photo-1507924538820-ede94a04019d?w=400&q=80', alt: 'theater', badge: '30% OFF', name: 'Habima Theater', loc: 'TLV Center' },
      { img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80', alt: 'food tour', badge: '15% OFF', name: 'Food Tour Carmel', loc: 'Carmel Market' },
    ],
  },
]

export const categoryFilters: { cat: string; labelKey: TranslationKey }[] = [
  { cat: 'all', labelKey: 'cat_all' },
  { cat: 'new', labelKey: 'cat_new' },
  { cat: 'bestsellers', labelKey: 'cat_bestsellers' },
  { cat: 'beach', labelKey: 'cat_beach' },
  { cat: 'tourism', labelKey: 'cat_tourism' },
  { cat: 'bundles', labelKey: 'cat_bundles' },
  { cat: 'beauty', labelKey: 'cat_beauty' },
  { cat: 'restaurants', labelKey: 'cat_restaurants' },
  { cat: 'fashion', labelKey: 'cat_fashion' },
  { cat: 'sport', labelKey: 'cat_sport' },
  { cat: 'attractions', labelKey: 'cat_attractions' },
]
