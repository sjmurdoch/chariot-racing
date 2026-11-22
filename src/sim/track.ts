// Track geometry for a stadium-shaped circuit around a central barrier (spina).
//
// Coordinates: the ground is the XZ plane with Y up. The spina lies along the
// X axis, centred on the origin. Chariots race anticlockwise seen from above,
// so the spina is always on the driver's left, as in the Circus Maximus.
//
// A position on the track is (progress, offset):
// - progress counts segments travelled and is never wrapped: 0-1 is the
//   first straight (along +X, on the +Z side), 1-2 the far turn, 2-3 the back
//   straight and 3-4 the near turn; 4 is the start of the second lap.
// - offset is the distance in metres outwards from the inner edge of the
//   track. Offset 0 brushes the spina and the turning posts (metae).
//
// Because every lane shares the same progress scale, comparing progress tells
// you who is ahead, and lanes nearer the spina cover a segment in fewer metres.

export interface TrackSpec {
  /** Length of each straight, the distance between the two metae, in metres. */
  straightLength: number;
  /** Distance from the centre of a meta to the inner edge of the track. */
  innerRadius: number;
  /** Width of the track from the inner edge to the outer wall. */
  width: number;
  /** Gap between the inner edge of the track and the spina wall. */
  spinaClearance: number;
}

/** Half the width of the spina, which is also the radius of each meta's base. */
export function spinaHalfWidth(track: TrackSpec): number {
  return track.innerRadius - track.spinaClearance;
}

export interface Pose {
  x: number;
  z: number;
  /** Unit vector in the direction of travel. */
  forwardX: number;
  forwardZ: number;
}

export const SEGMENTS_PER_LAP = 4;

function segmentIndex(progress: number): number {
  const lapSegment = Math.floor(progress) % SEGMENTS_PER_LAP;
  return lapSegment < 0 ? lapSegment + SEGMENTS_PER_LAP : lapSegment;
}

function isTurn(segment: number): boolean {
  return segment % 2 === 1;
}

/** Turning radius of the lane at this offset. */
export function laneRadius(track: TrackSpec, offset: number): number {
  return track.innerRadius + offset;
}

/** Length in metres of one segment of the lane at this offset. */
export function segmentLength(track: TrackSpec, segment: number, offset: number): number {
  return isTurn(segment) ? Math.PI * laneRadius(track, offset) : track.straightLength;
}

/**
 * How sharply the lane at this offset bends, in radians per metre: zero on
 * the straights, 1 / radius in the turns. Every turn bends left.
 */
export function curvature(track: TrackSpec, progress: number, offset: number): number {
  return isTurn(segmentIndex(progress)) ? 1 / laneRadius(track, offset) : 0;
}

/** Length in metres of one lap of the lane at this offset. */
export function lapLength(track: TrackSpec, offset: number): number {
  return 2 * track.straightLength + 2 * Math.PI * laneRadius(track, offset);
}

/** Position and direction of travel at a point on the track. */
export function poseAt(track: TrackSpec, progress: number, offset: number): Pose {
  const segment = segmentIndex(progress);
  const f = progress - Math.floor(progress);
  const half = track.straightLength / 2;
  const r = laneRadius(track, offset);

  switch (segment) {
    case 0: // Home straight, heading +X on the +Z side.
      return { x: -half + f * track.straightLength, z: r, forwardX: 1, forwardZ: 0 };
    case 1: {
      // Far turn around the meta at +X.
      const a = f * Math.PI;
      return {
        x: half + r * Math.sin(a),
        z: r * Math.cos(a),
        forwardX: Math.cos(a),
        forwardZ: -Math.sin(a),
      };
    }
    case 2: // Back straight, heading -X on the -Z side.
      return { x: half - f * track.straightLength, z: -r, forwardX: -1, forwardZ: 0 };
    default: {
      // Near turn around the meta at -X.
      const a = f * Math.PI;
      return {
        x: -half - r * Math.sin(a),
        z: -r * Math.cos(a),
        forwardX: -Math.cos(a),
        forwardZ: Math.sin(a),
      };
    }
  }
}

/**
 * The direction actually travelled, in world X/Z, for a heading measured
 * from the track direction at `pose` (positive turns outwards, to the right).
 */
export function travelDirection(pose: Pose, heading: number): { x: number; z: number } {
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  // The driver's right, with Y up, is (-forwardZ, forwardX).
  return {
    x: pose.forwardX * cos - pose.forwardZ * sin,
    z: pose.forwardZ * cos + pose.forwardX * sin,
  };
}

/**
 * Moves `distance` metres forward along the lane at `offset`, crossing
 * segment boundaries as needed, and returns the new progress.
 */
export function advance(
  track: TrackSpec,
  progress: number,
  offset: number,
  distance: number,
): number {
  let p = progress;
  let remaining = distance;
  // Each pass finishes one segment, so a few iterations suffice per frame.
  for (;;) {
    const segment = segmentIndex(p);
    const length = segmentLength(track, segment, offset);
    const leftInSegment = (Math.floor(p) + 1 - p) * length;
    if (remaining < leftInSegment) return p + remaining / length;
    remaining -= leftInSegment;
    p = Math.floor(p) + 1;
  }
}

/** Number of completed laps. */
export function lapsCompleted(progress: number): number {
  return Math.floor(progress / SEGMENTS_PER_LAP);
}
