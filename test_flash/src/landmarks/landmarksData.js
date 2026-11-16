export const LANDMARKS = [
  {
    id: 'eiffel-tower',
    name: 'Eiffel Tower',
    location: 'Paris, France',
    flag: '🇫🇷',
    lat: 48.8584,
    lon: 2.2945,
    altitude: 100,
    ringHeight: 4.8,
    color: '#38bdf8', // Neon Sky Blue
    description: 'Iconic 330m wrought-iron lattice tower on the Champ de Mars, built in 1889 by Gustave Eiffel.',
    funFact: 'It can grow by up to 15 cm in summer due to thermal expansion of the iron!'
  },
  {
    id: 'statue-of-liberty',
    name: 'Statue of Liberty',
    location: 'New York, USA',
    flag: '🇺🇸',
    lat: 40.6892,
    lon: -74.0445,
    altitude: 100,
    ringHeight: 4.2,
    color: '#34d399', // Emerald Green
    description: 'Colossal neoclassical copper sculpture on Liberty Island, gifted by France in 1886.',
    funFact: 'Her copper skin is only 2.4 millimeters thick, about the thickness of two pennies together!'
  },
  {
    id: 'pyramids-giza',
    name: 'Great Pyramids & Sphinx',
    location: 'Cairo, Egypt',
    flag: '🇪🇬',
    lat: 29.9792,
    lon: 31.1342,
    altitude: 100,
    ringHeight: 4.5,
    color: '#fbbf24', // Golden Amber
    description: 'Monumental ancient tombs of the Fourth Dynasty pharaohs guarded by the mythical limestone Sphinx.',
    funFact: 'The Great Pyramid remained the tallest human-made structure in the world for over 3,800 years.'
  },
  {
    id: 'big-ben',
    name: 'Big Ben & Westminster',
    location: 'London, UK',
    flag: '🇬🇧',
    lat: 51.5007,
    lon: -0.1246,
    altitude: 100,
    ringHeight: 4.0,
    color: '#f43f5e', // Rose Red
    description: 'The Elizabeth Tower and Great Clock of Westminster, ringing across the River Thames since 1859.',
    funFact: 'Big Ben is strictly the nickname of the 13.7-tonne Great Bell inside the tower!'
  },
  {
    id: 'colosseum',
    name: 'The Colosseum',
    location: 'Rome, Italy',
    flag: '🇮🇹',
    lat: 41.8902,
    lon: 12.4922,
    altitude: 100,
    ringHeight: 3.8,
    color: '#f97316', // Bright Orange
    description: 'The largest ancient amphitheater ever built, inaugurated in 80 AD under Emperor Titus.',
    funFact: 'It could hold up to 65,000 spectators and could even be flooded for mock naval sea battles!'
  },
  {
    id: 'taj-mahal',
    name: 'Taj Mahal',
    location: 'Agra, India',
    flag: '🇮🇳',
    lat: 27.1751,
    lon: 78.0421,
    altitude: 100,
    ringHeight: 4.2,
    color: '#a855f7', // Purple
    description: 'Pristine white marble mausoleum commissioned in 1631 by Mughal Emperor Shah Jahan.',
    funFact: 'The four corner minarets are tilted slightly outward so they would fall away from the tomb in an earthquake.'
  },
  {
    id: 'mount-fuji',
    name: 'Mount Fuji & Torii Gate',
    location: 'Honshu, Japan',
    flag: '🇯🇵',
    lat: 35.3606,
    lon: 138.7274,
    altitude: 100,
    ringHeight: 5.2,
    color: '#ec4899', // Pink
    description: 'Sacred symmetrical stratovolcano rising 3,776 meters with a grand vermilion Shinto Torii gate.',
    funFact: 'Fuji is an exceptionally active spiritual symbol, painted in Hokusai 36 Views of Mount Fuji.'
  },
  {
    id: 'sydney-opera',
    name: 'Sydney Opera House',
    location: 'Sydney, Australia',
    flag: '🇦🇺',
    lat: -33.8568,
    lon: 151.2153,
    altitude: 100,
    ringHeight: 3.8,
    color: '#06b6d4', // Cyan
    description: 'Multi-venue performing arts center on Bennelong Point with world-famous precast concrete sail shells.',
    funFact: 'Designed by Danish architect Jorn Utzon after winning an international design competition in 1957.'
  },
  {
    id: 'christ-redeemer',
    name: 'Christ the Redeemer',
    location: 'Rio de Janeiro, Brazil',
    flag: '🇧🇷',
    lat: -22.9519,
    lon: -43.2105,
    altitude: 100,
    ringHeight: 4.2,
    color: '#10b981', // Green
    description: 'Art Deco statue standing atop the 700-meter Corcovado mountain with arms outstretched over Rio.',
    funFact: 'The statue was built in pieces in France and hauled up the Corcovado mountain via cog-wheel train!'
  },
  {
    id: 'golden-gate',
    name: 'Golden Gate Bridge',
    location: 'San Francisco, USA',
    flag: '🇺🇸',
    lat: 37.8199,
    lon: -122.4783,
    altitude: 100,
    ringHeight: 4.0,
    color: '#ea580c', // International Orange
    description: 'Famed 2.7-kilometer suspension bridge linking San Francisco Bay to the Pacific Ocean.',
    funFact: 'Its signature International Orange color was originally an anti-corrosion primer that locals fell in love with.'
  },
  {
    id: 'great-wall',
    name: 'Great Wall of China',
    location: 'Beijing, China',
    flag: '🇨🇳',
    lat: 40.4319,
    lon: 116.5704,
    altitude: 100,
    ringHeight: 4.2,
    color: '#eab308', // Gold
    description: 'Ancient stone fortifications and watchtowers snaking across rugged mountain ridges.',
    funFact: 'The total length of all built sections exceeds 21,000 kilometers (over 13,000 miles)!'
  },
  {
    id: 'burj-khalifa',
    name: 'Burj Khalifa',
    location: 'Dubai, UAE',
    flag: '🇦🇪',
    lat: 25.1972,
    lon: 55.2744,
    altitude: 100,
    ringHeight: 5.6,
    color: '#60a5fa', // Blue
    description: 'The world tallest building at 828 meters (2,717 ft), featuring a tiered neo-futuristic spire.',
    funFact: 'The sun sets several minutes later at the top of the tower than at the ground level!'
  },
  {
    id: 'chichen-itza',
    name: 'Chichen Itza Pyramid',
    location: 'Yucatan, Mexico',
    flag: '🇲🇽',
    lat: 20.6843,
    lon: -88.5678,
    altitude: 100,
    ringHeight: 3.8,
    color: '#14b8a6', // Teal
    description: 'El Castillo: 9-tiered Maya pyramid dedicated to the feathered serpent deity Kukulkan.',
    funFact: 'During the equinoxes, afternoon shadows create the illusion of a giant serpent slithering down the steps!'
  },
  {
    id: 'stonehenge',
    name: 'Stonehenge',
    location: 'Wiltshire, UK',
    flag: '🇬🇧',
    lat: 51.1789,
    lon: -1.8262,
    altitude: 100,
    ringHeight: 3.5,
    color: '#8b5cf6', // Violet
    description: 'Prehistoric ring of standing sarsen stones and horizontal lintels dating back to 3000 BC.',
    funFact: 'The stones are aligned with the movements of the sun during the summer and winter solstices.'
  }
];

