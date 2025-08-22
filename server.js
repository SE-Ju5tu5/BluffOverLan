// BluffOverLan - Node/Express/Socket.IO Server

const path = require('path');
const os = require('os');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ---- Utilities ----
function getLocalIPs() {
  const ifaces = os.networkInterfaces();
  const addrs = [];
  Object.keys(ifaces).forEach((name) => {
    (ifaces[name] || []).forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) addrs.push(iface.address);
    });
  });
  return addrs;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = array[i]; array[i] = array[j]; array[j] = t;
  }
  return array;
}

function makeDeck() {
  const ranks = [
    { label: '2', v: 2 }, { label: '3', v: 3 }, { label: '4', v: 4 },
    { label: '5', v: 5 }, { label: '6', v: 6 }, { label: '7', v: 7 },
    { label: '8', v: 8 }, { label: '9', v: 9 }, { label: '10', v: 10 },
    { label: 'J', v: 11 }, { label: 'Q', v: 12 }, { label: 'K', v: 13 }, { label: 'A', v: 14 },
  ];
  const suits = [
    { key: 'hearts', sym: '♥' }, { key: 'diamonds', sym: '♦' },
    { key: 'spades', sym: '♠' }, { key: 'clubs', sym: '♣' },
  ];
  const deck = [];
  suits.forEach((s) => {
    ranks.forEach((r) => {
      const id = `${r.v}_${s.key}`;
      deck.push({ id, value: r.label, color: s.key, suit: s.key, numericValue: r.v });
    });
  });
  return shuffle(deck);
}

