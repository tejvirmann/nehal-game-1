import { Player, Enemy, GameMap, AmmoPickup, Princess } from "./types";
import { castRays } from "./raycaster";

const WALL_COLORS: Record<number, [number, number, number]> = {
  1: [139, 69, 19],    // brown outdoor
  2: [100, 100, 120],  // stone gray-blue
  3: [160, 40, 40],    // blood red
  4: [60, 80, 60],     // dark green
  5: [180, 160, 120],  // mansion exterior (sandstone)
  6: [120, 80, 60],    // mansion interior (dark wood)
  7: [255, 255, 80],   // stairs (bright yellow - very visible!)
};

const FOV = Math.PI / 3;

let faceImg: HTMLImageElement | null = null;
let faceLoaded = false;

export function loadFaceImage() {
  if (faceImg) return;
  faceImg = new Image();
  faceImg.onload = () => { faceLoaded = true; };
  faceImg.src = "/face.png";
}

// Check if player is inside the mansion bounds
function playerInMansion(player: Player): boolean {
  if (player.floor > 1) return true;
  return player.x >= 24 && player.x <= 38 && player.y >= 12 && player.y <= 38;
}

// Get the next objective target for the compass
function getObjectiveTarget(player: Player, bowserDead: boolean, princess: Princess): { x: number; y: number; label: string } | null {
  if (princess.rescued) return null;

  if (!bowserDead) {
    if (player.floor === 1) {
      if (player.x < 24) {
        return { x: 24.5, y: 22.5, label: "MANSION ENTRANCE" };
      } else {
        return { x: 30.5, y: 24.5, label: "STAIRS (F1->F2)" };
      }
    } else if (player.floor === 2) {
      return { x: 34.5, y: 16.5, label: "STAIRS (F2->F3)" };
    } else {
      return { x: 31.5, y: 31.5, label: "BOWSER EPSTEIN" };
    }
  } else {
    if (player.floor === 1) {
      return { x: 30.5, y: 24.5, label: "STAIRS (F1->F2)" };
    } else if (player.floor === 2) {
      return { x: 34.5, y: 16.5, label: "STAIRS (F2->F3)" };
    }
    return { x: princess.x, y: princess.y, label: "PRINCESS" };
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  player: Player,
  enemies: Enemy[],
  map: GameMap,
  ammoPickups: AmmoPickup[],
  princess: Princess,
  bowserDead: boolean
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  const inMansion = playerInMansion(player);

  // Ceiling - different inside mansion vs outside
  const ceilGrad = ctx.createLinearGradient(0, 0, 0, height / 2);
  if (inMansion) {
    // Dark wood ceiling inside mansion
    ceilGrad.addColorStop(0, "#0a0500");
    ceilGrad.addColorStop(1, "#2a1508");
  } else {
    // Open sky outside
    ceilGrad.addColorStop(0, "#1a0a0a");
    ceilGrad.addColorStop(1, "#3a1a1a");
  }
  ctx.fillStyle = ceilGrad;
  ctx.fillRect(0, 0, width, height / 2);

  // Floor - different inside mansion
  const floorGrad = ctx.createLinearGradient(0, height / 2, 0, height);
  if (inMansion) {
    // Dark wood/carpet floor
    floorGrad.addColorStop(0, "#1a1008");
    floorGrad.addColorStop(1, "#0a0804");
  } else {
    floorGrad.addColorStop(0, "#2a2a2a");
    floorGrad.addColorStop(1, "#0a0a0a");
  }
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, height / 2, width, height / 2);

  // Cast rays and draw walls
  const rays = castRays(map, player.x, player.y, player.angle, width, FOV);
  const zBuffer: number[] = [];

  const time = Date.now();
  const stairPulse = 0.7 + 0.3 * Math.sin(time / 200); // pulsing for stairs

  for (let x = 0; x < width; x++) {
    const hit = rays[x];
    zBuffer[x] = hit.distance;

    const lineHeight = height / hit.distance;
    const drawStart = Math.max(0, (height - lineHeight) / 2);
    const drawEnd = Math.min(height, (height + lineHeight) / 2);

    const color = WALL_COLORS[hit.wallType] || WALL_COLORS[1];
    const shade = hit.side === 1 ? 0.7 : 1.0;
    const distShade = Math.max(0.15, 1 - hit.distance / 20);
    const texBrightness = 0.8 + 0.2 * Math.sin(hit.texX * Math.PI * 8);

    let r: number, g: number, b: number;

    if (hit.wallType === 7) {
      // Stairs: bright pulsing yellow - VERY visible
      r = Math.floor(255 * shade * distShade * stairPulse);
      g = Math.floor(255 * shade * distShade * stairPulse);
      b = Math.floor(40 * shade * distShade);
    } else {
      r = Math.floor(color[0] * shade * distShade * texBrightness);
      g = Math.floor(color[1] * shade * distShade * texBrightness);
      b = Math.floor(color[2] * shade * distShade * texBrightness);
    }

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);

    // Stair glow effect
    if (hit.wallType === 7 && hit.distance < 10) {
      const glowAlpha = Math.max(0, (1 - hit.distance / 10) * 0.3 * stairPulse);
      ctx.fillStyle = `rgba(255, 255, 100, ${glowAlpha})`;
      ctx.fillRect(x, drawStart - 20, 1, drawEnd - drawStart + 40);
    }

    // Edge lines for non-stair walls
    if (hit.wallType !== 7 && (hit.texX < 0.02 || hit.texX > 0.98)) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(x, drawStart, 1, drawEnd - drawStart);
    }
  }

  // Collect all sprites (enemies, ammo, princess) for depth sorting
  interface Sprite {
    type: "enemy" | "ammo" | "princess";
    x: number;
    y: number;
    dist: number;
    relAngle: number;
    data: Enemy | AmmoPickup | Princess;
  }

  const sprites: Sprite[] = [];

  // Enemies
  for (const e of enemies) {
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    let relAngle = angle - player.angle;
    while (relAngle > Math.PI) relAngle -= 2 * Math.PI;
    while (relAngle < -Math.PI) relAngle += 2 * Math.PI;
    if (Math.abs(relAngle) < FOV / 2 + 0.2 && dist > 0.3) {
      sprites.push({ type: "enemy", x: e.x, y: e.y, dist, relAngle, data: e });
    }
  }

  // Ammo pickups
  for (const a of ammoPickups) {
    if (!a.active) continue;
    const dx = a.x - player.x;
    const dy = a.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    let relAngle = angle - player.angle;
    while (relAngle > Math.PI) relAngle -= 2 * Math.PI;
    while (relAngle < -Math.PI) relAngle += 2 * Math.PI;
    if (Math.abs(relAngle) < FOV / 2 + 0.2 && dist > 0.3) {
      sprites.push({ type: "ammo", x: a.x, y: a.y, dist, relAngle, data: a });
    }
  }

  // Princess
  if (!princess.rescued) {
    const dx = princess.x - player.x;
    const dy = princess.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    let relAngle = angle - player.angle;
    while (relAngle > Math.PI) relAngle -= 2 * Math.PI;
    while (relAngle < -Math.PI) relAngle += 2 * Math.PI;
    if (Math.abs(relAngle) < FOV / 2 + 0.2 && dist > 0.3) {
      sprites.push({ type: "princess", x: princess.x, y: princess.y, dist, relAngle, data: princess });
    }
  }

  // Sort far to near
  sprites.sort((a, b) => b.dist - a.dist);

  for (const sprite of sprites) {
    const screenX = width / 2 + (sprite.relAngle / (FOV / 2)) * (width / 2);
    const checkX = Math.floor(screenX);

    if (sprite.type === "enemy") {
      drawEnemy(ctx, width, height, screenX, sprite.dist, sprite.data as Enemy, zBuffer);
    } else if (sprite.type === "ammo") {
      if (checkX >= 0 && checkX < width && zBuffer[checkX] < sprite.dist) continue;
      drawAmmoPickup(ctx, width, height, screenX, sprite.dist, sprite.data as AmmoPickup);
    } else if (sprite.type === "princess") {
      if (checkX >= 0 && checkX < width && zBuffer[checkX] < sprite.dist) continue;
      drawPrincess(ctx, width, height, screenX, sprite.dist, bowserDead);
    }
  }

  // Draw weapon
  drawWeapon(ctx, width, height, player);

  // Draw HUD
  drawHUD(ctx, width, height, player, bowserDead, princess);

  // Draw crosshair
  ctx.strokeStyle = "#0f0";
  ctx.lineWidth = 2;
  const cx = width / 2;
  const cy = height / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 15, cy); ctx.lineTo(cx - 5, cy);
  ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 15, cy);
  ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy - 5);
  ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 15);
  ctx.stroke();

  // Draw objective compass
  drawObjectiveCompass(ctx, width, player, bowserDead, princess);

  // Minimap
  drawMinimap(ctx, width, height, player, enemies, map, ammoPickups, princess);
}

