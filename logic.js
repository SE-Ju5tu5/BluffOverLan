// Bluff Kartenspiel - Clean Game Logic

// Farben Definition
const Color = {
    HEARTS: 'hearts',
    DIAMONDS: 'diamonds', 
    CLUBS: 'clubs',
    SPADES: 'spades'
};

// Kartenwerte Definition
const Value = {
    ACE: { name: 'A', value: 1 },
    TWO: { name: '2', value: 2 },
    THREE: { name: '3', value: 3 },
    FOUR: { name: '4', value: 4 },
    FIVE: { name: '5', value: 5 },
    SIX: { name: '6', value: 6 },
    SEVEN: { name: '7', value: 7 },
    EIGHT: { name: '8', value: 8 },
    NINE: { name: '9', value: 9 },
    TEN: { name: '10', value: 10 },
    JACK: { name: 'J', value: 11 },
    QUEEN: { name: 'Q', value: 12 },
    KING: { name: 'K', value: 13 }
};

// Karte Klasse
class Card {
    constructor(value, color) {
        this.value = value;
        this.color = color;
    }

    toString() {
        return `${this.value.name} of ${this.color}`;
    }

    toJSON() {
        return {
            id: `${this.value.value}_${this.color}`,
            value: this.value.name,
            color: this.color,
            numericValue: this.value.value
        };
    }

    equals(other) {
        return this.value.value === other.value.value && this.color === other.color;
    }
}

// Deck Klasse
class Deck {
    constructor() {
        this.cards = [];
        this.createDeck();
    }

