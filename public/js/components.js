// Vue Components für das Bluff Kartenspiel - KOMPLETT GEFIXT

// === MENU SCREEN ===
window.MenuScreen = {
    props: ['games', 'playerName'],
    emits: ['create-game', 'join-game', 'change-name'],
    template: `
        <div style="text-align: center;">
            <h2>Willkommen beim Bluff-Spiel!</h2>
            <p>Lege Karten verdeckt ab und behaupte was du willst - andere können dich anzweifeln!</p>
            
            <div style="margin: 20px 0;">
                <input 
                    v-model="newName" 
                    @keyup.enter="changeName"
                    placeholder="Dein Name" 
                    maxlength="20"
                >
                <button class="btn" @click="changeName">Name ändern</button>
            </div>
            
            <button class="btn btn-success" @click="$emit('create-game')">
                Neues Spiel erstellen
            </button>
            
            <div>
                <div v-if="!games || games.length === 0" class="message info">
                    Keine Spiele verfügbar
                </div>
                <div 
                    v-for="game in games" 
                    :key="game.id"
                    class="game-card"
                    @click="$emit('join-game', game.id)"
                >
                    <h3>Spiel von {{ game.host }}</h3>
                    <p>Spieler: {{ game.playerCount }}/6</p>
                    <p>Status: {{ getGameStateText(game.gameState) }}</p>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            newName: this.playerName
        }
    },
    methods: {
        changeName() {
            if (this.newName.trim()) {
                this.$emit('change-name', this.newName.trim());
            }
        },
        getGameStateText(state) {
            const states = {
                'waiting': 'Wartet auf Spieler',
                'playing': 'Spiel läuft',
                'finished': 'Beendet'
            };
            return states[state] || state;
        }
    },
    watch: {
        playerName(newName) {
            this.newName = newName;
        }
    }
};

// === LOBBY SCREEN ===
window.LobbyScreen = {
    props: ['gameData', 'player', 'isReady'],
    emits: ['toggle-ready', 'leave-game'],
    template: `
        <div style="text-align: center;">
            <h2>{{ gameTitle }}</h2>
            <h3>Spieler:</h3>
            <div>
                <div 
                    v-for="player in gameData?.players || []" 
                    :key="player.id"
                    class="player-card"
                >
                    <h4>{{ player.name }}</h4>
                    <p :style="{ color: getReadyColor(player.id) }">
                        {{ getReadyText(player.id) }}
                    </p>
                </div>
            </div>
            <button 
                :class="['btn', isReady ? 'btn-warning' : 'btn-success']"
                @click="$emit('toggle-ready')"
            >
                {{ isReady ? 'Nicht bereit' : 'Bereit' }}
            </button>
            <button class="btn btn-danger" @click="$emit('leave-game')">
                Spiel verlassen
            </button>
        </div>
    `,
    computed: {
        gameTitle() {
            if (!this.gameData?.players?.length) return 'Lobby';
            return `Lobby - ${this.gameData.players.length}/6 Spieler`;
        }
    },
    methods: {
        getReadyColor(playerId) {
            return this.isPlayerReady(playerId) ? '#2ecc71' : '#e74c3c';
        },
        getReadyText(playerId) {
            return this.isPlayerReady(playerId) ? 'Bereit' : 'Nicht bereit';
        },
        isPlayerReady(playerId) {
            const player = this.gameData?.players?.find(p => p.id === playerId);
            return player?.ready || false;
        }
    }
};

// === GAME TABLE ===
window.GameTable = {
    props: ['gameData', 'player'],
    template: `
        <div class="game-table">
            <div class="center-area">
                <div class="center-pile">
                    <h3>Kartenstapel</h3>
                    <p>{{ gameData?.centerPileCount || 0 }} Karten</p>
                    
                    <div v-if="gameData?.lastClaim" class="last-claim">
                        <h4>Letzte Behauptung:</h4>
                        <p>{{ gameData.lastClaim.player }} behauptet:</p>
                        <p><strong>{{ gameData.lastClaim.count }}x {{ gameData.lastClaim.value }}</strong></p>
                    </div>
                </div>
                
                <div class="players-circle">
                    <div 
                        v-for="p in gameData?.players || []" 
                        :key="p.id"
                        :class="['player-spot', { 
                            'current-player': p.name === gameData?.currentPlayer,
                            'my-player': p.name === player?.name
                        }]"
                    >
                        <h4>{{ p.name }}</h4>
                        <p>{{ p.cardCount }} Karten</p>
                        <div v-if="p.name === gameData?.currentPlayer" class="current-indicator">
                            🎯 Am Zug
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
};

