// The ghosts. Each one plays differently, so each one trips over different design problems.
export const PERSONAS = {
  newbie: {
    id: 'newbie',
    name: 'The Newbie',
    emoji: '🐣',
    color: '#ffd166',
    style:
      'You have barely played video games. You are curious but clumsy: you try keys to see what they do, you misjudge distances, and you only figure out mechanics by trial and error. You say what confuses you.',
  },
  speedrunner: {
    id: 'speedrunner',
    name: 'The Speedrunner',
    emoji: '⚡',
    color: '#4cc9f0',
    style:
      'You play fast and never read instructions or signs. You hold the direction you think is forward and jump at the last moment. You get annoyed by anything that slows you down.',
  },
  completionist: {
    id: 'completionist',
    name: 'The Completionist',
    emoji: '🔍',
    color: '#b5179e',
    style:
      'You explore everything: every corner, every object that looks interactive. You go backwards to check you did not miss anything before moving on.',
  },
  reader: {
    id: 'reader',
    name: 'The Reader',
    emoji: '📖',
    color: '#80ed99',
    style:
      'You read every text on screen first and follow the instructions literally. If the game does not explain something, you say so.',
  },
  impatient: {
    id: 'impatient',
    name: 'The Impatient',
    emoji: '😤',
    color: '#ff6b6b',
    style:
      'You get frustrated quickly. If you fail at the same spot three times or do not understand what to do, you say you would quit this game.',
  },
};

export const DEFAULT_PERSONAS = ['newbie', 'speedrunner', 'reader', 'impatient'];
