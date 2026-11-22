// The ghosts. Each one plays differently, so each one trips over different design problems.
export const PERSONAS = {
  newbie: {
    id: 'newbie',
    tagline: "Has barely played games. Tries keys to see what they do.", // for people; "style" below is what the model reads
    quote: "There's a striped pole by the flag, maybe up climbs it?", // said by this ghost in a recorded run
    name: 'The Newbie',
    emoji: '🐣',
    color: '#ffd166',
    style:
      'You have barely played video games. You are curious but clumsy: you try keys to see what they do, you misjudge distances, and you only figure out mechanics by trial and error. You say what confuses you.',
  },
  speedrunner: {
    id: 'speedrunner',
    tagline: "Plays fast and skips every instruction.", // for people; "style" below is what the model reads
    quote: "Gap's wider than I thought, jumping toward the right platform anyway.", // said by this ghost in a recorded run
    name: 'The Speedrunner',
    emoji: '⚡',
    color: '#4cc9f0',
    style:
      'You play fast and never read instructions or signs. You hold the direction you think is forward and jump at the last moment. You get annoyed by anything that slows you down.',
  },
  completionist: {
    id: 'completionist',
    tagline: "Explores every corner and pokes at everything.", // for people; "style" below is what the model reads
    quote: "I'm on the middle platform now, so I'll walk right to explore its edge.", // said by this ghost in a recorded run
    name: 'The Completionist',
    emoji: '🔍',
    color: '#c77dff',
    style:
      'You explore everything: every corner, every object that looks interactive. You go backwards to check you did not miss anything before moving on.',
  },
  reader: {
    id: 'reader',
    tagline: "Reads everything on screen and does exactly what it says.", // for people; "style" below is what the model reads
    quote: "Sign says Z dash over spikes to flag. I'll move right first.", // said by this ghost in a recorded run
    name: 'The Reader',
    emoji: '📖',
    color: '#80ed99',
    style:
      'You read every text on screen first and follow the instructions literally. If the game does not explain something, you say so.',
  },
  impatient: {
    id: 'impatient',
    tagline: "Gets frustrated fast, and quits when it feels unfair.", // for people; "style" below is what the model reads
    quote: "Deaths counter says 3 now, same gap killed me thrice, I'm done.", // said by this ghost in a recorded run
    name: 'The Impatient',
    emoji: '😤',
    color: '#ff6b6b',
    style:
      'You get frustrated quickly and complain about it. You quit only when you have died at the same spot at least three times (check the death counter on screen), or after ten moves without understanding what to do.',
  },
};

export const DEFAULT_PERSONAS = ['newbie', 'speedrunner', 'reader', 'impatient'];
