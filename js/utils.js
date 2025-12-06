/**
 * Utility functions for the English Practice application
 */

const Utils = {
    /**
     * Debounce function to limit the rate of function calls
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} - Debounced function
     */
    debounce(fn, delay = 300) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    /**
     * Throttle function to limit function calls to once per interval
     * @param {Function} fn - Function to throttle
     * @param {number} interval - Interval in milliseconds
     * @returns {Function} - Throttled function
     */
    throttle(fn, interval = 300) {
        let lastTime = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastTime >= interval) {
                lastTime = now;
                fn.apply(this, args);
            }
        };
    },

    /**
     * Save data to localStorage
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     */
    saveToLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    },

    /**
     * Load data from localStorage
     * @param {string} key - Storage key
     * @param {any} defaultValue - Default value if key not found
     * @returns {any} - Stored value or default
     */
    loadFromLocalStorage(key, defaultValue = null) {
        try {
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : defaultValue;
        } catch (e) {
            console.warn('Failed to load from localStorage:', e);
            return defaultValue;
        }
    },

    /**
     * Sanitize HTML to prevent XSS
     * @param {string} text - Text to sanitize
     * @returns {string} - Sanitized text
     */
    sanitizeHTML(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Count words in text (supports both English and Chinese)
     * @param {string} text - Text to count
     * @returns {number} - Word count
     */
    countWords(text) {
        if (!text) return 0;
        // Count English words
        const englishWords = text.match(/[a-zA-Z]+/g) || [];
        // Count Chinese characters
        const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
        return englishWords.length + chineseChars.length;
    },

    /**
     * Count characters in text
     * @param {string} text - Text to count
     * @returns {number} - Character count
     */
    countCharacters(text) {
        return text ? text.length : 0;
    },

    /**
     * Fetch article content from URL using a proxy
     * Note: Due to CORS, this requires a proxy server
     * @param {string} url - URL to fetch
     * @returns {Promise<string>} - Article content
     */
    async fetchArticleFromURL(url) {
        // List of CORS proxies to try
        const proxies = [
            `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
            `https://corsproxy.io/?${encodeURIComponent(url)}`,
        ];

        for (const proxyUrl of proxies) {
            try {
                const response = await fetch(proxyUrl);
                if (!response.ok) continue;

                const data = await response.json();
                const html = data.contents || data;

                // Parse the HTML and extract text content
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // Remove script and style elements
                const scripts = doc.querySelectorAll('script, style, nav, header, footer, aside');
                scripts.forEach(el => el.remove());

                // Try to find the main content
                const selectors = [
                    'article',
                    '[role="main"]',
                    '.article-content',
                    '.post-content',
                    '.entry-content',
                    '.content',
                    'main',
                    '.story-body',
                ];

                for (const selector of selectors) {
                    const element = doc.querySelector(selector);
                    if (element && element.textContent.trim().length > 100) {
                        return this.cleanExtractedText(element.textContent);
                    }
                }

                // Fallback: get body text
                const bodyText = doc.body?.textContent || '';
                return this.cleanExtractedText(bodyText);

            } catch (e) {
                console.warn(`Proxy ${proxyUrl} failed:`, e);
                continue;
            }
        }

        throw new Error('無法擷取網頁內容，請嘗試直接複製貼上文章內容');
    },

    /**
     * Clean extracted text from HTML
     * @param {string} text - Raw text
     * @returns {string} - Cleaned text
     */
    cleanExtractedText(text) {
        return text
            .replace(/\s+/g, ' ')           // Normalize whitespace
            .replace(/\n\s*\n/g, '\n\n')    // Normalize line breaks
            .trim();
    },

    /**
     * Format text for display (convert newlines to HTML)
     * @param {string} text - Text to format
     * @returns {string} - Formatted HTML
     */
    formatTextForDisplay(text) {
        return this.sanitizeHTML(text).replace(/\n/g, '<br>');
    },

    /**
     * Show notification toast
     * @param {string} message - Message to display
     * @param {string} type - Type: 'success', 'error', 'info'
     */
    showToast(message, type = 'info') {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#6366f1'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    /**
     * Generate a unique ID
     * @returns {string} - Unique ID
     */
    generateId() {
        return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Delay execution
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Add toast animation styles
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(toastStyles);
