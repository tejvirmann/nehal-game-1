import { Player, Enemy, Keys, GameMap, AmmoPickup, Princess } from "./types";
import { buildFloorMap, isWall, isInMansion, AMMO_SPAWNS, PRINCESS_LOCATION, STAIRS } from "./map";
import { render, loadFaceImage } from "./renderer";

const SUPABASE_BASE = "https://kxqbkbdmwtihdhcwhuxq.supabase.co/storage/v1/object/public/nehal-doom/sounds";

// Audio cache - preloads and reuses audio elements so sounds aren't re-fetched
const audioCache = new Map<string, HTMLAudioElement>();

function getCachedAudio(url: string): HTMLAudioElement {
  let audio = audioCache.get(url);
  if (!audio) {
    audio = new Audio(url);
    audio.preload = "auto";
    audioCache.set(url, audio);
  }
  return audio;
}

function playCachedSound(url: string, volume: number) {
  const cached = getCachedAudio(url);
  // Clone so overlapping plays work (e.g. rapid shooting)
  const clone = cached.cloneNode(true) as HTMLAudioElement;
  clone.volume = volume;
  clone.play().catch(() => {});
}

const PLAYER_SPEED = 0.114;
const PLAYER_TURN_SPEED = 0.05;
const PLAYER_RADIUS = 0.25;
const SHOOT_COOLDOWN = 6;
const SHOOT_RANGE = 16;
const SHOOT_DAMAGE = 35;
const ENEMY_ATTACK_RANGE = 1.5;
const PICKUP_RANGE = 1.0;
const PRINCESS_RESCUE_RANGE = 1.5;
const AMMO_RESPAWN_TIME = 600; // ~10 seconds at 60fps
const STAIR_COOLDOWN = 60; // ~1 second at 60fps

export class Game {
  player: Player;
  enemies: Enemy[];
  keys: Keys;
  map: GameMap;
  soundFiles: string[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  running: boolean;
  mouseSensitivity: number;
  killCount: number;
  gameOver: boolean;
  gameWon: boolean;
  lastTime: number;
  ammoPickups: AmmoPickup[];
  princess: Princess;
  bowserDead: boolean;
  stairCooldown: number;
  onGameOver: (() => void) | null = null;
  onGameWon: (() => void) | null = null;

  // Music
  bgMusic: HTMLAudioElement | null;
  mansionMusic: HTMLAudioElement | null;
  selectedBgTrack: string;
  mansionTrackPath: string;
  inMansion: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.soundFiles = [];
    this.running = false;
    loadFaceImage();
    this.mouseSensitivity = 0.003;
    this.killCount = 0;
    this.gameOver = false;
    this.gameWon = false;
    this.lastTime = 0;
    this.bowserDead = false;
    this.stairCooldown = 0;

    // Music
    this.bgMusic = null;
    this.mansionMusic = null;
    this.selectedBgTrack = "";
    this.mansionTrackPath = `${SUPABASE_BASE}/mansion.m4a`;
    this.inMansion = false;

    this.player = this.createPlayer();
    this.keys = this.createKeys();
    this.map = buildFloorMap(this.player.floor);
    this.enemies = this.spawnEnemies();
    this.ammoPickups = this.spawnAmmoPickups();
    this.princess = { x: PRINCESS_LOCATION.x, y: PRINCESS_LOCATION.y, rescued: false, floor: PRINCESS_LOCATION.floor };
  }

  createPlayer(): Player {
    return {
      x: 3.5,
      y: 3.5,
      angle: 0,
      health: 100,
      ammo: 50,
      shooting: false,
      shootCooldown: 0,
      bobPhase: 0,
      velocity: { x: 0, y: 0 },
      floor: 1,
    };
  }

  createKeys(): Keys {
    return {
      forward: false,
      backward: false,
      left: false,
      right: false,
      strafeLeft: false,
      strafeRight: false,
      shoot: false,
    };
  }

