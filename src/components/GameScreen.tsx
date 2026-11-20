import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Board from './Board';
import SniperScene, { type Box } from './SniperScene';
import PowerPanel from './PowerPanel';
import ResultCard from './ResultCard';
import AdminDock from './AdminDock';
import TrollScare from './TrollScare';
import MoveStrip from './MoveStrip';
import { applyMove, gameResult, initialState, moveNotation, replay, type Color, type Move } from '../lib/chess';
import { type Profile } from '../lib/profile';
import { type Room } from '../lib/lobby';
import { applyShots } from '../lib/shots';
import { applyEvents, fleeList, magicMoves, omegaOf, type Flee, type MagicKind } from '../lib/fairy';
import { refreshAdmin } from '../lib/admin';
import { useAim } from '../lib/aim';
import { playShotSound, primeShot } from '../lib/sound';
import NameTag from './NameTag';

export default function GameScreen({
  room,
  moves,
  profile,
  send,
  onMove,
  onCopy,
  onRematch,
  onLeave,
}: {
  room: Room;
  moves: Move[];
  profile: Profile;
  send: (message: object) => void;
  onMove: (move: Move) => void;
  onCopy: () => void;
  onRematch: () => void;
  onLeave: () => void;
}) {
  const played = useMemo(() => applyEvents(replay(moves), room.magic), [moves, room.magic]);
  const state = useMemo(() => applyShots(played.state, room.shots), [played, room.shots]);
  const magic = played.magic;
  const omega = omegaOf(room.magic);
  const solo = room.solo === true;
  const myIndex = room.players.findIndex((player) => player.id === profile.id);
  const myColor: Color = myIndex === 1 ? 'b' : 'w';
  const opponent = room.players.find((player) => player.id !== profile.id);
  // the merge replaces the engine's verdict: one king, one winner
  const result = omega ? 'omega' : gameResult(state, moves);
  const over = result !== null;

  const [viewPly, setViewPly] = useState(moves.length);
  useEffect(() => {
    setViewPly(moves.length);
  }, [moves.length]);
  const live = viewPly >= moves.length;
  const shown = useMemo(
    () => applyShots(applyEvents(replay(moves.slice(0, viewPly)), room.magic).state, room.shots),
    [moves, viewPly, room.magic, room.shots],
  );
  const step = (delta: number) =>
    setViewPly((ply) => Math.min(moves.length, Math.max(0, ply + delta)));

  const notations = useMemo(() => {
    const list: string[] = [];
    let before = initialState();
    for (const move of moves) {
      list.push(moveNotation(before, move));
      const next = applyMove(before, move.from, move.to, move.promotion);
      if (!next) break;
      before = next;
    }
    return list;
  }, [moves]);

  /* ---------- the admin dock ---------- */

  // the server decides who holds the menu; the dock only appears for that account
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    void refreshAdmin().then(setAdmin);
  }, []);

  const [deck, setDeck] = useState(false);
  const [placing, setPlacing] = useState<MagicKind | null>(null);
  const [pick, setPick] = useState<number | null>(null);

  const dropPiece = (square: number) => {
    if (!placing) return;
    send({ t: 'spawn', kind: placing, square });
    setPlacing(null);
  };

  const tapMagic = (square: number) => {
    const held = magic.get(square);
    if (held) {
      if (held.side !== myColor) return;
      setPick((current) => (current === square ? null : square));
      return;
    }
    if (pick === null) return;
    send({ t: 'magic', from: pick, to: square });
    setPick(null);
  };

  const magicTargets = pick === null ? [] : magicMoves(played.state.board, magic, pick, myColor);

  /* ---------- the sniper scene ---------- */

  const remote = useAim();
  const [scene, setScene] = useState<'zoom' | 'aim' | 'fire' | 'back' | null>(null);
  const [aim, setAim] = useState({ x: 0.5, y: 0.5 });
  const [blast, setBlast] = useState(false);
  const [hit, setHit] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const timers = useRef<number[]>([]);
  const sentAt = useRef(0);

  const later = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  // a piece that has just fled: play its exit once, then forget it
  const [fleeing, setFleeing] = useState<Flee[]>([]);
  const seenFlee = useRef(fleeList(room.magic).length);
  useEffect(() => {
    const list = fleeList(room.magic);
    if (list.length > seenFlee.current) {
      setFleeing(list.slice(seenFlee.current));
      later(1050, () => setFleeing([]));
    }
    seenFlee.current = list.length;
  }, [room.magic]);

  // the troll lands on both screens; older scares are not replayed on rejoin
  const scare = room.scare;
  const [troll, setTroll] = useState<{ face: number; avatar: string | null } | null>(null);
  const seenScare = useRef(0);
  useEffect(() => {
    if (!scare || scare.at === seenScare.current) return;
    seenScare.current = scare.at;
    if (Date.now() - scare.at > 6000) return;
    playShotSound();
    const face = room.players.find((player) => player.id === scare.by)?.avatar ?? null;
    setTroll({ face: scare.face, avatar: face });
    const timer = window.setTimeout(() => setTroll(null), 1650);
    return () => window.clearTimeout(timer);
  }, [scare, room.players]);

  // the sight rides on the real board, so its square is measured, not guessed
  const measure = useCallback(() => {
    const board = document.querySelector('.board');
    if (!board) return;
    const rect = board.getBoundingClientRect();
    setBox({ left: rect.left, top: rect.top, size: rect.width });
  }, []);

  useEffect(() => {
    if (!scene && !remote.on) return;
    primeShot();
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [scene, remote.on, measure]);

  const armSniper = () => {
    if (scene) return;
    clearTimers();
    setBlast(false);
    setDeck(false);
    setPlacing(null);
    measure();
    send({ t: 'aim', x: 0.5, y: 0.5, on: true });
    setScene('zoom');
    later(620, () => setScene('aim'));
  };

  const holdFire = () => {
    clearTimers();
    send({ t: 'aim', x: aim.x, y: aim.y, on: false });
    setScene('back');
    later(560, () => setScene(null));
  };

  const moveSight = (x: number, y: number) => {
    setAim({ x, y });
    const now = Date.now();
    if (now - sentAt.current < 60) return;
    sentAt.current = now;
    send({ t: 'aim', x, y, on: true });
  };

  const fireAt = () => {
    if (scene !== 'aim') return;
    const column = Math.min(7, Math.max(0, Math.floor(aim.x * 8)));
    const row = Math.min(7, Math.max(0, Math.floor(aim.y * 8)));
    const flipped = !solo && myColor === 'b';
    const square = flipped ? (7 - row) * 8 + (7 - column) : row * 8 + column;
    setScene('fire');
    setHit(square);
    // heard on the trigger, not when the server answers
    playShotSound();
    send({ t: 'shoot', square });
    send({ t: 'aim', x: aim.x, y: aim.y, on: false });
    later(1050, () => setScene('back'));
    later(1650, () => {
      setScene(null);
      setHit(null);
    });
  };

  const shots = room.shots?.length ?? 0;
  const seenShots = useRef(shots);
  useEffect(() => {
    if (shots === seenShots.current) return;
    seenShots.current = shots;
    if (scene) return;
    setBlast(true);
    later(1000, () => setBlast(false));
  }, [shots, scene]);

  const winner = omega
    ? omega === 'w'
      ? 'white'
      : 'black'
    : result === 'checkmate'
      ? state.turn === 'w'
        ? 'black'
        : 'white'
      : null;
  const alone = !solo && room.players.length < 2;
  const mySide = myColor === 'w' ? 'white' : 'black';
  const outcome = !winner
    ? 'Draw'
    : omega
      ? 'Super Omega King'
      : solo || alone
        ? `${winner === 'white' ? 'White' : 'Black'} won`
        : winner === mySide
          ? 'You won'
          : 'You lost';
  const score = !winner ? '½-½' : winner === 'white' ? '1-0' : '0-1';
  // solo and abandoned tables have no "you", so they get the quiet treatment
  const verdict = !winner ? 'draw' : solo || alone ? 'neutral' : winner === mySide ? 'win' : 'loss';
  const canRematch = solo || room.players.length >= 2;

  const opponentName = solo ? profile.name : (opponent?.name ?? 'opponent');
  const myName = profile.name;
  const myTag = room.players[myIndex]?.tag ?? profile.tag ?? null;
  const opponentTag = solo ? myTag : (opponent?.tag ?? null);
  const opponentAvatar = solo ? profile.avatar : (opponent?.avatar ?? null);
  const opponentFace = opponentAvatar ? (
    <img src={opponentAvatar} alt="" />
  ) : (
    solo ? 'B' : opponentName.slice(0, 1).toUpperCase()
  );
  const myFace = profile.avatar ? <img src={profile.avatar} alt="" /> : (solo ? 'W' : myName.slice(0, 1).toUpperCase());

  // the shooter plays its own scene; everyone else watches the relayed one
  const viewing = scene ?? (blast ? 'fire' : remote.on ? 'aim' : null);
  const sight = scene ? aim : { x: remote.x, y: remote.y };

  return (
    <>
      <div className={`game${viewing ? ' sniping' : ''}${viewing === 'fire' ? ' firing' : ''}`}>
        <div className="pcard">
          <div className="pfp mid">{opponentFace}</div>
          <div className="meta">
            <strong>
              <NameTag tag={opponentTag} />
              {opponentName}
            </strong>
          </div>
          <button className="chip" onClick={onCopy} aria-label={`Table code ${room.code}, tap to copy`}>
            {room.code}
          </button>
        </div>

        <Board
          state={shown}
          myColor={myColor}
          solo={solo}
          locked={over || !live}
          hit={hit}
          magic={magic}
          magicTargets={magicTargets}
          magicPicked={pick}
          flee={fleeing}
          omega={omega}
          placing={placing !== null}
          onMove={onMove}
          onMagicTap={tapMagic}
          onPlace={dropPiece}
        />

        <div className="pcard">
          <div className="pfp mid">{myFace}</div>
          <div className="meta">
            <strong>
              <NameTag tag={myTag} />
              {myName}
            </strong>
          </div>
        </div>

        <MoveStrip
          notations={notations}
          viewPly={viewPly}
          live={live}
          count={moves.length}
          onJump={() => setViewPly(moves.length)}
          onStep={step}
        />

        {admin && (
          <AdminDock
            sniperOff={scene !== null || over}
            deckOpen={deck}
            placing={placing !== null}
            onSniper={armSniper}
            onDeck={() => {
              setDeck((open) => !open);
              setPlacing(null);
            }}
          />
        )}

        {over && (
          <ResultCard
            result={result ?? ''}
            verdict={verdict}
            outcome={outcome}
            score={score}
            winner={winner}
            canRematch={canRematch}
            onRematch={onRematch}
            onLeave={onLeave}
          />
        )}
      </div>

      {admin && deck && (
        <PowerPanel
          placing={placing}
          onToggle={() => {
            setDeck(false);
            setPlacing(null);
          }}
          onPick={(kind) => {
            setPlacing(kind);
            setPick(null);
            setDeck(false);
          }}
          onCancel={() => setPlacing(null)}
          onTurn={(kind) => send({ t: 'turn', kind })}
          onScare={(face) => send({ t: 'scare', face })}
          onOmega={() => send({ t: 'omega' })}
        />
      )}

      {troll && <TrollScare face={troll.face} avatar={troll.avatar} />}

      {viewing && (
        <SniperScene
          mode={viewing}
          reticle={sight}
          board={box}
          interactive={scene === 'aim'}
          onMove={moveSight}
          onFire={fireAt}
          onHold={holdFire}
        />
      )}
    </>
  );
}
