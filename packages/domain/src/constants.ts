// Container playlist constraints
export const CONTAINER_MIN_TRACKS = 40;
export const CONTAINER_MAX_TRACKS = 65;
export const CONTAINER_MAX_OWN_TRACK_RATIO = 0.5;
export const CONTAINER_MAX_SINGLE_NEIGHBOR_TRACKS = 5;
export const CONTAINER_MAX_CONSECUTIVE_OWN_TRACKS = 2;
export const CONTAINER_MAX_CONSECUTIVE_SAME_ARTIST = 2;

// Release cycle
export const RELEASE_CYCLE_WEEKS = 8;

// Scoring ranges
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

// Neighbor intelligence thresholds
export const IDEAL_FOLLOWER_RATIO_MIN = 1.0;
export const IDEAL_FOLLOWER_RATIO_MAX = 10.0;
export const IDEAL_POPULARITY_GAP_MIN = 0;
export const IDEAL_POPULARITY_GAP_MAX = 20;

// Closed loop risk thresholds
export const CLOSED_LOOP_SMALLER_RATIO_HIGH = 0.7;
export const CLOSED_LOOP_SMALLER_RATIO_MEDIUM = 0.5;