  spawnAmmoPickups(): AmmoPickup[] {
    return AMMO_SPAWNS.map((s, i) => ({
      x: s.x,
      y: s.y,
      amount: 10 + Math.floor(Math.random() * 15),
      active: true,
      respawnTimer: 0,
      bobPhase: i * 0.7,
      floor: s.floor,
    }));
  }

  spawnEnemies(): Enemy[] {
    const spawns: { x: number; y: number; type: "imp" | "demon" | "baron" | "boss" | "bowser"; floor: number }[] = [
      // Outdoor area (floor 1)
      { x: 5, y: 5, type: "imp", floor: 1 },
      { x: 7, y: 3, type: "imp", floor: 1 },
      { x: 12, y: 6, type: "demon", floor: 1 },
      { x: 14, y: 4, type: "imp", floor: 1 },
      { x: 10, y: 10, type: "demon", floor: 1 },
      { x: 11, y: 11, type: "imp", floor: 1 },
      { x: 17, y: 5, type: "imp", floor: 1 },
      { x: 20, y: 3, type: "demon", floor: 1 },
      { x: 5, y: 15, type: "baron", floor: 1 },
      { x: 10, y: 18, type: "demon", floor: 1 },
      { x: 16, y: 16, type: "imp", floor: 1 },
      { x: 20, y: 15, type: "baron", floor: 1 },
      { x: 3, y: 20, type: "imp", floor: 1 },
      { x: 20, y: 20, type: "demon", floor: 1 },
      { x: 12, y: 14, type: "imp", floor: 1 },
      { x: 8, y: 25, type: "imp", floor: 1 },
      { x: 15, y: 30, type: "demon", floor: 1 },
      { x: 5, y: 35, type: "imp", floor: 1 },
      { x: 18, y: 35, type: "baron", floor: 1 },
      { x: 10, y: 28, type: "imp", floor: 1 },
      // Outdoor boss (floor 1)
      { x: 16, y: 21, type: "boss", floor: 1 },
      // Mansion ground floor (floor 1)
      { x: 26, y: 14, type: "demon", floor: 1 },
      { x: 36, y: 14, type: "demon", floor: 1 },
      { x: 30, y: 18, type: "baron", floor: 1 },
      { x: 34, y: 20, type: "imp", floor: 1 },
      { x: 26, y: 22, type: "imp", floor: 1 },
      { x: 35, y: 25, type: "demon", floor: 1 },
      { x: 28, y: 30, type: "baron", floor: 1 },
      // Mansion floor 2
      { x: 30, y: 14, type: "demon", floor: 2 },
      { x: 34, y: 20, type: "baron", floor: 2 },
      { x: 26, y: 25, type: "imp", floor: 2 },
      { x: 33, y: 30, type: "demon", floor: 2 },
      { x: 28, y: 35, type: "baron", floor: 2 },
      { x: 35, y: 33, type: "imp", floor: 2 },
      // Mansion floor 3 (Bowser's lair)
      { x: 30, y: 15, type: "demon", floor: 3 },
      { x: 34, y: 20, type: "baron", floor: 3 },
      { x: 26, y: 25, type: "demon", floor: 3 },
      // BOWSER EPSTEIN - guarding the princess on floor 3
      { x: 31, y: 31, type: "bowser", floor: 3 },
    ];

    const hpMap = { imp: 40, demon: 80, baron: 150, boss: 500, bowser: 800 };
    const speedMap = { imp: 0.045, demon: 0.054, baron: 0.036, boss: 0.027, bowser: 0.0315 };
    const dmgMap = { imp: 8, demon: 15, baron: 20, boss: 35, bowser: 40 };
    const cdMap = { imp: 40, demon: 40, baron: 60, boss: 50, bowser: 45 };

    return spawns.map((s) => ({
      x: s.x + 0.5,
      y: s.y + 0.5,
      health: hpMap[s.type],
      maxHealth: hpMap[s.type],
      alive: true,
      type: s.type,
      speed: speedMap[s.type],
      damage: dmgMap[s.type],
      lastAttack: 0,
      attackCooldown: cdMap[s.type],
      hitFlash: 0,
      deathTimer: 0,
      sprite: s.type,
      floor: s.floor,
    }));
  }

