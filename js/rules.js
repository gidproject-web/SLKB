/* Snake & Ladder: Knowledge Battle - mesin aturan murni, bisa diuji dengan Node. */
(function (root, factory) {
  const API = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.SLRules = API;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const LADDER_PAIRS = Object.freeze([[3,22],[8,30],[20,41],[28,55],[43,71],[57,76],[70,91],[80,99]]);
  const SNAKE_PAIRS = Object.freeze([[98,78],[95,56],[88,67],[74,53],[62,19],[49,11],[36,6]]);
  const LADDERS = Object.freeze(Object.fromEntries(LADDER_PAIRS));
  const SNAKES = Object.freeze(Object.fromEntries(SNAKE_PAIRS));
  const PAIRS = Object.freeze({ ladders: LADDER_PAIRS, snakes: SNAKE_PAIRS });
  const COLORS = Object.freeze(['#ec3659','#2778fb','#23be5d','#f2bd26','#a356ee','#f58b25']);
  const NAMES = Object.freeze(['Tim Merah','Tim Biru','Tim Hijau','Tim Kuning','Tim Ungu','Tim Oranye']);

  function squareOf(n) {
    if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error('Nomor kotak harus 1–100');
    const rowBottom = Math.floor((n - 1) / 10);
    const offset = (n - 1) % 10;
    return { row: 9 - rowBottom, col: rowBottom % 2 === 0 ? offset : 9 - offset };
  }
  function squareAt(row, col) {
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 9 || col < 0 || col > 9) throw new Error('Koordinat tidak sah');
    const bottomRow = 9 - row;
    return bottomRow * 10 + (bottomRow % 2 === 0 ? col + 1 : 10 - col);
  }
  function init(names, mode="klasik") {
    if (!Array.isArray(names) || names.length < 2 || names.length > 6) throw new Error('Gunakan 2–6 tim');
    return {
      teams: names.map((name,i) => ({ id:i, name:String(name || NAMES[i]).trim().slice(0,32) || NAMES[i], color: COLORS[i], position:0, correct:0, wrong:0, hits:0 })),
      current:0, turn:0, sixStreak:0, winner:null, finished:false, mode, history:[]
    };
  }
  // Angka 6 hanya boleh menghasilkan dua bonus berturut-turut.
  // Jika muncul 6 untuk ketiga kalinya, lemparan itu HANGUS, tanpa soal dan tanpa gerakan.
  // Gerakan dari dua lemparan 6 sebelumnya tetap sah.
  function forfeitThirdSix(oldState) {
    if (!oldState || oldState.finished || oldState.sixStreak !== 2) throw new Error('Lemparan ketiga angka enam tidak berlaku pada kondisi ini');
    const state={...oldState, teams:oldState.teams.map(t=>({...t})), history:[...oldState.history]};
    const moving=state.teams[state.current], at=moving.position;
    const events=[{type:'third-six',team:moving.id,from:at,to:at}];
    state.turn++;
    state.history.push({turn:state.turn,team:moving.id,roll:6,correct:null,from:at,to:at,events:events.map(e=>({...e}))});
    if(state.history.length>500)state.history=state.history.slice(-500);
    state.sixStreak=0;
    state.current=(state.current+1)%state.teams.length;
    return {state,events};
  }
  // Setelah melewati 100, bidak memantul mundur (tanpa dianggap menang).
  // Contoh: 99 + dadu 5 -> 100, 99, 98, 97, 96.
  // Ular/tangga hanya berlaku di kotak AKHIR, tidak selama langkah perantara.
  function movementPath(from, roll) {
    if (!Number.isInteger(from) || from < 0 || from >= 100) throw new Error('Posisi awal harus 0–99');
    if (!Number.isInteger(roll) || roll < 1 || roll > 6) throw new Error('Dadu harus 1–6');
    return Array.from({length:roll},(_,i)=>{
      const point=from+i+1;
      return point<=100 ? point : 200-point;
    });
  }
  function applyTurn(oldState, { roll, correct }) {
    if (!oldState || oldState.finished) throw new Error('Permainan sudah berakhir');
    if (!Number.isInteger(roll) || roll < 1 || roll > 6) throw new Error('Dadu harus 1–6');
    if (typeof correct !== 'boolean') throw new Error('Jawaban benar/salah harus boolean');
    if (roll===6 && oldState.sixStreak===2) return forfeitThirdSix(oldState);
    const state = { ...oldState, teams: oldState.teams.map(t => ({...t})), history:[...oldState.history] };
    const moving = state.teams[state.current];
    const from = moving.position;
    const events = [];
    let landing = from;
    if (!correct) {
      moving.wrong++;
      events.push({ type:'wrong', team:moving.id, from, to:from });
    } else {
      moving.correct++;
    }
    if (correct || state.mode === 'edukatif') {
      {
        const path=movementPath(from, roll);
        landing=path[path.length-1];
        events.push({ type:'advance', team:moving.id, from, to:landing, roll });
        if (from+roll>100) {
          events.push({type:'bounce', team:moving.id, from, peak:100, excess:from+roll-100, to:landing});
        }
        if (LADDERS[landing]) {
          const to=LADDERS[landing];
          events.push({ type:'ladder', team:moving.id, from:landing, to });
          landing=to;
        } else if (SNAKES[landing]) {
          const to=SNAKES[landing];
          events.push({ type:'snake', team:moving.id, from:landing, to });
          landing=to;
        }
        // Benturan dihitung di kotak AKHIR sesudah efek ular/tangga.
        // START (position 0) adalah area bersama, tidak ada benturan.
        if (landing > 0) {
          for (const other of state.teams) {
            if (other.id !== moving.id && other.position === landing) {
              other.position = 0;
              other.hits += 1;
              events.push({ type:'collision', team: moving.id, bumped:other.id, at:landing });
            }
          }
        }
        moving.position = landing;
        if (landing === 100) {
          state.finished = true;
          state.winner = moving.id;
          events.push({ type:'win', team:moving.id });
        }
      }
    }
    state.turn++;
    state.history.push({ turn: state.turn, team: moving.id, roll, correct, from, to: moving.position, events:events.map(e => ({...e})) });
    if (state.history.length > 500) state.history = state.history.slice(-500);
    // Bonus hanya berlaku setelah soal dari angka 6 dijawab BENAR.
    // Jawaban salah (termasuk saat mendapat 6) mengakhiri giliran.
    if (!state.finished && correct && roll===6) {
      state.sixStreak=(oldState.sixStreak||0)+1;
      events.push({type:'bonus-six',team:moving.id,count:state.sixStreak});
    } else {
      state.sixStreak=0;
      if (!state.finished) state.current=(state.current+1)%state.teams.length;
    }
    return { state, events };
  }
  function rankTeams(teams, mode='klasik') {
    if (mode === 'edukatif') return [...teams].sort((a,b) => b.correct - a.correct || b.position - a.position || a.wrong - b.wrong || a.id - b.id);
    return [...teams].sort((a,b) => b.position - a.position || b.correct - a.correct || a.id - b.id);
  }
  return { LADDERS, SNAKES, PAIRS, COLORS, NAMES, squareOf, squareAt, init, applyTurn, forfeitThirdSix, rankTeams, movementPath };
});
