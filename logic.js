// Bluff Kartenspiel - Game Logic

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
        this.loser = null; // NEU: Für losing screen
        this.lastAction = null;
        this.lastClaim = null;
        this.canCallBluff = false;
        this.lastPlayerToPlay = null;
    }

    reset() {
        this.players.forEach(player => player.clearCards());
        this.deck = new Deck();
        this.centerPile = [];
        this.currentPlayerIndex = 0;
        this.gameState = 'waiting';
        this.winner = null;
        this.loser = null; // NEU: Reset loser
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

        // Wiederhole das Austeilen bis niemand 4 Asse hat
        let maxRetries = 10;
        let retry = 0;
        
        while (retry < maxRetries) {
            this.gameState = 'playing';
            this.deck.createDeck();
            this.deck.shuffle();
            
            // Alle Spieler leeren
            this.players.forEach(player => player.clearCards());
            
            this.dealCards();
            this.currentPlayerIndex = 0;
            this.lastClaim = null;
            this.canCallBluff = false;
            this.lastPlayerToPlay = null;
            
            // Prüfe auf 4 Asse beim Auteilen
            let someoneHasFourAces = false;
            
            for (let player of this.players) {
                if (this.playerHasFourAces(player)) {
                    someoneHasFourAces = true;
                    console.log(`⚠️ ${player.name} hat 4 Asse beim Austeilen - Karten werden neu gemischt`);
                    break;
                }
            }
            
            if (!someoneHasFourAces) {
                // Prüfe auf andere 4er-Kombinationen (die entfernt werden)
                // UND auf 4 Asse nach dem Entfernen!
                let foundQuads = false;
                let continueChecking = true;
                
                while (continueChecking) {
                    continueChecking = false;
                    
                    for (let player of this.players) {
                        if (this.checkPlayerForQuads(player)) {
                            foundQuads = true;
                            continueChecking = true;
                            break;
                        }
                    }
                }
                
                // Wenn jemand durch 4er-Entfernung 4 Asse bekommen hat, neu mischen
                for (let player of this.players) {
                    if (this.playerHasFourAces(player)) {
                        someoneHasFourAces = true;
                        console.log(`⚠️ ${player.name} hat nach 4er-Entfernung 4 Asse - Karten werden neu gemischt`);
                        break;
                    }
                }
                
                if (!someoneHasFourAces) {
                    console.log(`✅ Spiel gestartet nach ${retry + 1} Versuch(en). Entfernte 4er-Kombinationen: ${foundQuads ? 'Ja' : 'Nein'}`);
                    return;
                }
            }
            
            retry++;
        }
        
        if (retry >= maxRetries) {
            console.log('⚠️ Maximale Versuche erreicht, starte Spiel trotz möglicher 4 Asse');
        }
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

    playerHasFourAces(player) {
        const aceCount = player.hand.filter(card => card.value.value === 1).length;
        return aceCount >= 4;
    }

    // FIXED playCards method - Mit Winner/Loser System
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

        if (!cardIds || cardIds.length === 0) {
            throw new Error("Keine Karten ausgewählt");
        }

        if (!claimedValue || !claimedValue.value) {
            throw new Error("Ungültiger Kartenwert");
        }

        // Neue Bluff-Regeln
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
            actualCards: playedCards // Nur die letzten gelegten Karten
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

        // GEWINNLOGIK: Prüfe auf Gewinner erst nach dem nächsten Zug
        // Der Spieler gewinnt nicht sofort, sondern erst wenn der nächste Spieler seinen Zug beendet
        // und der Bluff-Check zeigt, dass er nicht gelogen hat
        if (player.getCardCount() === 0) {
            this.lastAction.message += ' ' + player.name + ' hat alle Karten gelegt!';
        }

        // Nächster Spieler
        this.nextPlayer();
        
        // GEWINNLOGIK: Wenn der vorherige Spieler alle Karten gelegt hat und der nächste Spieler weiter spielt
        // Prüfe, ob der vorherige Spieler (der gerade gespielt hat) alle Karten gelegt hatte
        if (player.getCardCount() === 0) {
            // Der Spieler hat alle Karten gelegt, aber der nächste Spieler spielt weiter
            // Das bedeutet, dass der Spieler gewonnen hat, da er nicht geblufft wurde
            this.gameState = 'finished';
            this.winner = player;
            this.loser = null;
            this.lastAction = {
                type: 'gameWon',
                winner: player.name,
                message: player.name + ' hat gewonnen, da alle Karten gelegt wurden und der nächste Spieler weiter gespielt hat!'
            };
        }
    }

    // FIXED callBluff method - Korrigierte nächster Spieler Logik
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

        // Nur der nächste Spieler darf bluffen
        if (this.getCurrentPlayer().id !== callerId) {
            throw new Error("Du bist nicht der nächste Spieler und kannst daher keinen Bluff rufen");
        }

        // Überprüfe die Gesamtanzahl der behaupteten Karten im Stapel
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
                actualCards: this.lastClaim.actualCards.map(card => ({
                    value: card.value.name,
                    suit: this.getSuitSymbol(card.color)
                })),
                message: liar.name + ' hat die Wahrheit gesagt! ' + caller.name + ' muss ' + this.centerPile.length + ' Karten aufnehmen.'
            };
            
            // Der der NICHT geblufft hat (liar) ist als nächstes dran
            this.currentPlayerIndex = liar.index;
            
            // Prüfe Anzweifler auf 4 gleiche Karten nach Kartenaufnahme
            this.checkPlayerForQuads(caller);
            
            // GEWINNLOGIK: Wenn der Spieler, der die Wahrheit gesagt hat, alle Karten gelegt hatte
            // UND jetzt nach der Kartenaufnahme des Anzweiflers immer noch keine Karten hat
            if (liar.getCardCount() === 0) {
                this.gameState = 'finished';
                this.winner = liar;
                this.loser = null;
                bluffResult.type = 'gameWon';
                bluffResult.winner = liar.name;
                bluffResult.message = liar.name + ' hat gewonnen, da alle Karten korrekt gelegt wurden!';
            }
            
        } else {
            // WAR ein Bluff - Behauptung war gelogen
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
            
            // Der der den Bluff gerufen hat (caller) ist als nächstes dran
            this.currentPlayerIndex = caller.index;
            
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

    // FIXED checkPlayerForQuads - Setzt loser richtig
    checkPlayerForQuads(player) {
        const valueCounts = {};
        
        // Zähle Karten nach Wert
        player.hand.forEach(card => {
            const value = card.value.value;
            valueCounts[value] = (valueCounts[value] || 0) + 1;
        });
        
        // Prüfe auf 4er-Kombination
        for (let value in valueCounts) {
            if (valueCounts[value] >= 4) {
                if (value === '1') { // Asse (value 1)
                    // SPIELER VERLIERT - hat 4 Asse
                    this.gameState = 'finished';
                    this.loser = player;
                    this.winner = null; // Sicherstellen dass nur winner ODER loser gesetzt ist
                    this.lastAction = {
                        type: 'playerLostAces',
                        player: player.name,
                        message: player.name + ' hat 4 Asse und verliert das Spiel!'
                    };
                    return true;
                } else {
                    // Normale 4er werden entfernt
                    const cardsToRemove = [];
                    let removed = 0;
                    
                    for (let i = player.hand.length - 1; i >= 0 && removed < 4; i--) {
                        if (player.hand[i].value.value === parseInt(value)) {
                            cardsToRemove.push(player.hand.splice(i, 1)[0]);
                            removed++;
                        }
                    }
                    
                    this.lastAction = {
                        type: 'quadsRemoved',
                        player: player.name,
                        value: cardsToRemove[0].value.name,
                        count: 4,
                        message: player.name + ' hatte 4x ' + cardsToRemove[0].value.name + ' - diese wurden entfernt!'
                    };
                    return true;
                }
            }
        }
        
        return false;
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

    // FIXED getPublicGameState - Entfernt potentialWinner, fügt loser hinzu
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
            loser: this.loser ? this.loser.name : null, // NEU: Für losing screen
            canCallBluff: this.canCallBluff
            // potentialWinner ENTFERNT
        };
    }

    getPlayerGameState(playerId) {
        const player = this.getPlayer(playerId);
        const publicState = this.getPublicGameState();
        
        if (player) {
            publicState.playerHand = player.getHand().map(card => card.toJSON());
            publicState.isCurrentPlayer = this.getCurrentPlayer().id === playerId;
            
            // Nur der nächste Spieler (aktueller Spieler) kann bluffen
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
