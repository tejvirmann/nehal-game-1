import { Player, Enemy, Keys, GameMap } from "./types";
import { GAME_MAP, isWall } from "./map";
import { render } from "./renderer";

const PLAYER_SPEED = 0.06;
const PLAYER_TURN_SPEED = 0.04;
const PLAYER_RADIUS = 0.25;
const SHOOT_COOLDOWN = 8;
const SHOOT_RANGE = 16;
const SHOOT_DAMAGE = 35;
const ENEMY_ATTACK_RANGE = 1.5;

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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.map = GAME_MAP;
    this.soundFiles = [];
    this.running = false;
    this.mouseSensitivity = 0.003;
    this.killCount = 0;
    this.gameOver = false;
    this.gameWon = false;
    this.lastTime = 0;

    this.player = {
      x: this.map.spawnX,
      y: this.map.spawnY,
      angle: this.map.spawnAngle,
      health: 100,
      ammo: 50,
      shooting: false,
      shootCooldown: 0,
      bobPhase: 0,
      velocity: { x: 0, y: 0 },
    };

    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      strafeLeft: false,
      strafeRight: false,
      shoot: false,
    };

    this.enemies = this.spawnEnemies();
  }

  spawnEnemies(): Enemy[] {
    const spawns: { x: number; y: number; type: "imp" | "demon" | "baron" }[] = [
      // Room 1 area
      { x: 5, y: 5, type: "imp" },
      { x: 7, y: 3, type: "imp" },
      // Central area
      { x: 12, y: 6, type: "demon" },
      { x: 14, y: 4, type: "imp" },
      // Middle room
      { x: 10, y: 10, type: "demon" },
      { x: 11, y: 11, type: "imp" },
      // Right area
      { x: 17, y: 5, type: "imp" },
      { x: 20, y: 3, type: "demon" },
      // Bottom section
      { x: 5, y: 15, type: "baron" },
      { x: 10, y: 18, type: "demon" },
      { x: 16, y: 16, type: "imp" },
      { x: 20, y: 15, type: "baron" },
      // More scattered
      { x: 3, y: 20, type: "imp" },
      { x: 20, y: 20, type: "demon" },
      { x: 12, y: 14, type: "imp" },
    ];

    return spawns.map((s) => ({
      x: s.x + 0.5,
      y: s.y + 0.5,
      health: s.type === "baron" ? 150 : s.type === "demon" ? 80 : 40,
      maxHealth: s.type === "baron" ? 150 : s.type === "demon" ? 80 : 40,
      alive: true,
      type: s.type,
      speed: s.type === "demon" ? 0.03 : s.type === "baron" ? 0.02 : 0.025,
      damage: s.type === "baron" ? 20 : s.type === "demon" ? 15 : 8,
      lastAttack: 0,
      attackCooldown: s.type === "baron" ? 60 : 40,
      hitFlash: 0,
      deathTimer: 0,
      sprite: s.type,
    }));
  }

  async loadSounds() {
    try {
      const res = await fetch("/api/sounds");
      const data = await res.json();
      this.soundFiles = data.sounds;
    } catch {
      this.soundFiles = [];
    }
  }

  playHitSound() {
    if (this.soundFiles.length === 0) {
      // Generate a funny synth sound as fallback
      this.playFallbackSound();
      return;
    }
    const randomSound =
      this.soundFiles[Math.floor(Math.random() * this.soundFiles.length)];
    const audio = new Audio(randomSound);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  }

  playFallbackSound() {
    const audioCtx = new AudioContext();
    const type = Math.floor(Math.random() * 5);

    switch (type) {
      case 0: {
        // Slide whistle down
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
        // Boing
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
        // Fart-ish
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
        // High bonk
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
        // Wah wah
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
    const audioCtx = new AudioContext();
    // Gunshot
    const bufferSize = audioCtx.sampleRate * 0.15;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();
  }

  handleKeyDown(e: KeyboardEvent) {
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        this.keys.forward = true;
        break;
      case "KeyS":
      case "ArrowDown":
        this.keys.backward = true;
        break;
      case "KeyA":
        this.keys.strafeLeft = true;
        break;
      case "KeyD":
        this.keys.strafeRight = true;
        break;
      case "ArrowLeft":
        this.keys.left = true;
        break;
      case "ArrowRight":
        this.keys.right = true;
        break;
    }
  }

  handleKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        this.keys.forward = false;
        break;
      case "KeyS":
      case "ArrowDown":
        this.keys.backward = false;
        break;
      case "KeyA":
        this.keys.strafeLeft = false;
        break;
      case "KeyD":
        this.keys.strafeRight = false;
        break;
      case "ArrowLeft":
        this.keys.left = false;
        break;
      case "ArrowRight":
        this.keys.right = false;
        break;
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

  tryShoot() {
    if (this.player.shootCooldown > 0 || this.player.ammo <= 0) return;

    this.player.ammo--;
    this.player.shootCooldown = SHOOT_COOLDOWN;
    this.playShootSound();

    // Check if we hit any enemy
    const cos = Math.cos(this.player.angle);
    const sin = Math.sin(this.player.angle);

    let closestHit: Enemy | null = null;
    let closestDist = SHOOT_RANGE;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > SHOOT_RANGE) continue;

      // Project enemy onto ray direction
      const dot = dx * cos + dy * sin;
      if (dot <= 0) continue;

      // Perpendicular distance from ray to enemy
      const perpDist = Math.abs(dx * sin - dy * cos);
      const hitRadius = 0.5 + 0.1 * (dist / SHOOT_RANGE); // More forgiving at distance

      if (perpDist < hitRadius && dot < closestDist) {
        // Check if wall is in the way
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
        this.player.ammo = Math.min(50, this.player.ammo + 5); // Ammo drop

        // Check win
        if (this.enemies.every((e) => !e.alive)) {
          this.gameWon = true;
        }
      }
    }
  }

  update() {
    if (this.gameOver || this.gameWon) return;

    const p = this.player;

    // Turning with arrow keys
    if (this.keys.left) p.angle -= PLAYER_TURN_SPEED;
    if (this.keys.right) p.angle += PLAYER_TURN_SPEED;

    // Movement
    let moveX = 0;
    let moveY = 0;
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);

    if (this.keys.forward) {
      moveX += cos * PLAYER_SPEED;
      moveY += sin * PLAYER_SPEED;
    }
    if (this.keys.backward) {
      moveX -= cos * PLAYER_SPEED;
      moveY -= sin * PLAYER_SPEED;
    }
    if (this.keys.strafeLeft) {
      moveX += sin * PLAYER_SPEED;
      moveY -= cos * PLAYER_SPEED;
    }
    if (this.keys.strafeRight) {
      moveX -= sin * PLAYER_SPEED;
      moveY += cos * PLAYER_SPEED;
    }

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

    // Update enemies
    for (const enemy of this.enemies) {
      if (enemy.hitFlash > 0) enemy.hitFlash--;

      if (!enemy.alive) {
        enemy.deathTimer++;
        continue;
      }

      // Simple AI: move toward player
      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 20) {
        // Chase player
        const nx = dx / dist;
        const ny = dy / dist;

        const newEX = enemy.x + nx * enemy.speed;
        const newEY = enemy.y + ny * enemy.speed;

        // Enemy wall collision
        if (!isWall(this.map, newEX, enemy.y)) enemy.x = newEX;
        if (!isWall(this.map, enemy.x, newEY)) enemy.y = newEY;

        // Attack if close
        if (dist < ENEMY_ATTACK_RANGE) {
          enemy.lastAttack++;
          if (enemy.lastAttack >= enemy.attackCooldown) {
            enemy.lastAttack = 0;
            p.health -= enemy.damage;
            if (p.health <= 0) {
              p.health = 0;
              this.gameOver = true;
            }
          }
        }
      }
    }
  }

  renderFrame() {
    render(this.ctx, this.canvas.width, this.canvas.height, this.player, this.enemies, this.map);

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
      this.ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.font = "bold 64px monospace";
      this.ctx.fillStyle = "#00ff00";
      this.ctx.textAlign = "center";
      this.ctx.fillText("YOU WIN!", this.canvas.width / 2, this.canvas.height / 2 - 30);
      this.ctx.font = "bold 28px monospace";
      this.ctx.fillStyle = "#fff";
      this.ctx.fillText("All enemies defeated!", this.canvas.width / 2, this.canvas.height / 2 + 30);
      this.ctx.fillText("Click to Play Again", this.canvas.width / 2, this.canvas.height / 2 + 70);
      this.ctx.textAlign = "left";
    }
  }

  restart() {
    this.player = {
      x: this.map.spawnX,
      y: this.map.spawnY,
      angle: this.map.spawnAngle,
      health: 100,
      ammo: 50,
      shooting: false,
      shootCooldown: 0,
      bobPhase: 0,
      velocity: { x: 0, y: 0 },
    };
    this.enemies = this.spawnEnemies();
    this.killCount = 0;
    this.gameOver = false;
    this.gameWon = false;
  }

  gameLoop = () => {
    if (!this.running) return;
    this.update();
    this.renderFrame();
    requestAnimationFrame(this.gameLoop);
  };

  start() {
    this.running = true;
    this.gameLoop();
  }

  stop() {
    this.running = false;
  }
}
