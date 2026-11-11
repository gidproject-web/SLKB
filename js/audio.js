/* Snake & Ladder: Knowledge Battle V1.5.5 — user-provided audio.
   Music starts only after the first user gesture (browser autoplay policy).
   All game effects follow the independent SFX switch; BGM has its own volume.
*/
(() => {
  'use strict';
  const FILES = Object.freeze({
    music: 'assets/audio/bgm.mp3',
    correct: 'assets/audio/correct.mp3',
    wrong: 'assets/audio/wrong.mp3',
    dice: 'assets/audio/dice-roll.mp3',
    click: 'assets/audio/click.mp3',
    victory: 'assets/audio/victory.mp3'
  });
  const EFFECT_LEVEL = Object.freeze({correct:0.78, wrong:0.78, dice:0.84, click:0.86, victory:0.85});
  const EFFECT_DUCK_MS = Object.freeze({correct:1700, wrong:1700, dice:1400, click:230, victory:4300});
  const sounds = Object.create(null);
  let musicEnabled = false;
  let effectsEnabled = true;
  let interacted = false;
  let musicVolume = 20; // 0..100, persisted with game's settings
  let duckTimer = null;
  let ducked = false;
  let duckUntil = 0;

  const clamp = value => Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 20));
  function targetMusicVolume() { return musicVolume / 100; }
  function applyMusicVolume() {
    if (sounds.music) sounds.music.volume = ducked ? targetMusicVolume() * .38 : targetMusicVolume();
  }
  function get(name) {
    if (!Object.hasOwn(FILES,name)) return null;
    if (!sounds[name]) {
      const a = new Audio(FILES[name]);
      a.preload = name === 'music' ? 'none' : 'auto';
      a.loop = name === 'music';
      a.volume = name === 'music' ? targetMusicVolume() : EFFECT_LEVEL[name];
      sounds[name]=a;
    }
    return sounds[name];
  }
  function safePlay(sound) {
    if (!sound) return;
    try {
      const p = sound.play();
      if (p && typeof p.catch === 'function') p.catch(err => console.warn('[SLKB Audio] Audio tidak dapat diputar:', sound.src, err?.message || err));
    } catch (err) { console.warn('[SLKB Audio] Audio tidak dapat diputar:', err?.message || err); }
  }
  function stopMusic() { sounds.music?.pause(); }
  function startMusic() {
    if (!musicEnabled || !interacted || document.hidden) return;
    const track = get('music');
    applyMusicVolume();
    if (track.paused) safePlay(track);
  }
  function setMusicVolume(value) { musicVolume = clamp(value); applyMusicVolume(); }
  function configure(settings) {
    musicEnabled = !!settings?.music;
    effectsEnabled = !!settings?.sfx;
    setMusicVolume(settings?.musicVolume ?? 20);
    if (musicEnabled) startMusic(); else stopMusic();
    if (!effectsEnabled) {
      Object.keys(EFFECT_LEVEL).forEach(name => {
        const sound=sounds[name];
        if (sound) { sound.pause(); try { sound.currentTime=0; } catch {} }
      });
    }
  }
  function gesture() {
    interacted = true;
    startMusic();
  }
  function duckMusic(duration) {
    if (!sounds.music || !musicEnabled) return;
    // Multiple effects may overlap; never restore BGM before the longer effect ends.
    duckUntil = Math.max(duckUntil, Date.now() + duration);
    ducked = true;
    applyMusicVolume();
    clearTimeout(duckTimer);
    const restore = () => {
      const remaining = duckUntil - Date.now();
      if (remaining > 0) { duckTimer = setTimeout(restore, remaining); return; }
      ducked = false;
      applyMusicVolume();
    };
    duckTimer = setTimeout(restore, Math.max(30,duration));
  }
  function playEffect(name, preview=false) {
    if (!Object.hasOwn(EFFECT_LEVEL,name)) return;
    if (!effectsEnabled && !preview) return;
    if (preview) gesture();
    const sound = get(name);
    try { sound.pause(); sound.currentTime=0; } catch {}
    sound.volume = EFFECT_LEVEL[name];
    // Do not duck BGM for rapid menu clicks; they are deliberately subtle.
    if (name !== 'click') duckMusic(EFFECT_DUCK_MS[name]);
    safePlay(sound);
  }
  // One click sound per actionable UI click; works for mouse, touch and keyboard.
  // Skip buttons where an explicit, more important sound plays immediately.
  const EXCLUSIVE_EFFECT_BUTTONS = new Set([
    'rollBtn','quizSubmitBtn','previewCorrectBtn','previewWrongBtn',
    'previewDiceBtn','previewVictoryBtn','previewClickBtn','replayVictoryBtn'
  ]);
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('button, a[href], select, input[type="checkbox"], input[type="radio"], [role="button"]') : null;
    if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true' || EXCLUSIVE_EFFECT_BUTTONS.has(target.id)) return;
    playEffect('click');
  }, {capture:true});
  document.addEventListener('pointerdown', gesture, {capture:true, passive:true});
  document.addEventListener('keydown', gesture, {capture:true});
  document.addEventListener('visibilitychange', () => document.hidden ? stopMusic() : startMusic());
  window.addEventListener('pagehide', stopMusic);
  window.addEventListener('pageshow', startMusic);

  window.SLAudio = Object.freeze({configure, playEffect, startMusic, stopMusic, setMusicVolume});
})();