function drawObjectiveCompass(
  ctx: CanvasRenderingContext2D,
  width: number,
  player: Player,
  bowserDead: boolean,
  princess: Princess
) {
  const target = getObjectiveTarget(player, bowserDead, princess);
  if (!target) return;

  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const targetAngle = Math.atan2(dy, dx);
  let relAngle = targetAngle - player.angle;
  while (relAngle > Math.PI) relAngle -= 2 * Math.PI;
  while (relAngle < -Math.PI) relAngle += 2 * Math.PI;

  // Compass bar at top of screen
  const barY = 30;
  const barWidth = 400;
  const barX = width / 2 - barWidth / 2;

  // Background
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(barX - 10, barY - 20, barWidth + 20, 50);

  // Arrow indicator - clamp to bar width
  const arrowX = width / 2 + Math.max(-barWidth / 2, Math.min(barWidth / 2, (relAngle / Math.PI) * barWidth));

  const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 300);

  // Arrow triangle
  ctx.fillStyle = `rgba(255, ${bowserDead ? 105 : 200}, ${bowserDead ? 180 : 0}, ${pulse})`;
  ctx.beginPath();
  ctx.moveTo(arrowX, barY - 5);
  ctx.lineTo(arrowX - 10, barY + 10);
  ctx.lineTo(arrowX + 10, barY + 10);
  ctx.closePath();
  ctx.fill();

  // Center tick
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2, barY - 5);
  ctx.lineTo(width / 2, barY + 5);
  ctx.stroke();

  // Label
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(`${target.label} - ${Math.floor(dist)}m`, width / 2, barY + 25);

  // Direction hint
  if (Math.abs(relAngle) > 0.3) {
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = `rgba(255, 255, 0, ${pulse})`;
    if (relAngle > 0) {
      ctx.fillText(">>>", width / 2 + 120, barY + 5);
    } else {
      ctx.fillText("<<<", width / 2 - 120, barY + 5);
    }
  }

  ctx.textAlign = "left";
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  screenX: number,
  dist: number,
  enemy: Enemy,
  zBuffer: number[]
) {
  const isBoss = enemy.type === "boss" || enemy.type === "bowser";
  const sizeMultiplier = enemy.type === "bowser" ? 3.0 : enemy.type === "boss" ? 2.5 : 1.0;
  const spriteHeight = (height / dist) * sizeMultiplier;
  const spriteWidth = spriteHeight * 0.7;
  const drawStartY = (height - spriteHeight) / 2;

  const checkX = Math.floor(screenX);
  if (checkX >= 0 && checkX < width && zBuffer[checkX] < dist) return;

  const distShade = Math.max(0.2, 1 - dist / 18);

  if (!enemy.alive) {
    const deathProgress = Math.min(1, enemy.deathTimer / 30);
    const shrink = 1 - deathProgress * 0.7;
    const h = spriteHeight * shrink;
    const w = spriteWidth * shrink;
    const y = (height - spriteHeight) / 2 + spriteHeight - h;

    ctx.globalAlpha = 1 - deathProgress;
    if (faceLoaded && faceImg) {
      ctx.save();
      ctx.translate(screenX, y + h / 2);
      ctx.rotate(deathProgress * Math.PI * 3);
      ctx.drawImage(faceImg, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = `rgba(${Math.floor(180 * distShade)}, 0, 0, 1)`;
      ctx.fillRect(screenX - w / 2, y, w, h);
    }
    ctx.globalAlpha = 1;
    return;
  }

  const bodyColor = getEnemyColor(enemy.type);
  const flashR = enemy.hitFlash > 0 ? 255 : bodyColor[0];
  const flashG = enemy.hitFlash > 0 ? 255 : bodyColor[1];
  const flashB = enemy.hitFlash > 0 ? 255 : bodyColor[2];

  const r = Math.floor(flashR * distShade);
  const g = Math.floor(flashG * distShade);
  const b = Math.floor(flashB * distShade);

  // Body
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(screenX - spriteWidth / 2, drawStartY + spriteHeight * 0.35, spriteWidth, spriteHeight * 0.45);

  // Legs
  ctx.fillStyle = `rgb(${Math.floor(r * 0.6)},${Math.floor(g * 0.6)},${Math.floor(b * 0.6)})`;
  const legTop = drawStartY + spriteHeight * 0.8;
  const legH = spriteHeight * 0.2;
  ctx.fillRect(screenX - spriteWidth * 0.3, legTop, spriteWidth * 0.2, legH);
  ctx.fillRect(screenX + spriteWidth * 0.1, legTop, spriteWidth * 0.2, legH);

  // Arms
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(screenX - spriteWidth * 0.6, drawStartY + spriteHeight * 0.4, spriteWidth * 0.15, spriteHeight * 0.3);
  ctx.fillRect(screenX + spriteWidth * 0.45, drawStartY + spriteHeight * 0.4, spriteWidth * 0.15, spriteHeight * 0.3);

  // Bowser: spiky shell on back
  if (enemy.type === "bowser") {
    ctx.fillStyle = `rgb(${Math.floor(50 * distShade)},${Math.floor(120 * distShade)},${Math.floor(30 * distShade)})`;
    const shellW = spriteWidth * 0.9;
    const shellH = spriteHeight * 0.35;
    const shellY = drawStartY + spriteHeight * 0.3;
    ctx.beginPath();
    ctx.ellipse(screenX, shellY + shellH / 2, shellW / 2, shellH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Spikes
    ctx.fillStyle = `rgb(${Math.floor(200 * distShade)},${Math.floor(200 * distShade)},${Math.floor(50 * distShade)})`;
    for (let i = -2; i <= 2; i++) {
      const spikeX = screenX + i * (shellW * 0.15);
      ctx.beginPath();
      ctx.moveTo(spikeX - 5, shellY);
      ctx.lineTo(spikeX, shellY - spriteHeight * 0.12);
      ctx.lineTo(spikeX + 5, shellY);
      ctx.fill();
    }
  }

  // FACE
  const faceSize = spriteWidth * (isBoss ? 1.0 : 0.7);
  const faceX = screenX - faceSize / 2;
  const faceY = drawStartY - faceSize * 0.05;

  if (faceLoaded && faceImg) {
    ctx.save();
    if (enemy.hitFlash > 0) {
      ctx.globalAlpha = 0.7;
      ctx.drawImage(faceImg, faceX, faceY, faceSize, faceSize);
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = "#fff";
      ctx.fillRect(faceX, faceY, faceSize, faceSize);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = distShade;
    ctx.drawImage(faceImg, faceX, faceY, faceSize, faceSize);
    ctx.globalAlpha = 1;

    // Bowser: horns instead of crown
    if (enemy.type === "bowser") {
      drawBowserHorns(ctx, screenX, faceY, faceSize, distShade);
    } else if (enemy.type === "boss") {
      drawCrown(ctx, screenX, faceY - faceSize * 0.05, faceSize * 0.8);
    }
    ctx.restore();
  } else {
    const headSize = spriteWidth * 0.5;
    ctx.beginPath();
    ctx.arc(screenX, drawStartY + spriteHeight * 0.15, headSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fill();
  }

  // Labels
  if (enemy.type === "bowser") {
    ctx.font = `bold ${Math.max(14, Math.floor(spriteWidth * 0.12))}px monospace`;
    ctx.fillStyle = "#f80";
    ctx.textAlign = "center";
    ctx.fillText("BOWSER EPSTEIN", screenX, drawStartY - faceSize * 0.2);
    ctx.textAlign = "left";
  } else if (enemy.type === "boss") {
    ctx.font = `bold ${Math.max(12, Math.floor(spriteWidth * 0.15))}px monospace`;
    ctx.fillStyle = "#ff0";
    ctx.textAlign = "center";
    ctx.fillText("THE BIG GUY", screenX, drawStartY - faceSize * 0.15);
    ctx.textAlign = "left";
  }

  // Health bar
  if (enemy.health < enemy.maxHealth) {
    const barWidth = spriteWidth * (isBoss ? 1.2 : 1);
    const barHeight = isBoss ? 8 : 4;
    const barY = drawStartY - (isBoss ? faceSize * 0.3 : 10);
    ctx.fillStyle = "#300";
    ctx.fillRect(screenX - barWidth / 2, barY, barWidth, barHeight);
    ctx.fillStyle = enemy.type === "bowser" ? "#f60" : isBoss ? "#f80" : "#f00";
    ctx.fillRect(screenX - barWidth / 2, barY, barWidth * (enemy.health / enemy.maxHealth), barHeight);
    if (isBoss) {
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(`${enemy.health}/${enemy.maxHealth}`, screenX, barY - 3);
      ctx.textAlign = "left";
    }
  }
}

function drawBowserHorns(ctx: CanvasRenderingContext2D, x: number, y: number, faceSize: number, shade: number) {
  const hornW = faceSize * 0.15;
  const hornH = faceSize * 0.4;
  ctx.fillStyle = `rgb(${Math.floor(220 * shade)},${Math.floor(200 * shade)},${Math.floor(100 * shade)})`;
  // Left horn
  ctx.beginPath();
  ctx.moveTo(x - faceSize * 0.35, y + faceSize * 0.1);
  ctx.lineTo(x - faceSize * 0.45, y - hornH);
  ctx.lineTo(x - faceSize * 0.35 + hornW, y + faceSize * 0.1);
  ctx.fill();
  // Right horn
  ctx.beginPath();
  ctx.moveTo(x + faceSize * 0.35, y + faceSize * 0.1);
  ctx.lineTo(x + faceSize * 0.45, y - hornH);
  ctx.lineTo(x + faceSize * 0.35 - hornW, y + faceSize * 0.1);
  ctx.fill();
}

function drawAmmoPickup(
  ctx: CanvasRenderingContext2D,
  _width: number,
  height: number,
  screenX: number,
  dist: number,
  pickup: AmmoPickup
) {
  const spriteH = (height / dist) * 0.4;
  const spriteW = spriteH * 0.8;
  const bob = Math.sin(pickup.bobPhase) * spriteH * 0.1;
  const baseY = height / 2 + (height / dist) * 0.3 + bob;
  const distShade = Math.max(0.3, 1 - dist / 18);

  // Glow
  ctx.fillStyle = `rgba(255, 200, 0, ${0.15 * distShade})`;
  ctx.beginPath();
  ctx.arc(screenX, baseY, spriteW * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Ammo box
  ctx.fillStyle = `rgb(${Math.floor(50 * distShade)},${Math.floor(150 * distShade)},${Math.floor(50 * distShade)})`;
  ctx.fillRect(screenX - spriteW / 2, baseY - spriteH / 2, spriteW, spriteH);

  // Ammo label
  ctx.fillStyle = `rgb(${Math.floor(255 * distShade)},${Math.floor(255 * distShade)},${Math.floor(0)})`;
  ctx.font = `bold ${Math.max(8, Math.floor(spriteH * 0.4))}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(`${pickup.amount}`, screenX, baseY + spriteH * 0.1);

  // "AMMO" text
  ctx.font = `bold ${Math.max(6, Math.floor(spriteH * 0.25))}px monospace`;
  ctx.fillText("AMMO", screenX, baseY - spriteH * 0.15);
  ctx.textAlign = "left";
}

function drawPrincess(
  ctx: CanvasRenderingContext2D,
  _width: number,
  height: number,
  screenX: number,
  dist: number,
  bowserDead: boolean
) {
  const spriteHeight = (height / dist) * 1.2;
  const spriteWidth = spriteHeight * 0.5;
  const drawStartY = (height - spriteHeight) / 2;
  const distShade = Math.max(0.3, 1 - dist / 18);

  // Glow aura
  if (bowserDead) {
    ctx.fillStyle = `rgba(255, 192, 203, ${0.2 * distShade + 0.05 * Math.sin(Date.now() / 200)})`;
    ctx.beginPath();
    ctx.arc(screenX, drawStartY + spriteHeight * 0.4, spriteWidth * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pink dress (triangle shape)
  const dressTop = drawStartY + spriteHeight * 0.3;
  const dressBot = drawStartY + spriteHeight * 0.85;
  ctx.fillStyle = `rgb(${Math.floor(255 * distShade)},${Math.floor(105 * distShade)},${Math.floor(180 * distShade)})`;
  ctx.beginPath();
  ctx.moveTo(screenX - spriteWidth * 0.15, dressTop);
  ctx.lineTo(screenX + spriteWidth * 0.15, dressTop);
  ctx.lineTo(screenX + spriteWidth * 0.5, dressBot);
  ctx.lineTo(screenX - spriteWidth * 0.5, dressBot);
  ctx.closePath();
  ctx.fill();

  // Dress details
  ctx.fillStyle = `rgb(${Math.floor(255 * distShade)},${Math.floor(150 * distShade)},${Math.floor(200 * distShade)})`;
  ctx.fillRect(screenX - spriteWidth * 0.1, dressTop + (dressBot - dressTop) * 0.3, spriteWidth * 0.2, 3);

  // Head (skin)
  const headRadius = spriteWidth * 0.25;
  ctx.fillStyle = `rgb(${Math.floor(255 * distShade)},${Math.floor(220 * distShade)},${Math.floor(185 * distShade)})`;
  ctx.beginPath();
  ctx.arc(screenX, drawStartY + spriteHeight * 0.2, headRadius, 0, Math.PI * 2);
  ctx.fill();

  // Blonde hair
  ctx.fillStyle = `rgb(${Math.floor(255 * distShade)},${Math.floor(230 * distShade)},${Math.floor(100 * distShade)})`;
  ctx.beginPath();
  ctx.arc(screenX, drawStartY + spriteHeight * 0.17, headRadius * 1.15, -Math.PI, 0);
  ctx.fill();
  // Hair sides
  ctx.fillRect(screenX - headRadius * 1.1, drawStartY + spriteHeight * 0.17, headRadius * 0.3, spriteHeight * 0.2);
  ctx.fillRect(screenX + headRadius * 0.8, drawStartY + spriteHeight * 0.17, headRadius * 0.3, spriteHeight * 0.2);

  // Crown/tiara
  ctx.fillStyle = `rgb(${Math.floor(255 * distShade)},${Math.floor(215 * distShade)},0)`;
  const tiaraY = drawStartY + spriteHeight * 0.1;
  ctx.beginPath();
  ctx.moveTo(screenX - headRadius * 0.6, tiaraY + 5);
  ctx.lineTo(screenX - headRadius * 0.4, tiaraY - 3);
  ctx.lineTo(screenX - headRadius * 0.15, tiaraY + 2);
  ctx.lineTo(screenX, tiaraY - 6);
  ctx.lineTo(screenX + headRadius * 0.15, tiaraY + 2);
  ctx.lineTo(screenX + headRadius * 0.4, tiaraY - 3);
  ctx.lineTo(screenX + headRadius * 0.6, tiaraY + 5);
  ctx.closePath();
  ctx.fill();

  // Eyes
  ctx.fillStyle = `rgb(0,${Math.floor(100 * distShade)},${Math.floor(200 * distShade)})`;
  ctx.fillRect(screenX - headRadius * 0.3 - 1, drawStartY + spriteHeight * 0.19, 3, 3);
  ctx.fillRect(screenX + headRadius * 0.3 - 1, drawStartY + spriteHeight * 0.19, 3, 3);

  // Label
  if (bowserDead) {
    ctx.font = `bold ${Math.max(10, Math.floor(spriteWidth * 0.2))}px monospace`;
    ctx.fillStyle = `rgb(${Math.floor(255 * distShade)},${Math.floor(105 * distShade)},${Math.floor(180 * distShade)})`;
    ctx.textAlign = "center";
    ctx.fillText("RESCUE ME!", screenX, drawStartY - 10);
    ctx.textAlign = "left";
  } else {
    ctx.font = `bold ${Math.max(8, Math.floor(spriteWidth * 0.15))}px monospace`;
    ctx.fillStyle = `rgba(255,255,255,${0.5 * distShade})`;
    ctx.textAlign = "center";
    ctx.fillText("Kill Bowser first!", screenX, drawStartY - 10);
    ctx.textAlign = "left";
  }
}

function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const h = w * 0.5;
  ctx.fillStyle = "#ffd700";
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, y - h * 0.6);
  ctx.lineTo(x - w / 4, y - h * 0.3);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + w / 4, y - h * 0.3);
  ctx.lineTo(x + w / 2, y - h * 0.6);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f00";
  ctx.beginPath();
  ctx.arc(x, y - h * 0.35, w * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#00f";
  ctx.beginPath();
  ctx.arc(x - w * 0.2, y - h * 0.2, w * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w * 0.2, y - h * 0.2, w * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

function getEnemyColor(type: string): [number, number, number] {
  switch (type) {
    case "imp": return [180, 100, 60];
    case "demon": return [200, 50, 50];
    case "baron": return [100, 180, 80];
    case "boss": return [80, 0, 0];
    case "bowser": return [40, 100, 20];
    default: return [150, 150, 150];
  }
}

function drawWeapon(ctx: CanvasRenderingContext2D, width: number, height: number, player: Player) {
  const bobX = Math.sin(player.bobPhase) * 8;
  const bobY = Math.abs(Math.cos(player.bobPhase)) * 6;
  const wx = width / 2 - 60 + bobX;
  const wy = height - 200 + bobY;
  const recoil = player.shootCooldown > 0 ? Math.min(20, player.shootCooldown * 3) : 0;

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

  ctx.fillStyle = "#555";
  ctx.fillRect(wx + 45, wy - 80 + recoil, 30, 90);
  ctx.fillStyle = "#666";
  ctx.fillRect(wx + 20, wy + recoil, 80, 50);
  ctx.fillStyle = "#443322";
  ctx.fillRect(wx + 40, wy + 40 + recoil, 30, 70);
  ctx.fillStyle = "#777";
  ctx.fillRect(wx + 50, wy - 70 + recoil, 10, 5);
  ctx.fillStyle = "#d4a574";
  ctx.fillRect(wx + 30, wy + 50 + recoil, 50, 30);
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  player: Player,
  bowserDead: boolean,
  princess: Princess
) {
  ctx.fillStyle = "rgba(50, 50, 50, 0.85)";
  ctx.fillRect(0, height - 60, width, 60);
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, height - 60, width, 60);

  ctx.font = "bold 20px monospace";

  // Health
  ctx.fillStyle = player.health > 30 ? "#0f0" : "#f00";
  ctx.fillText(`HP: ${player.health}`, 20, height - 25);
  ctx.fillStyle = "#300";
  ctx.fillRect(20, height - 50, 120, 12);
  ctx.fillStyle = player.health > 30 ? "#0a0" : "#a00";
  ctx.fillRect(20, height - 50, 120 * (player.health / 100), 12);

  // Ammo
  ctx.fillStyle = "#ff0";
  ctx.fillText(`AMMO: ${player.ammo}`, 160, height - 25);
  ctx.fillStyle = "#330";
  ctx.fillRect(160, height - 50, 100, 12);
  ctx.fillStyle = "#aa0";
  ctx.fillRect(160, height - 50, 100 * (player.ammo / 99), 12);

  // Floor indicator
  ctx.fillStyle = "#aaf";
  ctx.fillText(`F${player.floor}`, 280, height - 25);

  // Objective with floor info
  ctx.font = "bold 14px monospace";
  if (!bowserDead) {
    ctx.fillStyle = "#f80";
    if (player.floor < 3) {
      ctx.fillText("OBJECTIVE: Go to FLOOR 3 to find Bowser Epstein!", width / 2 - 220, height - 40);
    } else {
      ctx.fillText("OBJECTIVE: Kill Bowser Epstein!", width / 2 - 130, height - 40);
    }
  } else if (!princess.rescued) {
    ctx.fillStyle = "#f0f";
    if (player.floor !== 3) {
      ctx.fillText("OBJECTIVE: Go to FLOOR 3 to rescue the Princess!", width / 2 - 220, height - 40);
    } else {
      ctx.fillText("OBJECTIVE: Rescue the Princess!", width / 2 - 130, height - 40);
    }
  }

  ctx.fillStyle = "#666";
  ctx.font = "12px monospace";
  ctx.fillText("WASD + Mouse | Click to Shoot | Follow compass arrow!", width / 2 - 180, height - 20);
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  width: number,
  _height: number,
  player: Player,
  enemies: Enemy[],
  map: GameMap,
  ammoPickups: AmmoPickup[],
  princess: Princess
) {
  const scale = 4;
  const mapW = map.width * scale;
  const mapH = map.height * scale;
  const offsetX = width - mapW - 10;
  const offsetY = 10;

  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(offsetX - 3, offsetY - 3, mapW + 6, mapH + 6);

  const time = Date.now();
  const stairBlink = Math.sin(time / 150) > 0;

  // Walls with color coding
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.walls[y][x];
      if (tile > 0 && tile !== 7) {
        if (tile === 5) ctx.fillStyle = "#a98";
        else if (tile === 6) ctx.fillStyle = "#864";
        else ctx.fillStyle = "#555";
        ctx.fillRect(offsetX + x * scale, offsetY + y * scale, scale, scale);
      } else if (tile === 7) {
        // Stairs blink bright on minimap
        ctx.fillStyle = stairBlink ? "#ff0" : "#880";
        ctx.fillRect(offsetX + x * scale - 1, offsetY + y * scale - 1, scale + 2, scale + 2);
      }
    }
  }

  // Ammo pickups on minimap
  for (const a of ammoPickups) {
    if (!a.active) continue;
    ctx.fillStyle = "#0f0";
    ctx.fillRect(offsetX + a.x * scale - 1, offsetY + a.y * scale - 1, 3, 3);
  }

  // Princess on minimap (only if on this floor)
  if (!princess.rescued) {
    ctx.fillStyle = "#f0f";
    ctx.fillRect(offsetX + princess.x * scale - 2, offsetY + princess.y * scale - 2, 5, 5);
  }

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.type === "bowser") ctx.fillStyle = "#f80";
    else if (e.type === "boss") ctx.fillStyle = "#ff0";
    else ctx.fillStyle = "#f00";
    const dotSize = (e.type === "boss" || e.type === "bowser") ? 5 : 3;
    ctx.fillRect(
      offsetX + e.x * scale - dotSize / 2,
      offsetY + e.y * scale - dotSize / 2,
      dotSize, dotSize
    );
  }

  // Player
  ctx.fillStyle = "#0f0";
  ctx.fillRect(offsetX + player.x * scale - 2, offsetY + player.y * scale - 2, 5, 5);
  ctx.strokeStyle = "#0f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(offsetX + player.x * scale, offsetY + player.y * scale);
  ctx.lineTo(
    offsetX + (player.x + Math.cos(player.angle) * 2) * scale,
    offsetY + (player.y + Math.sin(player.angle) * 2) * scale
  );
  ctx.stroke();

  // Minimap legend
  ctx.font = "9px monospace";
  ctx.fillStyle = "#0f0"; ctx.fillText("Ammo", offsetX, offsetY + mapH + 12);
  ctx.fillStyle = "#f0f"; ctx.fillText("Princess", offsetX + 35, offsetY + mapH + 12);
  ctx.fillStyle = "#f80"; ctx.fillText("Bowser", offsetX + 80, offsetY + mapH + 12);
  ctx.fillStyle = "#ff0"; ctx.fillText("Stairs", offsetX + 120, offsetY + mapH + 12);

  // Floor label on minimap
  ctx.font = "bold 12px monospace";
  ctx.fillStyle = "#aaf";
  ctx.fillText(`FLOOR ${player.floor}`, offsetX, offsetY - 5);
}
