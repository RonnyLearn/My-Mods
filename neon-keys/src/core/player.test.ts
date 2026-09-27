import { describe, expect, it, vi } from 'vitest';
import { makeSong } from '../music/song';
import { LEAD_IN, NOTE_HIT, NOTE_MISSED, Player, type PlayerOutput } from './player';

const song = () => makeSong('t', ['RH', 'LH'], [
  { midi: 60, time: 0, duration: 0.5, velocity: 80, track: 0 },
  { midi: 48, time: 0, duration: 0.5, velocity: 80, track: 1 },
  { midi: 62, time: 1, duration: 0.5, velocity: 80, track: 0 },
  { midi: 64, time: 2, duration: 0.5, velocity: 80, track: 0 },
], [], 'demo');

function setup() {
  const out: PlayerOutput = { schedule: vi.fn(), stopScheduled: vi.fn(), onJudge: vi.fn(), onEnd: vi.fn() };
  const player = new Player(out);
  player.load(song());
  return { player, out };
}

const run = (p: Player, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.01) p.update(0.01);
};

describe('Player', () => {
  it('autoplays every note in listen mode', () => {
    const { player, out } = setup();
    player.play();
    run(player, LEAD_IN + 3);
    expect(out.schedule).toHaveBeenCalledTimes(4);
    expect(out.onEnd).toHaveBeenCalled();
  });

  it('judges the user part and autoplays the rest in play mode', () => {
    const { player, out } = setup();
    player.mode = 'play';
    player.userTracks = new Set([0]);
    player.play();
    run(player, LEAD_IN + 0.02);
    expect(player.userPress(60)).not.toBeNull(); // on time
    run(player, 1);
    expect(player.userPress(61)).toBeNull(); // wrong key
    run(player, 2);
    expect(out.schedule).toHaveBeenCalledTimes(1); // only the left hand note
    expect(player.state[1]).toBe(NOTE_HIT); // sorted: 48 then 60 at t=0
    expect(player.state[2]).toBe(NOTE_MISSED);
    expect(player.stats.perfect).toBe(1);
    expect(player.stats.miss).toBe(2);
    expect(player.stats.wrong).toBe(1);
  });

  it('waits for the right key in wait mode', () => {
    const { player } = setup();
    player.mode = 'wait';
    player.userTracks = new Set([0]);
    player.play();
    run(player, LEAD_IN + 5);
    expect(player.time).toBeCloseTo(0); // frozen at the first note
    player.userPress(60);
    run(player, 5);
    expect(player.time).toBeCloseTo(1); // now waiting for D4
    player.userPress(62);
    player.userPress(64); // too early for E4 at t=2 → wrong
    expect(player.stats.wrong).toBe(1);
    run(player, 5);
    expect(player.time).toBeCloseTo(2);
  });

  it('respects playback speed', () => {
    const { player } = setup();
    player.speed = 0.5;
    player.play();
    run(player, 1);
    expect(player.time).toBeCloseTo(-LEAD_IN + 0.5, 1);
  });
});
