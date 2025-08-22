// Vue.js App für Bluff Kartenspiel

window.createBluffApp = function() {
    const { createApp } = Vue;

    const __localComponents = {
        'start-screen': {
            props: ['player', 'availableGames', 'isConnected'],
            emits: ['change-name', 'create-game', 'join-game', 'request-games-list'],
            data() { return { newPlayerName: '' }; },
            template: `
                <div class="container">
                    <h1>🃏 Bluff Kartenspiel</h1>
                    <div :class="['status', isConnected ? 'connected' : 'disconnected']">
                        {{ isConnected ? '🟢 Verbunden' : '🔴 Getrennt' }}
                    </div>
                    <div class="player-info" v-if="player">
                        <h2>Spieler: {{ player.name || player.id }}</h2>
                        <div class="name-change">
                            <input v-model="newPlayerName" placeholder="Neuer Name"
                                   @keyup.enter="changeName" class="name-input" />
                            <button class="btn btn-success btn-small" @click="changeName">Namen ändern</button>
                        </div>
                    </div>
                    <div class="game-creation">
                        <button class="btn btn-success" @click="$emit('create-game')" :disabled="!isConnected">🆕 Neues Spiel</button>
                        <button class="btn btn-warning btn-small" @click="$emit('request-games-list')" :disabled="!isConnected">🔄 Aktualisieren</button>
                    </div>
                    <div class="available-games">
                        <h3>📋 Verfügbare Spiele ({{ availableGames.length }})</h3>
                        <div v-if="availableGames.length === 0" class="no-games">Keine Spiele verfügbar</div>
                        <div v-else class="games-list">
                            <div v-for="game in availableGames" :key="game.id" class="game-card"
                                 @click="$emit('join-game', game.id)">
                                <h4>🎯 {{ game.host }} Spiel</h4>
                                <p>👥 {{ game.playerCount }}/6 Spieler</p>
                                <p>🎮 Status: {{ game.gameState === 'waiting' ? 'Wartet' : 'Läuft' }}</p>
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
                                <div v-for="p in gameData.players" :key="p.id"
                                     :class="['player-card', { ready: p.ready }]">
                                    <div class="player-name">{{ p.name }}</div>
                                    <div class="player-status">{{ p.ready ? '✅ Bereit' : '⏳ Nicht bereit' }}</div>
                                </div>
                            </div>
                        </div>
                        <div class="lobby-controls">
                            <button class="btn btn-success" @click="$emit('toggle-ready')">✅/❌ Ready</button>
                            <button class="btn btn-danger" @click="$emit('leave-game')">🚪 Verlassen</button>
                        </div>
                    </div>
                </div>
            `
        },

        'game-screen': {
            props: ['gameData', 'player', 'playerHand', 'selectedCards', 'messages',
                    'availableValues', 'claimedValue', 'removedQuads', 'showValuePopup'],
            emits: ['toggle-card', 'play-cards', 'call-bluff', 'leave-game',
                    'update-claimed-value', 'clear-removed-quads',
                    'show-value-popup', 'hide-value-popup'],
            template: `
                <div class="game-layout">
                    
                    <!-- Popup zur Wertwahl (Ass gesperrt) -->
                    <div v-if="showValuePopup" class="popup-overlay" @click="$emit('hide-value-popup')">
                        <div class="popup-content" @click.stop>
                            <h3>🎯 Welcher Wert?</h3>
                            <p>Du spielst {{ selectedCards.length }} Karte(n)</p>
                            <div class="popup-values">
                                <button v-for="val in getSelectableValues()" :key="val.value"
                                        class="btn btn-value" @click="selectValueAndPlay(val)">
                                    {{ selectedCards.length }}x {{ val.name }}
                                </button>
                            </div>
                            <button class="btn btn-danger btn-small" @click="$emit('hide-value-popup')">Abbrechen</button>
                        </div>
                    </div>

                    <!-- Spieler im Kreis -->
                    <div class="table-circle">
                        <div v-for="(p,i) in gameData.players" :key="p.id" 
                             class="player-slot" 
                             :style="getPlayerPositionStyle(i, gameData.players.length)">
                            <div class="player-name" :class="{ me: player && p.id === player.id }">
                                {{ p.name }} ({{ p.cardCount }})
                            </div>
                            <div v-if="gameData.currentPlayer === p.name" class="turn-indicator">▶️</div>
                        </div>
                    </div>

                    <!-- Letzte Behauptung -->
                    <div class="last-claim" v-if="gameData.lastClaim">
                        Letzte Behauptung: {{ gameData.lastClaim.count }}x {{ gameData.lastClaim.value }}
                    </div>

                    <!-- Entfernte Quads -->
                    <div v-if="removedQuads.length > 0" class="removed-quads-panel">
                        <h3>🗑️ Entfernte 4er-Kombinationen:</h3>
                        <div v-for="entry in removedQuads" :key="entry.id" class="removed-entry">
                            {{ entry.player }}: 4x {{ entry.value }}
                        </div>
                        <button class="btn btn-small" @click="$emit('clear-removed-quads')">Leeren</button>
                    </div>

                    <!-- Controls -->
                    <div class="game-controls">
                      <template v-if="gameData && gameData.isCurrentPlayer">
                        <!-- Es gibt schon eine Behauptung: beides zeigen -->
                        <template v-if="gameData.lastClaim">
                          <button class="btn btn-bluff" @click="$emit('call-bluff')">🚨 BLUFF!</button>
                          <button class="btn btn-success"
                                  :disabled="selectedCards.length===0"
                                  @click="$emit('play-cards')">Karten spielen</button>
                        </template>
                        <!-- Erste Ansage: nur Karten spielen (mit Wertauswahl) -->
                        <template v-else>
                          <button class="btn btn-success"
                                  :disabled="selectedCards.length===0"
                                  @click="$emit('show-value-popup')">Karten spielen</button>
                        </template>
                      </template>
                      <!-- Leave-Button immer sichtbar -->
                      <button class="btn btn-danger btn-small" @click="$emit('leave-game')">🚪 Spiel verlassen</button>
                    </div>

                    <!-- Hand unten -->
                    <div class="hand-panel">
                        <h3>🖐️ Deine Hand ({{ playerHand.length }})</h3>
                        <div class="cards">
                            <div v-for="card in playerHand"
                                 :key="card?.id || card"
                                 class="card"
                                 :class="[getSuitClass(card), { selected: selectedCards.includes(card) }]"
                                 @click="$emit('toggle-card', card)">
                                <div class="card-rank">{{ getCardRank(card) }}</div>
                                <div class="card-suit">{{ getCardSuitSymbol(card) }}</div>
                            </div>
                        </div>
                    </div>

                </div>
            `,
            methods: {
                selectValueAndPlay(val) {
                    this.$emit('update-claimed-value', { name: val.name, value: val.value });
                    this.$emit('play-cards');
                    this.$emit('hide-value-popup');
                },
                getSelectableValues() {
                    return Array.isArray(this.availableValues)
                        ? this.availableValues.filter(v => Number(v.value) !== 14)
                        : [];
                },
                getPlayerPositionStyle(index, total) {
                    const angle = (360 / Math.max(total, 1)) * index;
                    const radius = 160;
                    const x = Math.cos((angle - 90) * Math.PI/180) * radius;
                    const y = Math.sin((angle - 90) * Math.PI/180) * radius;
                    return {
                        position: 'absolute',
                        left: `calc(50% + ${x}px)`,
                        top: `calc(50% + ${y}px)`,
                        transform: 'translate(-50%, -50%)'
                    };
                },
                normalizeCard(raw) {
                    if (!raw) return { rank: '', suit: '' };
                    if (typeof raw === 'string') {
                        const parts = raw.split('-');
                        const rankRaw = parts[0] || '';
                        const suitRaw = parts[1] || '';
                        return { rank: rankRaw, suit: suitRaw };
                    }
                    const rank = (raw && (raw.rank || raw.value)) || '';
                    const suit = (raw && (raw.suit || raw.color)) || '';
                    return { rank, suit };
                },
                rankToLabel(r) {
                    const s = String(r || '').trim().toUpperCase();
                    const map = { '1':'A','11':'J','12':'Q','13':'K','14':'A' };
                    return map[s] || s;
                },
                suitToKey(suit) {
                    const s = String(suit || '').trim().toLowerCase();
                    if (['herz','heart','hearts','♥','h'].includes(s)) return 'herz';
                    if (['karo','diamond','diamonds','♦','d'].includes(s)) return 'karo';
                    if (['pik','spade','spades','peek','♠','s'].includes(s)) return 'pik';
                    if (['kreuz','club','clubs','♣','c'].includes(s)) return 'kreuz';
                    return 'unknown';
                },
                suitKeyToSymbol(key) {
                    switch (key) {
                        case 'herz': return '♥';
                        case 'karo': return '♦';
                        case 'pik': return '♠';
                        case 'kreuz': return '♣';
                        default: return '❓';
                    }
                },
                getSuitClass(card) {
                    const c = this.normalizeCard(card);
                    return `suit-${this.suitToKey(c.suit)}`;
                },
                getCardRank(card) {
                    const c = this.normalizeCard(card);
                    return this.rankToLabel(c.rank);
                },
                getCardSuitSymbol(card) {
                    const c = this.normalizeCard(card);
                    return this.suitKeyToSymbol(this.suitToKey(c.suit));
                }
            }
        },

        'winning-screen': {
            props: ['gameData', 'player'],
            emits: ['start-new-game', 'leave-game'],
            template: `
                <div class="container">
                    <h1>🎉 Gewonnen!</h1>
                    <p>{{ gameData?.winner }} hat das Spiel gewonnen.</p>
                    <button class="btn btn-success" @click="$emit('start-new-game')">🔄 Neues Spiel</button>
                    <button class="btn btn-danger" @click="$emit('leave-game')">🚪 Verlassen</button>
                </div>
            `
        },
        'losing-screen': {
            props: ['gameData', 'player'],
            emits: ['start-new-game', 'leave-game'],
            template: `
                <div class="container">
                    <h1>💀 Verloren!</h1>
                    <p>{{ gameData?.loser }} hat verloren.</p>
                    <button class="btn btn-success" @click="$emit('start-new-game')">🔄 Neues Spiel</button>
                    <button class="btn btn-danger" @click="$emit('leave-game')">🚪 Verlassen</button>
                </div>
            `
        }
    };

    const app = createApp({
        data() {
            return {
                connectionStatus: 'disconnected',
                player: null,
                currentScreen: 'menu',
                availableGames: [],
                gameData: null,
                playerHand: [],
                selectedCards: [],
                claimedValue: null,
                showValuePopup: false,
                gameMessages: [],
                messageCounter: 0,
                removedCards: [],
                removedQuads: []
            };
        },
        computed: {
            isConnected() { return this.connectionStatus === 'connected'; },
            availableValues() {
                return [
                    { name: '2', value: 2 }, { name: '3', value: 3 }, { name: '4', value: 4 },
                    { name: '5', value: 5 }, { name: '6', value: 6 }, { name: '7', value: 7 },
                    { name: '8', value: 8 }, { name: '9', value: 9 }, { name: '10', value: 10 },
                    { name: 'J', value: 11 }, { name: 'Q', value: 12 }, { name: 'K', value: 13 },
                    { name: 'A', value: 14 }
                ];
            }
        },
        components: __localComponents,
        mounted() { this.initSocketHandlers(); },
        methods: {
            initSocketHandlers() { window.initSocketHandlers(this); },
            showValuePopupDialog() { this.showValuePopup = true; },
            hideValuePopupDialog() { this.showValuePopup = false; },
            clearGameState() {
                this.selectedCards = [];
                this.playerHand = [];
                this.claimedValue = null;
                this.removedCards = [];
                this.removedQuads = [];
                this.gameMessages = [];
                console.log('🧹 Game State geleert');
            },
            clearRemovedCards() { this.removedCards = []; },
            clearRemovedQuads() { this.removedQuads = []; },
            clearRemovedCardsAndQuads() { this.removedCards = []; this.removedQuads = []; },
            showMessage(type, text) {
                const msg = { id: ++this.messageCounter, type, text };
                this.gameMessages.push(msg);
                setTimeout(() => {
                    this.gameMessages = this.gameMessages.filter(m => m.id !== msg.id);
                }, 8000);
            },
            changeName(name) { window.SocketAPI.changeName(name); },
            createGame() { window.SocketAPI.createGame(); },
            joinGame(id) {
                this.gameData = {
                    gameId: id, gameState: 'waiting', players: [],
                    currentPlayerIndex: 0, currentPlayer: null, lastClaim: null
                };
                this.currentScreen = 'lobby';
                this.showMessage('info', `Lobby ${id} beitreten...`);
                window.SocketAPI.joinGame(id);
                setTimeout(() => window.SocketAPI.requestGamesList(), 500);
            },
            toggleReady() { window.SocketAPI.toggleReady(); },
            leaveGame() { window.SocketAPI.leaveGame(); this.currentScreen = 'menu'; },
            startNewGame() { this.clearGameState(); window.SocketAPI.startNewGame(); },
            playSelectedCards() {
                if (!Array.isArray(this.selectedCards) || this.selectedCards.length === 0) {
                    this.showMessage('error', 'Keine Karten ausgewählt');
                    return;
                }
                const gameId = this && this.gameData ? this.gameData.gameId : null;
                const playerId = window.SocketAPI.getId();
                const playerName = this && this.player ? this.player.name : null;
                if (!gameId || !playerId) {
                    this.showMessage('error', 'Spieler oder Spiel nicht gefunden');
                    return;
                }
                let claim;
                if (this.gameData && this.gameData.lastClaim) {
                    const last = this.gameData.lastClaim;
                    claim = { count: Number(last.count) + this.selectedCards.length, value: last.value };
                } else {
                    if (!this.claimedValue || Number(this.claimedValue.value) === 14) {
                        this.showMessage('error', 'Bitte einen gültigen Wert (kein Ass) wählen');
                        return;
                    }
                    claim = { count: this.selectedCards.length, value: this.claimedValue.value };
                }
                const payload = { gameId, playerId, playerName, cards: this.selectedCards.slice(), claim };
                console.log('🃏 Sende Zug:', payload);
                window.SocketAPI.playCards(payload);
                this.showValuePopup = false;
                this.selectedCards = [];
            },
            callBluff() { window.SocketAPI.callBluff(); },
            requestGamesList() { window.SocketAPI.requestGamesList(); },
            updateClaimedValue(v) { this.claimedValue = v; },
            toggleCardSelection(card) {
                const i = this.selectedCards.indexOf(card);
                if (i === -1) this.selectedCards.push(card); else this.selectedCards.splice(i, 1);
            },
            updatePlayerHand(newHand) { this.playerHand = Array.isArray(newHand) ? newHand : []; }
        }
    });

    Object.entries(__localComponents).forEach(([n, def]) => app.component(n, def));

    window.SocketAPI = window.SocketAPI || {
        changeName() {}, requestGamesList() {}, createGame() {},
        joinGame() {}, leaveGame() {}, startNewGame() {},
        toggleReady() {}, playCards() {}, callBluff() {}, getId: () => null
    };

    return app;
};

