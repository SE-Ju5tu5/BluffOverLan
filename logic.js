const Color = {
    HEARTS: 'hearts',
    DIAMONDS: 'diamonds', 
    CLUBS: 'clubs',
    SPADES: 'spades'
};

const Value = {
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
    KING: { name: 'K', value: 13 },
    ACE: { name: 'A', value: 14 }
};

class Card {
    constructor(value, color) {
        this.value = value;
        this.color = color;
        this.id = value.name + '_' + color;
    }
    
    toString() {
        return this.value.name + ' of ' + this.color;
    }
    
    toJSON() {
        return {
            id: this.id,
            value: this.value.name,
            suit: this.color,
            numericValue: this.value.value
        };
    }
}

class Deck {
    constructor() {
        this.cards = [];
        this.createDeck();
    }

    createDeck() {
        this.cards = [];
        for (let colorKey in Color) {
            for (let valueKey in Value) {
                this.cards.push(new Card(Value[valueKey], Color[colorKey]));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            let temp = this.cards[i];
            this.cards[i] = this.cards[j];
            this.cards[j] = temp;
        }
    }

    draw() {
        if (this.cards.length === 0) {
            throw new Error("Deck ist leer!");
        }
        return this.cards.pop();
    }

    size() {
        return this.cards.length;
    }

    isEmpty() {
        return this.cards.length === 0;
    }
}

class BluffPlayer {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.hand = [];
        this.index = null;
    }

    receiveCard(card) {
        this.hand.push(card);
    }

    clearCards() {
        this.hand = [];
    }

    getHand() {
        return this.hand;
    }

    removeCards(cardIds) {
        const removedCards = [];
        cardIds.forEach(cardId => {
            const index = this.hand.findIndex(card => card.id === cardId);
            if (index !== -1) {
                removedCards.push(this.hand.splice(index, 1)[0]);
            }
        });
        return removedCards;
    }

    hasCards(cardIds) {
        return cardIds.every(cardId => 
            this.hand.some(card => card.id === cardId)
        );
    }

    getCardCount() {
        return this.hand.length;
    }
}

class BluffGame {
    constructor(gameId) {
        this.gameId = gameId;
        this.deck = new Deck();
        this.players = [];
        this.centerPile = [];
        this.currentPlayerIndex = 0;
        this.gameState = 'waiting';
        this.winner = null;
        this.lastAction = null;
        this.lastClaim = null;
        this.canCallBluff = false;
        this.lastPlayerToPlay = null; // Wer hat zuletzt gespielt
    }

    addPlayer(id, name) {
        const player = new BluffPlayer(id, name);
        player.index = this.players.length;
        this.players.push(player);
        return player;
    }

    removePlayer(playerId) {
        const index = this.players.findIndex(p => p.id === playerId);
        if (index !== -1) {
            this.players.splice(index, 1);
            this.players.forEach((player, i) => {
                player.index = i;
            });
            return true;
        }
        return false;
    }

    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    getNextPlayer() {
        const nextIndex = (this.currentPlayerIndex + 1) % this.players.length;
        return this.players[nextIndex];
    }

    startGame() {
        if (this.players.length < 2) {
            throw new Error("Mindestens 2 Spieler erforderlich");
        }

        this.gameState = 'playing';
        this.deck.shuffle();
        this.dealCards();
        this.currentPlayerIndex = 0;
        this.lastClaim = null;
        this.canCallBluff = false;
        this.lastPlayerToPlay = null;
        
        // Prüfe alle Spieler auf 4 gleiche Karten nach dem Austeilen
        this.checkAllPlayersForQuads();
        
        this.lastAction = {
            type: 'gameStarted',
            message: this.getCurrentPlayer().name + ' beginnt!'
        };
    }

    // Neue Funktion: Prüfe auf 4 gleiche Karten
    checkAllPlayersForQuads() {
        for (let player of this.players) {
            this.checkPlayerForQuads(player);
        }
    }

    checkPlayerForQuads(player) {
        const valueGroups = {};
        
        // Karten nach Werten gruppieren
        player.hand.forEach(card => {
            const value = card.value.value;
            if (!valueGroups[value]) {
                valueGroups[value] = [];
            }
            valueGroups[value].push(card);
        });

        // Suche nach 4 gleichen Werten
        for (let value in valueGroups) {
            const cards = valueGroups[value];
            
            if (cards.length === 4) {
                // 4 Asse = Spieler verliert sofort
                if (parseInt(value) === 14) { // Ass = 14
                    this.gameState = 'finished';
                    this.lastAction = {
                        type: 'playerLostAces',
                        player: player.name,
                        message: player.name + ' hat 4 Asse und verliert das Spiel!'
                    };
                    return;
                }
                
                // 4 andere gleiche Karten - entfernen
                cards.forEach(card => {
                    const index = player.hand.findIndex(c => c.id === card.id);
                    if (index !== -1) {
                        player.hand.splice(index, 1);
                    }
                });
                
                this.lastAction = {
                    type: 'quadsRemoved',
                    player: player.name,
                    value: cards[0].value.name,
                    message: player.name + ' hatte 4x ' + cards[0].value.name + ' - diese wurden entfernt!'
                };
                
                return; // Nur einen Quad pro Runde entfernen
            }
        }
    }

