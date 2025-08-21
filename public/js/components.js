// Vue Components für das Bluff Kartenspiel

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
                :class="['btn', isReady ? 'btn-success' : 'btn-warning']"
                @click="$emit('toggle-ready')"
            >
                {{ isReady ? 'Bereit ✓' : 'Bereit' }}
            </button>
            <button class="btn btn-danger" @click="$emit('leave-game')">
                Spiel verlassen
            </button>
        </div>
    `,
    computed: {
        gameTitle() {
            const count = this.gameData?.players?.length || 0;
            return `Bluff-Spiel (${count}/6 Spieler)`;
        }
    },
    methods: {
        getReadyColor(playerId) {
            const player = this.gameData?.players?.find(p => p.id === playerId);
            return player?.ready ? '#2ecc71' : '#f39c12';
        },
        getReadyText(playerId) {
            const player = this.gameData?.players?.find(p => p.id === playerId);
            return player?.ready ? 'Bereit ✓' : 'Warten...';
        }
    }
};

window.GameTable = {
    props: ['gameData', 'player'],
    template: `
        <div class="game-table">
            <div class="table-center">
                <div v-if="gameData?.lastClaim">
                    <h4>Letzte Behauptung:</h4>
                    <p>{{ lastClaimText }}</p>
                </div>
                <div>
                    <p>Karten in der Mitte: {{ gameData?.centerPileCount || 0 }}</p>
                </div>
            </div>
            
            <div 
                v-for="(otherPlayer, index) in otherPlayers" 
                :key="otherPlayer.id"
                :class="getPlayerSeatClass(otherPlayer, index)"
            >
                <h4>{{ otherPlayer.name }}</h4>
                <p>{{ otherPlayer.cardCount }} Karten</p>
                <p v-if="isCurrentTurn(otherPlayer)"><strong>Am Zug</strong></p>
            </div>
        </div>
    `,
    computed: {
        otherPlayers() {
            if (!this.gameData?.players || !this.player) return [];
            return this.gameData.players.filter(p => p.id !== this.player.id);
        },
        lastClaimText() {
            const claim = this.gameData?.lastClaim;
            if (!claim) return '';
            return `${claim.player} behauptet: ${claim.count} x ${claim.value}`;
        }
    },
    methods: {
        isCurrentTurn(player) {
            return this.gameData?.currentPlayer === player.name;
        },
        getPlayerSeatClass(player, index) {
            const positions = ['seat-top', 'seat-right', 'seat-bottom-right', 'seat-bottom-left', 'seat-left'];
            const baseClass = `player-seat ${positions[index % positions.length]}`;
            return this.isCurrentTurn(player) ? `${baseClass} current-turn` : baseClass;
        }
    }
};

window.PlayerHand = {
    props: ['cards', 'selectedCards'],
    emits: ['toggle-card'],
    template: `
        <div class="my-hand">
            <div style="margin-bottom: 15px;">
                <h3>Deine Karten ({{ cards?.length || 0 }})</h3>
            </div>
            <div>
                <div v-if="!cards || cards.length === 0" style="color: #888;">
                    Keine Karten vorhanden
                </div>
                <div 
                    v-for="card in cards" 
                    :key="card.id"
                    :class="getCardClass(card)"
                    @click="$emit('toggle-card', card.id)"
                >
                    <div style="font-size: 14px; font-weight: bold;">{{ card.value }}</div>
                    <div style="font-size: 16px; margin-top: 5px;">{{ getSuitSymbol(card.suit) }}</div>
                </div>
            </div>
        </div>
    `,
    methods: {
        getCardClass(card) {
            const isSelected = this.selectedCards.includes(card.id);
            return `card ${card.suit}${isSelected ? ' selected' : ''}`;
        },
        getSuitSymbol(suit) {
            const symbols = {
                hearts: '♥',
                diamonds: '♦',
                clubs: '♣',
                spades: '♠'
            };
            return symbols[suit] || suit;
        }
    }
};

window.RemovedCardsPanel = {
    props: ['removedCards'],
    emits: ['clear'],
    template: `
        <div v-if="removedCards.length > 0" class="removed-cards-panel">
            <h4>🗑️ Entfernte Karten</h4>
            <div>
                <div 
                    v-for="removed in removedCards" 
                    :key="removed.id"
                    class="removed-card-group"
                >
                    <div class="player-name">{{ removed.player }}</div>
                    <div class="cards">{{ removed.count }}x {{ removed.value }}</div>
                </div>
            </div>
            <button class="btn" @click="$emit('clear')" style="margin-top: 10px; padding: 5px 10px; font-size: 12px;">
                Liste leeren
            </button>
        </div>
    `
};

window.PlayedCardsPanel = {
    props: ['gameData'],
    template: `
        <div v-if="showPanel" class="played-cards-panel">
            <h4>🎯 Aktuelle Runde</h4>
            
            <div class="current-claim" v-if="gameData?.lastClaim">
                <div class="claim-header">
                    <strong>{{ gameData.lastClaim.player }}</strong> behauptet:
                </div>
                <div class="claim-content">
                    {{ gameData.lastClaim.count }}x {{ gameData.lastClaim.value }}
                </div>
            </div>
            <div class="pile-info">
                <div class="pile-count">
                    📚 {{ gameData?.centerPileCount || 0 }} Karten in der Mitte
                </div>
            </div>
        </div>
    `,
    computed: {
        showPanel() {
            return this.gameData?.gameState === 'playing' && 
                   (this.gameData?.lastClaim || (this.gameData?.centerPileCount || 0) > 0);
        }
    }
};

// === GAME SCREEN (Muss nach GameTable und PlayerHand kommen!) ===
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
                <!-- Bluff Controls -->
                <div v-if="showBluffControls" style="text-align: center; margin: 20px 0;">
                    <button class="btn btn-bluff" @click="$emit('call-bluff')">
                        BLUFF!
                    </button>
                    <p>Zweifel die Behauptung an!</p>
                </div>
                
                <!-- Play Controls -->
                <div v-if="showPlayControls">
                    <h3>Du bist am Zug!</h3>
                    
                    <div v-if="selectedCards.length > 0" class="selection-info">
                        <div v-html="selectionInfoText"></div>
                    </div>
                    
                    <div>
                        <label>Wert behaupten:</label>
                        <select v-model="claimedValue" :disabled="valueDisabled">
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
                        
                        <button 
                            class="btn btn-success" 
                            @click="playCards"
                            :disabled="!canPlayCards"
                            :style="{ background: playButtonColor }"
                        >
                            {{ playButtonText }}
                        </button>
                    </div>
                </div>
                
                <button class="btn btn-danger" @click="$emit('leave-game')">
                    Spiel verlassen
                </button>
            </div>

            <!-- Player Hand -->
            <player-hand 
                :cards="playerHand"
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
        showBluffControls() {
            return this.gameData?.isCurrentPlayer && 
                   this.gameData?.canCallBluff && 
                   this.gameData?.lastClaim;
        },
        showPlayControls() {
            return this.gameData?.isCurrentPlayer;
        },
        valueDisabled() {
            return !!this.gameData?.lastClaim;
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

window.WinningScreen = {
    props: ['gameData', 'player'],
    emits: ['leave-game'],
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
                
                <button class="btn btn-success" @click="$emit('leave-game')">
                    Neues Spiel
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

window.LosingScreen = {
    props: ['gameData', 'player'],
    emits: ['leave-game'],
    template: `
        <div class="end-screen losing-screen">
            <div class="end-content">
                <div class="skull">💀</div>
                <h1 v-if="isLoser">DU HAST VERLOREN!</h1>
                <h1 v-else>{{ gameData?.loser }} HAT VERLOREN!</h1>
                
                <div class="loser-info">
                    <p v-if="isLoser">{{ loseReason }}</p>
                    <p v-else>{{ gameData?.loser }} {{ loseReason }}</p>
                </div>
                
                <div class="final-stats">
                    <h3>Endstand:</h3>
                    <div v-for="p in sortedPlayers" :key="p.id" class="player-result">
                        <span :class="{ 'loser-name': p.name === gameData?.loser }">
                            {{ p.name }}: {{ p.cardCount }} Karten
                        </span>
                    </div>
                </div>
                
                <button class="btn btn-warning" @click="$emit('leave-game')">
                    Neues Spiel
                </button>
            </div>
        </div>
    `,
    computed: {
        isLoser() {
            return this.player?.name === this.gameData?.loser;
        },
        loseReason() {
            return 'hatte 4 Asse und verliert das Spiel!';
        },
        sortedPlayers() {
            if (!this.gameData?.players) return [];
            return [...this.gameData.players].sort((a, b) => a.cardCount - b.cardCount);
        }
    }
};

window.GameTable = {
    props: ['gameData', 'player'],
    template: `
        <div class="game-table">
            <div class="table-center">
                <div v-if="gameData?.lastClaim">
                    <h4>Letzte Behauptung:</h4>
                    <p>{{ lastClaimText }}</p>
                </div>
                <div>
                    <p>Karten in der Mitte: {{ gameData?.centerPileCount || 0 }}</p>
                </div>
            </div>
            
            <div 
                v-for="(otherPlayer, index) in otherPlayers" 
                :key="otherPlayer.id"
                :class="getPlayerSeatClass(otherPlayer, index)"
            >
                <h4>{{ otherPlayer.name }}</h4>
                <p>{{ otherPlayer.cardCount }} Karten</p>
                <p v-if="isCurrentTurn(otherPlayer)"><strong>Am Zug</strong></p>
            </div>
        </div>
    `,
    computed: {
        otherPlayers() {
            if (!this.gameData?.players || !this.player) return [];
            return this.gameData.players.filter(p => p.id !== this.player.id);
        },
        lastClaimText() {
            const claim = this.gameData?.lastClaim;
            if (!claim) return '';
            return `${claim.player} behauptet: ${claim.count} x ${claim.value}`;
        }
    },
    methods: {
        isCurrentTurn(player) {
            return this.gameData?.currentPlayer === player.name;
        },
        getPlayerSeatClass(player, index) {
            const positions = ['seat-top', 'seat-right', 'seat-bottom-right', 'seat-bottom-left', 'seat-left'];
            const baseClass = `player-seat ${positions[index % positions.length]}`;
            return this.isCurrentTurn(player) ? `${baseClass} current-turn` : baseClass;
        }
    }
};

window.PlayerHand = {
    props: ['cards', 'selectedCards'],
    emits: ['toggle-card'],
    template: `
        <div class="my-hand">
            <div style="margin-bottom: 15px;">
                <h3>Deine Karten ({{ cards?.length || 0 }})</h3>
            </div>
            <div>
                <div v-if="!cards || cards.length === 0" style="color: #888;">
                    Keine Karten vorhanden
                </div>
                <div 
                    v-for="card in cards" 
                    :key="card.id"
                    :class="getCardClass(card)"
                    @click="$emit('toggle-card', card.id)"
                >
                    <div style="font-size: 14px; font-weight: bold;">{{ card.value }}</div>
                    <div style="font-size: 16px; margin-top: 5px;">{{ getSuitSymbol(card.suit) }}</div>
                </div>
            </div>
        </div>
    `,
    methods: {
        getCardClass(card) {
            const isSelected = this.selectedCards.includes(card.id);
            return `card ${card.suit}${isSelected ? ' selected' : ''}`;
        },
        getSuitSymbol(suit) {
            const symbols = {
                hearts: '♥',
                diamonds: '♦',
                clubs: '♣',
                spades: '♠'
            };
            return symbols[suit] || suit;
        }
    }
};

window.RemovedCardsPanel = {
    props: ['removedCards'],
    emits: ['clear'],
    template: `
        <div v-if="removedCards.length > 0" class="removed-cards-panel">
            <h4>🗑️ Entfernte Karten</h4>
            <div>
                <div 
                    v-for="removed in removedCards" 
                    :key="removed.id"
                    class="removed-card-group"
                >
                    <div class="player-name">{{ removed.player }}</div>
                    <div class="cards">{{ removed.count }}x {{ removed.value }}</div>
                </div>
            </div>
            <button class="btn" @click="$emit('clear')" style="margin-top: 10px; padding: 5px 10px; font-size: 12px;">
                Liste leeren
            </button>
        </div>
    `
};
