/**
 * Main Application Module
 */

const App = {
    elements: {},
    state: {
        isProcessing: false,
        currentResults: null
    },

    /**
     * Initialize the application
     */
    async init() {
        // Cache DOM elements
        this.cacheElements();

        // Initialize TTS
        await TTS.init();

        // Setup event listeners
        this.setupEventListeners();

        // Load saved settings
        this.loadSavedSettings();

        // Setup theme
        this.setupTheme();

        // Populate voice select
        this.populateVoiceSelect();

        console.log('English Practice App initialized');
    },

    /**
     * Cache frequently used DOM elements
     */
    cacheElements() {
        this.elements = {
            // Input elements
            articleInput: document.getElementById('article-input'),
            urlInput: document.getElementById('url-input'),
            fetchUrlBtn: document.getElementById('fetch-url'),
            processBtn: document.getElementById('process-btn'),
            wordCount: document.getElementById('word-count'),

            // TTS elements
            voiceSelect: document.getElementById('voice-select'),
            speechRate: document.getElementById('speech-rate'),
            rateValue: document.getElementById('rate-value'),

            // Theme
            themeToggle: document.getElementById('theme-toggle'),

            // State elements
            emptyState: document.getElementById('empty-state'),
            loadingState: document.getElementById('loading-state'),
            loadingText: document.getElementById('loading-text'),
            resultsContainer: document.getElementById('results-container'),
            errorState: document.getElementById('error-state'),
            errorMessage: document.getElementById('error-message'),
            retryBtn: document.getElementById('retry-btn'),

            // Results
            summaryCard: document.getElementById('summary-card'),
            summaryContent: document.getElementById('summary-content'),
            paragraphsContainer: document.getElementById('paragraphs-container'),

            // Templates
            paragraphTemplate: document.getElementById('paragraph-template'),
            questionTemplate: document.getElementById('question-template')
        };
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Word count
        this.elements.articleInput.addEventListener('input', Utils.debounce(() => {
            const count = Utils.countCharacters(this.elements.articleInput.value);
            this.elements.wordCount.textContent = `${count} 字`;
        }, 100));

        // Fetch URL
        this.elements.fetchUrlBtn.addEventListener('click', () => this.fetchUrl());

        // Process article
        this.elements.processBtn.addEventListener('click', () => this.processArticle());

        // Retry
        this.elements.retryBtn.addEventListener('click', () => this.processArticle());

        // Voice select
        this.elements.voiceSelect.addEventListener('change', (e) => {
            TTS.setVoice(e.target.value);
        });

        // Speech rate
        this.elements.speechRate.addEventListener('input', (e) => {
            const rate = parseFloat(e.target.value);
            TTS.setRate(rate);
            this.elements.rateValue.textContent = `${rate}x`;
        });

        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Summary speak button
        const summarySpeakBtn = this.elements.summaryCard.querySelector('.btn-speak');
        if (summarySpeakBtn) {
            summarySpeakBtn.addEventListener('click', () => {
                this.speakElement(this.elements.summaryContent, summarySpeakBtn);
            });
        }
    },

    /**
     * Load saved settings
     */
    loadSavedSettings() {
        // Load TTS settings
        const rate = TTS.settings.rate;
        this.elements.speechRate.value = rate;
        this.elements.rateValue.textContent = `${rate}x`;
    },

    /**
     * Setup theme
     */
    setupTheme() {
        const savedTheme = Utils.loadFromLocalStorage('theme', 'light');
        document.documentElement.setAttribute('data-theme', savedTheme);
    },

    /**
     * Toggle theme
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        Utils.saveToLocalStorage('theme', newTheme);
    },

    /**
     * Populate voice select
     */
    populateVoiceSelect() {
        TTS.populateVoiceSelect(this.elements.voiceSelect);

        // Retry after a short delay if no voices loaded
        if (this.elements.voiceSelect.children.length === 0) {
            setTimeout(() => {
                TTS.populateVoiceSelect(this.elements.voiceSelect);
            }, 500);
        }
    },

    /**
     * Fetch article from URL using backend API
     */
    async fetchUrl() {
        const url = this.elements.urlInput.value.trim();
        if (!url) {
            Utils.showToast('請輸入網址', 'error');
            return;
        }

        try {
            this.elements.fetchUrlBtn.disabled = true;
            this.elements.fetchUrlBtn.textContent = '擷取中...';

            // Use backend API to fetch URL
            const result = await API.fetchUrl(url);
            this.elements.articleInput.value = result.content;

            // Update word count
            const count = Utils.countCharacters(result.content);
            this.elements.wordCount.textContent = `${count} 字`;

            Utils.showToast('文章擷取成功！', 'success');
        } catch (error) {
            Utils.showToast(error.message, 'error');
        } finally {
            this.elements.fetchUrlBtn.disabled = false;
            this.elements.fetchUrlBtn.textContent = '擷取';
        }
    },

    /**
     * Process the article using backend API
     */
    async processArticle() {
        const article = this.elements.articleInput.value.trim();

        if (!article) {
            Utils.showToast('請輸入或貼上文章內容', 'error');
            return;
        }

        if (this.state.isProcessing) return;

        this.state.isProcessing = true;
        this.showState('loading');
        this.elements.processBtn.classList.add('loading');
        this.elements.processBtn.disabled = true;

        try {
            const results = await API.processArticle(article, (message) => {
                this.elements.loadingText.textContent = message;
            });

            this.state.currentResults = results;
            this.renderResults(results);
            this.showState('results');
            Utils.showToast('文章處理完成！', 'success');
        } catch (error) {
            console.error('Processing error:', error);
            this.elements.errorMessage.textContent = error.message;
            this.showState('error');
        } finally {
            this.state.isProcessing = false;
            this.elements.processBtn.classList.remove('loading');
            this.elements.processBtn.disabled = false;
        }
    },

    /**
     * Show a specific state
     * @param {string} state - 'empty', 'loading', 'results', 'error'
     */
    showState(state) {
        this.elements.emptyState.classList.toggle('hidden', state !== 'empty');
        this.elements.loadingState.classList.toggle('hidden', state !== 'loading');
        this.elements.resultsContainer.classList.toggle('hidden', state !== 'results');
        this.elements.errorState.classList.toggle('hidden', state !== 'error');
    },

    /**
     * Render processing results
     * @param {Object} results - Processing results
     */
    renderResults(results) {
        // Render summary
        this.renderSummary(results.summary);

        // Clear existing paragraphs
        this.elements.paragraphsContainer.innerHTML = '';

        // Render each paragraph
        results.paragraphs.forEach((para, index) => {
            const card = this.createParagraphCard(para, index);
            this.elements.paragraphsContainer.appendChild(card);
        });
    },

    /**
     * Render summary
     * @param {string} summary - Summary text
     */
    renderSummary(summary) {
        // Convert bullet points to HTML list
        const lines = summary.split('\n').filter(line => line.trim());
        const listItems = lines.map(line => {
            // Remove bullet point characters at the start
            const text = line.replace(/^[\s•\-\*]+/, '').trim();
            return `<li>${Utils.sanitizeHTML(text)}</li>`;
        }).join('');

        this.elements.summaryContent.innerHTML = `<ul>${listItems}</ul>`;
    },

    /**
     * Create a paragraph card
     * @param {Object} para - Paragraph data
     * @param {number} index - Paragraph index
     * @returns {HTMLElement} - Card element
     */
    createParagraphCard(para, index) {
        const template = this.elements.paragraphTemplate.content.cloneNode(true);
        const card = template.querySelector('.paragraph-card');

        // Set paragraph number
        card.querySelector('.paragraph-number').textContent = para.index || (index + 1);

        // Set original text
        card.querySelector('.original-text').textContent = para.original;

        // Set translation
        card.querySelector('.translation-text').textContent = para.translation;

        // Set simple summary
        card.querySelector('.simple-summary').textContent = para.simpleSummary;
        card.querySelector('.summary-translation').textContent = para.simpleSummaryTranslation;

        // Setup questions
        const questionsList = card.querySelector('.questions-list');
        para.questions.forEach((q, qIndex) => {
            const questionItem = this.createQuestionItem(q, qIndex);
            questionsList.appendChild(questionItem);
        });

        // Setup event listeners for this card
        this.setupCardEventListeners(card, para);

        return card;
    },

    /**
     * Create a question item
     * @param {Object} question - Question data
     * @param {number} index - Question index
     * @returns {HTMLElement} - Question element
     */
    createQuestionItem(question, index) {
        const template = this.elements.questionTemplate.content.cloneNode(true);
        const item = template.querySelector('.question-item');

        // Set question number
        item.querySelector('.question-number').textContent = index + 1;

        // Set question text
        item.querySelector('.question-text').textContent = question.question;
        item.querySelector('.question-translation').textContent = question.questionTranslation;

        // Set answer
        item.querySelector('.answer-text').textContent = question.answer;
        item.querySelector('.answer-translation').textContent = question.answerTranslation;

        // Setup event listeners
        this.setupQuestionEventListeners(item, question);

        return item;
    },

    /**
     * Setup event listeners for a paragraph card
     * @param {HTMLElement} card - Card element
     * @param {Object} para - Paragraph data
     */
    setupCardEventListeners(card, para) {
        // Collapse button
        const collapseBtn = card.querySelector('.btn-collapse');
        collapseBtn.addEventListener('click', () => {
            card.classList.toggle('collapsed');
            collapseBtn.classList.toggle('collapsed');
        });

        // Original text speak
        const originalSpeakBtn = card.querySelector('.card-actions .btn-speak');
        originalSpeakBtn.addEventListener('click', () => {
            this.speak(para.original, originalSpeakBtn);
        });

        // Translation toggle
        const translationToggle = card.querySelector('.btn-toggle-translation');
        const translationText = card.querySelector('.translation-text');
        translationToggle.addEventListener('click', () => {
            translationText.classList.toggle('hidden');
            translationToggle.textContent = translationText.classList.contains('hidden')
                ? '👁 顯示翻譯'
                : '👁 隱藏翻譯';
        });

        // Simple summary speak
        const summarySpeakBtn = card.querySelector('.summary-block .btn-speak');
        summarySpeakBtn.addEventListener('click', () => {
            this.speak(para.simpleSummary, summarySpeakBtn);
        });

        // Summary translation toggle
        const summaryTranslationToggle = card.querySelector('.btn-toggle-summary-translation');
        const summaryTranslation = card.querySelector('.summary-translation');
        summaryTranslationToggle.addEventListener('click', () => {
            summaryTranslation.classList.toggle('hidden');
            summaryTranslationToggle.textContent = summaryTranslation.classList.contains('hidden')
                ? '👁 顯示中文'
                : '👁 隱藏中文';
        });
    },

    /**
     * Setup event listeners for a question item
     * @param {HTMLElement} item - Question item element
     * @param {Object} question - Question data
     */
    setupQuestionEventListeners(item, question) {
        // Question speak
        const questionSpeakBtn = item.querySelector('.question-header .btn-speak');
        questionSpeakBtn.addEventListener('click', () => {
            this.speak(question.question, questionSpeakBtn);
        });

        // Question translation toggle
        const questionTranslationToggle = item.querySelector('.btn-toggle-question-translation');
        const questionTranslation = item.querySelector('.question-translation');
        questionTranslationToggle.addEventListener('click', () => {
            questionTranslation.classList.toggle('hidden');
            questionTranslationToggle.textContent = questionTranslation.classList.contains('hidden')
                ? '👁 顯示中文'
                : '👁 隱藏中文';
        });

        // Show answer button
        const showAnswerBtn = item.querySelector('.btn-show-answer');
        const answerContent = item.querySelector('.answer-content');
        showAnswerBtn.addEventListener('click', () => {
            answerContent.classList.toggle('hidden');
            showAnswerBtn.textContent = answerContent.classList.contains('hidden')
                ? '顯示答案'
                : '隱藏答案';
        });

        // Answer speak
        const answerSpeakBtn = item.querySelector('.answer-header .btn-speak');
        answerSpeakBtn.addEventListener('click', () => {
            this.speak(question.answer, answerSpeakBtn);
        });

        // Answer translation toggle
        const answerTranslationToggle = item.querySelector('.btn-toggle-answer-translation');
        const answerTranslation = item.querySelector('.answer-translation');
        answerTranslationToggle.addEventListener('click', () => {
            answerTranslation.classList.toggle('hidden');
            answerTranslationToggle.textContent = answerTranslation.classList.contains('hidden')
                ? '👁 顯示中文'
                : '👁 隱藏中文';
        });
    },

    /**
     * Speak text using TTS
     * @param {string} text - Text to speak
     * @param {HTMLElement} button - Button that was clicked
     */
    speak(text, button) {
        // If already speaking and same button clicked, stop
        if (TTS.isSpeaking() && button.classList.contains('speaking')) {
            TTS.stop();
            button.classList.remove('speaking');
            return;
        }

        // Stop any current speech
        TTS.stop();

        // Remove speaking class from all buttons
        document.querySelectorAll('.btn-speak.speaking').forEach(btn => {
            btn.classList.remove('speaking');
        });

        // Start speaking
        button.classList.add('speaking');
        TTS.speak(text, 'en-US', () => {
            button.classList.remove('speaking');
        });
    },

    /**
     * Speak content of an element
     * @param {HTMLElement} element - Element containing text
     * @param {HTMLElement} button - Button that was clicked
     */
    speakElement(element, button) {
        const text = element.textContent || element.innerText;
        this.speak(text, button);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
