# Earth texture attribution

Earth surface, city lights, clouds, normal, and specular maps are by **Solar System Scope / INOVE**, based on NASA elevation data, imagery, and Blue Marble data.

- Collection and credit: https://www.solarsystemscope.com/textures/
- License: **Creative Commons Attribution 4.0 International**, https://creativecommons.org/licenses/by/4.0/
- Retrieved 2026-11-12.

| Bundled asset | Dimensions | Source | Adaptation |
| --- | --- | --- | --- |
| `public/textures/earth-day.jpg` | 8192 × 4096 | https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg | Renamed; image content unchanged |
| `public/textures/earth-night.jpg` | 4096 × 2048 | https://www.solarsystemscope.com/textures/download/8k_earth_nightmap.jpg | Resized from 8192 × 4096 and JPEG recompressed |
| `public/textures/earth-clouds.jpg` | 4096 × 2048 | https://www.solarsystemscope.com/textures/download/8k_earth_clouds.jpg | Resized from 8192 × 4096 and JPEG recompressed |
| `public/textures/earth-normal.jpg` | 2048 × 1024 | https://www.solarsystemscope.com/textures/download/2k_earth_normal_map.tif | TIFF converted to JPEG |
| `public/textures/earth-specular.jpg` | 2048 × 1024 | https://www.solarsystemscope.com/textures/download/2k_earth_specular_map.tif | TIFF converted to JPEG |

All maps use equirectangular projection with north at the top, Greenwich near the horizontal midpoint, and the antimeridian at the seam. The cloud map uses white clouds on black sky and is suitable as an alpha map. The normal and specular maps are data textures and must not use an sRGB color-space transform.

These are static visualization textures, not current weather or current satellite imagery. Solar System Scope describes its Earth textures as a compilation of geographic data and imagery with enhanced saturation and seasonal vegetation/snow choices. They are not a single unmodified satellite photograph.

The project's 3D landmark and aircraft models are original procedural geometry. Landmark proportions are intentionally exaggerated for recognition and gameplay.
