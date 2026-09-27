# PianoFlows — Interface Prototype

A clickable prototype for the PianoFlows piano application. This is visual-only: buttons are clickable, modals and tabs open, sliders move, and keys glow and emit light beams. There is no real backend logic: no audio synthesis, no data persistence, and no server.

**How to open:** double-click `dist/index.html` (an internet connection is only needed for Google Fonts; without it, system fonts will be used as fallbacks).

---

## 1. Project Concept (What You Set Out to Do)

The development path was as follows:

1. **Study PianoGlow** — break down the application entirely: all mechanics, sections, every single button, and slider. The findings are documented in `docs/`.
2. **Recreate a similar design with all controls, but elevate it beyond the original**: more glow, "outdoing" it → `archive/v0_статичный_макет.html` (a static page containing all panels).
3. **Build an interactive prototype**: allowing users to click buttons and navigate menus without actual backend processing — pure visual interaction → `archive/v1_прототип_как_оригинал.html`.
4. **Move away from a 1:1 copy.** Retain the core essentials, but overhaul the top navigation, settings, practice modes, etc., giving the interface a distinct and unique identity. **The 3D camera has been removed.**
5. **Eliminate visual clutter ("color soup") and create a cohesive design system** so it doesn't look like generic AI output. Visual effects are refined and professional rather than basic: particles, light beams, and more → `dist/index.html` (current version).
6. **Package the project into a single deliverable and thoroughly document the concept** — this README.

### Core Principles of the Current Version
- **Monochromatic accent.** Everything is built upon a graphite palette with a single accent color (defaulting to amber `#f0c27b`). Beams, sparks, the horizon line, toggles, and highlights all share the same tone. No rainbow gradients, multicolored cards, or "neon mess."
- **Custom layout, distinct from PianoGlow**: a sidebar replaces the top button row, a status capsule sits at the top right, dialogs are centered, and related sections are consolidated.
- **Canvas-driven visual engine**, avoiding flat CSS strips: includes physics simulation, layered illumination, and additive blending.
- **Preserved core features from the original**: an 88-key piano with a virtual piano layout (Roblox style), note beams, practice drills, rooms, library, sound and layers, a letter-note notepad, recording, currency, streaks, and a shop.

---

## 2. Prototype Features

### Main Screen
| Element | Location | Prototype Behavior |
|---|---|---|
| **Sidebar** | Left | PF logo (opens "About"), navigation items, "More", profile, and settings. The active section is indicated by an accent bar. |
| **"Today" Bar** | Top left | Notes played and minutes spent today and all-time. The note counter increments as you play. Clicking opens your profile. |
| **Capsule** | Top right | Day streak (daily reward modal — claimable), daily goal ring (popover), coins and gems (shop), notifications, chat feed toggle, avatar menu (profile, friends, shop, account, sign out). |
| **Feed** | Right | Chat tabs for "Global", "Room", and "Direct". Messages send on Enter; includes "translate" and emoji options. Collapsible. |
| **Stage Title** | Center | Prominent display text above the stage, customizable in settings. |
| **Chord Display** | Above the keys | Displays active chords (Am7, Cmaj7, F/A…) or intervals alongside the list of held notes. |
| **Musical Staff** | Bottom right | Visualizes active notes in real-time across treble and bass clefs. |
| **Control Bar** | Centered above keys | Soft pedal, Sostenuto, Sustain pedal and its mode (Hold / Latch / Toggle), transposition ±, and a metronome with animated beat indicators. |
| **Piano** | Bottom | 88 keys with alphanumeric labels (1 ! 2 @ 3 4 $ … q Q w W …) and note names. Playable via mouse (velocity scales by vertical click position) and keyboard. |

### Keyboard Shortcuts
| Keys | Action |
|---|---|
| `1 2 3 … q w e … z x c …` | Play notes (virtual piano layout, 61 keys C2–C7) |
| `Shift` + key | Black keys; if a key has no sharp/flat pair, shifts up by a semitone |
| `Space` | Sustain pedal toggle |
| `Tab` | Switch sustain pedal mode |
| `↑ ↓` / `→ ←` | Transpose ±1 / ±12 semitones |
| `Enter` | Focus chat input |
| `F1`–`F6`, `F8`, `F9` | Library, Practice, Rooms, Studio, Sound, Notepad, Profile, Settings |
| `F7` | "More" menu |
| `Esc` | Close topmost modal |

