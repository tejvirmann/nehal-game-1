"use client";

import { useEffect, useRef, useState } from "react";
import { Game } from "@/engine/game";

interface MusicTrack {
  name: string;
  path: string;
}

interface JoystickVisual {
  active: boolean;
  baseX: number;
  baseY: number;
  thumbX: number;
  thumbY: number;
}

const JOYSTICK_MAX = 65;
const JOYSTICK_DEAD = 18;

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [started, setStarted] = useState(false);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [isMobile, setIsMobile] = useState(false);
  const [joystickVisual, setJoystickVisual] = useState<JoystickVisual>({
    active: false, baseX: 0, baseY: 0, thumbX: 0, thumbY: 0,
  });

  const joystickRef = useRef({ active: false, touchId: -1, baseX: 0, baseY: 0, thumbX: 0, thumbY: 0 });
  const lookRef = useRef({ active: false, touchId: -1, lastX: 0, lastY: 0, startX: 0, startY: 0, startTime: 0 });
  const shootBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    fetch("/api/music")
      .then((r) => r.json())
      .then((data) => {
        const tracks = (data.tracks || []).filter(
          (t: MusicTrack) => t.name.toLowerCase() !== "mansion"
        );
        setMusicTracks(tracks);
        if (tracks.length > 0) setSelectedTrack(tracks[0].path);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const game = new Game(canvas);
    gameRef.current = game;
    game.loadSounds();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      game.handleKeyDown(e);
    };
    const handleKeyUp = (e: KeyboardEvent) => game.handleKeyUp(e);
    const handleMouseMove = (e: MouseEvent) => game.handleMouseMove(e);
    const handleMouseDown = () => {
      if (game.gameOver || game.gameWon) {
        game.restart();
        return;
      }
      game.handleMouseDown();
    };
    const handleMouseUp = () => game.handleMouseUp();

    const handlePointerLockChange = () => {
      if (!document.pointerLockElement && game.running) {
        game.stopAllMusic();
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    return () => {
      game.stop();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, []);

  // Mobile touch handlers — only active after game starts
  useEffect(() => {
    if (!isMobile || !started) return;
    const game = gameRef.current;
    if (!game) return;

    const updateKeys = () => {
      const joy = joystickRef.current;
      if (!joy.active) {
        game.keys.forward = false;
        game.keys.backward = false;
        game.keys.strafeLeft = false;
        game.keys.strafeRight = false;
        return;
      }
      const dx = joy.thumbX - joy.baseX;
      const dy = joy.thumbY - joy.baseY;
      game.keys.forward = dy < -JOYSTICK_DEAD;
      game.keys.backward = dy > JOYSTICK_DEAD;
      game.keys.strafeLeft = dx < -JOYSTICK_DEAD;
      game.keys.strafeRight = dx > JOYSTICK_DEAD;
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        // Skip touches on the shoot button
        if (shootBtnRef.current && shootBtnRef.current.contains(touch.target as Node)) continue;

        // Tap anywhere to restart when game is over/won
        if (game.gameOver || game.gameWon) {
          game.restart();
          continue;
        }

        const x = touch.clientX;
        const y = touch.clientY;
        const isLeft = x < window.innerWidth * 0.45;

        if (isLeft && !joystickRef.current.active) {
          joystickRef.current = { active: true, touchId: touch.identifier, baseX: x, baseY: y, thumbX: x, thumbY: y };
          setJoystickVisual({ active: true, baseX: x, baseY: y, thumbX: x, thumbY: y });
          updateKeys();
        } else if (!isLeft && !lookRef.current.active) {
          lookRef.current = { active: true, touchId: touch.identifier, lastX: x, lastY: y, startX: x, startY: y, startTime: Date.now() };
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        // Joystick
        if (joystickRef.current.active && touch.identifier === joystickRef.current.touchId) {
          const rawDx = touch.clientX - joystickRef.current.baseX;
          const rawDy = touch.clientY - joystickRef.current.baseY;
          const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
          const clamped = Math.min(dist, JOYSTICK_MAX);
          const angle = Math.atan2(rawDy, rawDx);
          const thumbX = joystickRef.current.baseX + Math.cos(angle) * clamped;
          const thumbY = joystickRef.current.baseY + Math.sin(angle) * clamped;
          joystickRef.current = { ...joystickRef.current, thumbX, thumbY };
          setJoystickVisual((v) => ({ ...v, thumbX, thumbY }));
          updateKeys();
        }

        // Look
        if (lookRef.current.active && touch.identifier === lookRef.current.touchId) {
          const dx = touch.clientX - lookRef.current.lastX;
          game.handleTouchLook(dx);
          lookRef.current.lastX = touch.clientX;
          lookRef.current.lastY = touch.clientY;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        // Joystick released
        if (joystickRef.current.active && touch.identifier === joystickRef.current.touchId) {
          joystickRef.current = { ...joystickRef.current, active: false };
          setJoystickVisual((v) => ({ ...v, active: false }));
          updateKeys();
        }
        // Look released — check for tap-to-shoot
        if (lookRef.current.active && touch.identifier === lookRef.current.touchId) {
          const elapsed = Date.now() - lookRef.current.startTime;
          const dist = Math.sqrt(
            (touch.clientX - lookRef.current.startX) ** 2 +
            (touch.clientY - lookRef.current.startY) ** 2
          );
          if (elapsed < 250 && dist < 25) {
            game.keys.shoot = true;
            setTimeout(() => { if (game) game.keys.shoot = false; }, 120);
          }
          lookRef.current = { ...lookRef.current, active: false };
        }
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: false });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: false });
    document.addEventListener("touchcancel", handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [isMobile, started]);

  const handleStart = () => {
    if (gameRef.current) {
      gameRef.current.setBackgroundTrack(selectedTrack);
      gameRef.current.start();
      if (!isMobile) {
        canvasRef.current?.requestPointerLock();
      }
      setStarted(true);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        cursor: isMobile ? "default" : "none",
        overflow: "hidden",
        touchAction: "none",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", touchAction: "none" }} />

      {/* Floating joystick visual */}
      {isMobile && started && joystickVisual.active && (
        <div
          style={{
            position: "fixed",
            left: joystickVisual.baseX - JOYSTICK_MAX,
            top: joystickVisual.baseY - JOYSTICK_MAX,
            width: JOYSTICK_MAX * 2,
            height: JOYSTICK_MAX * 2,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
            border: "2px solid rgba(255,255,255,0.3)",
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: joystickVisual.thumbX - joystickVisual.baseX + JOYSTICK_MAX - 28,
              top: joystickVisual.thumbY - joystickVisual.baseY + JOYSTICK_MAX - 28,
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.45)",
              border: "2px solid rgba(255,255,255,0.8)",
            }}
          />
        </div>
      )}

      {/* Shoot button */}
      {isMobile && started && (
        <button
          ref={shootBtnRef}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (gameRef.current) gameRef.current.keys.shoot = true;
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (gameRef.current) gameRef.current.keys.shoot = false;
          }}
          style={{
            position: "fixed",
            bottom: 40,
            right: 40,
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: "rgba(180,0,0,0.75)",
            border: "3px solid rgba(255,60,60,0.9)",
            fontSize: "36px",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
            cursor: "pointer",
          }}
        >
          🔫
        </button>
      )}

      {/* Mobile controls hint */}
      {isMobile && started && (
        <div
          style={{
            position: "fixed",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "monospace",
            fontSize: "10px",
            color: "rgba(255,255,255,0.3)",
            pointerEvents: "none",
            zIndex: 50,
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          Left: Move &nbsp;|&nbsp; Right: Look &nbsp;|&nbsp; Tap right / 🔫: Shoot
        </div>
      )}

      {/* Start screen */}
      {!started && (
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.92)",
            cursor: "pointer",
            overflow: "auto",
            padding: "20px",
            boxSizing: "border-box",
          }}
          onClick={handleStart}
        >
          <h1
            style={{
              fontFamily: "monospace",
              fontSize: isMobile ? "36px" : "64px",
              color: "#ff3333",
              textShadow: "0 0 20px #ff0000, 0 0 40px #cc0000",
              margin: "0 0 5px 0",
              letterSpacing: isMobile ? "3px" : "6px",
              textAlign: "center",
            }}
          >
            NEHAL DOOM
          </h1>
          <p style={{ fontFamily: "monospace", fontSize: isMobile ? "13px" : "16px", color: "#888", margin: "5px 0", textAlign: "center" }}>
            Save the Princess from Bowser Epstein
          </p>

          <div
            style={{
              fontFamily: "monospace",
              fontSize: isMobile ? "11px" : "13px",
              color: "#666",
              margin: "15px 0",
              textAlign: "center",
              lineHeight: "1.7",
            }}
          >
            {isMobile ? (
              <>
                <p>Left side: Move &nbsp;|&nbsp; Right side: Look &nbsp;|&nbsp; Tap right or 🔫: Shoot</p>
                <p>Find the mansion, kill Bowser, rescue the princess!</p>
                <p>Collect green ammo drops to resupply</p>
                <p style={{ color: "#990" }}>Yellow tiles = Stairs between floors</p>
              </>
            ) : (
              <>
                <p>WASD - Move &nbsp;|&nbsp; Mouse - Look &nbsp;|&nbsp; Click - Shoot</p>
                <p>Find the mansion, kill Bowser, rescue the princess!</p>
                <p>Collect green ammo drops to resupply</p>
                <p style={{ color: "#990" }}>Yellow tiles = Stairs between floors</p>
              </>
            )}
          </div>

          {/* Music Selection */}
          {musicTracks.length > 0 && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                margin: "15px 0",
                padding: "15px 25px",
                background: "rgba(30, 30, 30, 0.9)",
                border: "2px solid #555",
                borderRadius: "8px",
                cursor: "default",
              }}
            >
              <p style={{ fontFamily: "monospace", fontSize: "14px", color: "#aaa", margin: "0 0 10px 0", textAlign: "center" }}>
                Background Music
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {musicTracks.map((track) => (
                  <label
                    key={track.path}
                    style={{
                      fontFamily: "monospace",
                      fontSize: "14px",
                      color: selectedTrack === track.path ? "#0f0" : "#888",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "4px 8px",
                      background: selectedTrack === track.path ? "rgba(0, 255, 0, 0.1)" : "transparent",
                      borderRadius: "4px",
                    }}
                  >
                    <input
                      type="radio"
                      name="music"
                      value={track.path}
                      checked={selectedTrack === track.path}
                      onChange={() => setSelectedTrack(track.path)}
                      style={{ accentColor: "#0f0" }}
                    />
                    {track.name}
                  </label>
                ))}
                <label
                  style={{
                    fontFamily: "monospace",
                    fontSize: "14px",
                    color: selectedTrack === "" ? "#0f0" : "#888",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "4px 8px",
                    background: selectedTrack === "" ? "rgba(0, 255, 0, 0.1)" : "transparent",
                    borderRadius: "4px",
                  }}
                >
                  <input
                    type="radio"
                    name="music"
                    value=""
                    checked={selectedTrack === ""}
                    onChange={() => setSelectedTrack("")}
                    style={{ accentColor: "#0f0" }}
                  />
                  No Music
                </label>
              </div>
              <p style={{ fontFamily: "monospace", fontSize: "11px", color: "#555", margin: "8px 0 0 0", textAlign: "center" }}>
                Mansion music plays automatically when inside
              </p>
            </div>
          )}

          <button
            style={{
              fontFamily: "monospace",
              fontSize: isMobile ? "22px" : "28px",
              color: "#fff",
              background: "#aa0000",
              border: "3px solid #ff3333",
              padding: isMobile ? "10px 40px" : "12px 50px",
              cursor: "pointer",
              marginTop: "10px",
              letterSpacing: "4px",
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleStart();
            }}
          >
            PLAY
          </button>
        </div>
      )}
    </div>
  );
}
