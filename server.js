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

// Static middleware
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
        .filter(game => game.gameState !== 'finished')
        .map(game => ({
            id: game.gameId,
            host: game.players[0] ? game.players[0].name : 'Unbekannt',
            playerCount: game.players.length,
            gameState: game.gameState
        }));
    
    if (targetSocket) {
        targetSocket.emit('gamesList', gamesList);
    } else {
        io.emit('gamesList', gamesList);
    }
}

function broadcastSpecialEvent(gameId, eventType, eventData) {
    setTimeout(() => {
        io.to(gameId).emit('specialEvent', { type: eventType, data: eventData });
    }, 1000);
}

io.on('connection', (socket) => {
    console.log('👤 Spieler verbunden:', socket.id);
    
    // Spieler registrieren
    const playerName = `Spieler${Math.floor(Math.random() * 1000)}`;
    const newPlayer = {
        id: socket.id,
        name: playerName,
        gameId: null
    };
    
    players.set(socket.id, newPlayer);
    
    socket.emit('playerConnected', {
        player: newPlayer
    });
    
    sendGamesList(socket);
    
    // Name ändern
    socket.on('changeName', (data) => {
        const player = players.get(socket.id);
        if (player && data.name && data.name.trim()) {
            player.name = data.name.trim();
            socket.emit('nameChanged', { name: player.name });
            console.log('✏️ Name geändert:', player.name);
        }
    });
    
    // Spiel erstellen
    socket.on('createGame', () => {
        const player = players.get(socket.id);
        if (!player) return;
        
        const gameId = 'game_' + Date.now();
        const game = new BluffGame(gameId);
        game.addPlayer(socket.id, player.name);
        
        games.set(gameId, game);
        player.gameId = gameId;
        
        socket.join(gameId);
        
        console.log('🎯 Spiel erstellt:', gameId, 'von', player.name);
        
        socket.emit('gameCreated', {
            gameState: game.getPublicGameState()
        });
        
        sendGamesList();
    });
    
    // Spiel beitreten
    socket.on('joinGame', (data) => {
        const player = players.get(socket.id);
        if (!player || !data.gameId) return;
        
        const game = games.get(data.gameId);
        if (!game) {
            socket.emit('error', { message: 'Spiel nicht gefunden' });
            return;
        }
        
        if (game.gameState !== 'waiting') {
            socket.emit('error', { message: 'Spiel läuft bereits' });
            return;
        }
        
        if (game.players.length >= 6) {
            socket.emit('error', { message: 'Spiel ist voll' });
            return;
        }
        
        game.addPlayer(socket.id, player.name);
        player.gameId = data.gameId;
        
        socket.join(data.gameId);
        
        console.log('👥 Spieler beigetreten:', player.name, '→', data.gameId);
        
        io.to(data.gameId).emit('gameUpdate', game.getPublicGameState());
        sendGamesList();
    });
    
    // Bereit togglen
    socket.on('toggleReady', () => {
        const player = players.get(socket.id);
        if (!player || !player.gameId) return;
        
        const game = games.get(player.gameId);
        if (!game || game.gameState !== 'waiting') return;
        
        const gamePlayer = game.getPlayer(socket.id);
        if (gamePlayer) {
            gamePlayer.ready = !gamePlayer.ready;
            console.log('⚡ Ready Status:', player.name, '→', gamePlayer.ready);
            
            const allReady = game.players.every(p => p.ready);
            
            io.to(player.gameId).emit('lobbyUpdate', {
                players: game.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    ready: p.ready || false
                })),
                allReady: allReady
            });
            
            if (allReady && game.players.length >= 2) {
                setTimeout(() => {
                    try {
                        game.startGame();
                        console.log('🚀 Spiel gestartet:', game.gameId);
                        
                        io.to(player.gameId).emit('gameStarted', game.getPublicGameState());
                        
                        game.players.forEach(p => {
                            const playerSocket = io.sockets.sockets.get(p.id);
                            if (playerSocket) {
                                playerSocket.emit('playerGameState', game.getPlayerGameState(p.id));
                            }
                        });
                        
                        sendGamesList();
                    } catch (error) {
                        console.error('❌ Fehler beim Spielstart:', error);
                        io.to(player.gameId).emit('error', { message: error.message });
                    }
                }, 1500);
            }
        }
    });
    
    // Karten spielen
    socket.on('playCards', (data) => {
        console.log('🃏 Karten gespielt von:', socket.id, data);
        const player = players.get(socket.id);
        if (!player || !player.gameId) {
            console.log('❌ Spieler oder GameID nicht gefunden');
            return;
        }
        
        const game = games.get(player.gameId);
        if (!game) {
            console.log('❌ Spiel nicht gefunden');
            return;
        }
        
        try {
            game.playCards(socket.id, data.cardIds, data.count, data.value);
            console.log('✅ Karten gespielt');
            
            // Check für Special Events
            if (game.lastAction.type === 'quadsRemoved') {
                broadcastSpecialEvent(player.gameId, 'quadsRemoved', game.lastAction);
            } else if (game.lastAction.type === 'playerLostAces') {
                broadcastSpecialEvent(player.gameId, 'playerLostAces', game.lastAction);
            } else if (game.lastAction.type === 'gameWon') {
                broadcastSpecialEvent(player.gameId, 'gameWon', game.lastAction);
            }
            
            // Send game update
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
            
            // Send bluff result
            io.to(player.gameId).emit('bluffResult', bluffResult);
            
            // Handle special events
            if (game.lastAction.type === 'quadsRemoved') {
                broadcastSpecialEvent(player.gameId, 'quadsRemoved', game.lastAction);
            } else if (game.lastAction.type === 'playerLostAces') {
                broadcastSpecialEvent(player.gameId, 'playerLostAces', game.lastAction);
            } else if (game.lastAction.type === 'gameWon') {
                broadcastSpecialEvent(player.gameId, 'gameWon', game.lastAction);
            }
            
            // Send game update
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
    
    // Spiel verlassen
    socket.on('leaveGame', () => {
        const player = players.get(socket.id);
        if (!player || !player.gameId) return;
        
        const game = games.get(player.gameId);
        const gameId = player.gameId;
        
        socket.leave(gameId);
        player.gameId = null;
        
        if (game) {
            game.players = game.players.filter(p => p.id !== socket.id);
            
            if (game.players.length === 0) {
                games.delete(gameId);
                console.log('🗑️ Leeres Spiel gelöscht:', gameId);
            } else {
                io.to(gameId).emit('gameUpdate', game.getPublicGameState());
            }
        }
        
        console.log('👋 Spieler verlässt Spiel:', player.name);
        sendGamesList();
    });
    
    // Neues Spiel starten
    socket.on('startNewGame', () => {
        const player = players.get(socket.id);
        if (!player || !player.gameId) return;
        
        const game = games.get(player.gameId);
        if (!game) return;
        
        try {
            game.reset();
            console.log('🔄 Spiel neu gestartet:', game.gameId);
            
            io.to(player.gameId).emit('gameUpdate', game.getPublicGameState());
            
        } catch (error) {
            console.error('❌ Fehler beim Spiel-Neustart:', error);
            socket.emit('error', { message: error.message });
        }
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        console.log('👤 Spieler getrennt:', socket.id);
        
        const player = players.get(socket.id);
        if (player && player.gameId) {
            const game = games.get(player.gameId);
            if (game) {
                game.players = game.players.filter(p => p.id !== socket.id);
                
                if (game.players.length === 0) {
                    games.delete(player.gameId);
                    console.log('🗑️ Leeres Spiel gelöscht:', player.gameId);
                } else {
                    io.to(player.gameId).emit('gameUpdate', game.getPublicGameState());
                }
            }
        }
        
        players.delete(socket.id);
        sendGamesList();
    });
});

const PORT = process.env.PORT || 3000;
const localIP = getLocalIpAddress();

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bluff Kartenspiel Server läuft:`);
    console.log(`   📱 Lokal: http://localhost:${PORT}`);
    console.log(`   🌐 Netzwerk: http://${localIP}:${PORT}`);
    console.log(`   🎯 Bereit für Verbindungen!`);
});
