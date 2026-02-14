import { Player, Enemy, RayHit, GameMap } from "./types";
import { castRays } from "./raycaster";
import { GAME_MAP } from "./map";

const WALL_COLORS: Record<number, [number, number, number]> = {
  1: [139, 69, 19],    // brown
  2: [100, 100, 120],  // stone gray-blue
  3: [160, 40, 40],    // blood red
  4: [60, 80, 60],     // dark green
};

const FOV = Math.PI / 3; // 60 degrees

export function render(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  player: Player,
  enemies: Enemy[],
  map: GameMap
) {
  // Clear
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  // Ceiling
  const ceilGrad = ctx.createLinearGradient(0, 0, 0, height / 2);
  ceilGrad.addColorStop(0, "#1a0a0a");
  ceilGrad.addColorStop(1, "#3a1a1a");
  ctx.fillStyle = ceilGrad;
  ctx.fillRect(0, 0, width, height / 2);

  // Floor
  const floorGrad = ctx.createLinearGradient(0, height / 2, 0, height);
  floorGrad.addColorStop(0, "#2a2a2a");
  floorGrad.addColorStop(1, "#0a0a0a");
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, height / 2, width, height / 2);

  // Cast rays and draw walls
  const rays = castRays(map, player.x, player.y, player.angle, width, FOV);
  const zBuffer: number[] = [];

  for (let x = 0; x < width; x++) {
    const hit = rays[x];
    zBuffer[x] = hit.distance;

    const lineHeight = height / hit.distance;
    const drawStart = Math.max(0, (height - lineHeight) / 2);
    const drawEnd = Math.min(height, (height + lineHeight) / 2);

    const color = WALL_COLORS[hit.wallType] || WALL_COLORS[1];
    const shade = hit.side === 1 ? 0.7 : 1.0;
    const distShade = Math.max(0.15, 1 - hit.distance / 16);

    // Fake texture: vertical stripes based on texX
    const texBrightness = 0.8 + 0.2 * Math.sin(hit.texX * Math.PI * 8);

    const r = Math.floor(color[0] * shade * distShade * texBrightness);
    const g = Math.floor(color[1] * shade * distShade * texBrightness);
    const b = Math.floor(color[2] * shade * distShade * texBrightness);

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);

    // Wall edge highlight
    if (hit.texX < 0.02 || hit.texX > 0.98) {
      ctx.fillStyle = `rgba(0,0,0,0.3)`;
      ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
    }
  }

  // Draw enemies (sorted by distance, far to near)
  const visibleEnemies = enemies
    .map((e) => {
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      let relAngle = angle - player.angle;
      // Normalize angle
      while (relAngle > Math.PI) relAngle -= 2 * Math.PI;
      while (relAngle < -Math.PI) relAngle += 2 * Math.PI;
      return { enemy: e, dist, relAngle };
    })
    .filter((e) => Math.abs(e.relAngle) < FOV / 2 + 0.2 && e.dist > 0.3)
    .sort((a, b) => b.dist - a.dist);

  for (const { enemy, dist, relAngle } of visibleEnemies) {
    const screenX = width / 2 + (relAngle / (FOV / 2)) * (width / 2);
    const spriteHeight = height / dist;
    const spriteWidth = spriteHeight * 0.7;

    const drawStartY = (height - spriteHeight) / 2;

    // Check if enemy is behind walls
    const checkX = Math.floor(screenX);
    if (checkX >= 0 && checkX < width && zBuffer[checkX] < dist) continue;

    const distShade = Math.max(0.2, 1 - dist / 14);

    if (!enemy.alive) {
      // Death animation - shrink and turn red
      const deathProgress = Math.min(1, enemy.deathTimer / 30);
      const shrink = 1 - deathProgress * 0.7;
      const h = spriteHeight * shrink;
      const w = spriteWidth * shrink;
      const y = (height - spriteHeight) / 2 + spriteHeight - h;

      ctx.fillStyle = `rgba(${Math.floor(180 * distShade)}, 0, 0, ${1 - deathProgress})`;
      ctx.fillRect(screenX - w / 2, y, w, h);
      continue;
    }

    // Draw enemy body
    const bodyColor = getEnemyColor(enemy.type);
    const flashR = enemy.hitFlash > 0 ? 255 : bodyColor[0];
    const flashG = enemy.hitFlash > 0 ? 255 : bodyColor[1];
    const flashB = enemy.hitFlash > 0 ? 255 : bodyColor[2];

    const r = Math.floor(flashR * distShade);
    const g = Math.floor(flashG * distShade);
    const b = Math.floor(flashB * distShade);

    // Body
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(
      screenX - spriteWidth / 2,
      drawStartY + spriteHeight * 0.2,
      spriteWidth,
      spriteHeight * 0.6
    );

    // Head
    const headSize = spriteWidth * 0.5;
    ctx.beginPath();
    ctx.arc(
      screenX,
      drawStartY + spriteHeight * 0.15,
      headSize / 2,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fill();

    // Eyes (glowing)
    const eyeGlow = Math.floor(200 * distShade + 55);
    ctx.fillStyle = `rgb(${eyeGlow}, ${Math.floor(eyeGlow * 0.3)}, 0)`;
    const eyeY = drawStartY + spriteHeight * 0.13;
    const eyeSpacing = headSize * 0.25;
    ctx.fillRect(screenX - eyeSpacing - 2, eyeY - 2, 4, 4);
    ctx.fillRect(screenX + eyeSpacing - 2, eyeY - 2, 4, 4);

    // Legs
    ctx.fillStyle = `rgb(${Math.floor(r * 0.6)},${Math.floor(g * 0.6)},${Math.floor(b * 0.6)})`;
    const legTop = drawStartY + spriteHeight * 0.8;
    const legH = spriteHeight * 0.2;
    ctx.fillRect(screenX - spriteWidth * 0.3, legTop, spriteWidth * 0.2, legH);
    ctx.fillRect(screenX + spriteWidth * 0.1, legTop, spriteWidth * 0.2, legH);

    // Health bar
    if (enemy.health < enemy.maxHealth) {
      const barWidth = spriteWidth;
      const barHeight = 4;
      const barY = drawStartY - 10;
      ctx.fillStyle = "#300";
      ctx.fillRect(screenX - barWidth / 2, barY, barWidth, barHeight);
      ctx.fillStyle = "#f00";
      ctx.fillRect(
        screenX - barWidth / 2,
        barY,
        barWidth * (enemy.health / enemy.maxHealth),
        barHeight
      );
    }
  }

  // Draw weapon
  drawWeapon(ctx, width, height, player);

  // Draw HUD
  drawHUD(ctx, width, height, player);

  // Draw crosshair
  ctx.strokeStyle = "#0f0";
  ctx.lineWidth = 2;
  const cx = width / 2;
  const cy = height / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 15, cy);
  ctx.lineTo(cx - 5, cy);
  ctx.moveTo(cx + 5, cy);
  ctx.lineTo(cx + 15, cy);
  ctx.moveTo(cx, cy - 15);
  ctx.lineTo(cx, cy - 5);
  ctx.moveTo(cx, cy + 5);
  ctx.lineTo(cx, cy + 15);
  ctx.stroke();

  // Minimap
  drawMinimap(ctx, width, height, player, enemies, map);
}