Direct navigation via URL hash is supported: `index.html#settings`, `#train`, `#rooms`, `#studio`, `#echo` (direct mode launch), etc.

### Canvas Lighting Engine
- **Beams** — five rendering passes: wide bloom, beam body, hot core, and a white core thread. Features a soft front edge, dynamic key-strike glow, and ambient shimmer. Key velocity modulates beam width and intensity. Styles: Glow, Thread, Pillar, Smoke, None.
- **Sparks** — directional fan with motion trails, gravity simulation, air resistance, and single-bounce physics off the horizon.
- **Embers** — upward-drifting particles rising from active beams with turbulence and flicker.
- **Shockwave** — perspective-projected ground rings expanding along the horizon from each strike point.
- **Impact Flash** — high-intensity instant flash at the key contact point.
- **Horizon** — ambient glow that dynamically intensifies under active notes and decays smoothly. Modes: Bloom, Thin Line, None.
- **Pedal Trail** — notes released while holding sustain leave an ascending, dissipating light column.
- **Atmospheric Dust** — depth-layered particulate field (distant particles are fine, foreground particles are blurred), glowing brighter near sounding notes.
- **Idle Demo**: after 7 seconds of inactivity, the stage automatically plays an Am7 → Fmaj7 → C → G progression with a melodic lead. Interaction immediately interrupts the demo.
- CSS-based atmospheric overlays: rain, snow, falling petals, fireflies, and distant lightning.

### Sections
| Section | Contents |
|---|---|
| **Library (F1)** | Tabs: Virtual Sheets (50,000+), Classical Piano Sheets, My Files, Community Workshop, Scan from Image (integrated PDF/OCR replacement). Search, shelf filters, 5-star difficulty ratings, favorites, and action buttons: "Play", "To Notepad", "Practice", "Listen". |
| **Practice (F2)** | Category filters with activity counters, daily goal bar, "Recommended Today" card, and 12 training modes with mastery rings and high scores. Each mode includes a dedicated interface: score header, progress bar, and slide-out settings. |
| **Rooms (F3)** | Room cards (game mode, voice chat status, avatar stack, capacity). "Create Room" launches a modal featuring 6 game types. Inside rooms: "On Stage" status with turn timers and audio visualizers, queue and spectator rosters, push-to-talk control. |
| **Studio (F4)** | Unified workspace tabs: Player, Learn (scoring, A–B looping, tempo control, "wait-for-note" mode, performance heatmaps), Editor (piano roll/sheet grid), Recorder (always-on background MIDI buffer, audio render, file-based video import, screen capture, reward renders), Looper (radial bar tracker). |
| **Sound (F5)** | Categorized instrument browser with mini-waveforms, layering engine with key-zone splits and volume trims, FX Rack with rotary controls (Reverb, Chorus, Delay, EQ), 8-channel mixer, latency adjustments, output routing (WASAPI, ASIO), and virtual MIDI ports. |
| **Notepad (F6)** | Rich alphanumeric sheet editor, typography scaling, Shift/Ctrl modifier counters, auto-playback, key-detection, chord simplification, and one-click export to "Sheet Typing" or "Speed Typing". |
| **More (F7)** | Draggable floating utility windows: Circle of Fifths, Camera, Video Overlay, Audio-to-MIDI, MIDI Monitor, Pitch & Vibrato, Web Browser, Community Feedback, and Bug Reporter. |
| **Profile (F8)** | Custom banner, achievement badges, tabs: Overview (metrics and activity heatmaps), Leaderboards, Key Heatmap (frequency of played notes), Friends List. |
| **Shop** | Cosmetic storefront for username styles, custom cursors, profile cards, and gem packages. |
| **Settings (F9)** | Comprehensive multi-category preferences panel featuring global instant search across all settings cards. |

### 12 Practice Modes
| Mode | Description |
|---|---|
| Song Practice | Waterfall notes descending toward keys — play in rhythm (routes to Studio → Learn) |
| Sheet Typing | Sequential alphanumeric note reading, functioning like a typing tutor |
| Sight Reading | Random notes generated on the musical staff |
| Ear Training: Intervals | Identify the interval distance between two pitches |
| Ear Training: Chords | Identify chord qualities (major, minor, diminished, etc.) |
| Chord Builder | Construct a chord on the keys based on a chord symbol |
| Rhythm Taps | Tap along with displayed rhythmic patterns |
| **Echo Melody** | *New mode not found in PianoGlow:* listen to a phrase played by the stage and replicate it |
| Scales & Arpeggios | Practice scale patterns and arpeggios with recommended fingerings |
| Falling Meteors | Intercept falling meteors by striking matching notes (clicking also detonates them) |
| Speed Typing | Timed alphanumeric typing drills, compatible with musical input |
| Catch the Beam | Two-player local co-op: Player 1 plays notes while Player 2 intercepts beams |

