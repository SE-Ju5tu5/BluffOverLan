// Socket.IO Event Handlers für das Bluff Kartenspiel

window.initSocketHandlers = function(app) {
    const socket = io();
    
    // Connection Events
    socket.on('connect', () => {
        app.connectionStatus = 'connected';
        app.statusText = 'Verbunden';
    });

    socket.on('disconnect', () => {
        app.connectionStatus = 'disconnected';
        app.statusText = 'Getrennt';
    });

    // Player Events
    socket.on('playerConnected', (data) => {
        app.player = data.player;
        app.requestGamesList();
    });

    socket.on('nameChanged', (data) => {
        if (app.player) {
            app.player.name = data.name;
        }
    });

    // Game List Events
    socket.on('gamesList', (games) => {
        app.availableGames = games || [];
    });

    // Game Creation & Joining
    socket.on('gameCreated', (data) => {
        app.gameData = data.gameState;
        app.currentScreen = 'lobby';
        app.clearGameState();
    });

    socket.on('gameUpdate', (data) => {
        app.gameData = data;
        if (data.gameState === 'waiting') {
            app.currentScreen = 'lobby';
        } else if (data.gameState === 'playing') {
            app.currentScreen = 'game';
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
    });

    // Game Events
    socket.on('gameStarted', (data) => {
        app.gameData = data;
        app.currentScreen = 'game';
        app.clearRemovedCards();
        app.clearGameState();
        app.showMessage('success', 'Spiel gestartet! Viel Spaß!');
    });

    socket.on('playerGameState', (data) => {
        app.gameData = data;
        app.playerHand = data.playerHand || [];
    });

    // Bluff & Special Events
    socket.on('bluffResult', (data) => {
        const cardList = data.actualCards.map(c => c.value + c.suit).join(', ');
        const message = data.message + '\n\nGespielte Karten: ' + cardList;
        app.showMessage('bluff-result', message);
    });

    socket.on('quadsRemoved', (data) => {
        app.showMessage('success', data.player + ' hatte 4x ' + data.value + ' - diese wurden entfernt!');
        app.addRemovedCards(data.player, data.value, 4);
    });

    socket.on('playerLostAces', (data) => {
        app.showMessage('error', data.player + ' hat 4 Asse und verliert das Spiel!');
    });

    // Error Handling
    socket.on('error', (data) => {
        console.error('Server error:', data);
        app.showMessage('error', data.message || 'Ein Fehler ist aufgetreten');
    });

    return socket;
}

// Socket Emit Helper Functions
window.SocketAPI = {
    socket: null,

    init(socket) {
        this.socket = socket;
    },

    // Game Management
    createGame() {
        this.socket.emit('createGame', {});
    },

    joinGame(gameId) {
        this.socket.emit('joinGame', { gameId });
    },

    leaveGame() {
        this.socket.emit('leaveGame', {});
    },

    // Player Actions
    changeName(name) {
        this.socket.emit('changeName', { name });
    },

    toggleReady() {
        this.socket.emit('playerReady');
    },

    // Game Actions
    playCards(cardIds, claimedValue) {
        const valueMap = {
            '2': { name: '2', value: 2 },
            '3': { name: '3', value: 3 },
            '4': { name: '4', value: 4 },
            '5': { name: '5', value: 5 },
            '6': { name: '6', value: 6 },
            '7': { name: '7', value: 7 },
            '8': { name: '8', value: 8 },
            '9': { name: '9', value: 9 },
            '10': { name: '10', value: 10 },
            '11': { name: 'J', value: 11 },
            '12': { name: 'Q', value: 12 },
            '13': { name: 'K', value: 13 }
        };

        const claimedValueObj = valueMap[claimedValue];
        
        this.socket.emit('playCards', {
            cardIds: cardIds,
            claimedCount: cardIds.length,
            claimedValue: claimedValueObj
        });
    },

    callBluff() {
        this.socket.emit('callBluff');
    },

    // Utility
    refreshGames() {
        this.socket.emit('refreshGames');
    }
};