function getEnemyColor(type: string): [number, number, number] {
  switch (type) {
    case "imp":
      return [180, 100, 60];
    case "demon":
      return [200, 50, 50];
    case "baron":
      return [100, 180, 80];
    default:
      return [150, 150, 150];
  }
}

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  player: Player
) {
  const bobX = Math.sin(player.bobPhase) * 8;
  const bobY = Math.abs(Math.cos(player.bobPhase)) * 6;

  const wx = width / 2 - 60 + bobX;
  const wy = height - 200 + bobY;

  const recoil = player.shootCooldown > 0 ? Math.min(20, player.shootCooldown * 3) : 0;

  // Muzzle flash
  if (player.shootCooldown > 5) {
    ctx.fillStyle = "#ff0";
    ctx.beginPath();
    ctx.arc(wx + 60, wy - 10 + recoil, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(wx + 60, wy - 10 + recoil, 15, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gun barrel
  ctx.fillStyle = "#555";
  ctx.fillRect(wx + 45, wy - 80 + recoil, 30, 90);

  // Gun body
  ctx.fillStyle = "#666";
  ctx.fillRect(wx + 20, wy + recoil, 80, 50);

  // Gun grip
  ctx.fillStyle = "#443322";
  ctx.fillRect(wx + 40, wy + 40 + recoil, 30, 70);

  // Gun details
  ctx.fillStyle = "#777";
  ctx.fillRect(wx + 50, wy - 70 + recoil, 10, 5);

  // Hand
  ctx.fillStyle = "#d4a574";
  ctx.fillRect(wx + 30, wy + 50 + recoil, 50, 30);
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  player: Player
) {
  // HUD background
  ctx.fillStyle = "rgba(50, 50, 50, 0.85)";
  ctx.fillRect(0, height - 60, width, 60);
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, height - 60, width, 60);

  ctx.font = "bold 20px monospace";

  // Health
  ctx.fillStyle = player.health > 30 ? "#0f0" : "#f00";
  ctx.fillText(`HEALTH: ${player.health}`, 20, height - 25);

  // Health bar
  ctx.fillStyle = "#300";
  ctx.fillRect(20, height - 50, 150, 12);
  ctx.fillStyle = player.health > 30 ? "#0a0" : "#a00";
  ctx.fillRect(20, height - 50, 150 * (player.health / 100), 12);

  // Ammo
  ctx.fillStyle = "#ff0";
  ctx.fillText(`AMMO: ${player.ammo}`, width - 200, height - 25);

  // Ammo bar
  ctx.fillStyle = "#330";
  ctx.fillRect(width - 200, height - 50, 150, 12);
  ctx.fillStyle = "#aa0";
  ctx.fillRect(width - 200, height - 50, 150 * (player.ammo / 50), 12);

  // Kill text
  const aliveCount = GAME_MAP.walls.length; // just use as placeholder
  ctx.fillStyle = "#fff";
  ctx.fillText("WASD + Mouse | Click to Shoot", width / 2 - 150, height - 25);
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  player: Player,
  enemies: Enemy[],
  map: GameMap
) {
  const scale = 6;
  const offsetX = width - map.width * scale - 15;
  const offsetY = 15;

  // Background
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(
    offsetX - 3,
    offsetY - 3,
    map.width * scale + 6,
    map.height * scale + 6
  );

  // Walls
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.walls[y][x] > 0) {
        ctx.fillStyle = "#555";
        ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
      }
    }
  }

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    ctx.fillStyle = "#f00";
    ctx.fillRect(
      offsetX + e.x * scale - 2,
      offsetY + e.y * scale - 2,
      4,
      4
    );
  }

  // Player
  ctx.fillStyle = "#0f0";
  ctx.fillRect(
    offsetX + player.x * scale - 2,
    offsetY + player.y * scale - 2,
    5,
    5
  );

  // Player direction
  ctx.strokeStyle = "#0f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(offsetX + player.x * scale, offsetY + player.y * scale);
  ctx.lineTo(
    offsetX + (player.x + Math.cos(player.angle) * 2) * scale,
    offsetY + (player.y + Math.sin(player.angle) * 2) * scale
  );
  ctx.stroke();
}
