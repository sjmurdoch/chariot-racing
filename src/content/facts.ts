// Historical facts about Roman chariot racing, each with the source it was
// checked against. Shown one at a time on the start and finish screens, and
// all together on the About screen.

export interface Source {
  title: string;
  url: string;
}

export interface Fact {
  text: string;
  source: Source;
}

const ENCYCLOPAEDIA_ROMANA: Source = {
  title: 'Encyclopaedia Romana: Circus Maximus',
  url: 'https://penelope.uchicago.edu/encyclopaedia_romana/circusmaximus/circusmaximus.html',
};
const PLATNER: Source = {
  title: 'Platner, A Topographical Dictionary of Ancient Rome (1929): Circus Maximus',
  url: 'https://digi.ub.uni-heidelberg.de/diglit/platner1929/0161',
};
const VROMA: Source = {
  title: 'VRoma: The Roman Circus',
  url: 'https://vroma.org/vromans/bmcmanus/circus.html',
};
const NATIONAL_GEOGRAPHIC: Source = {
  title: 'National Geographic: Inside the chariot races of the Circus Maximus',
  url: 'https://www.nationalgeographic.com/history/article/ancient-rome-circus-maximus-chariot-racing',
};
const WORLD_HISTORY: Source = {
  title: 'World History Encyclopedia: Chariot Racing in Ancient Rome',
  url: 'https://www.worldhistory.org/article/2150/chariot-racing-in-ancient-rome/',
};

export const FACTS: Fact[] = [
  {
    text: 'A race was seven laps, spatia in Latin, run anticlockwise round the central barrier.',
    source: ENCYCLOPAEDIA_ROMANA,
  },
  {
    text: 'Seven large wooden eggs were set up on the barrier in 174 BC; one was taken down for each lap, so the crowd could count.',
    source: ENCYCLOPAEDIA_ROMANA,
  },
  {
    text: 'In 33 BC Agrippa added seven bronze dolphins to count the laps alongside the eggs; one was turned for each lap.',
    source: ENCYCLOPAEDIA_ROMANA,
  },
  {
    text: 'The presiding magistrate started the race by dropping a white cloth, the mappa, as a trumpet called a tuba sounded.',
    source: {
      title: 'Wikipedia: Mappa (Roman)',
      url: 'https://en.wikipedia.org/wiki/Mappa_(Roman)',
    },
  },
  {
    text: 'The twelve starting gates, the carceres, were built on a gentle curve so every chariot had the same distance to the line where it could leave its lane.',
    source: ENCYCLOPAEDIA_ROMANA,
  },
  {
    text: 'A crash was called a naufragium, a shipwreck. Drivers carried a knife to cut themselves free of the reins.',
    source: VROMA,
  },
  {
    text: 'The turning posts, the metae, at each end of the barrier were three cones of gilded bronze.',
    source: PLATNER,
  },
  {
    text: 'Augustus brought an Egyptian obelisk from Heliopolis in 10 BC and set it up in the middle of the barrier. It is 23.7 m high and now stands in the Piazza del Popolo.',
    source: PLATNER,
  },
  {
    text: 'Ancient writers put the crowd at 150,000 (Dionysius) to 250,000 (Pliny) spectators.',
    source: PLATNER,
  },
  {
    text: 'By the middle of the 1st century AD, a day at the circus was 24 races.',
    source: NATIONAL_GEOGRAPHIC,
  },
  {
    text: 'Charioteers raced for four factions: the Reds, Whites, Blues and Greens, each with fiercely loyal fans.',
    source: WORLD_HISTORY,
  },
  {
    text: 'The charioteer Gaius Appuleius Diocles won 1,462 of his 4,257 races and earned 35,863,120 sesterces.',
    source: {
      title: 'Wikipedia: Gaius Appuleius Diocles',
      url: 'https://en.wikipedia.org/wiki/Gaius_Appuleius_Diocles',
    },
  },
  {
    text: 'A winning charioteer was given a palm branch and a victory wreath.',
    source: {
      title: 'Metropolitan Museum of Art: Terracotta medallion of a victorious charioteer',
      url: 'https://www.metmuseum.org/art/collection/search/250464',
    },
  },
];

/**
 * Where this game simplifies or departs from history, shown on the About
 * screen so the facts above aren't taken as describing the game exactly.
 */
export const DEPARTURES: string[] = [
  'The track is shorter than the real one (about 600 m long), so seven laps take about two minutes.',
  'Four chariots race, one per faction, rather than up to twelve.',
  'The width of the barrier and the tightness of the turns are chosen for play, not copied from the real circus.',
  'Crashed chariots carry on after a short stop, instead of being out of the race.',
];

/** A fact chosen by `random` (a number from 0 up to 1). */
export function pickFact(random: number): Fact {
  return FACTS[Math.min(FACTS.length - 1, Math.floor(random * FACTS.length))]!;
}
