const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { BluffGame, Value } = require('./logic.js');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// WICHTIG: Static middleware mit korrekten MIME-Types
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

const players = new Map();
const games = new Map();

function getLocalIpAddress() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

function sendGamesList(targetSocket = null) {
    const gamesList = Array.from(games.values())
        .filter(game => game.gameState !== 'finished') // Nur aktive Spiele anzeigen
        .map(game => ({
            id: game.gameId,
            host: game.players[0] ? game.players[0].name : 'Unknown',
            playerCount: game.players.length,
            gameState: game.gameState
        }));
    
    if (targetSocket) {
        targetSocket.emit('gamesList', gamesList);
    } else {
        io.emit('gamesList', gamesList);
    }
}

function broadcastSpecialEvent(gameId, eventType, actionData) {
    console.log(`📡 Broadcasting special event: ${eventType}`, actionData);
    
    switch (eventType) {
        case 'quadsRemoved':
            io.to(gameId).emit('quadsRemoved', {
                player: actionData.player,
                value: actionData.value,
                count: actionData.count
            });
            break;
            
        case 'playerLostAces':
            io.to(gameId).emit('playerLostAces', {
                player: actionData.player
            });
            // Aktualisiere die Spieleliste, da das Spiel beendet ist
            sendGamesList();
            break;
            
        case 'gameWon':
            io.to(gameId).emit('gameWon', {
                winner: actionData.winner
            });
            // Aktualisiere die Spieleliste, da das Spiel beendet ist
            sendGamesList();
            break;
            
        default:
            console.warn('⚠️ Unknown special event type:', eventType);
    }
}

