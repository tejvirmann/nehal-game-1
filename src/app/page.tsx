"use client";

import { useEffect, useRef, useState } from "react";
import { Game } from "@/engine/game";

interface MusicTrack {
  name: string;
  path: string;
}

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [started, setStarted] = useState(false);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string>("");

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

    // Stop music when ESC exits pointer lock
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

  const handleStart = () => {
    if (gameRef.current) {
      gameRef.current.setBackgroundTrack(selectedTrack);
      gameRef.current.start();
      canvasRef.current?.requestPointerLock();
      setStarted(true);
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", cursor: "none" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
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
          }}
          onClick={handleStart}
        >
          <h1
            style={{
              fontFamily: "monospace",
              fontSize: "64px",
              color: "#ff3333",
              textShadow: "0 0 20px #ff0000, 0 0 40px #cc0000",
              margin: "0 0 5px 0",
              letterSpacing: "6px",
            }}
          >
            NEHAL DOOM
          </h1>
          <p style={{ fontFamily: "monospace", fontSize: "16px", color: "#888", margin: "5px 0" }}>
            Save the Princess from Bowser Epstein
          </p>

          <div
            style={{
              fontFamily: "monospace",
              fontSize: "13px",
              color: "#666",
              margin: "15px 0",
              textAlign: "center",
              lineHeight: "1.6",
            }}
          >
            <p>WASD - Move | Mouse - Look | Click - Shoot</p>
            <p>Find the mansion, kill Bowser, rescue the princess!</p>
            <p>Collect green ammo drops to resupply</p>
            <p style={{ color: "#990" }}>Yellow tiles = Stairs between floors</p>
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
              fontSize: "28px",
              color: "#fff",
              background: "#aa0000",
              border: "3px solid #ff3333",
              padding: "12px 50px",
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

          <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#444", marginTop: "15px", textAlign: "center" }}>
            <p>Add sounds to public/sounds/ | Add music to public/music/</p>
          </div>
        </div>
      )}
    </div>
  );
}
