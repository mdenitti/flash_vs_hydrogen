/**
 * Metadata definition for each world landmark checkpoint placed on the globe.
 */
export interface LandmarkDefinition {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  /** Visual height of the sculpted landmark above ground (world units). */
  height: number;
  /** Recommended fly-over ring altitude offset above ground surface (world units). */
  ringAltitude: number;
  /** Initial compass orientation of the monument on the local tangent plane (degrees). */
  headingDeg: number;
  accentColor: string;
  fact: string;
}

/**
 * 12 iconic global points of interest distributed across every major continent.
 */
export const LANDMARKS: LandmarkDefinition[] = [
  {
    id: 'eiffel',
    name: 'Eiffel Tower',
    city: 'Paris',
    country: 'France',
    lat: 48.8584,
    lon: 2.2945,
    height: 7.2,
    ringAltitude: 7.9,
    headingDeg: 15,
    accentColor: '#ffbf5e',
    fact: 'Iron lattice icon rising over the Champ de Mars since the 1889 World Fair.',
  },
  {
    id: 'bigben',
    name: 'Big Ben & Westminster',
    city: 'London',
    country: 'United Kingdom',
    lat: 51.5007,
    lon: -0.1246,
    height: 6.4,
    ringAltitude: 7.4,
    headingDeg: 90,
    accentColor: '#ffd275',
    fact: 'Neo-Gothic clock tower keeping time beside the River Thames since 1859.',
  },
  {
    id: 'colosseum',
    name: 'The Colosseum',
    city: 'Rome',
    country: 'Italy',
    lat: 41.8902,
    lon: 12.4922,
    height: 4.2,
    ringAltitude: 5.8,
    headingDeg: 35,
    accentColor: '#ffaa55',
    fact: 'The largest ancient travertine amphitheater ever built in the Roman Empire.',
  },
  {
    id: 'giza',
    name: 'Pyramids of Giza & Sphinx',
    city: 'Giza',
    country: 'Egypt',
    lat: 29.9792,
    lon: 31.1342,
    height: 4.6,
    ringAltitude: 6.2,
    headingDeg: 0,
    accentColor: '#ffd966',
    fact: 'The Great Pyramid stood as the tallest human-made structure for over 3,800 years.',
  },
  {
    id: 'burj',
    name: 'Burj Khalifa',
    city: 'Dubai',
    country: 'UAE',
    lat: 25.1972,
    lon: 55.2744,
    height: 8.8,
    ringAltitude: 9.2,
    headingDeg: 45,
    accentColor: '#6be3ff',
    fact: "Spiraling Y-shaped glass spire piercing the sky as Earth's tallest building.",
  },
  {
    id: 'tajmahal',
    name: 'Taj Mahal',
    city: 'Agra',
    country: 'India',
    lat: 27.1751,
    lon: 78.0421,
    height: 5.2,
    ringAltitude: 6.6,
    headingDeg: 180,
    accentColor: '#ffdfb0',
    fact: 'Ivory-white marble mausoleum framed by four minarets and Charbagh gardens.',
  },
  {
    id: 'fuji_tokyo',
    name: 'Mt. Fuji & Tokyo Tower',
    city: 'Tokyo / Honshu',
    country: 'Japan',
    lat: 35.45,
    lon: 139.25,
    height: 6.8,
    ringAltitude: 7.8,
    headingDeg: -20,
    accentColor: '#ff6f61',
    fact: "Japan's snow-crowned volcanic peak paired with Tokyo's red-and-white lattice spire.",
  },
  {
    id: 'sydney',
    name: 'Sydney Opera House',
    city: 'Sydney',
    country: 'Australia',
    lat: -33.8568,
    lon: 151.2153,
    height: 4.4,
    ringAltitude: 6.0,
    headingDeg: 25,
    accentColor: '#8ae8ff',
    fact: 'Interlocking precast concrete sail shells poised on Bennelong Point.',
  },
  {
    id: 'liberty',
    name: 'Statue of Liberty',
    city: 'New York',
    country: 'USA',
    lat: 40.6892,
    lon: -74.0445,
    height: 6.8,
    ringAltitude: 7.6,
    headingDeg: 135,
    accentColor: '#6ef5b9',
    fact: 'Verdigris copper beacon raising a golden torch above New York Harbor.',
  },
  {
    id: 'goldengate',
    name: 'Golden Gate Bridge',
    city: 'San Francisco',
    country: 'USA',
    lat: 37.8199,
    lon: -122.4783,
    height: 5.4,
    ringAltitude: 6.8,
    headingDeg: -10,
    accentColor: '#ff6e4a',
    fact: 'International Orange Art Deco suspension towers spanning the Golden Gate strait.',
  },
  {
    id: 'chichen',
    name: 'Chichen Itza (El Castillo)',
    city: 'Yucatan',
    country: 'Mexico',
    lat: 20.6843,
    lon: -88.5678,
    height: 4.5,
    ringAltitude: 6.0,
    headingDeg: 18,
    accentColor: '#98f576',
    fact: 'Nine-tiered Mayan step pyramid aligned with the equinox serpent shadow.',
  },
  {
    id: 'redeemer',
    name: 'Christ the Redeemer',
    city: 'Rio de Janeiro',
    country: 'Brazil',
    lat: -22.9519,
    lon: -43.2105,
    height: 6.4,
    ringAltitude: 7.4,
    headingDeg: 70,
    accentColor: '#9be7ff',
    fact: 'Soapstone Art Deco statue crowning Corcovado mountain above Guanabara Bay.',
  },
];
