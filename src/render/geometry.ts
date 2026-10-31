/**
 * Internal render surface: a 150px canvas upscaled to 300px with
 * nearest-neighbour sampling, with the ball given extra headroom for orbiting helpers.
 */

export const PX = 150; // internal canvas (2x integer scale at 300px display)
export const CX = 75;
export const CY = 70;
export const R = 57;