    createDeck() {
        this.cards = [];
        const colors = Object.values(Color);
        const values = Object.values(Value);

        for (let color of colors) {
            for (let value of values) {
                this.cards.push(new Card(value, color));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    dealCard() {
        return this.cards.pop();
    }

    getSize() {
        return this.cards.length;
    }
}

// Spieler Klasse
class BluffPlayer {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.hand = [];
        this.index = 0;
        this.ready = false;
    }

    addCard(card) {
        this.hand.push(card);
    }

    removeCard(cardId) {
        const index = this.hand.findIndex(card => card.toJSON().id === cardId);
        if (index === -1) {
            throw new Error(`Karte ${cardId} nicht in der Hand gefunden`);
        }
        return this.hand.splice(index, 1)[0];
    }

    removeCards(cardIds) {
        const removedCards = [];
        for (let cardId of cardIds) {
            removedCards.push(this.removeCard(cardId));
        }
        return removedCards;
    }

    getHand() {
        return this.hand;
    }

    getCardCount() {
        return this.hand.length;
    }

    clearCards() {
        this.hand = [];
    }

    hasCard(cardId) {
        return this.hand.some(card => card.toJSON().id === cardId);
    }
}

// Hauptspiel Klasse
class BluffGame {
    constructor(gameId) {
        this.gameId = gameId;
        this.players = [];
        this.deck = new Deck();
        this.centerPile = [];
        this.currentPlayerIndex = 0;
        this.gameState = 'waiting';
        this.winner = null;
        this.loser = null;
        this.lastAction = null;
        this.lastClaim = null;
        this.canCallBluff = false;
        this.lastPlayerToPlay = null;
    }

    addPlayer(id, name) {
        const player = new BluffPlayer(id, name);
        player.index = this.players.length;
        this.players.push(player);
        return player;
    }

    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    startGame() {
        if (this.players.length < 2) {
            throw new Error("Mindestens 2 Spieler benötigt");
        }

        this.gameState = 'playing';
        this.deck.shuffle();
        this.dealCards();
        this.currentPlayerIndex = 0;
        this.lastAction = {
            type: 'gameStarted',
            message: 'Spiel gestartet! ' + this.getCurrentPlayer().name + ' beginnt.'
        };
    }

    dealCards() {
        const cardsPerPlayer = Math.floor(52 / this.players.length);
        
        for (let i = 0; i < cardsPerPlayer; i++) {
            for (let player of this.players) {
                if (this.deck.getSize() > 0) {
                    player.addCard(this.deck.dealCard());
                }
            }
        }
    }

    // CLEAN playCards method
    playCards(playerId, cardIds, claimedCount, claimedValue) {
        console.log('🎮 playCards:', { playerId, cardIds, claimedValue });
        
        if (this.gameState !== 'playing') {
            throw new Error("Spiel läuft nicht");
        }

        const player = this.getPlayer(playerId);
        if (!player) {
            throw new Error("Spieler nicht gefunden");
        }

        if (this.getCurrentPlayer().id !== playerId) {
            throw new Error("Du bist nicht am Zug");
        }

        if (!cardIds || cardIds.length === 0) {
            throw new Error("Keine Karten ausgewählt");
        }

        if (!claimedValue || !claimedValue.value) {
            throw new Error("Ungültiger Kartenwert");
        }

        // Bluff-Regeln
        if (this.lastClaim) {
            if (claimedValue.value !== this.lastClaim.value.value) {
                throw new Error("Du musst den gleichen Kartenwert behaupten: " + this.lastClaim.value.name);
            }
            if (cardIds.length < 1) {
                throw new Error("Du musst mindestens 1 Karte spielen");
            }
            claimedCount = this.lastClaim.count + cardIds.length;
        }

        // Karten entfernen und in die Mitte legen
        const playedCards = player.removeCards(cardIds);
        this.centerPile.push(...playedCards);

        // Behauptung speichern
        this.lastClaim = {
            value: claimedValue,
            count: claimedCount,
            player: player,
            actualCards: playedCards
        };

        this.canCallBluff = true;
        this.lastPlayerToPlay = player;

        this.lastAction = {
            type: 'cardsPlayed',
            player: player.name,
            claimedCount: claimedCount,
            claimedValue: claimedValue.name,
            message: player.name + ' behauptet ' + claimedCount + ' x ' + claimedValue.name + ' gespielt zu haben.'
        };

        // Nachricht wenn alle Karten gelegt
        if (player.getCardCount() === 0) {
            this.lastAction.message += ' ' + player.name + ' hat alle Karten gelegt!';
        }

        // Nächster Spieler
        this.nextPlayer();
        
        console.log('🔄 Nächster Spieler:', this.getCurrentPlayer().name);
    }

    callBluff(callerId) {
        if (this.gameState !== 'playing') {
            throw new Error("Spiel läuft nicht");
        }

        if (!this.canCallBluff || !this.lastClaim) {
            throw new Error("Kein Bluff zum Anzweifeln da");
        }

        const caller = this.getPlayer(callerId);
        if (!caller) {
            throw new Error("Spieler nicht gefunden");
        }

        if (this.getCurrentPlayer().id !== callerId) {
            throw new Error("Du bist nicht der nächste Spieler");
        }

        const actualCount = this.centerPile.filter(card => 
            card.value.value === this.lastClaim.value.value
        ).length;

        const claimedCount = this.lastClaim.count;
        const liar = this.lastClaim.player;

        let bluffResult;

        if (actualCount >= claimedCount) {
            // KEIN Bluff - Behauptung war ehrlich
            caller.hand.push(...this.centerPile);
            bluffResult = {
                type: 'bluffFailed',
                caller: caller.name,
                liar: liar.name,
                actualCount: actualCount,
                claimedCount: claimedCount,
                message: liar.name + ' hat die Wahrheit gesagt! ' + caller.name + ' muss ' + this.centerPile.length + ' Karten aufnehmen.'
            };
            
            this.currentPlayerIndex = liar.index;
            this.checkPlayerForQuads(caller);
            
            // Gewinnlogik: Wenn der ehrliche Spieler alle Karten gelegt hatte
            if (liar.getCardCount() === 0) {
                this.gameState = 'finished';
                this.winner = liar;
                this.loser = null;
                bluffResult.type = 'gameWon';
                bluffResult.winner = liar.name;
                bluffResult.message = liar.name + ' hat gewonnen!';
            }
            
        } else {
            // WAR ein Bluff
            liar.hand.push(...this.centerPile);
            bluffResult = {
                type: 'bluffSucceeded',
                caller: caller.name,
                liar: liar.name,
                actualCount: actualCount,
                claimedCount: claimedCount,
                message: liar.name + ' hat gelogen! Nur ' + actualCount + ' von ' + claimedCount + ' Karten waren echt.'
            };
            
            this.currentPlayerIndex = caller.index;
            this.checkPlayerForQuads(liar);
        }

        // Stapel leeren
        this.centerPile = [];
        this.lastClaim = null;
        this.canCallBluff = false;
        this.lastPlayerToPlay = null;

        this.lastAction = bluffResult;
        return bluffResult;
    }

    checkPlayerForQuads(player) {
        const valueCounts = {};
        player.hand.forEach(card => {
            const value = card.value.value;
            valueCounts[value] = (valueCounts[value] || 0) + 1;
        });
        
        for (let value in valueCounts) {
            if (valueCounts[value] >= 4) {
                if (value === '1') { // Asse
                    this.gameState = 'finished';
                    this.loser = player;
                    this.winner = null;
                    this.lastAction = {
                        type: 'playerLostAces',
                        player: player.name,
                        message: player.name + ' hat 4 Asse und verliert das Spiel!'
                    };
                    return true;
                } else {
                    // 4er entfernen
                    let removed = 0;
                    for (let i = player.hand.length - 1; i >= 0 && removed < 4; i--) {
                        if (player.hand[i].value.value === parseInt(value)) {
                            player.hand.splice(i, 1);
                            removed++;
                        }
                    }
                    this.lastAction = {
                        type: 'quadsRemoved',
                        player: player.name,
                        value: Object.values(Value).find(v => v.value === parseInt(value)).name,
                        count: 4,
                        message: player.name + ' hatte 4er - diese wurden entfernt!'
                    };
                    return true;
                }
            }
        }
        return false;
    }

    nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    reset() {
        this.players.forEach(player => {
            player.clearCards();
            player.ready = false;
        });
        this.deck = new Deck();
        this.centerPile = [];
        this.currentPlayerIndex = 0;
        this.gameState = 'waiting';
        this.winner = null;
        this.loser = null;
        this.lastAction = null;
        this.lastClaim = null;
        this.canCallBluff = false;
        this.lastPlayerToPlay = null;
    }

    getPublicGameState() {
        return {
            gameId: this.gameId,
            gameState: this.gameState,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                cardCount: p.getCardCount(),
                index: p.index,
                ready: p.ready || false
            })),
            currentPlayerIndex: this.currentPlayerIndex,
            currentPlayer: this.getCurrentPlayer() ? this.getCurrentPlayer().name : null,
            centerPileCount: this.centerPile.length,
            lastAction: this.lastAction,
            lastClaim: this.lastClaim ? {
                value: this.lastClaim.value.name,
                count: this.lastClaim.count,
                player: this.lastClaim.player.name
            } : null,
            winner: this.winner ? this.winner.name : null,
            loser: this.loser ? this.loser.name : null,
            canCallBluff: this.canCallBluff
        };
    }

    getPlayerGameState(playerId) {
        const player = this.getPlayer(playerId);
        const publicState = this.getPublicGameState();
        
        if (player) {
            publicState.playerHand = player.getHand().map(card => card.toJSON());
            publicState.isCurrentPlayer = this.getCurrentPlayer().id === playerId;
            
            if (this.canCallBluff && this.lastClaim) {
                publicState.canCallBluff = this.getCurrentPlayer().id === playerId;
            } else {
                publicState.canCallBluff = false;
            }
        }
        
        return publicState;
    }
}

module.exports = {
    BluffGame,
    BluffPlayer,
    Card,
    Deck,
    Color,
    Value
};