function toValueNum(val) {
  const s = String(val).trim().toUpperCase();
  if (s === 'A' || s === '14') return 14;
  if (s === 'K' || s === '13') return 13;
  if (s === 'Q' || s === '12') return 12;
  if (s === 'J' || s === '11') return 11;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// ---- Game State ----
/**
 * games: Map<gameId, {
 *   id, hostSocketId, hostName,
 *   state: 'waiting'|'playing'|'finished',
 *   players: Array<{id,name,ready,hand:Card[]}>,
 *   currentPlayerIndex: number,
 *   lastClaim: {count,value} | null,      // kumulative Behauptung in der Runde
 *   lastPlay: {                           // letzte einzelne Ablage (für Bluff-Prüfung)
 *     playerId: string,
 *     playerName: string,
 *     cards: Card[],
 *     claimValue: number
 *   } | null,
 *   pendingWinnerId: string|null,         // ⚠️ NEU: möglicher Sieger (hat 0 Karten), noch nicht final
 *   pendingWinnerName: string|null,
 *   pile: Card[]
 * }>
 */
const games = new Map();

// ---- Broadcasting helpers ----
function emitGamesList() {
  const list = [];
  games.forEach((g, gid) => {
    list.push({
      id: gid,
      host: g.hostName || 'Host',
      playerCount: g.players.length,
      gameState: g.state
    });
  });
  io.emit('gamesList', list);
}

function emitLobbyUpdate(game) {
  io.to(game.id).emit('lobbyUpdate', {
    players: game.players.map(p => ({ id: p.id, name: p.name, ready: !!p.ready })),
    allReady: game.players.length > 1 && game.players.every(p => p.ready)
  });
}

function emitGameUpdate(game) {
  io.to(game.id).emit('gameUpdate', {
    gameId: game.id,
    gameState: game.state,
    players: game.players.map(p => ({ id: p.id, name: p.name, cardCount: p.hand.length })),
    currentPlayerIndex: game.currentPlayerIndex,
    currentPlayer: game.players[game.currentPlayerIndex] ? game.players[game.currentPlayerIndex].name : null,
    lastClaim: game.lastClaim || null,
  });
}

function emitPlayerGameState(game, socket) {
  const me = game.players.find(p => p.id === socket.id);
  const isMyTurn = game.players[game.currentPlayerIndex]
    ? (game.players[game.currentPlayerIndex].id === socket.id)
    : false;

  socket.emit('playerGameState', {
    handSize: me ? me.hand.length : 0,
    isCurrentPlayer: isMyTurn,
    // nur wenn Behauptung existiert UND ich dran bin
    canCallBluff: !!game.lastClaim && isMyTurn
  });

  socket.emit('playerHand', (me && me.hand) ? me.hand : []);
}

// ---- Core game helpers ----
function addPlayerToGame(game, socket, name) {
  const exists = game.players.some(p => p.id === socket.id);
  if (!exists) {
    game.players.push({ id: socket.id, name: name || `Spieler${Math.floor(Math.random() * 1000)}`, ready: false, hand: [] });
  } else {
    game.players = game.players.map(p => p.id === socket.id ? { ...p, name: name || p.name } : p);
  }
}

function startGame(game) {
  game.state = 'playing';
  game.pile = [];
  game.lastClaim = null;
  game.lastPlay = null;
  game.pendingWinnerId = null;
  game.pendingWinnerName = null;
  game.currentPlayerIndex = 0;

  const deck = makeDeck();
  const n = game.players.length;
  for (let i = 0; i < deck.length; i++) {
    const pIndex = i % n;
    game.players[pIndex].hand.push(deck[i]);
  }

  game.players.forEach(p => {
    const s = io.sockets.sockets.get(p.id);
    if (s) emitPlayerGameState(game, s);
  });

  emitGameUpdate(game);
  io.to(game.id).emit('serverMessage', { type: 'success', text: 'Spiel gestartet' });
}

function nextPlayer(game) {
  if (!game.players.length) return;
  let i = (game.currentPlayerIndex + 1) % game.players.length;
  for (let step = 0; step < game.players.length; step++) {
    if (game.players[i].hand.length > 0) break;
    i = (i + 1) % game.players.length;
  }
  game.currentPlayerIndex = i;
}

function finalizeWinner(game, winnerId, winnerName) {
  game.state = 'finished';
  io.to(game.id).emit('serverMessage', { type: 'success', text: `${winnerName} hat gewonnen!` });
  emitGameUpdate(game);
}

// ---- Socket.IO ----
io.on('connection', (socket) => {
  console.log('👤 Spieler verbunden:', socket.id);
  socket.data.playerName = `Spieler${Math.floor(Math.random() * 1000)}`;

  socket.on('disconnect', () => {
    console.log('👤 Spieler getrennt:', socket.id);
    games.forEach((g) => {
      const idx = g.players.findIndex(p => p.id === socket.id);
      if (idx >= 0) {
        g.players.splice(idx, 1);
        io.to(g.id).emit('serverMessage', { type: 'info', text: `${socket.data.playerName} hat das Spiel verlassen.` });
        if (g.players.length === 0) {
          games.delete(g.id);
        } else {
          emitLobbyUpdate(g);
          emitGameUpdate(g);
        }
      }
    });
    emitGamesList();
  });

  socket.on('changeName', (data) => {
    const newName = data && data.name ? String(data.name) : socket.data.playerName;
    socket.data.playerName = newName;
  });

  socket.on('requestGamesList', () => { emitGamesList(); });

  socket.on('createGame', () => {
    const gameId = `game_${Date.now()}`;
    const game = {
      id: gameId,
      hostSocketId: socket.id,
      hostName: socket.data.playerName,
      state: 'waiting',
      players: [],
      currentPlayerIndex: 0,
      lastClaim: null,
      lastPlay: null,
      pendingWinnerId: null,
      pendingWinnerName: null,
      pile: []
    };
    games.set(gameId, game);

    addPlayerToGame(game, socket, socket.data.playerName);
    socket.join(gameId);
    socket.data.gameId = gameId;

    console.log(`🎯 Spiel erstellt: ${gameId}`);
    socket.emit('gameCreated', { gameId });
    emitLobbyUpdate(game);
    emitGamesList();
  });

  socket.on('joinGame', (data) => {
    const gameId = data && data.gameId ? data.gameId : null;
    if (!gameId || !games.has(gameId)) return;
    const game = games.get(gameId);

    addPlayerToGame(game, socket, socket.data.playerName);
    socket.join(gameId);
    socket.data.gameId = gameId;

    io.to(gameId).emit('serverMessage', { type: 'info', text: `${socket.data.playerName} ist beigetreten.` });
    emitLobbyUpdate(game);
    emitGamesList();
  });

  socket.on('leaveGame', () => {
    const gid = socket.data.gameId;
    if (!gid || !games.has(gid)) return;
    const game = games.get(gid);

    const idx = game.players.findIndex(p => p.id === socket.id);
    if (idx >= 0) {
      game.players.splice(idx, 1);
      socket.leave(gid);
      socket.data.gameId = null;
      io.to(gid).emit('serverMessage', { type: 'info', text: `${socket.data.playerName} hat das Spiel verlassen.` });
      if (game.players.length === 0) {
        games.delete(gid);
      } else {
        emitLobbyUpdate(game);
        emitGameUpdate(game);
      }
      emitGamesList();
    }
  });

  socket.on('toggleReady', () => {
    const gid = socket.data.gameId;
    if (!gid || !games.has(gid)) return;
    const game = games.get(gid);

    const p = game.players.find(pl => pl.id === socket.id);
    if (!p) return;
    p.ready = !p.ready;
    console.log(`⚡ Ready Status: ${p.name} → ${p.ready}`);

    emitLobbyUpdate(game);

    const allReady = game.players.length > 1 && game.players.every(x => x.ready);
    if (allReady) {
      io.to(gid).emit('serverMessage', { type: 'success', text: 'Alle Spieler bereit! Spiel startet...' });
      startGame(game);
      console.log(`🚀 Spiel gestartet: ${gid}`);
    }
  });

  socket.on('startNewGame', () => {
    const gid = socket.data.gameId;
    if (!gid || !games.has(gid)) return;
    const game = games.get(gid);
    game.players.forEach(p => p.ready = true);
    startGame(game);
    console.log(`🚀 Spiel gestartet: ${gid}`);
  });

  socket.on('playCards', (raw) => {
    try {
      const data = raw || {};
      const payloadGameId = data.gameId || data.roomId || data.room || data.gid || null;
      const payloadPlayerId = data.playerId || data.pid || null;

      const gameId = payloadGameId || socket.data.gameId || null;
      const playerId = payloadPlayerId || socket.id;

      if (!gameId || !games.has(gameId)) {
        socket.emit('errorMessage', 'Spiel oder GameID nicht gefunden');
        return;
      }
      const game = games.get(gameId);

      // ⚠️ Bevor ein neuer Zug verarbeitet wird:
      // Falls es einen "pending Winner" gibt und dessen letzte Ablage noch aktiv ist,
      // endet das Spiel JETZT (der nächste Spieler hat gespielt → Sieg bestätigt).
      if (
        game.state === 'playing' &&
        game.pendingWinnerId &&
        game.lastPlay &&
        game.lastPlay.playerId === game.pendingWinnerId &&
        playerId !== game.pendingWinnerId
      ) {
        finalizeWinner(game, game.pendingWinnerId, game.pendingWinnerName || 'Spieler');
        return; // Zug wird nicht mehr verarbeitet
      }

      const player = game.players.find(p => p.id === playerId);
      if (!player) {
        socket.emit('errorMessage', 'Spieler nicht im Spiel');
        return;
      }

      if (game.state !== 'playing') {
        socket.emit('errorMessage', 'Spiel läuft nicht.');
        return;
      }

      const isMyTurn = game.players[game.currentPlayerIndex] && game.players[game.currentPlayerIndex].id === playerId;
      if (!isMyTurn) {
        socket.emit('errorMessage', 'Du bist nicht am Zug.');
        return;
      }

      const cards = Array.isArray(data.cards) ? data.cards : [];
      const claim = data.claim && typeof data.claim.count !== 'undefined' && typeof data.claim.value !== 'undefined'
        ? { count: Number(data.claim.count), value: data.claim.value }
        : null;

      if (!cards.length) { socket.emit('errorMessage', 'Keine Karten übergeben.'); return; }
      if (!claim)       { socket.emit('errorMessage', 'Ungültiger Claim.'); return; }

      // Karten vom Spieler entfernen
      const removingIds = cards.map(c => String(c.id));
      player.hand = player.hand.filter(c => removingIds.indexOf(String(c.id)) === -1);

      // Ablage auf den Stapel
      if (!Array.isArray(game.pile)) game.pile = [];
      for (let i = 0; i < cards.length; i++) game.pile.push(cards[i]);

      // kumulative Behauptung aktualisieren
      const claimValNum = toValueNum(claim.value);
      if (game.lastClaim && toValueNum(game.lastClaim.value) === claimValNum) {
        game.lastClaim.count = Number(game.lastClaim.count) + cards.length;
      } else {
        game.lastClaim = { count: cards.length, value: claimValNum };
      }

      // letzte einzelne Ablage speichern
      game.lastPlay = {
        playerId: player.id,
        playerName: player.name,
        cards: cards.slice(),
        claimValue: claimValNum
      };

      // ⚠️ NEU: Hat der Spieler jetzt 0 Karten? → NICHT sofort Sieg! Erst pendingWinner setzen.
      if (player.hand.length === 0) {
        game.pendingWinnerId = player.id;
        game.pendingWinnerName = player.name;
        io.to(game.id).emit('serverMessage', { type: 'info', text: `${player.name} hat keine Karten mehr. Wenn kein Bluff erfolgreich ist und der nächste spielt, gewinnt ${player.name}.` });
      }

      // Nächster Spieler
      nextPlayer(game);

      emitGameUpdate(game);
      game.players.forEach(p => {
        const s = io.sockets.sockets.get(p.id);
        if (s) emitPlayerGameState(game, s);
      });

      io.to(gameId).emit('cardsPlayed', {
        playerId,
        playerName: player.name,
        cards,
        claim: { count: cards.length, value: claimValNum }
      });

    } catch (err) {
      console.error('💥 playCards handler crashed:', err);
      socket.emit('errorMessage', 'Serverfehler beim Ausspielen.');
    }
  });

  socket.on('callBluff', () => {
    const gid = socket.data.gameId;
    if (!gid || !games.has(gid)) return;
    const game = games.get(gid);

    if (!game.lastClaim || !game.lastPlay) {
      socket.emit('errorMessage', 'Es gibt keine Behauptung zu prüfen.');
      return;
    }

    // Wer hat zuletzt gelegt?
    const accusedId = game.lastPlay.playerId;
    const accusedName = game.lastPlay.playerName || 'Spieler';
    const callerId = socket.id;
    const caller = game.players.find(p => p.id === callerId);

    // Wahrheitsprüfung (bezieht sich nur auf die letzte Ablage)
    const claimedNum = toValueNum(game.lastPlay.claimValue);
    const lastBatch = Array.isArray(game.lastPlay.cards) ? game.lastPlay.cards : [];
    const wasTruth = lastBatch.length > 0 && lastBatch.every(c => Number(c.numericValue) === claimedNum);

    let loserId, loserName, winnerId, winnerName;

    if (wasTruth) {
      // Wahrheit → Caller lag falsch → Caller nimmt Stapel, Accused ist im Recht
      loserId = callerId;
      loserName = caller ? caller.name : 'Caller';
      winnerId = accusedId;
      winnerName = accusedName;
    } else {
      // Lüge → Accused lag falsch → Accused nimmt Stapel, Caller ist im Recht
      loserId = accusedId;
      loserName = accusedName;
      winnerId = callerId;
      winnerName = caller ? caller.name : 'Caller';
    }

    // Stapel übertragen
    const loser = game.players.find(p => p.id === loserId);
    if (!Array.isArray(game.pile)) game.pile = [];
    if (loser) loser.hand = loser.hand.concat(game.pile);

    // Runde zurücksetzen
    game.pile = [];
    game.lastClaim = null;
    game.lastPlay = null;

    // Pending-Winner-Logik
    if (!wasTruth) {
      // Lüge → Accused bekam Stapel → er hat wieder Karten → pendingWinner löschen
      if (game.pendingWinnerId === accusedId) {
        game.pendingWinnerId = null;
        game.pendingWinnerName = null;
      }
    } else {
      // Wahrheit → Accused war im Recht.
      // Falls er (accused) der Pending-Winner war (d. h. hatte 0 Karten), gewinnt er jetzt sofort.
      const accused = game.players.find(p => p.id === accusedId);
      const accusedHasZero = accused ? accused.hand.length === 0 : false;
      if (game.pendingWinnerId === accusedId || accusedHasZero) {
        finalizeWinner(game, accusedId, accusedName);
        io.to(gid).emit('bluffResolved', { truth: true, loserId, loserName, winnerId: accusedId, winnerName: accusedName });
        return;
      }
      // Wenn er nicht pending war, einfach weiter – und der Gewinner (Recht habende) ist am Zug
    }

    // Gewinner (der Recht hatte) ist als Nächstes am Zug
    const winnerIndex = game.players.findIndex(p => p.id === winnerId);
    if (winnerIndex >= 0) game.currentPlayerIndex = winnerIndex;

    const msgText = wasTruth
      ? `✅ Wahrheit! ${loserName} (Bluff-Rufer) nimmt die Karten auf. ${winnerName} ist dran.`
      : `❌ Bluff! ${loserName} (letzter Spieler) nimmt die Karten auf. ${winnerName} ist dran.`;

    io.to(gid).emit('serverMessage', { type: wasTruth ? 'success' : 'warning', text: msgText });
    io.to(gid).emit('bluffResolved', {
      truth: wasTruth,
      loserId,
      loserName,
      winnerId,
      winnerName
    });

    emitGameUpdate(game);
    game.players.forEach(p => {
      const s = io.sockets.sockets.get(p.id);
      if (s) emitPlayerGameState(game, s);
    });
  });
});

// ---- Server start ----
server.listen(PORT, () => {
  const locals = [`http://localhost:${PORT}`];
  const ips = getLocalIPs().map(ip => `http://${ip}:${PORT}`);
  console.log('🚀 Bluff Kartenspiel Server läuft:');
  console.log('   📱 Lokal:', locals[0]);
  if (ips.length) console.log('   🌐 Netzwerk:', ips[0]);
  console.log('   🎯 Bereit für Verbindungen!');
});

