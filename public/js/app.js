// Haupt Vue.js App für das Bluff Kartenspiel - FIXED mit 4er-Liste

const { createApp } = Vue;

const BluffGameApp = createApp({
    components: {
        MenuScreen: window.MenuScreen,
        LobbyScreen: window.LobbyScreen,
        GameScreen: window.GameScreen,
        WinningScreen: window.WinningScreen,
        LosingScreen: window.LosingScreen,
        GameTable: window.GameTable,
        PlayerHand: window.PlayerHand,
        RemovedCardsPanel: window.RemovedCardsPanel,
        QuadsRemovedPanel: window.QuadsRemovedPanel, // NEU: 4er-Liste
        PlayedCardsPanel: window.PlayedCardsPanel
    },
    
    data() {
        return {
            // Connection & Socket
            socket: null,
            connectionStatus: 'disconnected',
            statusText: 'Verbinde...',
            
            // Navigation
            currentScreen: 'menu',
            
            // Player & Game Data
            player: null,
            gameData: null,
            availableGames: [],
            
            // Game State
            playerHand: [],
            selectedCards: [],
            removedCards: [],
            removedQuads: [], // NEU: Separate Liste für 4er-Kombinationen
            gameMessages: [],
            isReady: false,
            
            // Utility
            messageCounter: 0
        }
    },
    
    mounted() {
        console.log('🎮 Bluff Game App gestartet!');
        this.initializeApp();
    },
    
    methods: {
        // App Initialization
        initializeApp() {
            this.socket = window.initSocketHandlers(this);
            window.SocketAPI.init(this.socket);
            
            // Request initial games list after a short delay
            setTimeout(() => {
                this.requestGamesList();
            }, 1000);
        },

        // Navigation
        showScreen(screen) {
            this.currentScreen = screen;
        },

        // Game Management
        createGame() {
            console.log('🎮 Erstelle neues Spiel...');
            window.SocketAPI.createGame();
        },

        joinGame(gameId) {
            console.log('👥 Trete Spiel bei:', gameId);
            window.SocketAPI.joinGame(gameId);
        },

        leaveGame() {
            console.log('🚪 Verlasse Spiel...');
            window.SocketAPI.leaveGame();
            this.resetGameState();
            this.showScreen('menu');
            this.requestGamesList();
        },

        // Player Actions
        changeName(newName) {
            if (newName && newName.trim()) {
                console.log('📝 Ändere Name zu:', newName);
                window.SocketAPI.changeName(newName.trim());
            }
        },

        toggleReady() {
            this.isReady = !this.isReady;
            console.log('🔄 Toggle Ready:', this.isReady);
            window.SocketAPI.toggleReady();
        },

        startNewGame() {
            console.log('🔄 Starte neues Spiel...');
            window.SocketAPI.startNewGame();
            this.resetGameState();
        },

        // Game Actions
        toggleCardSelection(cardId) {
            const index = this.selectedCards.indexOf(cardId);
            if (index === -1) {
                this.selectedCards.push(cardId);
                console.log('✅ Karte ausgewählt:', cardId);
            } else {
                this.selectedCards.splice(index, 1);
                console.log('❌ Karte abgewählt:', cardId);
            }
            console.log('🃏 Aktuelle Auswahl:', this.selectedCards);
        },

        playSelectedCards(data) {
            if (this.selectedCards.length === 0) {
                this.showMessage('error', 'Bitte wähle zuerst Karten aus');
                return;
            }

            if (this.gameData?.lastClaim && this.selectedCards.length < 1) {
                this.showMessage('error', 'Du musst mindestens 1 Karte spielen');
                return;
            }

            console.log('🎯 Spiele Karten:', {
                cardIds: this.selectedCards,
                claimedValue: data.claimedValue
            });

            window.SocketAPI.playCards(this.selectedCards, data.claimedValue);
            this.selectedCards = [];
        },

        callBluff() {
            console.log('🚨 Rufe Bluff!');
            window.SocketAPI.callBluff();
        },

        // FIXED: Separate Methods für Removed Cards vs Quads
        addRemovedCards(playerName, cardValue, count = 4) {
            this.removedCards.push({
                id: Date.now() + Math.random(),
                player: playerName,
                value: cardValue,
                count: count,
                timestamp: new Date()
            });
            console.log('🗑️ Karten entfernt:', { playerName, cardValue, count });
        },

        // NEU: Separate Method für 4er-Kombinationen
        addRemovedQuads(playerName, cardValue) {
            this.removedQuads.push({
                id: Date.now() + Math.random(),
                player: playerName,
                value: cardValue,
                timestamp: new Date()
            });
            console.log('🗑️ 4er-Kombination entfernt:', { playerName, cardValue });
        },

        clearRemovedCards() {
            this.removedCards = [];
            console.log('🧹 Entfernte Karten Liste geleert');
        },

        // NEU: Clear method für 4er-Liste
        clearRemovedQuads() {
            this.removedQuads = [];
            console.log('🧹 4er-Kombinationen Liste geleert');
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
            
            // Auto-remove messages after delay
            const removeDelay = type === 'bluff-result' ? 10000 : 5000;
            setTimeout(() => {
                const index = this.gameMessages.findIndex(m => m.id === message.id);
                if (index !== -1) {
                    this.gameMessages.splice(index, 1);
                }
            }, removeDelay);
        },

        // State Management
        resetGameState() {
            this.gameData = null;
            this.playerHand = [];
            this.selectedCards = [];
            this.removedQuads = []; // NEU: Reset 4er-Liste
            this.isReady = false;
            this.gameMessages = [];
            console.log('🔄 Spielstatus zurückgesetzt');
        },

        clearGameState() {
            this.selectedCards = [];
            this.gameMessages = [];
        },

        // FIXED: Clear both lists when starting new game
        clearRemovedCardsAndQuads() {
            this.removedCards = [];
            this.removedQuads = [];
            console.log('🧹 Alle Listen geleert');
        },

        // Utility
        requestGamesList() {
            window.SocketAPI.refreshGames();
        },

        // Debug Helpers
        debugGameState() {
            console.log('=== 🐛 GAME STATE DEBUG ===');
            console.log('Player:', this.player);
            console.log('Game Data:', this.gameData);
            console.log('Player Hand:', this.playerHand);
            console.log('Selected Cards:', this.selectedCards);
            console.log('Removed Cards:', this.removedCards);
            console.log('Removed Quads:', this.removedQuads); // NEU
            console.log('Messages:', this.gameMessages);
            console.log('Current Screen:', this.currentScreen);
            console.log('========================');
        }
    },
    
    // Global Error Handler
    errorCaptured(err, component, info) {
        console.error('🚨 Vue Error:', err);
        console.error('Component:', component);
        console.error('Info:', info);
        this.showMessage('error', 'Ein unerwarteter Fehler ist aufgetreten');
        return false;
    }
});

// Mount the App
BluffGameApp.mount('#app');

// Global Debug Access
window.BluffGame = BluffGameApp;

console.log('🎮 Bluff Kartenspiel geladen!');
