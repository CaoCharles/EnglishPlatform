/**
 * Text-to-Speech module using Web Speech API
 */

const TTS = {
    synth: window.speechSynthesis,
    voices: [],
    currentUtterance: null,
    settings: {
        rate: 1,
        pitch: 1,
        volume: 1,
        voiceURI: null
    },

    /**
     * Initialize TTS and load voices
     * @returns {Promise<void>}
     */
    async init() {
        // Load voices
        await this.loadVoices();

        // Reload voices when they change (some browsers load asynchronously)
        this.synth.onvoiceschanged = () => this.loadVoices();

        // Load saved settings
        const savedSettings = Utils.loadFromLocalStorage('tts_settings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...savedSettings };
        }
    },

    /**
     * Load available voices
     * @returns {Promise<void>}
     */
    loadVoices() {
        return new Promise((resolve) => {
            const loadVoiceList = () => {
                this.voices = this.synth.getVoices();
                resolve();
            };

            // Some browsers need a small delay
            if (this.synth.getVoices().length > 0) {
                loadVoiceList();
            } else {
                setTimeout(loadVoiceList, 100);
            }
        });
    },

    /**
     * Get English voices
     * @returns {SpeechSynthesisVoice[]} - Array of English voices
     */
    getEnglishVoices() {
        return this.voices.filter(voice =>
            voice.lang.startsWith('en') ||
            voice.lang.includes('EN')
        );
    },

    /**
     * Get all available voices
     * @returns {SpeechSynthesisVoice[]} - Array of all voices
     */
    getAllVoices() {
        return this.voices;
    },

    /**
     * Set voice by URI
     * @param {string} voiceURI - Voice URI to use
     */
    setVoice(voiceURI) {
        this.settings.voiceURI = voiceURI;
        this.saveSettings();
    },

    /**
     * Get currently selected voice
     * @returns {SpeechSynthesisVoice|undefined} - Selected voice
     */
    getCurrentVoice() {
        if (this.settings.voiceURI) {
            return this.voices.find(v => v.voiceURI === this.settings.voiceURI);
        }
        // Default to first English voice
        return this.getEnglishVoices()[0] || this.voices[0];
    },

    /**
     * Set speech rate
     * @param {number} rate - Rate from 0.1 to 10
     */
    setRate(rate) {
        this.settings.rate = Math.max(0.1, Math.min(10, rate));
        this.saveSettings();
    },

    /**
     * Set speech pitch
     * @param {number} pitch - Pitch from 0 to 2
     */
    setPitch(pitch) {
        this.settings.pitch = Math.max(0, Math.min(2, pitch));
        this.saveSettings();
    },

    /**
     * Set speech volume
     * @param {number} volume - Volume from 0 to 1
     */
    setVolume(volume) {
        this.settings.volume = Math.max(0, Math.min(1, volume));
        this.saveSettings();
    },

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        Utils.saveToLocalStorage('tts_settings', this.settings);
    },

    /**
     * Speak text
     * @param {string} text - Text to speak
     * @param {string} lang - Language code (default: 'en-US')
     * @param {Function} onEnd - Callback when speech ends
     * @param {Function} onStart - Callback when speech starts
     * @returns {SpeechSynthesisUtterance} - The utterance object
     */
    speak(text, lang = 'en-US', onEnd = null, onStart = null) {
        // Cancel any current speech
        this.stop();

        // Create utterance
        const utterance = new SpeechSynthesisUtterance(text);

        // Set voice
        const voice = this.getCurrentVoice();
        if (voice) {
            utterance.voice = voice;
        }

        // Set language
        utterance.lang = lang;

        // Apply settings
        utterance.rate = this.settings.rate;
        utterance.pitch = this.settings.pitch;
        utterance.volume = this.settings.volume;

        // Event handlers
        utterance.onstart = () => {
            if (onStart) onStart();
        };

        utterance.onend = () => {
            this.currentUtterance = null;
            if (onEnd) onEnd();
        };

        utterance.onerror = (event) => {
            console.error('TTS Error:', event.error);
            this.currentUtterance = null;
            if (onEnd) onEnd();
        };

        // Store and speak
        this.currentUtterance = utterance;
        this.synth.speak(utterance);

        return utterance;
    },

    /**
     * Stop current speech
     */
    stop() {
        if (this.synth.speaking) {
            this.synth.cancel();
        }
        this.currentUtterance = null;
    },

    /**
     * Pause current speech
     */
    pause() {
        if (this.synth.speaking && !this.synth.paused) {
            this.synth.pause();
        }
    },

    /**
     * Resume paused speech
     */
    resume() {
        if (this.synth.paused) {
            this.synth.resume();
        }
    },

    /**
     * Toggle pause/resume
     */
    togglePause() {
        if (this.synth.paused) {
            this.resume();
        } else if (this.synth.speaking) {
            this.pause();
        }
    },

    /**
     * Check if currently speaking
     * @returns {boolean} - True if speaking
     */
    isSpeaking() {
        return this.synth.speaking;
    },

    /**
     * Check if paused
     * @returns {boolean} - True if paused
     */
    isPaused() {
        return this.synth.paused;
    },

    /**
     * Populate a select element with English voices
     * @param {HTMLSelectElement} selectElement - Select element to populate
     */
    populateVoiceSelect(selectElement) {
        selectElement.innerHTML = '';

        const englishVoices = this.getEnglishVoices();
        const currentVoice = this.getCurrentVoice();

        if (englishVoices.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No English voices available';
            option.disabled = true;
            selectElement.appendChild(option);
            return;
        }

        // Group voices by language
        const groups = {};
        englishVoices.forEach(voice => {
            const langGroup = voice.lang;
            if (!groups[langGroup]) {
                groups[langGroup] = [];
            }
            groups[langGroup].push(voice);
        });

        // Create options
        Object.entries(groups).forEach(([lang, voices]) => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = this.getLangDisplayName(lang);

            voices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.voiceURI;
                option.textContent = voice.name;
                if (currentVoice && voice.voiceURI === currentVoice.voiceURI) {
                    option.selected = true;
                }
                optgroup.appendChild(option);
            });

            selectElement.appendChild(optgroup);
        });
    },

    /**
     * Get display name for language code
     * @param {string} langCode - Language code
     * @returns {string} - Display name
     */
    getLangDisplayName(langCode) {
        const names = {
            'en-US': 'English (US)',
            'en-GB': 'English (UK)',
            'en-AU': 'English (Australia)',
            'en-IN': 'English (India)',
            'en-IE': 'English (Ireland)',
            'en-ZA': 'English (South Africa)',
            'en-CA': 'English (Canada)',
        };
        return names[langCode] || langCode;
    }
};
