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

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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
    const gamesList = Array.from(games.values()).map(game => ({
        id: game.gameId,
        host: game.players[0] ? players.get(game.players[0].id)?.name : 'Unbekannt',
        playerCount: game.players.length,
        maxPlayers: 6,
        gameState: game.gameState
    }));
    
    if (targetSocket) {
        targetSocket.emit('gamesList', gamesList);
    } else {
        io.emit('gamesList', gamesList);
    }
}

io.on('connection', (socket) => {
    console.log('✅ Spieler verbunden:', socket.id);
    
    players.set(socket.id, {
        id: socket.id,
        name: 'Spieler_' + socket.id.substring(0, 4),
        gameId: null,
        ready: false
    });
    
    socket.emit('playerConnected', {
        playerId: socket.id,
        player: players.get(socket.id)
    });
    
    sendGamesList(socket);
    
    socket.on('refreshGames', () => {
        sendGamesList(socket);
    });
    
    socket.on('changeName', (data) => {
        const player = players.get(socket.id);
        if (player && data.name && data.name.trim().length > 0) {
            player.name = data.name.trim().substring(0, 20);
            socket.emit('nameChanged', { name: player.name });
            
            if (player.gameId) {
                const game = games.get(player.gameId);
                if (game) {
                    io.to(player.gameId).emit('gameUpdate', game.getPublicGameState());
                }
            }
        }
    });
    
    socket.on('createGame', (data) => {
        console.log('🎮 Erstelle Spiel für:', socket.id);
        const gameId = 'bluff_' + Date.now();
        const game = new BluffGame(gameId);
        
        const player = players.get(socket.id);
        game.addPlayer(socket.id, player.name);
        player.gameId = gameId;
        
        games.set(gameId, game);
        socket.join(gameId);
        
        socket.emit('gameCreated', { 
            gameId, 
            gameState: game.getPublicGameState() 
        });
        
        sendGamesList();
        console.log('🃏 Spiel erstellt:', gameId);
    });
    
    socket.on('joinGame', (data) => {
        console.log('👥 Spieler tritt bei:', socket.id, 'Spiel:', data.gameId);
        const game = games.get(data.gameId);
        if (!game) {
            socket.emit('error', { message: 'Spiel nicht gefunden' });
            return;
        }
        
        if (game.players.length >= 6) {
            socket.emit('error', { message: 'Spiel ist voll' });
            return;
        }
        
        if (game.gameState === 'playing') {
            socket.emit('error', { message: 'Spiel läuft bereits' });
            return;
        }
        
        const player = players.get(socket.id);
        
        if (game.getPlayer(socket.id)) {
            socket.emit('error', { message: 'Du bist bereits in diesem Spiel' });
            return;
        }
        
        game.addPlayer(socket.id, player.name);
        player.gameId = data.gameId;
        
        socket.join(data.gameId);
        io.to(data.gameId).emit('gameUpdate', game.getPublicGameState());
        sendGamesList();
    });
    
    socket.on('playerReady', () => {
        console.log('🔄 Spieler bereit:', socket.id);
        const player = players.get(socket.id);
        if (!player || !player.gameId) {
            return;
        }
        
        const game = games.get(player.gameId);
        if (!game || game.gameState !== 'waiting') {
            return;
        }
        
        player.ready = !player.ready;
        
        const gamePlayers = game.players.map(p => players.get(p.id));
        const allReady = gamePlayers.every(p => p && p.ready);
        
        const playersWithReady = gamePlayers.map(p => ({
            id: p.id,
            name: p.name,
            ready: p.ready
        }));
        
        io.to(player.gameId).emit('lobbyUpdate', {
            players: playersWithReady,
            allReady: allReady
        });
        
        if (allReady && game.players.length >= 2) {
            try {
                console.log('🎲 Starte Spiel:', game.gameId);
                game.startGame();
                gamePlayers.forEach(p => p.ready = false);
                
                io.to(player.gameId).emit('gameStarted', game.getPublicGameState());
                
                game.players.forEach(p => {
                    const playerSocket = io.sockets.sockets.get(p.id);
                    if (playerSocket) {
                        playerSocket.emit('playerGameState', game.getPlayerGameState(p.id));
                    }
                });
                
            } catch (error) {
                console.error('❌ Fehler beim Spielstart:', error);
                io.to(player.gameId).emit('error', { message: error.message });
            }
        } else {
            io.to(player.gameId).emit('gameUpdate', game.getPublicGameState());
        }
    });
    
    socket.on('playCards', (data) => {
        console.log('🃏 Karten spielen Event:', socket.id);
        
        const player = players.get(socket.id);
        if (!player || !player.gameId) {
            socket.emit('error', { message: 'Du bist in keinem Spiel' });
            return;
        }
        
        const game = games.get(player.gameId);
        if (!game) {
            socket.emit('error', { message: 'Spiel nicht gefunden' });
            return;
        }
        
        try {
            game.playCards(socket.id, data.cardIds, data.claimedCount, data.claimedValue);
            
            console.log('✅ Karten erfolgreich gespielt!');
            
            // Alle über die neue Situation informieren
            io.to(player.gameId).emit('gameUpdate', game.getPublicGameState());
            
            // Jedem Spieler seinen aktuellen Zustand senden
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
    
    socket.on('callBluff', () => {
        console.log('🚨 Bluff gerufen von:', socket.id);
        const player = players.get(socket.id);
        if (!player || !player.gameId) return;
        
        const game = games.get(player.gameId);
        if (!game) return;
        
        try {
            const bluffResult = game.callBluff(socket.id);
            console.log('✅ Bluff abgearbeitet');
            
            // Bluff-Ergebnis an alle senden
            io.to(player.gameId).emit('bluffResult', bluffResult);
            
            // Game State Update
            io.to(player.gameId).emit('gameUpdate', game.getPublicGameState());
            
            // Jedem Spieler seinen neuen Zustand senden
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
    
    socket.on('leaveGame', () => {
        const player = players.get(socket.id);
        if (player && player.gameId) {
            const game = games.get(player.gameId);
            if (game) {
                game.removePlayer(socket.id);
                socket.leave(player.gameId);
                player.gameId = null;
                player.ready = false;
                
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
                
                if (game.players.length === 0) {
                    games.delete(player.gameId);
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
    console.log('=====================================');
});
