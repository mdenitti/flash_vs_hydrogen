# GlobeFly · Three.js Ultrarealistic Globe Flight Expedition

A high-fidelity Three.js 3D globe flight exploration experience inspired by [TinySkies](https://tinyskies.vercel.app/). Pilot an aerobatic aircraft around a photorealistic planetary Earth, skim the oceans and mountain ranges, fly into the stratosphere, and soar over oversized, recognizable iconic world landmarks to trigger glowing checkpoint rings!

## Key Features

1. **Ultrarealistic Earth System**:
   - **Multi-layer Atmosphere & Surface Shader**: Seamless dynamic blending of high-resolution daytime satellite imagery, night metropolitan city lights, specular ocean reflections, and twilight scattering along the day-night terminator line.
   - **Outer Atmospheric Halo**: Additive Fresnel rim glow simulating Rayleigh atmospheric scattering visible from orbit.
   - **Dynamic Cloud Deck**: Translucent volumetric cloud layer rotating with high-altitude atmospheric currents.
   - **Deep Celestial Starfield**: 3,500 varied stellar-temperature stars and cosmic glow.
   - **Dynamic Sun & Time of Day**: Real-time directional sunlight with quick presets for Dawn, Noon, Sunset, and Night.

2. **Singularity-Free Spherical Flight Physics**:
   - Quaternion-based spherical geodesic flight math: fly around any continent, across the equator, or over the poles without gimbal lock.
   - Aerodynamic banking: rolling tilts lift and induces coordinated turns.
   - Flight envelope protection: terrain ground avoidance and atmospheric ceiling clamping.
   - Dual wingtip contrails that draw aerodynamic condensation ribbons along the curved flight path.

3. **14 Iconic World Landmarks (Oversized & Recognizable Checkpoints)**:
   - **Eiffel Tower (Paris, France)**: 4 curved lattice steel legs, observation decks, spire, revolving searchlight beam, and beacon!
   - **Statue of Liberty (New York, USA)**: Fort Wood pedestal, copper draped robe, 7-point spiked crown, and glowing torch!
   - **Great Pyramids of Giza & Sphinx (Cairo, Egypt)**: Stepped pyramids with golden capstones and carved Sphinx guardian.
   - **Big Ben & Westminster (London, UK)**: Gothic sandstone Elizabeth Tower with illuminated glowing clock faces.
   - **The Colosseum (Rome, Italy)**: Tiered travertine arcade arches and ruined arena hypogeum.
   - **Taj Mahal (Agra, India)**: Pristine white marble onion dome, corner minarets, and cyan reflecting pool.
   - **Mount Fuji & Torii Gate (Honshu, Japan)**: Snow-capped composite volcanic cone with vermilion Shinto Torii gate.
   - **Sydney Opera House (Sydney, Australia)**: Interlocking precast concrete white sail shells on the harbor.
   - **Christ the Redeemer (Rio de Janeiro, Brazil)**: Mount Corcovado peak with monumental outstretched arms.
   - **Golden Gate Bridge (San Francisco, USA)**: Art Deco towers in International Orange with sweeping suspension cables.
   - **Great Wall of China (China)**: Serpentine fortress wall and watchtowers traversing mountain ridges.
   - **Burj Khalifa (Dubai, UAE)**: Stepped neo-futuristic skyscraper with aviation obstruction beacons.
   - **Chichen Itza Pyramid (Yucatan, Mexico)**: 9-tier stepped Maya temple of Kukulkan.
   - **Stonehenge (Wiltshire, UK)**: Prehistoric ring of giant standing sarsen megaliths and lintels.

4. **Checkpoint Discovery & Waypoint Progression**:
   - Each landmark is equipped with an animated glowing checkpoint torus ring and a vertical sky beacon.
   - Flying through a ring triggers a Web Audio celebratory chime, a burst of 3D star particles, and a celebration briefing card with fun facts and expedition XP.
   - Live discovery counter tracking progress (e.g. 0 / 14 discovered).

5. **Aerospace HUD & Flight Telemetry**:
   - Heading ribbon tape (0° to 360° compass).
   - Airspeed indicator (KTS) with thrust bar.
   - Altimeter (meters above globe).
   - Artificial horizon with pitch ladder and crosshair reticle.
   - Nearest waypoint radar reticle with real-time distance in kilometers.
   - Mini Globe Radar in bottom-left displaying your position and landmark statuses.
   - Fast Travel / Flight Approach selector in bottom-right to warp straight to any landmark!

6. **Audio Engine (Web Audio API)**:
   - Dynamic engine drone responsive to throttle and RPM.
   - Airflow rushing sound proportional to airspeed.
   - Multi-harmonic pentatonic chime on checkpoint completion.

## Flight Controls

| Control | Action |
| :--- | :--- |
| **W / S** or **↑ / ↓** | Pitch Nose Down / Up (flight stick convention) |
| **A / D** or **← / →** | Roll / Bank Left & Right |
| **Q / E** | Rudder / Yaw Steering |
| **SPACE** | Afterburner / Boost Speed |
| **SHIFT** or **B** | Airbrake / Decelerate |
| **C** | Cycle Camera (Chase / Cockpit / Orbit) |
| **M** | Toggle Audio Mute |
| **🖱️ Mouse Steer** | Click "Mouse Steer" in the top bar to fly with mouse cursor |
| **Touch Controls** | On-screen virtual joystick and boost buttons on mobile/tablet |

## Running the Application

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Build for production
npm run build
```

