"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Video, VideoOff, Mic, MicOff } from "lucide-react";
import InterviewerAvatar from "@/components/InterviewerAvatar";

/**
 * Meet-style video-call panel for the interview room (Part 1).
 *  - AI interviewer tile: avatar + speaking animation (no real face — an AI avatar).
 *  - Self tile: the user's own webcam feed (camera off by default; one click to enable).
 * Camera stream is fully torn down when the panel unmounts (i.e. when the
 * interview stage ends) or when the user turns the camera off.
 *
 * Part 2 (future): replace the AI tile with a full 3D talking avatar (lip-synced,
 * dressed in the user's college uniform). See memory part2-3d-avatar.
 */
export default function VideoCallPanel({ persona, isSpeaking, isListening, label = "You" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch {}
      }
      setCameraOn(true);
    } catch {
      setError("Allow camera access in the browser popup, then try again.");
      setCameraOn(false);
    } finally {
      setStarting(false);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (cameraOn) {
      stopCamera();
      setCameraOn(false);
    } else {
      startCamera();
    }
  }, [cameraOn, startCamera, stopCamera]);

  // Tear the camera down on unmount (interview ended / page left).
  useEffect(() => () => stopCamera(), [stopCamera]);

  const tile = {
    position: "relative",
    width: "100%",
    aspectRatio: "4 / 3",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #E3E5F1",
  };
  const badge = {
    position: "absolute",
    left: 8,
    bottom: 8,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 9px",
    borderRadius: 99,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.04em",
    background: "rgba(14, 26, 58, 0.62)",
    color: "#fff",
    backdropFilter: "blur(4px)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* AI interviewer tile */}
      <div
        style={{
          ...tile,
          background: "radial-gradient(120% 120% at 50% 0%, #1A1F4A 0%, #0E1A3A 70%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <InterviewerAvatar persona={persona} isSpeaking={isSpeaking} isListening={false} size={84} />
        <div style={badge}>
          <span
            style={{
              width: 6, height: 6, borderRadius: "50%",
              background: isSpeaking ? "#4ade80" : "#9AA0B8",
            }}
          />
          AI Interviewer
        </div>
        {isSpeaking && (
          <div style={{ ...badge, left: "auto", right: 8, background: "rgba(74, 222, 128, 0.22)", color: "#bbf7d0" }}>
            Speaking
          </div>
        )}
      </div>

      {/* Self tile */}
      <div style={{ ...tile, background: "#0E1A3A" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)", // mirror, like Google Meet
            display: cameraOn ? "block" : "none",
          }}
        />

        {!cameraOn && (
          <div
            style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 10,
              padding: 12, textAlign: "center",
            }}
          >
            <VideoOff size={22} color="#9AA0B8" />
            <button
              type="button"
              onClick={toggleCamera}
              disabled={starting}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 99,
                border: "none", cursor: starting ? "default" : "pointer",
                background: "#4A3DF0", color: "#fff",
                fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                opacity: starting ? 0.7 : 1,
              }}
            >
              <Video size={13} /> {starting ? "Starting…" : "Turn on camera"}
            </button>
            {error && (
              <p style={{ fontSize: 9, color: "#fca5a5", margin: 0, maxWidth: 200, lineHeight: 1.4 }}>{error}</p>
            )}
          </div>
        )}

        {cameraOn && (
          <>
            <div style={badge}>{label}</div>
            <button
              type="button"
              onClick={toggleCamera}
              title="Turn off camera"
              aria-label="Turn off camera"
              style={{
                position: "absolute", top: 8, right: 8,
                width: 30, height: 30, borderRadius: "50%",
                border: "none", cursor: "pointer",
                background: "rgba(14, 26, 58, 0.62)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                backdropFilter: "blur(4px)",
              }}
            >
              <VideoOff size={15} />
            </button>
            {/* Mic status mirrors the interview's listening state */}
            <div
              style={{
                position: "absolute", left: "auto", right: 8, bottom: 8,
                width: 30, height: 30, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isListening ? "rgba(74, 222, 128, 0.85)" : "rgba(229, 72, 77, 0.85)",
                color: "#fff",
              }}
            >
              {isListening ? <Mic size={14} /> : <MicOff size={14} />}
            </div>
            {isListening && (
              <motion.div
                animate={{ opacity: [0.9, 0.3, 0.9] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{ position: "absolute", inset: 0, border: "2px solid #4ade80", borderRadius: 12, pointerEvents: "none" }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
