// Socket.IO Event Handlers für das Bluff Kartenspiel - FIXED

window.initSocketHandlers = function(app) {
    const socket = io();
    
    // Connection Events
    socket.on('connect', () => {
        app.connectionStatus = 'connected';
        app.statusText = 'Verbunden';
        console.log('✅ Socket verbunden');
    });

    socket.on('disconnect', () => {
        app.connectionStatus = 'disconnected';
        app.statusText = 'Getrennt';
        console.log('❌ Socket getrennt');
    });

    // Player Events
    socket.on('playerConnected', (data) => {
        app.player = data.player;
        app.requestGamesList();
        console.log('👤 Spieler verbunden:', data.player);
    });

    socket.on('nameChanged', (data) => {
        if (app.player) {
            app.player.name = data.name;
            console.log('✏️ Name geändert zu:', data.name);
        }
    });

    // Game List Events
    socket.on('gamesList', (games) => {
        app.availableGames = games || [];
        console.log('📋 Spiele Liste aktualisiert:', games?.length || 0);
    });

    // Game Creation & Joining
    socket.on('gameCreated', (data) => {
        app.gameData = data.gameState;
        app.currentScreen = 'lobby';
        app.clearGameState();
        console.log('🎯 Spiel erstellt:', data.gameState.gameId);
    });

    // FIXED gameUpdate - Mit Winner/Loser Screen Logic
    socket.on('gameUpdate', (data) => {
        app.gameData = data;
        console.log('🔄 Game Update:', data);
        
        // Screen Logic based on game state
        if (data.gameState === 'waiting') {
            app.currentScreen = 'lobby';
        } else if (data.gameState === 'playing') {
            app.currentScreen = 'game';
        } else if (data.gameState === 'finished') {
            // FIXED: Determine winner or loser - ENTWEDER winner ODER loser
            if (data.winner) {
                app.currentScreen = 'winning';
                app.showMessage('success', data.winner + ' hat gewonnen!');
            } else if (data.loser) {
                app.currentScreen = 'losing';
                app.showMessage('error', data.loser + ' hat verloren!');
            }
        }
    });

    // Lobby Events
    socket.on('lobbyUpdate', (data) => {
        if (app.gameData) {
            // Update player ready status
            app.gameData.players = data.players;
        }
        
        if (data.allReady && data.players.length >= 2) {
            app.showMessage('success', 'Alle Spieler bereit! Spiel startet...');
        }
        console.log('🏁 Lobby Update:', data);
    });

    // Game Events
    socket.on('gameStarted', (data) => {
        app.gameData = data;
        app.currentScreen = 'game';
        app.clearRemovedCardsAndQuads(); // FIXED: Clear both lists
        app.clearGameState();
        app.showMessage('success', 'Spiel gestartet! Viel Spaß!');
        console.log('🚀 Spiel gestartet');
    });

    // FIXED playerGameState - Mit Hand Update
    socket.on('playerGameState', (data) => {
        // Update game data with player-specific info
        if (app.gameData) {
            Object.assign(app.gameData, data);
        }
        
        // FIXED: Update player hand
        app.updatePlayerHand(data.playerHand);
        
        console.log('👤 Player Game State:', {
            handSize: data.playerHand?.length || 0,
            isCurrentPlayer: data.isCurrentPlayer,
            canCallBluff: data.canCallBluff
        });
    });

    // Bluff Result
    socket.on('bluffResult', (result) => {
        let message = result.message;
        let messageType = 'bluff-result';
        
        if (result.type === 'bluffSucceeded') {
            message = `🚨 BLUFF AUFGEDECKT! ${message}`;
        } else if (result.type === 'bluffFailed') {
            message = `✅ EHRLICH GESPIELT! ${message}`;
        } else if (result.type === 'gameWon') {
            message = `🏆 SPIEL GEWONNEN! ${message}`;
            messageType = 'success';
        }
        
        app.showMessage(messageType, message);
        console.log('🚨 Bluff Result:', result);
    });

    // FIXED Special Events - Mit beiden Listen
    socket.on('specialEvent', (event) => {
        console.log('✨ Special Event:', event);
        
        if (event.type === 'quadsRemoved') {
            const data = event.data;
            app.addRemovedQuads(data.player, data.value); // Use Quads method
            app.showMessage('info', `${data.player} hatte 4x ${data.value} - entfernt!`);
            
        } else if (event.type === 'playerLostAces') {
            const data = event.data;
            app.showMessage('error', `${data.player} hat 4 Asse und verliert!`);
            
        } else if (event.type === 'gameWon') {
            const data = event.data;
            app.showMessage('success', `🏆 ${data.winner || data.player} hat gewonnen!`);
        }
    });

    // Error Handling
    socket.on('error', (error) => {
        app.showMessage('error', error.message);
        console.error('❌ Socket Error:', error);
    });

    // Custom events for app methods
    app.changeName = (name) => {
        socket.emit('changeName', { name });
    };

    app.createGame = () => {
        socket.emit('createGame');
    };

    app.joinGame = (gameId) => {
        socket.emit('joinGame', { gameId });
    };

    app.toggleReady = () => {
        socket.emit('toggleReady');
    };

    app.leaveGame = () => {
        socket.emit('leaveGame');
    };

    app.startNewGame = () => {
        socket.emit('startNewGame');
    };

    app.playCards = (data) => {
        socket.emit('playCards', data);
    };

    app.callBluff = () => {
        socket.emit('callBluff');
    };

    app.requestGamesList = () => {
        socket.emit('requestGamesList');
    };

    // FIXED: Add methods directly to app instance
    app.updateClaimedValue = (value) => {
        app.claimedValue = value;
        console.log('🎯 Claimed Value updated:', value);
    };

    console.log('🔌 Socket Handlers initialisiert');
};
