import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { STORY, stageRoomNumber } from "./config/story.js";

const StoryScene = lazy(() => import("./scene/StoryScene.jsx"));

const nextByStage = { welcome: "room1", room1: "hall1", hall1: "room2", room2: "hall2", hall2: "room3" };
const previousByStage = { room1: "welcome", hall1: "room1", room2: "room1", hall2: "room2", room3: "room2" };

function useAmbientAudio() {
  const ctxRef = useRef(null);
  const musicRef = useRef(null);
  const enabledRef = useRef(false);
  const manualChoiceRef = useRef(false);
  const [enabled, setEnabled] = useState(false);

  const setMusic = useCallback(async (on) => {
    if (STORY.backgroundMusic) {
      if (!musicRef.current) {
        musicRef.current = new Audio(STORY.backgroundMusic);
        musicRef.current.loop = true;
        musicRef.current.volume = 0.28;
      }
      if (on) await musicRef.current.play().catch(() => {});
      else musicRef.current.pause();
      enabledRef.current = on;
      setEnabled(on);
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!ctxRef.current) {
      const context = new AudioContext();
      const master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 780;
      filter.connect(master);
      [130.81, 164.81, 196, 261.63].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const voice = context.createGain();
        oscillator.type = index === 3 ? "sine" : "triangle";
        oscillator.frequency.value = frequency;
        voice.gain.value = index === 3 ? 0.1 : 0.18;
        oscillator.connect(voice);
        voice.connect(filter);
        oscillator.start();
      });
      ctxRef.current = { context, master };
    }
    const { context, master } = ctxRef.current;
    await context.resume();
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(on ? 0.035 : 0, context.currentTime, 0.7);
    enabledRef.current = on;
    setEnabled(on);
  }, []);

  const chime = useCallback((kind = "soft") => {
    if (!enabledRef.current) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = ctxRef.current?.context || new AudioContext();
    if (!ctxRef.current) ctxRef.current = { context, master: null };
    context.resume().catch(() => {});
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const startingPitch = kind === "ring" ? 880 : 540;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(startingPitch, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === "ring" ? 1320 : 720, now + 0.22);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === "ring" ? 0.09 : 0.045, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.58);
  }, []);

  useEffect(() => () => {
    musicRef.current?.pause();
    ctxRef.current?.context.close().catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    manualChoiceRef.current = true;
    setMusic(!enabledRef.current);
  }, [setMusic]);
  const start = useCallback(() => {
    if (!manualChoiceRef.current) setMusic(true);
  }, [setMusic]);

  return { enabled, toggle, start, chime };
}

function WebGLFallback({ stage, onAdvance }) {
  const isHall = stage.startsWith("hall");
  return (
    <div className={`fallback-world ${isHall ? "fallback-hall" : ""}`} aria-hidden="true">
      <div className="fallback-glow" />
      <div className="fallback-back-wall" />
      <div className="fallback-floor" />
      {!isHall && <div className="fallback-door" onClick={onAdvance}><span>✦</span></div>}
      {isHall && <div className="fallback-path" />}
      <div className="fallback-petal p1" /><div className="fallback-petal p2" /><div className="fallback-petal p3" />
    </div>
  );
}

class SceneBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure?.(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function LoadingMark() {
  return <div className="loading-mark"><span className="loading-star">✦</span><span>Preparing your little world</span></div>;
}

function getRoomTitle(stage) {
  if (stage === "room1") return STORY.roomOneTitle;
  if (stage === "room3" || stage === "ending") return "Forever";
  return "";
}

function StageContent({ stage, onAdvance, onApproach, doorPrompt, doorApproaching, ringReady, onYes, onReplay, reducedMotion }) {
  const isRoomOne = stage === "room1";
  const isRoomThree = stage === "room3";
  const isHall = stage.startsWith("hall");
  const roomNumber = stageRoomNumber[stage];
  const textKey = `${stage}-${ringReady}`;

  if (stage === "welcome") return (
    <motion.div className="welcome-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
      <span className="eyebrow"><span /> A story with start and no end <span /></span>
      <h1>{STORY.welcomeTitle.replace("{name}", STORY.princessName)}</h1>
      <p>{STORY.welcomeSubtitle}</p>
      <motion.button className="primary-button enter-button" onClick={doorPrompt ? onAdvance : onApproach} disabled={doorApproaching} whileHover={{ scale: 1.035 }} whileTap={{ scale: 0.98 }}>
        <span>{doorPrompt ? "Enter Our Story" : doorApproaching ? "Walking to the front door..." : "Walk to the front door"}</span><span aria-hidden="true">✧</span>
      </motion.button>
      <div className="welcome-note">YOU STEPPED IN MY LIFE TO MAKE IT HEAVEN</div>
    </motion.div>
  );

  if (stage === "ending") return (
    <motion.div className="ending-card" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 1.2 }}>
      <span className="ending-heart">♥</span>
      <p dir="rtl">{STORY.finalMessage}</p>
      <h2>{STORY.foreverLine}</h2>
      {STORY.yourName && <span className="signature">I loooove you trillion time the size of univrse</span>}
      <button className="quiet-button replay-button" onClick={onReplay}><span>↺</span> Experience it again</button>
    </motion.div>
  );

  if (isHall) return (
    <motion.div key={textKey} className="story-card hallway-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
      <span className="eyebrow">ROOM {roomNumber} OF 3</span>
      <p>{doorApproaching ? "Walking beside the rose path to the next door..." : doorPrompt ? "We've reached the next door. Our story continues just ahead." : stage === "hall1" ? "Every step with you feels like coming home you're my home forever." : "The best part of my story is still ahead."}</p>
      {doorPrompt && <button className="primary-button" onClick={onAdvance}>{stage === "hall1" ? "Enter Room Two" : "Enter the proposal room"}<span> →</span></button>}
    </motion.div>
  );

  if (isRoomThree) return (
    <AnimatePresence mode="wait">
      {!ringReady ? (
        <motion.div key="ring-intro" className="story-card proposal-wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <h2>Something is waiting for you...</h2>
          <span className="waiting-dots"><i /><i /><i /></span>
        </motion.div>
      ) : (
        <motion.div key="proposal" className="story-card proposal-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 1.1 }}>
          <p className="proposal-message" dir="rtl">{STORY.proposalMessage}</p>
          <h2>{STORY.question}</h2>
          <div className="answer-buttons">
            <button className="primary-button" onClick={onYes}>YES! ❤️</button>
            <button className="secondary-button" onClick={onYes}>YES, A MILLION TIMES! 💍</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const message = isRoomOne ? STORY.roomOneMessage : STORY.roomTwoMessage;
  const messageDirection = /[\u0600-\u06ff]/.test(message) ? "rtl" : "ltr";
  const cta = isRoomOne ? "Continue to Room Two" : "Continue to the proposal room";
  return (
    <motion.div key={textKey} className="story-card room-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
      <span className="eyebrow">ROOM {roomNumber} OF 3 {isRoomOne && <><span className="small-star">✦</span> THE FIRST PAGE</>}</span>
      {isRoomOne && <h2 dir="rtl">{STORY.roomOneTitle}</h2>}
      <p className="letter-copy" dir={messageDirection}>{message}</p>
      {doorApproaching && <p className="door-status">Walking to the glowing doorway...</p>}
      {doorPrompt && <button className="primary-button" onClick={onAdvance}>{cta}<span> →</span></button>}
      {!doorPrompt && !doorApproaching && <p className="door-hint">Take your time, then tap the glowing door to continue.</p>}
    </motion.div>
  );
}

export default function App() {
  const [stage, setStage] = useState("welcome");
  const [webgl, setWebgl] = useState(null);
  const [doorApproaching, setDoorApproaching] = useState(false);
  const [doorPrompt, setDoorPrompt] = useState(false);
  const [ringReady, setRingReady] = useState(false);
  const [fireworks, setFireworks] = useState(false);
  const movementRef = useRef({ forward: false, back: false, left: false, right: false });
  const reducedMotion = useReducedMotion();
  const audio = useAmbientAudio();
  const roomNumber = stageRoomNumber[stage];
  const canWalk = ["room1", "hall1", "room2", "hall2", "room3"].includes(stage) && !doorApproaching && !doorPrompt && (stage !== "room3" || ringReady);

  const setMovement = useCallback((direction, pressed) => {
    movementRef.current[direction] = pressed;
  }, []);

  const clearMovement = useCallback(() => {
    movementRef.current = { forward: false, back: false, left: false, right: false };
  }, []);

  const handleDoorReached = useCallback(() => {
    setDoorApproaching(false);
    setDoorPrompt(true);
  }, []);

  const handleSceneFailure = useCallback(() => setWebgl(false), []);

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setWebgl(Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl"))));
    } catch { setWebgl(false); }
  }, []);

  useEffect(() => {
    if (stage !== "room3") { setRingReady(false); return undefined; }
    if (reducedMotion) { setRingReady(true); return undefined; }
    const timer = window.setTimeout(() => setRingReady(true), 3900);
    return () => window.clearTimeout(timer);
  }, [stage, reducedMotion]);

  useEffect(() => {
    if (!doorApproaching || webgl !== false) return undefined;
    const wait = reducedMotion ? 20 : stage.startsWith("hall") ? 4300 : stage === "welcome" ? 1800 : 1650;
    const timer = window.setTimeout(() => {
      setDoorApproaching(false);
      setDoorPrompt(true);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [doorApproaching, stage, reducedMotion, webgl]);

  useEffect(() => {
    if (!canWalk) { clearMovement(); return undefined; }
    const keyMap = { ArrowUp: "forward", w: "forward", W: "forward", ArrowDown: "back", s: "back", S: "back", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
    const onKeyDown = (event) => {
      const direction = keyMap[event.key];
      if (!direction || event.target?.closest?.("input, textarea, select")) return;
      event.preventDefault();
      setMovement(direction, true);
    };
    const onKeyUp = (event) => {
      const direction = keyMap[event.key];
      if (direction) setMovement(direction, false);
    };
    const onBlur = () => clearMovement();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      clearMovement();
    };
  }, [canWalk, setMovement, clearMovement]);

  useEffect(() => {
    if (stage !== "room3") return undefined;
    const timer = window.setTimeout(() => audio.chime("ring"), 1650);
    return () => window.clearTimeout(timer);
  }, [stage, audio.chime]);

  useEffect(() => {
    if (!fireworks) return undefined;
    const timer = window.setTimeout(() => setFireworks(false), 6200);
    return () => window.clearTimeout(timer);
  }, [fireworks]);

  const moveTo = useCallback((target, chime = true) => {
    if (chime) audio.chime("soft");
    setStage(target);
  }, [audio.chime]);

  const approachDoor = useCallback(() => {
    if (doorApproaching || doorPrompt || stage === "room3" || stage === "ending") return;
    if (stage === "welcome") audio.start();
    audio.chime("soft");
    setDoorPrompt(false);
    setDoorApproaching(true);
  }, [stage, doorApproaching, doorPrompt, audio.start, audio.chime]);

  const advance = useCallback(() => {
    if (!doorPrompt) return;
    const target = stage === "welcome" ? "room1" : nextByStage[stage];
    if (!target) return;
    audio.chime("soft");
    setDoorApproaching(target === "hall1" || target === "hall2");
    setDoorPrompt(false);
    setStage(target);
  }, [stage, doorPrompt, audio.chime]);

  const sayYes = useCallback(() => {
    audio.chime("ring");
    setFireworks(true);
    setStage("ending");
  }, [audio.chime]);

  const replay = useCallback(() => {
    setFireworks(false);
    setRingReady(false);
    setDoorApproaching(false);
    setDoorPrompt(false);
    setStage("welcome");
  }, []);

  const back = useCallback(() => {
    const prior = previousByStage[stage];
    if (prior) {
      setDoorApproaching(false);
      setDoorPrompt(false);
      moveTo(prior);
    }
  }, [stage, moveTo]);

  const progress = roomNumber ? Math.round((roomNumber / 3) * 100) : 0;
  const webglFallback = useMemo(() => <WebGLFallback stage={stage} onAdvance={approachDoor} />, [stage, approachDoor]);

  return (
    <main className={`experience stage-${stage} ${reducedMotion ? "reduced-motion" : ""}`} style={{ "--blush": STORY.theme.blush, "--ivory": STORY.theme.ivory, "--champagne": STORY.theme.champagne, "--rose": STORY.theme.rose, "--ink": STORY.theme.ink }}>
      <div className="scene-layer">
        {webgl === false ? webglFallback : webgl === true ? (
            <SceneBoundary fallback={webglFallback} onFailure={handleSceneFailure}>
            <Suspense fallback={<LoadingMark />}>
              <StoryScene stage={stage} onAdvance={approachDoor} onDoorReached={handleDoorReached} doorApproaching={doorApproaching} doorPrompt={doorPrompt} movement={movementRef.current} reducedMotion={reducedMotion} />
            </Suspense>
          </SceneBoundary>
        ) : <LoadingMark />}
      </div>

      <div className="atmosphere-grain" aria-hidden="true" />
      {fireworks && <div className="celebration-layer" aria-hidden="true"><span>♥</span><span>✦</span><span>♥</span><span>✧</span><span>♥</span><span>✦</span><span>♥</span><span>✧</span></div>}

      <header className={`topbar ${stage === "welcome" ? "topbar-welcome" : ""}`}>
        <a className="wordmark" href="#top" onClick={(event) => event.preventDefault()} aria-label="Our story">
          <span className="wordmark-mark">♡</span><span>My princess My world</span>
        </a>
        {stage !== "welcome" && stage !== "ending" && (
          <div className="journey-progress" aria-label={`Room ${roomNumber} of 3`}>
            <div className="journey-label"><span>OUR JOURNEY</span><span>{roomNumber} <i>/</i> 3</span></div>
            <div className="progress-track"><motion.div className="progress-value" animate={{ width: `${progress}%` }} transition={{ duration: 0.75 }} /></div>
          </div>
        )}
        <div className="topbar-actions">
          <button className={`icon-button audio-button ${audio.enabled ? "is-playing" : ""}`} onClick={audio.toggle} aria-label={audio.enabled ? "Mute music" : "Play music"} title={audio.enabled ? "Mute music" : "Play music"}>
            <span className="audio-bars" aria-hidden="true"><i /><i /><i /><i /></span>
            <span className="audio-label">{audio.enabled ? "Sound on" : "Sound off"}</span>
          </button>
          {stage !== "welcome" && stage !== "ending" && <button className="icon-button back-button" onClick={back}><span aria-hidden="true">←</span><span>Back</span></button>}
        </div>
      </header>

      <section className={`content-layer ${stage === "welcome" || stage === "ending" ? "content-centered" : ""}`} aria-live="polite">
        <StageContent stage={stage} onAdvance={advance} onApproach={approachDoor} doorPrompt={doorPrompt} doorApproaching={doorApproaching} ringReady={ringReady} onYes={sayYes} onReplay={replay} reducedMotion={reducedMotion} />
      </section>


      {(stage === "room1" || stage === "room3") && <div className="scene-caption"><span className="caption-line" />{getRoomTitle(stage)}<span className="caption-line" /></div>}
      {stage !== "welcome" && stage !== "ending" && <div className="explore-hint"><span aria-hidden="true">↔</span><span>{stage.startsWith("hall") ? "The rose path will carry you forward" : "Drag to look around · Tap the glowing door when ready"}</span></div>}
      {stage === "welcome" && <div className="welcome-footer"><span>MADE WITH LOVE</span><span>✦</span><span>FOR MY SOUL</span></div>}
      {stage === "ending" && <div className="ending-sparkle sparkle-one">✦</div>}
    </main>
  );
}
