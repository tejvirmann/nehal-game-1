"use client";

import { useEffect, useRef, useState } from "react";
import { Game } from "@/engine/game";

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [started, setStarted] = useState(false);

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

    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      game.stop();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleStart = () => {
    if (gameRef.current) {
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
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.9)",
            cursor: "pointer",
          }}
          onClick={handleStart}
        >
          <h1
            style={{
              fontFamily: "monospace",
              fontSize: "72px",
              color: "#ff3333",
              textShadow: "0 0 20px #ff0000, 0 0 40px #cc0000",
              margin: "0 0 10px 0",
              letterSpacing: "8px",
            }}
          >
            NEHAL DOOM
          </h1>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "18px",
              color: "#888",
              margin: "10px 0",
            }}
          >
            A First-Person Shooter with Funny Sound Effects
          </p>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "14px",
              color: "#666",
              margin: "20px 0",
              textAlign: "center",
              lineHeight: "1.8",
            }}
          >
            <p>WASD - Move | Mouse - Look | Click - Shoot</p>
            <p>Arrow Keys also work for movement and turning</p>
            <p>Kill all enemies to win!</p>
          </div>
          <button
            style={{
              fontFamily: "monospace",
              fontSize: "28px",
              color: "#fff",
              background: "#aa0000",
              border: "3px solid #ff3333",
              padding: "15px 50px",
              cursor: "pointer",
              marginTop: "20px",
              letterSpacing: "4px",
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleStart();
            }}
          >
            PLAY
          </button>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "12px",
              color: "#555",
              marginTop: "30px",
            }}
          >
            Add .mp3/.wav/.ogg files to public/sounds/ for custom hit sounds!
          </p>
        </div>
      )}
    </div>
  );
}
