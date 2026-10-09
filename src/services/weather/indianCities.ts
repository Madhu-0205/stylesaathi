import { WeatherLocation } from '../../types';

export type IndianClimateZone =
  | 'coastal_humid'
  | 'deccan_moderate'
  | 'subtropical_extreme'
  | 'tropical_humid'
  | 'hot_semiarid'
  | 'temperate_valley';

export interface IndianCityProfile extends WeatherLocation {
  climateZone: IndianClimateZone;
  description: string;
}

export const INDIAN_CITIES: IndianCityProfile[] = [
  {
    city: 'Bengaluru',
    region: 'Karnataka',
    country: 'India',
    latitude: 12.97,
    longitude: 77.59,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'deccan_moderate',
    description: 'Elevated Deccan plateau with moderate temperatures year-round and breezy evenings.',
  },
  {
    city: 'Mumbai',
    region: 'Maharashtra',
    country: 'India',
    latitude: 19.07,
    longitude: 72.87,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'coastal_humid',
    description: 'Coastal maritime climate with intense summer humidity and torrential monsoon showers.',
  },
  {
    city: 'Delhi NCR',
    region: 'Delhi',
    country: 'India',
    latitude: 28.61,
    longitude: 77.23,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'subtropical_extreme',
    description: 'Continental extremes with dry blistering summers and chilly winter mornings.',
  },
  {
    city: 'Kolkata',
    region: 'West Bengal',
    country: 'India',
    latitude: 22.57,
    longitude: 88.36,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'tropical_humid',
    description: 'Tropical wet climate with high year-round humidity and heavy monsoon spells.',
  },
  {
    city: 'Chennai',
    region: 'Tamil Nadu',
    country: 'India',
    latitude: 13.08,
    longitude: 80.27,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'coastal_humid',
    description: 'Coromandel coastal warmth with persistent high humidity and retreating northeast monsoon.',
  },
  {
    city: 'Hyderabad',
    region: 'Telangana',
    country: 'India',
    latitude: 17.38,
    longitude: 78.48,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'deccan_moderate',
    description: 'Semi-arid Deccan climate with dry warm summers and pleasant mild winters.',
  },
  {
    city: 'Pune',
    region: 'Maharashtra',
    country: 'India',
    latitude: 18.52,
    longitude: 73.85,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'deccan_moderate',
    description: 'Western Ghats plateau with breezy pleasant weather and brisk cool winters.',
  },
  {
    city: 'Ahmedabad',
    region: 'Gujarat',
    country: 'India',
    latitude: 23.02,
    longitude: 72.57,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'hot_semiarid',
    description: 'Hot semi-arid climate with intense dry sunshine and crisp pleasant winters.',
  },
  {
    city: 'Jaipur',
    region: 'Rajasthan',
    country: 'India',
    latitude: 26.91,
    longitude: 75.78,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'subtropical_extreme',
    description: 'Desert margin climate with dry sunny heat and sharp diurnal winter drops.',
  },
  {
    city: 'Lucknow',
    region: 'Uttar Pradesh',
    country: 'India',
    latitude: 26.84,
    longitude: 80.94,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'subtropical_extreme',
    description: 'Gangetic plains climate with hot pre-monsoon summers and foggy cool winters.',
  },
  {
    city: 'Kochi',
    region: 'Kerala',
    country: 'India',
    latitude: 9.93,
    longitude: 76.26,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'coastal_humid',
    description: 'Malabar coast tropical climate with heavy monsoon rainfall and constant coastal warmth.',
  },
  {
    city: 'Chandigarh',
    region: 'Punjab',
    country: 'India',
    latitude: 30.73,
    longitude: 76.77,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'subtropical_extreme',
    description: 'Sub-Himalayan plains with clear seasons, humid monsoon, and crisp winters.',
  },
  {
    city: 'Goa',
    region: 'Goa',
    country: 'India',
    latitude: 15.29,
    longitude: 73.98,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'coastal_humid',
    description: 'Konkan coast with tropical humidity, balmy sea breezes, and lush monsoon rains.',
  },
  {
    city: 'Guwahati',
    region: 'Assam',
    country: 'India',
    latitude: 26.14,
    longitude: 91.73,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'tropical_humid',
    description: 'Brahmaputra valley with high atmospheric moisture and extended rainy seasons.',
  },
  {
    city: 'Srinagar',
    region: 'Jammu & Kashmir',
    country: 'India',
    latitude: 34.08,
    longitude: 74.79,
    timezone: 'Asia/Kolkata',
    source: 'manual',
    climateZone: 'temperate_valley',
    description: 'Himalayan valley climate with cool alpine summers, crisp autumn, and cold winters.',
  },
];

export const DEFAULT_INDIAN_LOCATION: WeatherLocation = {
  city: 'Bengaluru',
  region: 'Karnataka',
  country: 'India',
  latitude: 12.97,
  longitude: 77.59,
  timezone: 'Asia/Kolkata',
  source: 'manual',
};

/**
 * Privacy-preserving snap: Finds closest major Indian city by coordinates.
 * Prevents persisting or broadcasting raw household GPS coordinates.
 */
export function findClosestIndianCity(latitude: number, longitude: number): IndianCityProfile {
  let closest = INDIAN_CITIES[0];
  let minDistance = Number.POSITIVE_INFINITY;

  for (const city of INDIAN_CITIES) {
    if (city.latitude !== undefined && city.longitude !== undefined) {
      // Equirectangular approximation is lightweight and sufficient for city snapping
      const dLat = (city.latitude - latitude) * (Math.PI / 180);
      const dLon = (city.longitude - longitude) * (Math.PI / 180);
      const meanLat = ((city.latitude + latitude) / 2) * (Math.PI / 180);
      const x = dLon * Math.cos(meanLat);
      const y = dLat;
      const dist = Math.sqrt(x * x + y * y);

      if (dist < minDistance) {
        minDistance = dist;
        closest = city;
      }
    }
  }

  return closest;
}
