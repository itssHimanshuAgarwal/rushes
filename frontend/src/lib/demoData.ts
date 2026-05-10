import type {
  AnalysisResult,
  ClipAnalysis,
  ContinuityBreak,
  Critique,
  MissingShot,
} from './types'

// Tiny SVG-gradient thumbnail so the demo renders without a backend.
function demoThumb(top: string, bottom: string, label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180' preserveAspectRatio='xMidYMid slice'>
    <defs>
      <linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'>
        <stop offset='0%' stop-color='${top}'/>
        <stop offset='100%' stop-color='${bottom}'/>
      </linearGradient>
      <radialGradient id='v' cx='50%' cy='55%' r='65%'>
        <stop offset='0%' stop-color='rgba(0,0,0,0)'/>
        <stop offset='100%' stop-color='rgba(0,0,0,0.55)'/>
      </radialGradient>
    </defs>
    <rect width='320' height='180' fill='url(#g)'/>
    <rect width='320' height='180' fill='url(#v)'/>
    <text x='50%' y='52%' fill='rgba(255,255,255,0.55)' text-anchor='middle'
      font-family='monospace' font-size='12' letter-spacing='2'>${label}</text>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// 5 demo clips telling a moody noir vignette: a stranger arrives in a rainy city.
const DEMO_CLIPS: ClipAnalysis[] = [
  {
    clip_id: 'demo_01',
    filename: 'NIGHT_STREET_WIDE_v2.mp4',
    duration: 6.4,
    resolution: '1920x1080',
    has_audio: false,
    scene_description:
      'A wet city street at night. Neon signs reflect in puddles. A lone figure in a long coat walks toward the camera, hands in pockets.',
    environment: 'rain-soaked downtown street, neon storefronts, low-level fog',
    lighting: 'cool sodium streetlights from above, magenta neon rim light from the right',
    mood: 'mysterious and tense',
    characters: [
      {
        description:
          'tall man, late 30s, dark cropped hair, three-day stubble, sharp jawline',
        clothing: 'long black wool overcoat, dark slacks, leather boots',
      },
    ],
    objects: ['streetlights', 'puddles', 'neon signage', 'wet asphalt'],
    sounds_needed: [
      'rain falling on pavement, steady drizzle',
      'slow heavy footsteps on wet asphalt',
      'distant car passing on cross street',
      'low neon hum',
    ],
    ambient_type: 'city-street',
    quality_score: 87,
    quality_issues: [],
    color_palette: 'desaturated blues with magenta and amber neon accents',
    thumbnail_url: demoThumb('#1B2A4E', '#0A0F1F', 'NIGHT_STREET_WIDE'),
    video_url: '/demo_film.mp4',
  },
  {
    clip_id: 'demo_02',
    filename: 'CAFE_INTERIOR_CU_v1.mp4',
    duration: 4.8,
    resolution: '1920x1080',
    has_audio: true,
    scene_description:
      'Close-up inside a small late-night cafe. Steam rising from a porcelain cup. The owner wipes the counter with a stained rag.',
    environment: 'cramped late-night cafe interior, vinyl stools, formica counter',
    lighting:
      'warm tungsten pendant lights from above, soft fill from a flickering window sign',
    mood: 'quiet and contemplative',
    characters: [
      {
        description: 'woman in her 60s, silver-grey hair pulled back, soft eyes',
        clothing: 'faded green apron over a white blouse',
      },
    ],
    objects: ['ceramic mug', 'steam', 'rag', 'vintage espresso machine'],
    sounds_needed: [
      'low cafe ambience, gentle chatter',
      'steam wand hissing',
      'porcelain cup placed on saucer',
    ],
    ambient_type: 'restaurant',
    quality_score: 91,
    quality_issues: [],
    color_palette: 'warm amber and ochre with deep brown shadows',
    thumbnail_url: demoThumb('#3A1F12', '#1A0E0A', 'CAFE_INTERIOR_CU'),
    video_url: '/demo_film.mp4',
  },
  {
    clip_id: 'demo_03',
    filename: 'DOORWAY_MED_v1.mp4',
    duration: 5.2,
    resolution: '1920x1080',
    has_audio: false,
    scene_description:
      'Medium shot of the same man from clip 1 stepping through a backlit doorway. He pauses, lets the door close behind him.',
    environment: 'narrow doorway opening into the cafe, brass kickplate',
    lighting: 'strong backlight from the street, warm amber bounce on his face',
    mood: 'tense and arrival',
    characters: [
      {
        description: 'tall man, late 30s, dark cropped hair, stubble',
        clothing:
          'navy peacoat, charcoal scarf, dark jeans — wardrobe shifted from clip 1',
      },
    ],
    objects: ['glass door', 'brass handle', 'string of small bells'],
    sounds_needed: [
      'door bell jangle on entry',
      'whoosh of cold air rushing in',
      'door closing on a soft latch',
    ],
    ambient_type: 'indoor-room',
    quality_score: 78,
    quality_issues: ['slight motion blur on the right hand at frame 0:02'],
    color_palette: 'amber interior versus cool blue exterior framing',
    thumbnail_url: demoThumb('#4A2F18', '#1B0F08', 'DOORWAY_MED'),
    video_url: '/demo_film.mp4',
  },
  {
    clip_id: 'demo_04',
    filename: 'COUNTER_OTS_v3.mp4',
    duration: 7.1,
    resolution: '1920x1080',
    has_audio: false,
    scene_description:
      'Over-the-shoulder of the woman as the man slides onto a stool. They share a long, knowing glance without speaking.',
    environment: 'cafe counter from owner POV, espresso machine in foreground',
    lighting: 'warm tungsten key, hard shadow under the bar lip',
    mood: 'tense and unspoken',
    characters: [
      {
        description: 'tall man, late 30s, dark cropped hair, stubble',
        clothing: 'navy peacoat, charcoal scarf',
      },
      {
        description: 'woman in her 60s, silver-grey hair pulled back',
        clothing: 'faded green apron over a white blouse',
      },
    ],
    objects: ['espresso machine', 'sugar shaker', 'rotating coffee grinder'],
    sounds_needed: [
      'distant rain still audible through the window',
      'slow scrape of a stool on tile',
      'quiet exhale, suppressed breath',
      'electric grinder humming faintly',
    ],
    ambient_type: 'restaurant',
    quality_score: 72,
    quality_issues: ['slight character drift on woman in middle frame'],
    color_palette: 'warm ambers offset with a cool blue window wash',
    thumbnail_url: demoThumb('#3F2515', '#150C08', 'COUNTER_OTS'),
    video_url: '/demo_film.mp4',
  },
  {
    clip_id: 'demo_05',
    filename: 'WINDOW_RAIN_INSERT_v1.mp4',
    duration: 3.2,
    resolution: '1920x1080',
    has_audio: true,
    scene_description:
      'Insert shot of rain streaking down the cafe window, neon signs blurred behind. A silhouette passes by outside.',
    environment: 'cafe window glass, exterior obscured by rain',
    lighting: 'mixed: cool magenta neon outside, warm interior reflected on glass',
    mood: 'melancholy and waiting',
    characters: [],
    objects: ['rain streaks', 'condensation', 'blurred neon signs'],
    sounds_needed: [
      'heavy rain on glass',
      'distant car passing through puddle',
      'low refrigerator hum',
    ],
    ambient_type: 'indoor-room',
    quality_score: 84,
    quality_issues: [],
    color_palette: 'cool magenta and teal exterior bleeding through warm interior',
    thumbnail_url: demoThumb('#2A1840', '#0A0820', 'WINDOW_RAIN_INSERT'),
    video_url: '/demo_film.mp4',
  },
]

const DEMO_BREAKS: ContinuityBreak[] = [
  {
    clip_a: 0,
    clip_b: 2,
    severity: 'high',
    issue:
      "Wardrobe mismatch: the man wears a long black wool overcoat in NIGHT_STREET_WIDE but appears in a navy peacoat with a charcoal scarf in DOORWAY_MED. Same character, different outfit between adjacent shots.",
    anchor_clip_id: 'demo_01',
    fix_clip_id: 'demo_03',
    corrected_prompt:
      'A medium shot of the same man from the previous scene stepping through a backlit doorway. He wears a long black wool overcoat — exactly matching the wardrobe of the establishing wide shot. Warm amber light from the door behind him spills onto his face. Cool magenta neon spills in from the street outside. 35mm anamorphic, cinematic noir, slow handheld push-in.',
  },
]

const DEMO_MISSING: MissingShot[] = [
  {
    description:
      'No establishing wide shot of the cafe exterior. The cut from a wide street to a tight cafe interior reads as a jump — viewers lose spatial orientation.',
    suggested_prompt:
      'Establishing wide shot of a small late-night cafe on a rainy city street, warm amber light glowing from inside through fogged windows, neon CAFE sign reflected in wet asphalt, cinematic noir framing, 35mm anamorphic, slow push-in.',
  },
]

export const DEMO_ANALYSIS: AnalysisResult = {
  clips: DEMO_CLIPS,
  continuity_breaks: DEMO_BREAKS,
  missing_shots: DEMO_MISSING,
  suggested_order: [
    'demo_01',
    'demo_03',
    'demo_05',
    'demo_02',
    'demo_04',
  ],
  overall_coherence_score: 72,
}

export const DEMO_ASSEMBLED_VIDEO_URL = '/demo_film.mp4'
export const DEMO_MUSIC_MOOD = 'mysterious and tense'

export const DEMO_CRITIQUE: Critique = {
  overall_score: 68,
  verdict:
    'Atmospheric setup with a strong neon palette, undermined by a wardrobe shift between adjacent shots and an ambient bed that overstays its welcome.',
  audio_quality: {
    score: 72,
    notes:
      'Sound design is moody and well-matched to setting, but the cafe ambient bed competes with the rain-on-glass insert. Drop ambience by 4-6dB during clip 5.',
  },
  visual_continuity: {
    score: 55,
    notes:
      'Wardrobe mismatch between exterior and interior shots breaks the spell. Lighting consistency is otherwise strong; color-grading both shots could mask the wardrobe break.',
  },
  pacing: {
    score: 78,
    notes:
      'Crossfades work, but the 7s counter shot lingers. Tightening to ~5s would tighten forward momentum without losing the held silence.',
  },
  mood_coherence: {
    score: 70,
    notes:
      'Noir tone is consistent, though the warm cafe interior and cool rainy exterior pull in opposite directions. A slight cyan push on interior whites would unify them.',
  },
  improvements: [
    {
      type: 'audio',
      description:
        'Lower the cafe ambient bed during the rain insert so the rain texture reads clearly.',
      agent_to_rerun: 'sound-design',
      new_instruction:
        'Reduce indoor-room ambience by 6dB on clip 5; raise the rain-on-glass SFX to dominate the mix.',
    },
    {
      type: 'pacing',
      description:
        'Tighten the over-the-shoulder counter shot from 7.1s to 5.0s.',
      agent_to_rerun: 'assembly',
      new_instruction:
        'Trim 2.1s from clip COUNTER_OTS_v3, keeping the shared glance, dropping the final lingering frames.',
    },
    {
      type: 'mood',
      description:
        'Push the music bed slightly more melancholic to bind the cafe and the rainy street together.',
      agent_to_rerun: 'music',
      new_instruction:
        'Regenerate music as "subtle, melancholy and waiting" instead of "mysterious and tense".',
    },
  ],
}