// === FIXED PLAYER HAND - Mit Kartenfarben ===
window.PlayerHand = {
    props: ['playerHand', 'selectedCards'],
    emits: ['toggle-card'],
    template: `
        <div class="player-hand">
            <h3>Deine Hand ({{ playerHand?.length || 0 }} Karten)</h3>
            <div class="hand-cards">
                <div 
                    v-for="card in playerHand || []" 
                    :key="card.id"
                    :class="['card', card.color, { 'selected': isSelected(card.id) }]"
                    @click="$emit('toggle-card', card.id)"
                >
                    {{ card.value }}{{ getSuitSymbol(card.color) }}
                </div>
            </div>
        </div>
    `,
    methods: {
        isSelected(cardId) {
            return this.selectedCards.includes(cardId);
        },
        getSuitSymbol(color) {
            const symbols = {
                hearts: '♥',
                diamonds: '♦',
                clubs: '♣',
                spades: '♠'
            };
            return symbols[color] || '';
        }
    }
};

// === NEU: 4ER-REMOVED LISTE ===
window.QuadsRemovedPanel = {
    props: ['removedQuads'],
    emits: ['clear'],
    template: `
        <div v-if="removedQuads && removedQuads.length > 0" class="quads-removed-panel">
            <h3>🗑️ Entfernte 4er-Kombinationen:</h3>
            <div class="quads-entries">
                <div v-for="entry in removedQuads" :key="entry.id" class="quads-entry">
                    <strong>{{ entry.player }}</strong>: 4x {{ entry.value }}
                </div>
            </div>
            <button class="btn btn-small" @click="$emit('clear')">Leeren</button>
        </div>
    `
};

// === REMOVED CARDS PANEL (für andere entfernte Karten) ===
window.RemovedCardsPanel = {
    props: ['removedCards'],
    emits: ['clear'],
    template: `
        <div v-if="removedCards && removedCards.length > 0" class="removed-cards-panel">
            <h3>📋 Entfernte Karten:</h3>
            <div class="removed-entries">
                <div v-for="entry in removedCards" :key="entry.id" class="removed-entry">
                    <strong>{{ entry.player }}</strong>: {{ entry.count }}x {{ entry.value }}
                </div>
            </div>
            <button class="btn btn-small" @click="$emit('clear')">Leeren</button>
        </div>
    `
};

// === PLAYED CARDS PANEL ===
window.PlayedCardsPanel = {
    props: ['gameData'],
    template: `
        <div v-if="gameData?.lastAction" class="played-cards-panel">
            <h3>📋 Letzte Aktion:</h3>
            <p>{{ gameData.lastAction.message }}</p>
        </div>
    `
};