io.on('connection', (socket) => {
    console.log('✅ Spieler verbunden:', socket.id);
    
    // Player erstellen und verbinden
    if (!players.has(socket.id)) {
        const playerName = `Spieler${Math.floor(Math.random() * 1000)}`;
        players.set(socket.id, {
            id: socket.id,
            name: playerName,
            gameId: null,
            ready: false
        });
        
        socket.emit('playerConnected', {
            player: players.get(socket.id)
        });
    }
    
    sendGamesList(socket);
    
    // Name ändern
    socket.on('changeName', (data) => {
        const player = players.get(socket.id);
        if (player && data.name && data.name.trim()) {
            const oldName = player.name;
            player.name = data.name.trim();
            console.log(`📝 Name geändert: ${oldName} → ${player.name}`);
            socket.emit('nameChanged', { name: player.name });
        }
    });
    
    // Spiel erstellen
    socket.on('createGame', (data) => {
        console.log('🎮 Erstelle neues Spiel für:', socket.id);
        const player = players.get(socket.id);
        if (!player) return;
        
        // Wenn Spieler bereits in einem Spiel ist, verlassen
        if (player.gameId) {
            const oldGame = games.get(player.gameId);
            if (oldGame) {
                oldGame.removePlayer(socket.id);
                socket.leave(player.gameId);
            }
        }
        
        const gameId = 'game_' + Date.now();
        const game = new BluffGame(gameId);
        games.set(gameId, game);
        
        // Spieler zum Spiel hinzufügen
        game.addPlayer(socket.id, player.name);
        player.gameId = gameId;
        player.ready = false;
        
        socket.join(gameId);
        
        socket.emit('gameCreated', {
            gameState: game.getPublicGameState()
        });
        
        sendGamesList();
        console.log('✅ Spiel erstellt:', gameId);
    });
    
    // Spiel beitreten
    socket.on('joinGame', (data) => {
        console.log('👥 Trete Spiel bei:', data.gameId, 'Spieler:', socket.id);
        const player = players.get(socket.id);
        const game = games.get(data.gameId);
        
        if (!player || !game) {
            socket.emit('error', { message: 'Spiel nicht gefunden' });
            return;
        }
        
        if (game.players.length >= 6) {
            socket.emit('error', { message: 'Spiel ist voll' });
            return;
        }
        
        if (game.gameState !== 'waiting') {
            socket.emit('error', { message: 'Spiel läuft bereits' });
            return;
        }
        
        // Wenn Spieler bereits in einem Spiel ist, verlassen
        if (player.gameId) {
            const oldGame = games.get(player.gameId);
            if (oldGame) {
                oldGame.removePlayer(socket.id);
                socket.leave(player.gameId);
            }
        }
        
        // Zum neuen Spiel hinzufügen
        game.addPlayer(socket.id, player.name);
        player.gameId = data.gameId;
        player.ready = false;
        
        socket.join(data.gameId);
        
        io.to(data.gameId).emit('gameUpdate', game.getPublicGameState());
        sendGamesList();
        console.log('✅ Spieler beigetreten');
    });
    
    // Spieler bereit toggle
    socket.on('playerReady', () => {
        console.log('🔄 Spieler ready toggle:', socket.id);
        const player = players.get(socket.id);
        if (!player || !player.gameId) return;
        
        const game = games.get(player.gameId);
        if (!game) return;
        
        player.ready = !player.ready;
        
        // Prüfe ob alle bereit sind
        const allReady = game.players.every(p => {
            const playerData = players.get(p.id);
            return playerData && playerData.ready;
        });
        
        const playersWithReady = game.players.map(p => {
            const playerData = players.get(p.id);
            return {
                ...p,
                ready: playerData ? playerData.ready : false
            };
        });
        
        io.to(player.gameId).emit('lobbyUpdate', {
            players: playersWithReady,
            allReady: allReady
        });
        
        // Starte Spiel wenn alle bereit und mindestens 2 Spieler
        if (allReady && game.players.length >= 2) {
            setTimeout(() => {
                try {
                    game.startGame();
                    io.to(player.gameId).emit('gameStarted', game.getPublicGameState());
                    
                    // Sende jedem Spieler seine Hand
                    game.players.forEach(p => {
                        const playerSocket = io.sockets.sockets.get(p.id);
                        if (playerSocket) {
                            playerSocket.emit('playerGameState', game.getPlayerGameState(p.id));
                        }
                    });
                    
                    console.log('🚀 Spiel gestartet:', player.gameId);
                } catch (error) {
                    console.error('❌ Fehler beim Spiel starten:', error.message);
                    io.to(player.gameId).emit('error', { message: error.message });
                }
            }, 2000);
        }
    });
    
    // Karten spielen
    socket.on('playCards', (data) => {
        console.log('🎯 Karten gespielt von:', socket.id, data);
        const player = players.get(socket.id);
        if (!player || !player.gameId) return;
        
        const game = games.get(player.gameId);
        if (!game) return;
        
        try {
            game.playCards(socket.id, data.cardIds, data.claimedCount, data.claimedValue);
            console.log('✅ Karten erfolgreich gespielt');
            
            // Handle special events first
            if (game.lastAction.type === 'quadsRemoved') {
                broadcastSpecialEvent(player.gameId, 'quadsRemoved', game.lastAction);
            } else if (game.lastAction.type === 'playerLostAces') {
                broadcastSpecialEvent(player.gameId, 'playerLostAces', game.lastAction);
            } else if (game.lastAction.type === 'gameWon') {
                broadcastSpecialEvent(player.gameId, 'gameWon', game.lastAction);
            }
            
            // Always send game update
            io.to(player.gameId).emit('gameUpdate', game.getPublicGameState());
            
            // Send individual player states
            game.players.forEach(p => {
                const playerSocket = io.sockets.sockets.get(p.id);
                if (playerSocket) {
                    playerSocket.emit('playerGameState', game.getPlayerGameState(p.id));
                }
            });
            
        } catch (error) {
            console.error('❌ Fehler beim Karten spielen:', error.message);
            socket.emit('error', { message: error.message });
        }
    });
    
    // Bluff rufen
    socket.on('callBluff', () => {
        console.log('🚨 Bluff gerufen von:', socket.id);
        const player = players.get(socket.id);
        if (!player || !player.gameId) return;
        
        const game = games.get(player.gameId);
        if (!game) return;
        
        try {
            const bluffResult = game.callBluff(socket.id);
            console.log('✅ Bluff abgearbeitet');
            
            // Send bluff result first
            io.to(player.gameId).emit('bluffResult', bluffResult);
            
            // Handle special events that might happen after bluff
            if (game.lastAction.type === 'quadsRemoved') {
                broadcastSpecialEvent(player.gameId, 'quadsRemoved', game.lastAction);
            } else if (game.lastAction.type === 'playerLostAces') {
                broadcastSpecialEvent(player.gameId, 'playerLostAces', game.lastAction);
            } else if (game.lastAction.type === 'gameWon') {
                broadcastSpecialEvent(player.gameId, 'gameWon', game.lastAction);
            }
            
            // Always send game update
            io.to(player.gameId).emit('gameUpdate', game.getPublicGameState());
            
            // Send individual player states
            game.players.forEach(p => {
                const playerSocket = io.sockets.sockets.get(p.id);
                if (playerSocket) {
                    playerSocket.emit('playerGameState', game.getPlayerGameState(p.id));
                }
            });
            
        } catch (error) {
            console.error('❌ Fehler beim Bluff rufen:', error.message);
            socket.emit('error', { message: error.message });
        }
    });
    
    socket.on('refreshGames', () => {
        sendGamesList(socket);
    });
    
    // Neues Spiel in der gleichen Lobby starten
    socket.on('startNewGame', () => {
        console.log('🔄 Starte neues Spiel in Lobby:', socket.id);
        const player = players.get(socket.id);
        if (!player || !player.gameId) return;
        
        const game = games.get(player.gameId);
        if (!game) return;
        
        try {
            // Reset das Spiel
            game.reset();
            
            // Setze alle Spieler auf nicht bereit
            game.players.forEach(p => {
                const playerData = players.get(p.id);
                if (playerData) {
                    playerData.ready = false;
                }
            });
            
            // Sende Update an alle Spieler
            io.to(player.gameId).emit('gameUpdate', game.getPublicGameState());
            sendGamesList();
            
            console.log('✅ Neues Spiel gestartet in Lobby:', player.gameId);
        } catch (error) {
            console.error('❌ Fehler beim Starten eines neuen Spiels:', error.message);
            socket.emit('error', { message: error.message });
        }
    });
    
    socket.on('leaveGame', () => {
        const player = players.get(socket.id);
        if (player && player.gameId) {
            const game = games.get(player.gameId);
            if (game) {
                game.removePlayer(socket.id);
                socket.leave(player.gameId);
                player.gameId = null;
                player.ready = false;
                
                // Lösche leere Lobbys, auch wenn das Spiel läuft
                if (game.players.length === 0) {
                    games.delete(player.gameId);
                    console.log('🗑️ Leeres Spiel gelöscht');
                } else {
                    io.to(game.gameId).emit('gameUpdate', game.getPublicGameState());
                }
                
                sendGamesList();
            }
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Spieler getrennt:', socket.id);
        
        const player = players.get(socket.id);
        if (player && player.gameId) {
            const game = games.get(player.gameId);
            if (game) {
                game.removePlayer(socket.id);
                
                // Lösche leere Lobbys, auch wenn das Spiel läuft
                if (game.players.length === 0) {
                    games.delete(player.gameId);
                    console.log('🗑️ Leeres Spiel gelöscht (Disconnect)');
                } else {
                    io.to(player.gameId).emit('gameUpdate', game.getPublicGameState());
                }
                
                sendGamesList();
            }
        }
        
        players.delete(socket.id);
    });
});

const PORT = process.env.PORT || 3001;
const LOCAL_IP = getLocalIpAddress();

server.listen(PORT, '0.0.0.0', () => {
    console.log('=====================================');
    console.log('🃏 BLUFF KARTENSPIEL SERVER LÄUFT!');
    console.log('=====================================');
    console.log(`Lokal: http://localhost:${PORT}`);
    console.log(`LAN: http://${LOCAL_IP}:${PORT}`);
    console.log('📋 Modulare Struktur mit separaten Dateien');
    console.log('=====================================');
});
