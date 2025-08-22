// Vue.js App für Bluff Kartenspiel - Clean & Simple

window.createBluffApp = function() {
    const { createApp } = Vue;
    
    const app = createApp({
        data() {
            return {
                connectionStatus: 'disconnected',
                statusText: 'Verbindung...',
                player: null,
                newPlayerName: '',
                currentScreen: 'menu',
                availableGames: [],
                gameData: null,
                selectedCards: [],
                claimedValue: null,
                claimedCount: 1,
                playerHand: [],
                showValuePopup: false,
                gameMessages: [],
                messageCounter: 0,
                removedCards: [],
                removedQuads: []
            };
        },
        
        computed: {
            isConnected() {
                return this.connectionStatus === 'connected';
            },
            
            availableValues() {
                return [
                    { name: '2', value: 2 },
                    { name: '3', value: 3 },
                    { name: '4', value: 4 },
                    { name: '5', value: 5 },
                    { name: '6', value: 6 },
                    { name: '7', value: 7 },
                    { name: '8', value: 8 },
                    { name: '9', value: 9 },
                    { name: '10', value: 10 },
                    { name: 'J', value: 11 },
                    { name: 'Q', value: 12 },
                    { name: 'K', value: 13 }
                ];
            },
            
            showBluffControls() {
                return this.gameData && 
                       this.gameData.canCallBluff && 
                       this.gameData.isCurrentPlayer &&
                       this.gameData.gameState === 'playing';
            },
            
            canPlayCards() {
                return this.gameData && 
                       this.gameData.isCurrentPlayer && 
                       this.gameData.gameState === 'playing' &&
                       this.selectedCards.length > 0;
            }
        },
        
        components: {
            'start-screen': {
                props: ['player', 'availableGames', 'isConnected'],
                emits: ['change-name', 'create-game', 'join-game', 'request-games-list'],
                data() {
                    return { newPlayerName: '' };
                },
                template: `
                    <div class="container">
                        <h1>🃏 Bluff Kartenspiel</h1>
                        <div :class="['status', isConnected ? 'connected' : 'disconnected']">
                            {{ isConnected ? '🟢 Verbunden' : '🔴 Getrennt' }}
                        </div>
                        <div class="player-info" v-if="player">
                            <h2>Spieler: {{ player.name }}</h2>
                            <div class="name-change">
                                <input v-model="newPlayerName" placeholder="Neuer Name" @keyup.enter="changeName" class="name-input" />
                                <button class="btn btn-success btn-small" @click="changeName">Namen ändern</button>
                            </div>
                        </div>
                        <div class="game-creation">
                            <button class="btn btn-success" @click="$emit('create-game')" :disabled="!isConnected">🆕 Neues Spiel erstellen</button>
                            <button class="btn btn-warning btn-small" @click="$emit('request-games-list')" :disabled="!isConnected">🔄 Spiele aktualisieren</button>
                        </div>
                        <div class="available-games">
                            <h3>📋 Verfügbare Spiele ({{ availableGames.length }})</h3>
                            <div v-if="availableGames.length === 0" class="no-games">Keine Spiele verfügbar. Erstelle ein neues Spiel!</div>
                            <div v-else class="games-list">
                                <div v-for="game in availableGames" :key="game.id" class="game-card" @click="$emit('join-game', game.id)">
                                    <h4>🎯 {{ game.host }} Spiel</h4>
                                    <p>👥 {{ game.playerCount }}/6 Spieler</p>
                                    <p>🎮 Status: {{ game.gameState === 'waiting' ? 'Wartet auf Spieler' : 'Läuft' }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                methods: {
                    changeName() {
                        if (this.newPlayerName.trim()) {
                            this.$emit('change-name', this.newPlayerName.trim());
                            this.newPlayerName = '';
                        }
                    }
                }
            },
            
            'lobby-screen': {
                props: ['gameData', 'player'],
                emits: ['toggle-ready', 'leave-game'],
                template: `
                    <div class="container">
                        <h1>🏁 Spiellobby</h1>
                        <div v-if="gameData" class="lobby-info">
                            <h2>Spiel: {{ gameData.gameId }}</h2>
                            <div class="players-list">
                                <h3>👥 Spieler ({{ gameData.players.length }}/6)</h3>
                                <div class="players-grid">
                                    <div v-for="p in gameData.players" :key="p.id" :class="['player-card', { 'current-player': p.id === player?.id }]">
                                        <span class="player-name">{{ p.name }}</span>
                                        <span v-if="p.ready" class="ready-status">✅ Bereit</span>
                                        <span v-else class="ready-status">⏳ Wartet</span>
                                    </div>
                                </div>
                            </div>
                            <div class="lobby-controls">
                                <button class="btn btn-success" @click="$emit('toggle-ready')">{{ getCurrentPlayerReady() ? '❌ Nicht bereit' : '✅ Bereit' }}</button>
                                <button class="btn btn-danger" @click="$emit('leave-game')">🚪 Spiel verlassen</button>
                            </div>
                            <div v-if="gameData.players.length >= 2" class="ready-info">
                                {{ getReadyCount() }}/{{ gameData.players.length }} Spieler bereit
                                <div v-if="allPlayersReady()" class="start-info">🚀 Spiel startet in Kürze...</div>
                            </div>
                            <div v-else class="waiting-info">⏳ Warte auf mindestens 2 Spieler...</div>
                        </div>
                    </div>
                `,
                methods: {
                    getCurrentPlayerReady() {
                        const currentPlayer = this.gameData?.players?.find(p => p.id === this.player?.id);
                        return currentPlayer?.ready || false;
                    },
                    getReadyCount() {
                        return this.gameData?.players?.filter(p => p.ready).length || 0;
                    },
                    allPlayersReady() {
                        return this.gameData?.players?.length >= 2 && this.gameData?.players?.every(p => p.ready);
                    }
                }
            },
            
            'game-screen': {
                props: ['gameData', 'player', 'playerHand', 'selectedCards', 'messages', 'availableValues', 'claimedValue', 'removedQuads', 'showValuePopup'],
                emits: ['toggle-card', 'play-cards', 'call-bluff', 'leave-game', 'update-claimed-value', 'clear-removed-quads', 'show-value-popup', 'hide-value-popup'],
                computed: {
                    showBluffControls() {
                        return this.gameData && this.gameData.canCallBluff && this.gameData.isCurrentPlayer && this.gameData.gameState === 'playing';
                    },
                    canPlayCards() {
                        return this.gameData && this.gameData.isCurrentPlayer && this.gameData.gameState === 'playing' && this.selectedCards.length > 0;
                    }
                },
                template: `
                    <div class="game-layout">
                        <div v-if="showValuePopup" class="popup-overlay" @click="$emit('hide-value-popup')">
                            <div class="popup-content" @click.stop>
                                <h3>🎯 Welcher Kartenwert?</h3>
                                <p>Du spielst {{ selectedCards.length }} Karte(n). Welchen Wert behauptest du?</p>
                                <div class="popup-values">
                                    <button v-for="val in availableValues" :key="val.value" class="btn btn-value" @click="selectValueAndPlay(val)">
                                        {{ selectedCards.length }}x {{ val.name }}
                                    </button>
                                </div>
                                <button class="btn btn-danger btn-small" @click="$emit('hide-value-popup')">Abbrechen</button>
                            </div>
                        </div>

                        <div class="messages-container">
                            <transition-group name="fade">
                                <div v-for="message in messages" :key="message.id" :class="['message', message.type]">{{ message.text }}</div>
                            </transition-group>
                        </div>
                        
                        <div class="game-table-container">
                            <div class="game-table">
                                <div class="players-circle">
                                    <div v-for="(p, index) in gameData.players" :key="p.id" :class="getPlayerPositionClass(index)">
                                        <div class="player-info">
                                            <div class="player-name">{{ p.name }}</div>
                                            <div class="card-count">{{ p.cardCount }} 🃏</div>
                                            <div v-if="index === gameData.currentPlayerIndex" class="turn-indicator">👆 Am Zug</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="center-pile">
                                    <div class="pile-info">
                                        <h3>📚 Stapel</h3>
                                        <p>{{ gameData.centerPileCount }} Karten</p>
                                        <div v-if="gameData.lastClaim" class="last-claim">
                                            <strong>Letzte Behauptung:</strong><br>
                                            {{ gameData.lastClaim.count }}x {{ gameData.lastClaim.value }}<br>
                                            von {{ gameData.lastClaim.player }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="side-panels">
                            <div v-if="removedQuads.length > 0" class="removed-quads-panel">
                                <h3>🗑️ Entfernte 4er-Kombinationen:</h3>
                                <div class="removed-list">
                                    <div v-for="entry in removedQuads" :key="entry.id" class="removed-entry">
                                        <strong>{{ entry.player }}</strong>: 4x {{ entry.value }}
                                    </div>
                                </div>
                                <button class="btn btn-small" @click="$emit('clear-removed-quads')">Leeren</button>
                            </div>
                        </div>

                        <div class="game-controls">
                            <div v-if="showBluffControls" class="bluff-controls">
                                <button class="btn btn-bluff" @click="$emit('call-bluff')">🚨 BLUFF! 🚨</button>
                                <p>Du kannst die Behauptung anzweifeln!</p>
                            </div>
                            
                            <div v-if="gameData?.isCurrentPlayer && !showBluffControls" class="play-controls">
                                <h3>🎯 Dein Zug</h3>
                                
                                <div v-if="!gameData.lastClaim">
                                    <div v-if="selectedCards.length > 0" class="selection-info">
                                        <p>{{ selectedCards.length }} Karte(n) ausgewählt</p>
                                        <p>Klicke auf "Karten spielen" um den Wert zu wählen</p>
                                    </div>
                                    <div v-else class="selection-info">
                                        <p>Wähle Karten aus deiner Hand aus</p>
                                    </div>
                                    <button class="btn btn-success" @click="$emit('show-value-popup')" :disabled="selectedCards.length === 0">🃏 Karten spielen</button>
                                </div>
                                
                                <div v-else>
                                    <div class="value-info">
                                        <p><strong>Fester Wert: {{ gameData.lastClaim.value }}</strong></p>
                                        <p>Du musst {{ gameData.lastClaim.value }} behaupten</p>
                                    </div>
                                    <div v-if="selectedCards.length > 0" class="selection-info">
                                        <p>{{ selectedCards.length }} Karte(n) ausgewählt</p>
                                        <p>Behaupte: {{ getNewClaimedCount() }}x {{ gameData.lastClaim.value }}</p>
                                    </div>
                                    <button class="btn btn-success" @click="playWithFixedValue" :disabled="selectedCards.length === 0">
                                        🃏 {{ selectedCards.length }}x {{ gameData.lastClaim.value }} spielen
                                    </button>
                                </div>
                            </div>
                            
                            <div v-if="!gameData?.isCurrentPlayer" class="waiting-message">
                                ⏳ {{ gameData?.currentPlayer || 'Unbekannt' }} ist am Zug...
                            </div>
                            
                            <div class="leave-section">
                                <button class="btn btn-danger btn-small" @click="$emit('leave-game')">🚪 Spiel verlassen</button>
                            </div>
                        </div>

                        <div class="player-hand-bottom">
                            <div class="player-hand-container">
                                <h3>🃏 Deine Karten ({{ playerHand.length }})</h3>
                                <div class="hand-cards">
                                    <div v-for="card in playerHand" :key="card.id" 
                                         :class="['card', card.color, { 'selected': selectedCards.includes(card.id) }]"
                                         @click="$emit('toggle-card', card.id)">
                                        {{ card.value }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                methods: {
                    selectValueAndPlay(value) {
                        console.log('🎯 Value selected:', value);
                        const normalValue = { name: value.name, value: value.value };
                        this.$emit('update-claimed-value', normalValue);
                        this.$nextTick(() => {
                            this.$emit('play-cards');
                            this.$emit('hide-value-popup');
                        });
                    },
                    playWithFixedValue() {
                        const fixedValue = this.availableValues.find(v => v.name === this.gameData.lastClaim.value);
                        const normalValue = { name: fixedValue.name, value: fixedValue.value };
                        this.$emit('update-claimed-value', normalValue);
                        this.$emit('play-cards');
                    },
                    getNewClaimedCount() {
                        if (this.gameData?.lastClaim) {
                            return this.gameData.lastClaim.count + this.selectedCards.length;
                        }
                        return this.selectedCards.length;
                    },
                    getPlayerPositionClass(index) {
                        const totalPlayers = this.gameData.players.length;
                        return [
                            'player-position', 
                            'position-' + totalPlayers + '-' + index,
                            { 
                                'current-turn': index === this.gameData.currentPlayerIndex,
                                'current-player': this.gameData.players[index].id === this.player?.id 
                            }
                        ];
                    }
                }
            },
            
            'winning-screen': {
                props: ['gameData', 'player'],
                emits: ['start-new-game', 'leave-game'],
                template: `
                    <div class="container">
                        <div class="win-screen">
                            <h1>🎉 Gewonnen! 🎉</h1>
                            <div class="winner-info">
                                <h2>{{ gameData?.winner || 'Unbekannter Gewinner' }} hat gewonnen!</h2>
                                <div v-if="gameData?.winner === player?.name" class="personal-win">🏆 Glückwunsch! Du hast das Spiel gewonnen! 🏆</div>
                                <div v-else class="other-win">🏅 Gut gespielt! Vielleicht gewinnst du das nächste Mal! 🏅</div>
                            </div>
                            <div class="win-controls">
                                <button class="btn btn-success" @click="$emit('start-new-game')">🔄 Neues Spiel</button>
                                <button class="btn btn-danger" @click="$emit('leave-game')">🚪 Spiel verlassen</button>
                            </div>
                        </div>
                    </div>
                `
            },
            
            'losing-screen': {
                props: ['gameData', 'player'],
                emits: ['start-new-game', 'leave-game'],
                template: `
                    <div class="container">
                        <div class="lose-screen">
                            <h1>💀 Verloren! 💀</h1>
                            <div class="loser-info">
                                <h2>{{ gameData?.loser || 'Unbekannter Verlierer' }} hat verloren!</h2>
                                <div v-if="gameData?.loser === player?.name" class="personal-lose">😞 Du hast das Spiel verloren! Mehr Glück beim nächsten Mal! 😞</div>
                                <div v-else class="other-lose">😬 {{ gameData?.loser }} hat verloren! Du bist noch im Rennen! 😬</div>
                            </div>
                            <div class="lose-controls">
                                <button class="btn btn-success" @click="$emit('start-new-game')">🔄 Neues Spiel</button>
                                <button class="btn btn-danger" @click="$emit('leave-game')">🚪 Spiel verlassen</button>
                            </div>
                        </div>
                    </div>
                `
            }
        },
        
        methods: {
            // Connection
            changeName() {
                if (this.newPlayerName.trim()) {
                    window.SocketAPI.changeName(this.newPlayerName.trim());
                    this.newPlayerName = '';
                }
            },
            
            // Navigation
            requestGamesList() {
                window.SocketAPI.requestGamesList();
            },
            
            createGame() {
                window.SocketAPI.createGame();
            },
            
            joinGame(gameId) {
                window.SocketAPI.joinGame(gameId);
            },
            
            leaveGame() {
                this.clearGameState();
                window.SocketAPI.leaveGame();
                this.currentScreen = 'menu';
            },
            
            startNewGame() {
                this.clearGameState();
                window.SocketAPI.startNewGame();
            },
            
            toggleReady() {
                window.SocketAPI.toggleReady();
            },
            
            // Game Logic
            toggleCardSelection(cardId) {
                const index = this.selectedCards.indexOf(cardId);
                if (index === -1) {
                    this.selectedCards.push(cardId);
                } else {
                    this.selectedCards.splice(index, 1);
                }
                console.log('🃏 Karte ausgewählt:', cardId);
            },
            
            playSelectedCards() {
                if (!this.canPlayCards) {
                    this.showMessage('error', 'Keine gültige Auswahl');
                    return;
                }
                
                if (!this.claimedValue) {
                    this.showMessage('error', 'Kein Wert ausgewählt');
                    return;
                }
                
                const playData = {
                    cardIds: [...this.selectedCards],
                    value: {
                        name: this.claimedValue.name,
                        value: this.claimedValue.value
                    },
                    count: this.claimedCount
                };
                
                console.log('🎯 Spiele Karten:', playData);
                
                window.SocketAPI.playCards(playData);
                this.selectedCards = [];
            },
            
            callBluff() {
                console.log('🚨 Rufe Bluff!');
                window.SocketAPI.callBluff();
            },
            
            updateClaimedValue(value) {
                this.claimedValue = value;
                console.log('🎯 Claimed Value updated:', value);
            },
            
            showValuePopupDialog() {
                this.showValuePopup = true;
            },
            
            hideValuePopupDialog() {
                this.showValuePopup = false;
            },
            
            // Removed Quads Management
            addRemovedQuads(playerName, cardValue) {
                this.removedQuads.push({
                    id: Date.now() + Math.random(),
                    player: playerName,
                    value: cardValue,
                    timestamp: new Date()
                });
            },
            
            clearRemovedQuads() {
                this.removedQuads = [];
            },
            
            // Message System
            showMessage(type, text) {
                const message = {
                    id: ++this.messageCounter,
                    type: type,
                    text: text,
                    timestamp: Date.now()
                };
                
                this.gameMessages.push(message);
                console.log(`💬 [${type.toUpperCase()}] ${text}`);
                
                const removeDelay = type === 'bluff-result' ? 8000 : 4000;
                setTimeout(() => {
                    const index = this.gameMessages.findIndex(m => m.id === message.id);
                    if (index !== -1) {
                        this.gameMessages.splice(index, 1);
                    }
                }, removeDelay);
            },
            
            clearMessages() {
                this.gameMessages = [];
            },
            
            // Game State Management
            clearGameState() {
                this.selectedCards = [];
                this.claimedValue = null;
                this.claimedCount = 1;
                this.playerHand = [];
                this.showValuePopup = false;
                this.clearMessages();
                console.log('🧹 Game State geleert');
            },
            
            updatePlayerHand(hand) {
                this.playerHand = hand || [];
                this.selectedCards = this.selectedCards.filter(cardId => 
                    this.playerHand.some(card => card.id === cardId)
                );
            }
        },
        
        mounted() {
            console.log('🚀 Bluff App gestartet');
            window.initSocketHandlers(this);
            window.SocketAPI = window.createSocketAPI();
        }
    });
    
    return app;
};

window.createSocketAPI = function() {
    const socket = io();
    
    return {
        changeName: (name) => socket.emit('changeName', { name }),
        requestGamesList: () => socket.emit('requestGamesList'),
        createGame: () => socket.emit('createGame'),
        joinGame: (gameId) => socket.emit('joinGame', { gameId }),
        leaveGame: () => socket.emit('leaveGame'),
        startNewGame: () => socket.emit('startNewGame'),
        toggleReady: () => socket.emit('toggleReady'),
        playCards: (data) => socket.emit('playCards', data),
        callBluff: () => socket.emit('callBluff')
    };
};