### Real-Time Visual Customization in Settings
- **Stage Glow** — master accent color applied throughout the UI, lighting passes, and particle systems.
- **Background** (Stars / Fog / Void), atmospheric dust density.
- **Weather Overlays**: 5 configurable visual layers.
- **Stage Title** — custom text content and font size.
- **Companion** — an animated mascot walking along the horizon line.
- **Beams**: rendering style, speed, and beam width.
- **Particles**: sparks, embers, impact shockwaves, and spawn counts.
- **Pedal Trail** and tail decay duration.
- **Horizon Line** and intensity.
- **Key Lighting**, key height scaling.
- **Key Labels**: dynamic auto, alphanumeric, note names, or disabled.
- **Key Finishes**: smoked glass, ivory, midnight, amber.
- **Sidebar**: label visibility and left/right screen docking.
- **HUD Widgets**: toggle chord display, staff, "Today" tracker, control bar, and chat feed.

Note: Functional/audio settings outside visual styling operate as interface-only mocks.

---

## 3. Differences from PianoGlow

| PianoGlow | PianoFlows |
|---|---|
| Top bar with 12 function-key buttons | Unified sidebar, 8 primary sections, remapped shortcuts, Esc dismisses windows |
| Green accents with multi-color rainbow gradients | Graphite theme anchored by a single unified accent color |
| Narrow right-hand icon drawer for settings | Full-featured settings dashboard with searchable textual categories and presets |
| Split standalone apps: Player, Recorder, MIDI Editor, Looper | Consolidated inside the unified "Studio" workspace |
| Audio FX mixed into general settings | Dedicated FX Rack with rotary knobs inside the "Sound" dashboard |
| Dedicated standalone PDF viewer | Integrated "Scan from Image" tab within the sheet music Library |
| 3D perspective camera | Omitted in favor of an optimized 2D canvas stage |
| Flat grid layout for mini-games | Structured Practice Hub with category filtering, mastery ranks, and "Echo Melody" |
| Plain text-row room listings | Grid of interactive room cards with a 6-mode creation wizard |
| DOM-element visual light beams | High-performance multi-pass 2D canvas particle engine |

---

## 4. Project Structure

```
PianoFlows_project/
├─ dist/index.html                     ← Compiled standalone prototype (single file, run in browser)
├─ src/
│  ├─ build.js                         ← Markup generator (assembles views, settings, and strings)
│  ├─ style3.css                       ← Stylesheet
│  ├─ app3.js                          ← UI state logic and canvas lighting engine
│  └─ icons.js                         ← SVG icon library
├─ archive/
│  ├─ v0_статичный_макет.html          ← Initial static wireframe
│  └─ v1_прототип_как_оригинал.html    ← Interactive prototype mimicking PianoGlow
├─ docs/
│  ├─ PianoGlow_полный_разбор.md       ← Functional breakdown of PianoGlow
│  └─ PianoGlow_каждая_кнопка.md       ← Comprehensive setting-by-setting reference (PianoGlow 0.50)
├─ package.json
└─ README.md
```

### Build Instructions
All UI copy, section layouts, and settings configurations are defined in `src/build.js`, styling is handled in `src/style3.css`, and visual effects/interactivity live in `src/app3.js`. To compile changes:

```bash
npm run build
```

(or `node src/build.js`) — this recompiles `dist/index.html`. Requires only Node.js with zero third-party dependencies.

Key references in `src/app3.js`:
- `FX.o` — engine configurations (beam styles, particle velocities, density limits);
- `noteOn` / `drawBeam` / `drawHorizon` — rendering pipeline;
- `PROG` / `MEL` — automated idle demo progression.

---

## 5. Next Steps (Production Roadmap)
1. **Audio Synthesis**: Integrate a SoundFont engine (e.g., SpessaSynth) to replace silent triggers.
2. **Web MIDI API** integration for physical digital piano input.
3. **Configuration Storage** (via browser localStorage or an Electron configuration file).
4. **Electron Packaging** — wrap the web build using your existing PianoFlows Electron harness.
5. **Backend Infrastructure** to handle multiplayer rooms, WebSocket signaling, and real-time chat.