    dealCards() {
        let playerIndex = 0;
        while (!this.deck.isEmpty()) {
            const card = this.deck.draw();
            this.players[playerIndex].receiveCard(card);
            playerIndex = (playerIndex + 1) % this.players.length;
        }
    }

    playCards(playerId, cardIds, claimedCount, claimedValue) {
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

        if (!player.hasCards(cardIds)) {
            throw new Error("Du hast diese Karten nicht");
        }

        if (cardIds.length !== claimedCount) {
            throw new Error("Anzahl der Karten stimmt nicht überein");
        }

        // KORRIGIERT: Neue Bluff-Regeln
        if (this.lastClaim) {
            // Muss gleicher Wert sein
            if (claimedValue.value !== this.lastClaim.value.value) {
                throw new Error("Du musst den gleichen Kartenwert behaupten: " + this.lastClaim.value.name);
            }
            
            // Muss mindestens 1 Karte spielen
            if (cardIds.length < 1) {
                throw new Error("Du musst mindestens 1 Karte spielen");
            }
            
            // Automatische Berechnung: Neue Gesamtanzahl = Alte + Neue Karten
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
        this.lastPlayerToPlay = player; // Merken wer gespielt hat

        this.lastAction = {
            type: 'cardsPlayed',
            player: player.name,
            claimedCount: claimedCount,
            claimedValue: claimedValue.name,
            message: player.name + ' behauptet ' + claimedCount + ' x ' + claimedValue.name + ' gespielt zu haben.'
        };

        // Prüfe auf Gewinner
        if (player.getCardCount() === 0) {
            this.gameState = 'finished';
            this.winner = player;
            this.lastAction = {
                type: 'gameWon',
                winner: player.name,
                message: player.name + ' hat gewonnen!'
            };
            return;
        }

        // Nächster Spieler
        this.nextPlayer();
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

        // KORRIGIERT: Nur der nächste Spieler darf bluffen
        if (this.getCurrentPlayer().id !== callerId) {
            throw new Error("Du bist nicht der nächste Spieler und kannst daher keinen Bluff rufen");
        }

        // Überprüfe die tatsächlich gespielten Karten
        const actualCount = this.lastClaim.actualCards.filter(card => 
            card.value.value === this.lastClaim.value.value
        ).length;

        const claimedCount = this.lastClaim.count;
        const liar = this.lastClaim.player;

        let bluffResult;

        if (actualCount >= claimedCount) {
            // Wahrheit gesagt - Anzweifler bekommt alle Karten
            caller.hand.push(...this.centerPile);
            bluffResult = {
                type: 'bluffFailed',
                caller: caller.name,
                liar: liar.name,
                actualCount: actualCount,
                claimedCount: claimedCount,
                actualCards: this.lastClaim.actualCards.map(card => ({
                    value: card.value.name,
                    suit: this.getSuitSymbol(card.color)
                })),
                message: liar.name + ' hat die Wahrheit gesagt! ' + caller.name + ' muss ' + this.centerPile.length + ' Karten aufnehmen.'
            };
            
            // Anzweifler ist als nächstes dran
            this.currentPlayerIndex = caller.index;
            
            // Prüfe Anzweifler auf 4 gleiche Karten nach Kartenaufnahme
            this.checkPlayerForQuads(caller);
        } else {
            // Gelogen - Original-Spieler bekommt alle Karten
            liar.hand.push(...this.centerPile);
            bluffResult = {
                type: 'bluffSucceeded',
                caller: caller.name,
                liar: liar.name,
                actualCount: actualCount,
                claimedCount: claimedCount,
                actualCards: this.lastClaim.actualCards.map(card => ({
                    value: card.value.name,
                    suit: this.getSuitSymbol(card.color)
                })),
                message: liar.name + ' hat gelogen! Nur ' + actualCount + ' von ' + claimedCount + ' Karten waren echt. ' + liar.name + ' muss ' + this.centerPile.length + ' Karten aufnehmen.'
            };
            
            // Lügner ist als nächstes dran
            this.currentPlayerIndex = liar.index;
            
            // Prüfe Lügner auf 4 gleiche Karten nach Kartenaufnahme
            this.checkPlayerForQuads(liar);
        }

        // Stapel leeren und neue Runde beginnen
        this.centerPile = [];
        this.lastClaim = null;
        this.canCallBluff = false;
        this.lastPlayerToPlay = null;

        this.lastAction = bluffResult;

        return bluffResult;
    }

    getSuitSymbol(suit) {
        const symbols = {
            hearts: '♥',
            diamonds: '♦',
            clubs: '♣',
            spades: '♠'
        };
        return symbols[suit] || suit;
    }

    nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    getPublicGameState() {
        return {
            gameId: this.gameId,
            gameState: this.gameState,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                cardCount: p.getCardCount(),
                index: p.index
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
            canCallBluff: this.canCallBluff
        };
    }

    getPlayerGameState(playerId) {
        const player = this.getPlayer(playerId);
        const publicState = this.getPublicGameState();
        
        if (player) {
            publicState.playerHand = player.getHand().map(card => card.toJSON());
            publicState.isCurrentPlayer = this.getCurrentPlayer().id === playerId;
            
            // KORRIGIERT: Nur der nächste Spieler (aktueller Spieler) kann bluffen
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
