import { GameMap, RayHit } from "./types";

export function castRay(
  map: GameMap,
  px: number,
  py: number,
  angle: number
): RayHit {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  let mapX = Math.floor(px);
  let mapY = Math.floor(py);

  const deltaDistX = Math.abs(1 / dirX);
  const deltaDistY = Math.abs(1 / dirY);

  let stepX: number, stepY: number;
  let sideDistX: number, sideDistY: number;

  if (dirX < 0) {
    stepX = -1;
    sideDistX = (px - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1 - px) * deltaDistX;
  }

  if (dirY < 0) {
    stepY = -1;
    sideDistY = (py - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1 - py) * deltaDistY;
  }

  let side = 0;
  let hit = false;

  while (!hit) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }

    if (
      mapX < 0 ||
      mapX >= map.width ||
      mapY < 0 ||
      mapY >= map.height
    ) {
      hit = true;
    } else if (map.walls[mapY][mapX] > 0) {
      hit = true;
    }
  }

  let perpDist: number;
  let wallX: number;

  if (side === 0) {
    perpDist = (mapX - px + (1 - stepX) / 2) / dirX;
    wallX = py + perpDist * dirY;
  } else {
    perpDist = (mapY - py + (1 - stepY) / 2) / dirY;
    wallX = px + perpDist * dirX;
  }

  wallX -= Math.floor(wallX);

  return {
    distance: perpDist,
    wallType:
      mapX >= 0 && mapX < map.width && mapY >= 0 && mapY < map.height
        ? map.walls[mapY][mapX]
        : 1,
    side,
    texX: wallX,
    mapX,
    mapY,
  };
}

export function castRays(
  map: GameMap,
  px: number,
  py: number,
  playerAngle: number,
  screenWidth: number,
  fov: number
): RayHit[] {
  const rays: RayHit[] = [];
  for (let x = 0; x < screenWidth; x++) {
    const cameraX = (2 * x) / screenWidth - 1;
    const rayAngle = playerAngle + Math.atan(cameraX * Math.tan(fov / 2));
    const hit = castRay(map, px, py, rayAngle);
    // Fix fisheye
    hit.distance *= Math.cos(rayAngle - playerAngle);
    rays.push(hit);
  }
  return rays;
}
