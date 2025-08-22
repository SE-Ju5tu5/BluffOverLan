// public/js/socket-handlers.js
// Initialisiert alle Socket.IO Listener und bindet sie an die Vue-App

(function () {
  window.initSocketHandlers = function (app) {
    if (!window.io) {
      console.error('❌ Socket.IO (io) nicht gefunden.');
      return;
    }

    const socket = io();

    // Verbindung
    socket.on('connect', function () {
      console.log('✅ Socket verbunden');
      app.connectionStatus = 'connected';
      console.log('🔌 Client connected, socket.id =', socket.id);

      if (!app.player) app.player = {};
      app.player.id = socket.id;

      socket.emit('requestGamesList');
    });

    socket.on('disconnect', function () {
      console.log('🔌 Socket getrennt');
      app.connectionStatus = 'disconnected';
    });

    socket.on('connect_error', function (err) {
      console.warn('⚠️ connect_error:', err && err.message ? err.message : err);
      app.connectionStatus = 'disconnected';
    });

    // Spieleliste
    socket.on('gamesList', function (list) {
      try {
        const safe = Array.isArray(list) ? list : [];
        app.availableGames = safe.map(function (g) {
          return {
            id: g.id || g.gameId || '',
            host: g.host || 'Host',
            playerCount: typeof g.playerCount === 'number' ? g.playerCount : 0,
            gameState: g.gameState || g.state || 'waiting'
          };
        });
        console.log('📋 Spiele Liste aktualisiert:', app.availableGames.length);
      } catch (e) {
        console.warn('⚠️ gamesList parse error:', e);
      }
    });

    // Spiel erstellt
    socket.on('gameCreated', function (payload) {
      var gameId = typeof payload === 'string' ? payload : (payload && payload.gameId);
      if (!gameId) {
        console.warn('⚠️ gameCreated ohne gameId:', payload);
        return;
      }
      console.log('🎯 Spiel erstellt:', gameId);
      app.gameData = {
        gameId: gameId, gameState: 'waiting', players: [],
        currentPlayerIndex: 0, currentPlayer: null, lastClaim: null
      };
      app.currentScreen = 'lobby';
      if (typeof app.showMessage === 'function') {
        app.showMessage('success', 'Spiel erstellt: ' + gameId);
      }
    });

    // Lobby Update
    socket.on('lobbyUpdate', function (data) {
      console.log('🏁 Lobby Update:', data);
      try {
        if (app && app.gameData) {
          app.gameData.players = Array.isArray(data.players) ? data.players.map(function (p) {
            return { id: p.id, name: p.name, ready: !!p.ready };
          }) : [];

          var me = Array.isArray(app.gameData.players)
            ? app.gameData.players.find(function (pl) { return pl.id === socket.id; })
            : null;
          if (me) {
            if (!app.player) app.player = {};
            app.player.id = me.id;
            app.player.name = me.name;
          }

          if (app.currentScreen !== 'lobby') app.currentScreen = 'lobby';
        }
      } catch (e) {
        console.warn('⚠️ lobbyUpdate parse error:', e);
      }
    });

    // Game Update
    socket.on('gameUpdate', function (data) {
      console.log('🔄 Game Update:', data);
      try {
        if (!app.gameData) app.gameData = {};
        app.gameData.gameId = data.gameId || app.gameData.gameId;
        app.gameData.gameState = data.gameState || app.gameData.gameState || 'waiting';
        app.gameData.players = Array.isArray(data.players) ? data.players : [];
        app.gameData.currentPlayerIndex = (typeof data.currentPlayerIndex === 'number')
          ? data.currentPlayerIndex : (app.gameData.currentPlayerIndex || 0);
        app.gameData.currentPlayer = data.currentPlayer || null;
        app.gameData.lastClaim = data.lastClaim || null;

        var me2 = Array.isArray(app.gameData.players)
          ? app.gameData.players.find(function (pl) { return pl.id === socket.id; })
          : null;
        if (me2) {
          if (!app.player) app.player = {};
          app.player.id = me2.id;
          app.player.name = me2.name;
        }

        if (app.gameData.gameState === 'playing') {
          app.currentScreen = 'game';
        } else if (app.gameData.gameState === 'finished') {
          app.currentScreen = 'menu';
        }
      } catch (e) {
        console.warn('⚠️ gameUpdate parse error:', e);
      }
    });

    // Spieler-Hand
    socket.on('playerHand', function (hand) {
      try {
        var safeHand = Array.isArray(hand) ? hand : [];
        if (typeof app.updatePlayerHand === 'function') {
          app.updatePlayerHand(safeHand);
        } else {
          app.playerHand = safeHand;
        }
      } catch (e) {
        console.warn('⚠️ playerHand parse error:', e);
      }
    });

    // Player Game State (isCurrentPlayer, canCallBluff)
    socket.on('playerGameState', function (data) {
      console.log('👤 Player Game State:', data);
      app.gameData = app.gameData || {};
      app.gameData.isCurrentPlayer = !!(data && data.isCurrentPlayer);
      app.gameData.canCallBluff = !!(data && data.canCallBluff);
    });

    // Server Messages
    socket.on('serverMessage', function (msg) {
      try {
        if (msg && msg.text) {
          console.log('💬 [' + (msg.type || 'info').toUpperCase() + ']', msg.text);
          if (typeof app.showMessage === 'function') {
            app.showMessage(msg.type || 'info', msg.text);
          }
        }
      } catch (e) {
        console.warn('⚠️ serverMessage parse error:', e);
      }
    });

    // 🔔 Ergebnis vom Bluff
    socket.on('bluffResolved', function (evt) {
      try {
        console.log('🎲 Bluff Ergebnis:', evt);
        const text = evt && evt.truth
          ? `✅ Wahrheit! ${evt.loserName} nimmt die Karten auf.`
          : `❌ Bluff! ${evt.loserName} nimmt die Karten auf.`;
        if (typeof app.showMessage === 'function') {
          app.showMessage(evt && evt.truth ? 'success' : 'warning', text);
        }
      } catch (e) {
        console.warn('⚠️ bluffResolved parse error:', e);
      }
    });

    // Optional: Broadcast, wenn Karten gelegt wurden
    socket.on('cardsPlayed', function (evt) {
      try {
        console.log('🃏 Karten gespielt (broadcast):', evt);
        if (typeof app.showMessage === 'function' && evt && evt.playerName) {
          var count = Array.isArray(evt.cards) ? evt.cards.length : 0;
          var val = evt.claim && evt.claim.value ? evt.claim.value : '?';
          app.showMessage('info', `${evt.playerName} spielt ${count} Karte(n), behauptet: ${val}`);
        }
      } catch (e) {
        console.warn('⚠️ cardsPlayed parse error:', e);
      }
    });

    // SocketAPI
    window.SocketAPI = {
      changeName: function (name) { socket.emit('changeName', { name: String(name || '') }); },
      requestGamesList: function () { socket.emit('requestGamesList'); },
      createGame: function () { socket.emit('createGame'); },
      joinGame: function (gameId) { socket.emit('joinGame', { gameId: String(gameId || '') }); },
      leaveGame: function () { socket.emit('leaveGame'); },
      startNewGame: function () { socket.emit('startNewGame'); },
      toggleReady: function () { socket.emit('toggleReady'); },
      playCards: function (data) { socket.emit('playCards', data); },
      callBluff: function () { socket.emit('callBluff'); },
      getId: function () { return socket.id || null; }
    };

    console.log('🔌 Socket Handlers initialisiert');
  };
})();

