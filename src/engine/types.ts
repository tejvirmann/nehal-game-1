export interface Player {
  x: number;
  y: number;
  angle: number;
  health: number;
  ammo: number;
  shooting: boolean;
  shootCooldown: number;
  bobPhase: number;
  velocity: { x: number; y: number };
}

export interface Enemy {
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  type: EnemyType;
  speed: number;
  damage: number;
  lastAttack: number;
  attackCooldown: number;
  hitFlash: number;
  deathTimer: number;
  sprite: string;
}

export type EnemyType = "imp" | "demon" | "baron";

export interface GameMap {
  walls: number[][];
  width: number;
  height: number;
  spawnX: number;
  spawnY: number;
  spawnAngle: number;
}

export interface RayHit {
  distance: number;
  wallType: number;
  side: number; // 0 = vertical, 1 = horizontal
  texX: number;
  mapX: number;
  mapY: number;
}

export interface Keys {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  strafeLeft: boolean;
  strafeRight: boolean;
  shoot: boolean;
}
