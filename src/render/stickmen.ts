/** Cosmetic Stickman orbit, jump, and attack-state updates for the plasma canvas. */
export type StickmanMotion = {
  angle: number;
  speed: number;
  nextJump: number;
  jumpStart: number;
  struck: boolean;
  phase: number;
};
export function createStickman(index: number, time: number): StickmanMotion {
  return {
    angle: (index * 2.399963229728653) % (2 * Math.PI),
    speed: (index % 2 ? -1 : 1) * (0.27 + (index % 3) * 0.055),
    nextJump: time + 0.8 + (index % 4) * 0.42,
    jumpStart: -1,
    struck: false,
    phase: index * 1.7,
  };
}
export type StickmanPose = {
  angle: number; jump: number; attack: boolean; stride: boolean; strike: boolean;
};
/** Returns a one-frame strike signal; one strike per leap, not per RAF tick. */
export function advanceStickman(agent: StickmanMotion, time: number, dt: number): StickmanPose {
  agent.angle += agent.speed * Math.min(0.1, Math.max(0, dt));
  if (agent.jumpStart < 0 && time >= agent.nextJump) {
    agent.jumpStart = time;
    agent.struck = false;
  }
  const progress = agent.jumpStart < 0 ? -1 : Math.min(1, (time - agent.jumpStart) / 0.72);
  const strike = progress >= 0.4 && !agent.struck && progress < 1;
  if (strike) agent.struck = true;
  const jump = progress >= 0 ? Math.sin(Math.PI * progress) : 0;
  const attack = progress >= 0.32 && progress <= 0.63;
  if (progress >= 1) {
    agent.jumpStart = -1;
    agent.nextJump = time + 1.3 + (agent.phase % 2) * 0.65;
  }
  return {
    angle: agent.angle, jump, attack, strike,
    stride: Math.sin(time * 12 + agent.phase) > 0,
  };
}
