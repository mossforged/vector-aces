// Physical constants, in millimetres (the engine works in table mm).
// Tweak here to experiment with board size, range bands, arc width, etc.

export const CONFIG = {
  playArea: 914,               // 3' x 3'
  baseSize: { small: 40, large: 80 }, // square base side
  rangeBand: 100,              // each section of the range ruler
  maxRange: 3,
  arcHalfAngle: 40,            // primary firing arc = 80°
  templateWidth: 20,
  straightPerSpeed: 40,        // straight template length = speed * 40
  bankRadius: { 1: 80, 2: 130, 3: 180 },   // centre-line radius of 45° bank templates
  turnRadius: { 1: 35, 2: 62.5, 3: 90 },   // centre-line radius of 90° turn templates
  setupDepth: 1,               // deploy within Range N of your edge
  obstacleCount: 6,
  obstacleEdgeClearance: 2,    // obstacles not within Range 1-2 of any edge
  recommendedPoints: 100,
};

// Six asteroid outlines (local coords, mm, roughly centred on 0,0).
export const ASTEROIDS = [
  [[-38,-10],[-22,-34],[8,-38],[34,-20],[40,8],[22,32],[-6,36],[-32,22]],
  [[-30,-6],[-16,-28],[14,-26],[30,-4],[24,22],[-2,30],[-26,18]],
  [[-44,-4],[-30,-26],[-2,-30],[26,-24],[44,-2],[34,22],[6,28],[-24,24]],
  [[-24,-12],[-8,-26],[16,-20],[26,2],[14,22],[-10,24],[-26,8]],
  [[-36,-18],[-10,-30],[22,-28],[38,-6],[30,20],[4,32],[-22,26],[-38,6]],
  [[-28,-20],[2,-32],[28,-16],[32,12],[10,30],[-18,26],[-32,4]],
];