// === FIXED GAME SCREEN - Mit korrigiertem Bluff Button ===
window.GameScreen = {
    props: ['gameData', 'player', 'playerHand', 'selectedCards', 'messages'],
    emits: ['toggle-card', 'play-cards', 'call-bluff', 'leave-game'],
    components: {
        'game-table': window.GameTable,
        'player-hand': window.PlayerHand
    },
    template: `
        <div>
            <!-- Messages -->
            <div>
                <transition-group name="fade">
                    <div 
                        v-for="message in messages" 
                        :key="message.id"
                        :class="['message', message.type]"
                    >
                        {{ message.text }}
                    </div>
                </transition-group>
            </div>
            
            <!-- Game Table -->
            <game-table 
                :game-data="gameData"
                :player="player"
            ></game-table>

            <!-- Game Controls -->
            <div class="game-controls">
                <!-- FIXED: Bluff Controls -->
                <div v-if="showBluffControls" style="text-align: center; margin: 20px 0;">
                    <button class="btn btn-bluff" @click="$emit('call-bluff')">
                        🚨 BLUFF! 🚨
                    </button>
                    <p style="margin: 10px 0; font-size: 14px;">
                        Du kannst die Behauptung anzweifeln!
                    </p>
                </div>

                <!-- Card Selection Info -->
                <div v-if="gameData?.isCurrentPlayer" class="selection-info">
                    <div v-html="selectionInfoText"></div>
                </div>

                <!-- Value Selection for First Play -->
                <div v-if="gameData?.isCurrentPlayer && !gameData?.lastClaim">
                    <label>Kartenwert wählen:</label>
                    <select v-model="claimedValue">
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                        <option value="6">6</option>
                        <option value="7">7</option>
                        <option value="8">8</option>
                        <option value="9">9</option>
                        <option value="10">10</option>
                        <option value="11">J</option>
                        <option value="12">Q</option>
                        <option value="13">K</option>
                    </select>
                </div>

                <!-- Play Button -->
                <div v-if="gameData?.isCurrentPlayer">
                    <button 
                        :class="['btn', canPlayCards ? 'btn-success' : 'btn-disabled']"
                        :style="{ background: playButtonColor }"
                        :disabled="!canPlayCards"
                        @click="playCards"
                    >
                        {{ playButtonText }}
                    </button>
                </div>

                <!-- Leave Game -->
                <button class="btn btn-danger" @click="$emit('leave-game')">
                    Spiel verlassen
                </button>
            </div>

            <!-- Player Hand -->
            <player-hand 
                :player-hand="playerHand"
                :selected-cards="selectedCards"
                @toggle-card="$emit('toggle-card', $event)"
            ></player-hand>
        </div>
    `,
    data() {
        return {
            claimedValue: '2'
        }
    },
    computed: {
        // FIXED: Korrigierte Bluff Controls Logic
        showBluffControls() {
            return this.gameData?.isCurrentPlayer && 
                   this.gameData?.canCallBluff && 
                   this.gameData?.lastClaim;
        },
        selectionInfoText() {
            if (this.gameData?.lastClaim) {
                const newTotal = this.gameData.lastClaim.count + this.selectedCards.length;
                return `<strong>Du musst ${this.gameData.lastClaim.value} behaupten!</strong><br>
                        Aktuelle Behauptung: ${this.gameData.lastClaim.count}x ${this.gameData.lastClaim.value}<br>
                        Deine Karten: ${this.selectedCards.length} → Neue Gesamtanzahl: ${newTotal}x ${this.gameData.lastClaim.value}<br>
                        (Mindestens 1 Karte erforderlich)`;
            }
            return `${this.selectedCards.length} Karte(n) ausgewählt`;
        },
        canPlayCards() {
            if (!this.selectedCards.length || !this.gameData?.isCurrentPlayer) return false;
            if (this.gameData?.lastClaim) {
                return this.selectedCards.length >= 1;
            }
            return true;
        },
        playButtonText() {
            if (!this.selectedCards.length) return 'Karten wählen';
            if (this.gameData?.lastClaim) {
                if (this.selectedCards.length >= 1) {
                    const newTotal = this.gameData.lastClaim.count + this.selectedCards.length;
                    return `${this.selectedCards.length} hinzufügen → ${newTotal}x ${this.gameData.lastClaim.value}`;
                }
                return 'Mindestens 1 Karte erforderlich';
            }
            return `${this.selectedCards.length} Karte(n) spielen`;
        },
        playButtonColor() {
            return this.canPlayCards ? 
                'linear-gradient(135deg, #2ecc71, #27ae60)' : 
                'linear-gradient(135deg, #95a5a6, #7f8c8d)';
        }
    },
    watch: {
        'gameData.lastClaim'(newClaim) {
            if (newClaim) {
                const valueMap = {
                    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', 
                    '8': '8', '9': '9', '10': '10', 'J': '11', 'Q': '12', 'K': '13'
                };
                this.claimedValue = valueMap[newClaim.value] || newClaim.value;
            }
        }
    },
    methods: {
        playCards() {
            this.$emit('play-cards', {
                cardIds: this.selectedCards,
                claimedValue: this.claimedValue
            });
        }
    }
};