  // Music control
  setBackgroundTrack(trackPath: string) {
    this.selectedBgTrack = trackPath;
  }

  startBackgroundMusic() {
    if (!this.selectedBgTrack) return;
    this.bgMusic = getCachedAudio(this.selectedBgTrack);
    this.bgMusic.loop = true;
    this.bgMusic.volume = 0.4;
    this.bgMusic.currentTime = 0;
    this.bgMusic.play().catch(() => {});
  }

  stopBackgroundMusic() {
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.bgMusic.currentTime = 0;
    }
  }

  startMansionMusic() {
    this.mansionMusic = getCachedAudio(this.mansionTrackPath);
    this.mansionMusic.loop = true;
    this.mansionMusic.volume = 0.5;
    this.mansionMusic.currentTime = 0;
    this.mansionMusic.play().catch(() => {});
  }

  stopMansionMusic() {
    if (this.mansionMusic) {
      this.mansionMusic.pause();
      this.mansionMusic.currentTime = 0;
      this.mansionMusic = null;
    }
  }

  stopAllMusic() {
    this.stopBackgroundMusic();
    this.stopMansionMusic();
  }

  updateMusicZone() {
    const nowInMansion = isInMansion(this.player.x, this.player.y, this.player.floor);
    if (nowInMansion && !this.inMansion) {
      // Entered mansion
      this.inMansion = true;
      if (this.bgMusic) this.bgMusic.pause();
      this.startMansionMusic();
    } else if (!nowInMansion && this.inMansion) {
      // Left mansion
      this.inMansion = false;
      this.stopMansionMusic();
      if (this.bgMusic) this.bgMusic.play().catch(() => {});
    }
  }

  async loadSounds() {
    try {
      const res = await fetch("/api/sounds");
      const data = await res.json();
      this.soundFiles = data.sounds;
      // Preload all sounds into cache
      for (const url of this.soundFiles) {
        getCachedAudio(url);
      }
      // Also preload music tracks
      getCachedAudio(this.mansionTrackPath);
      if (this.selectedBgTrack) getCachedAudio(this.selectedBgTrack);
    } catch {
      this.soundFiles = [];
    }
  }

  playHitSound() {
    if (this.soundFiles.length === 0) {
      this.playFallbackSound();
      return;
    }
    const randomSound =
      this.soundFiles[Math.floor(Math.random() * this.soundFiles.length)];
    playCachedSound(randomSound, 0.6);
  }

  playFallbackSound() {
    const audioCtx = new AudioContext();
    const type = Math.floor(Math.random() * 5);

    switch (type) {
      case 0: {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
        break;
      }
      case 1: {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
        break;
      }
      case 2: {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sawtooth";
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(80, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(60, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
        break;
      }
      case 3: {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "square";
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
        break;
      }
      case 4: {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(500, audioCtx.currentTime + 0.1);
        osc.frequency.linearRampToValueAtTime(300, audioCtx.currentTime + 0.2);
        osc.frequency.linearRampToValueAtTime(450, audioCtx.currentTime + 0.3);
        osc.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
        break;
      }
    }
  }

  playShootSound() {
    playCachedSound(`${SUPABASE_BASE}/discord-notification.m4a`, 0.7);
  }

  playDeathSound() {
    playCachedSound(`${SUPABASE_BASE}/bone-crack.m4a`, 0.8);
  }

  playPickupSound() {
    const audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  }

  playRescueSound() {
    const audioCtx = new AudioContext();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.15 + 0.3);
      osc.start(audioCtx.currentTime + i * 0.15);
      osc.stop(audioCtx.currentTime + i * 0.15 + 0.3);
    });
  }

  handleKeyDown(e: KeyboardEvent) {
    switch (e.code) {
      case "KeyW": case "ArrowUp": this.keys.forward = true; break;
      case "KeyS": case "ArrowDown": this.keys.backward = true; break;
      case "KeyA": this.keys.strafeLeft = true; break;
      case "KeyD": this.keys.strafeRight = true; break;
      case "ArrowLeft": this.keys.left = true; break;
      case "ArrowRight": this.keys.right = true; break;
    }
  }

  handleKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case "KeyW": case "ArrowUp": this.keys.forward = false; break;
      case "KeyS": case "ArrowDown": this.keys.backward = false; break;
      case "KeyA": this.keys.strafeLeft = false; break;
      case "KeyD": this.keys.strafeRight = false; break;
      case "ArrowLeft": this.keys.left = false; break;
      case "ArrowRight": this.keys.right = false; break;
    }
  }

  handleMouseMove(e: MouseEvent) {
    if (document.pointerLockElement === this.canvas) {
      this.player.angle += e.movementX * this.mouseSensitivity;
    }
  }

  handleMouseDown() {
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
      return;
    }
    this.keys.shoot = true;
  }

  handleMouseUp() {
    this.keys.shoot = false;
  }

  handleTouchLook(dx: number) {
    this.player.angle += dx * this.mouseSensitivity * 1.8;
  }

  unlockAudio() {
    // iOS requires audio to be triggered within a user gesture.
    // Ensure mansion track is in cache so it gets unlocked even if loadSounds() hasn't resolved yet.
    getCachedAudio(this.mansionTrackPath);
    // Play all cached HTML audio elements silently to unlock them.
    for (const audio of audioCache.values()) {
      audio.volume = 0;
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
      }).catch(() => {});
    }
    // Also unlock the Web Audio API context (used by fallback/pickup/rescue sounds).
    type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextClass = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      ctx.resume().catch(() => {});
    }
  }

  tryShoot() {
    if (this.player.shootCooldown > 0 || this.player.ammo <= 0) return;

    this.player.ammo--;
    this.player.shootCooldown = SHOOT_COOLDOWN;
    this.playShootSound();

    const cos = Math.cos(this.player.angle);
    const sin = Math.sin(this.player.angle);

    let closestHit: Enemy | null = null;
    let closestDist = SHOOT_RANGE;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      // Only hit enemies on the same floor
      if (enemy.floor !== this.player.floor) continue;

      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > SHOOT_RANGE) continue;

      const dot = dx * cos + dy * sin;
      if (dot <= 0) continue;

      const perpDist = Math.abs(dx * sin - dy * cos);
      const hitRadius = 0.5 + 0.1 * (dist / SHOOT_RANGE);

      if (perpDist < hitRadius && dot < closestDist) {
        let blocked = false;
        const steps = Math.floor(dot * 4);
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const cx = this.player.x + cos * dot * t;
          const cy = this.player.y + sin * dot * t;
          if (isWall(this.map, cx, cy)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          closestHit = enemy;
          closestDist = dot;
        }
      }
    }

    if (closestHit) {
      closestHit.health -= SHOOT_DAMAGE;
      closestHit.hitFlash = 6;
      this.playHitSound();

      if (closestHit.health <= 0) {
        closestHit.alive = false;
        closestHit.deathTimer = 0;
        this.killCount++;
        this.playDeathSound();

        if (closestHit.type === "bowser") {
          this.bowserDead = true;
        }
      }
    }
  }

  checkStairs() {
    if (this.stairCooldown > 0) return;

    const px = Math.floor(this.player.x);
    const py = Math.floor(this.player.y);

    for (const stair of STAIRS) {
      if (px === stair.x && py === stair.y && this.player.floor === stair.fromFloor) {
        this.player.floor = stair.toFloor;
        this.map = buildFloorMap(this.player.floor);
        this.stairCooldown = STAIR_COOLDOWN;
        break;
      }
    }
  }

  checkAmmoPickups() {
    for (const pickup of this.ammoPickups) {
      if (!pickup.active) continue;
      // Only pick up ammo on the same floor
      if (pickup.floor !== this.player.floor) continue;

      const dx = this.player.x - pickup.x;
      const dy = this.player.y - pickup.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < PICKUP_RANGE) {
        pickup.active = false;
        pickup.respawnTimer = AMMO_RESPAWN_TIME;
        this.player.ammo = Math.min(99, this.player.ammo + pickup.amount);
        this.playPickupSound();
      }
    }
  }

  checkPrincessRescue() {
    if (this.princess.rescued || !this.bowserDead) return;
    // Only rescue on same floor
    if (this.princess.floor !== this.player.floor) return;

    const dx = this.player.x - this.princess.x;
    const dy = this.player.y - this.princess.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < PRINCESS_RESCUE_RANGE) {
      this.princess.rescued = true;
      this.gameWon = true;
      this.onGameWon?.();
      this.playRescueSound();
    }
  }

  update(dt: number = 1) {
    if (this.gameOver || this.gameWon) return;

    const p = this.player;

    // Stair cooldown
    if (this.stairCooldown > 0) this.stairCooldown--;

    // Turning
    if (this.keys.left) p.angle -= PLAYER_TURN_SPEED * dt;
    if (this.keys.right) p.angle += PLAYER_TURN_SPEED * dt;

    // Movement
    let moveX = 0;
    let moveY = 0;
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);

    if (this.keys.forward) { moveX += cos * PLAYER_SPEED * dt; moveY += sin * PLAYER_SPEED * dt; }
    if (this.keys.backward) { moveX -= cos * PLAYER_SPEED * dt; moveY -= sin * PLAYER_SPEED * dt; }
    if (this.keys.strafeLeft) { moveX += sin * PLAYER_SPEED * dt; moveY -= cos * PLAYER_SPEED * dt; }
    if (this.keys.strafeRight) { moveX -= sin * PLAYER_SPEED * dt; moveY += cos * PLAYER_SPEED * dt; }

    // Wall collision
    const newX = p.x + moveX;
    const newY = p.y + moveY;

    if (!isWall(this.map, newX + PLAYER_RADIUS * Math.sign(moveX), p.y) &&
        !isWall(this.map, newX - PLAYER_RADIUS * Math.sign(moveX), p.y)) {
      p.x = newX;
    }
    if (!isWall(this.map, p.x, newY + PLAYER_RADIUS * Math.sign(moveY)) &&
        !isWall(this.map, p.x, newY - PLAYER_RADIUS * Math.sign(moveY))) {
      p.y = newY;
    }

    // Head bob
    if (Math.abs(moveX) > 0.001 || Math.abs(moveY) > 0.001) {
      p.bobPhase += 0.15;
    }

    // Shooting
    if (p.shootCooldown > 0) p.shootCooldown--;
    if (this.keys.shoot) {
      this.tryShoot();
    }

    // Check stairs
    this.checkStairs();

    // Check ammo pickups
    this.checkAmmoPickups();

    // Check princess rescue
    this.checkPrincessRescue();

    // Music zones
    this.updateMusicZone();

    // Respawn ammo pickups
    for (const pickup of this.ammoPickups) {
      if (!pickup.active) {
        pickup.respawnTimer--;
        if (pickup.respawnTimer <= 0) {
          pickup.active = true;
          pickup.amount = 10 + Math.floor(Math.random() * 15);
        }
      }
      pickup.bobPhase += 0.05;
    }

    // Update enemies
    for (const enemy of this.enemies) {
      if (enemy.hitFlash > 0) enemy.hitFlash--;

      if (!enemy.alive) {
        enemy.deathTimer++;
        continue;
      }

      // Only chase player if on the same floor
      if (enemy.floor !== this.player.floor) continue;

      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 20) {
        const nx = dx / dist;
        const ny = dy / dist;

        const newEX = enemy.x + nx * enemy.speed * dt;
        const newEY = enemy.y + ny * enemy.speed * dt;

        if (!isWall(this.map, newEX, enemy.y)) enemy.x = newEX;
        if (!isWall(this.map, enemy.x, newEY)) enemy.y = newEY;

        if (dist < ENEMY_ATTACK_RANGE) {
          enemy.lastAttack++;
          if (enemy.lastAttack >= enemy.attackCooldown) {
            enemy.lastAttack = 0;
            p.health -= enemy.damage;
            if (p.health <= 0) {
              p.health = 0;
              this.gameOver = true;
              this.onGameOver?.();
            }
          }
        }
      }
    }
  }

  renderFrame() {
    // Filter entities to only show ones on the current floor
    const visibleEnemies = this.enemies.filter(e => e.floor === this.player.floor);
    const visibleAmmo = this.ammoPickups.filter(a => a.floor === this.player.floor);
    const visiblePrincess = this.princess.floor === this.player.floor
      ? this.princess
      : { ...this.princess, rescued: true }; // hide princess on wrong floor

    render(
      this.ctx,
      this.canvas.width,
      this.canvas.height,
      this.player,
      visibleEnemies,
      this.map,
      visibleAmmo,
      visiblePrincess,
      this.bowserDead
    );

    if (this.gameOver) {
      this.ctx.fillStyle = "rgba(255, 0, 0, 0.4)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.font = "bold 72px monospace";
      this.ctx.fillStyle = "#ff0000";
      this.ctx.textAlign = "center";
      this.ctx.fillText("YOU DIED", this.canvas.width / 2, this.canvas.height / 2 - 30);
      this.ctx.font = "bold 28px monospace";
      this.ctx.fillStyle = "#fff";
      this.ctx.fillText(`Kills: ${this.killCount}`, this.canvas.width / 2, this.canvas.height / 2 + 30);
      this.ctx.fillText("Click to Restart", this.canvas.width / 2, this.canvas.height / 2 + 70);
      this.ctx.textAlign = "left";
    }

    if (this.gameWon) {
      this.ctx.fillStyle = "rgba(255, 192, 203, 0.3)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.font = "bold 52px monospace";
      this.ctx.fillStyle = "#ff69b4";
      this.ctx.textAlign = "center";
      this.ctx.fillText("PRINCESS SAVED!", this.canvas.width / 2, this.canvas.height / 2 - 50);
      this.ctx.font = "bold 36px monospace";
      this.ctx.fillStyle = "#00ff00";
      this.ctx.fillText("YOU WIN!", this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.font = "bold 24px monospace";
      this.ctx.fillStyle = "#fff";
      this.ctx.fillText(`Kills: ${this.killCount}`, this.canvas.width / 2, this.canvas.height / 2 + 40);
      this.ctx.fillText("Click to Play Again", this.canvas.width / 2, this.canvas.height / 2 + 80);
      this.ctx.textAlign = "left";
    }
  }

  restart() {
    this.player = this.createPlayer();
    this.keys = this.createKeys();
    this.map = buildFloorMap(1);
    this.enemies = this.spawnEnemies();
    this.ammoPickups = this.spawnAmmoPickups();
    this.princess = { x: PRINCESS_LOCATION.x, y: PRINCESS_LOCATION.y, rescued: false, floor: PRINCESS_LOCATION.floor };
    this.killCount = 0;
    this.gameOver = false;
    this.gameWon = false;
    this.bowserDead = false;
    this.stairCooldown = 0;
    this.inMansion = false;
    this.stopMansionMusic();
    if (this.running && this.bgMusic) {
      this.bgMusic.currentTime = 0;
      this.bgMusic.play().catch(() => {});
    }
  }

  gameLoop = (timestamp: number) => {
    if (!this.running) return;
    const dt = this.lastTime === 0 ? 1 : Math.min((timestamp - this.lastTime) / (1000 / 60), 3);
    this.lastTime = timestamp;
    this.update(dt);
    this.renderFrame();
    requestAnimationFrame(this.gameLoop);
  };

  start() {
    this.running = true;
    this.unlockAudio();
    this.startBackgroundMusic();
    requestAnimationFrame(this.gameLoop);
  }

  stop() {
    this.running = false;
    this.stopAllMusic();
  }
}