// === WINNING SCREEN ===
window.WinningScreen = {
    props: ['gameData', 'player'],
    emits: ['start-new-game', 'leave-game'],
    template: `
        <div class="end-screen winning-screen">
            <div class="end-content">
                <div class="trophy">🏆</div>
                <h1 v-if="isWinner">DU HAST GEWONNEN!</h1>
                <h1 v-else>{{ gameData?.winner }} HAT GEWONNEN!</h1>
                
                <div class="winner-info">
                    <p v-if="isWinner">Glückwunsch! Du warst der Beste!</p>
                    <p v-else>{{ gameData?.winner }} hat alle Karten erfolgreich abgelegt!</p>
                </div>
                
                <div class="final-stats">
                    <h3>Endstand:</h3>
                    <div v-for="p in sortedPlayers" :key="p.id" class="player-result">
                        <span :class="{ 'winner-name': p.name === gameData?.winner }">
                            {{ p.name }}: {{ p.cardCount }} Karten
                        </span>
                    </div>
                </div>
                
                <button class="btn btn-success" @click="$emit('start-new-game')">
                    Neues Spiel
                </button>
                <button class="btn btn-secondary" @click="$emit('leave-game')">
                    Lobby verlassen
                </button>
            </div>
        </div>
    `,
    computed: {
        isWinner() {
            return this.player?.name === this.gameData?.winner;
        },
        sortedPlayers() {
            if (!this.gameData?.players) return [];
            return [...this.gameData.players].sort((a, b) => a.cardCount - b.cardCount);
        }
    }
};

// === LOSING SCREEN ===
window.LosingScreen = {
    props: ['gameData', 'player'],
    emits: ['start-new-game', 'leave-game'],
    template: `
        <div class="end-screen losing-screen">
            <div class="end-content">
                <div class="skull">💀</div>
                <h1 v-if="isLoser">DU HAST VERLOREN!</h1>
                <h1 v-else>{{ gameData?.loser }} HAT VERLOREN!</h1>
                
                <div class="loser-info">
                    <p v-if="isLoser">Du hattest 4 Asse und verlierst das Spiel!</p>
                    <p v-else>{{ gameData?.loser }} hatte 4 Asse und verliert das Spiel!</p>
                </div>
                
                <div class="final-stats">
                    <h3>Endstand:</h3>
                    <div v-for="p in sortedPlayers" :key="p.id" class="player-result">
                        <span :class="{ 'loser-name': p.name === gameData?.loser }">
                            {{ p.name }}: {{ p.cardCount }} Karten
                        </span>
                    </div>
                </div>
                
                <button class="btn btn-warning" @click="$emit('start-new-game')">
                    Neues Spiel
                </button>
                <button class="btn btn-secondary" @click="$emit('leave-game')">
                    Lobby verlassen
                </button>
            </div>
        </div>
    `,
    computed: {
        isLoser() {
            return this.player?.name === this.gameData?.loser;
        },
        sortedPlayers() {
            if (!this.gameData?.players) return [];
            return [...this.gameData.players].sort((a, b) => a.cardCount - b.cardCount);
        }
    }
};
