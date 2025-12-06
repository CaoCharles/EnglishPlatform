/**
 * API module - Backend API integration
 * Calls the Python FastAPI backend instead of Claude directly
 */

const API = {
    baseUrl: '', // Same origin, relative paths

    /**
     * Make an API request to the backend
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body
     * @returns {Promise<Object>} - Response data
     */
    async request(endpoint, data) {
        try {
            const response = await fetch(`${this.baseUrl}/api${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `API 錯誤: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('無法連接到後端 API，請確認伺服器是否運行中');
            }
            throw error;
        }
    },

    /**
     * Fetch article from URL
     * @param {string} url - URL to fetch
     * @returns {Promise<{content: string, title: string}>}
     */
    async fetchUrl(url) {
        return this.request('/fetch-url', { url });
    },

    /**
     * Generate article summary
     * @param {string} article - Article text
     * @returns {Promise<{summary: string}>}
     */
    async generateSummary(article) {
        return this.request('/generate-summary', { article });
    },

    /**
     * Generate learning content for a paragraph
     * @param {string} paragraph - Paragraph text
     * @param {number} index - Paragraph index
     * @returns {Promise<Object>} - Paragraph content
     */
    async generateParagraphContent(paragraph, index) {
        return this.request('/generate-paragraph-content', { paragraph, index });
    },

    /**
     * Process entire article
     * @param {string} article - Article text
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} - Complete processed content
     */
    async processArticle(article, onProgress = () => { }) {
        // Option 1: Use the all-in-one endpoint
        // return this.request('/process-article', { article });

        // Option 2: Call individual endpoints for progress updates
        // Step 1: Generate summary
        onProgress('正在生成文章摘要...');
        const summaryResponse = await this.generateSummary(article);
        const summary = summaryResponse.summary;

        // Step 2: Split into paragraphs (done locally for speed)
        onProgress('正在智能分段...');
        const paragraphs = this.splitIntoParagraphs(article);

        // Step 3: Process each paragraph
        const processedParagraphs = [];
        for (let i = 0; i < paragraphs.length; i++) {
            onProgress(`正在處理第 ${i + 1}/${paragraphs.length} 段...`);
            const content = await this.generateParagraphContent(paragraphs[i], i + 1);
            processedParagraphs.push(content);
        }

        return {
            summary,
            paragraphs: processedParagraphs
        };
    },

    /**
     * Split article into paragraphs locally
     * @param {string} article - Article text
     * @returns {string[]} - Array of paragraphs
     */
    splitIntoParagraphs(article) {
        const naturalParagraphs = article
            .split(/\n\n+/)
            .map(p => p.trim())
            .filter(p => p.length > 0);

        const result = [];
        let currentChunk = '';

        for (const para of naturalParagraphs) {
            if (currentChunk === '') {
                currentChunk = para;
            } else {
                const combinedWordCount = (currentChunk + ' ' + para).split(/\s+/).length;

                if (combinedWordCount <= 150) {
                    currentChunk += '\n\n' + para;
                } else {
                    if (currentChunk.split(/\s+/).length >= 50) {
                        result.push(currentChunk);
                        currentChunk = para;
                    } else {
                        currentChunk += '\n\n' + para;
                    }
                }
            }
        }

        if (currentChunk) {
            result.push(currentChunk);
        }

        return result.length > 0 ? result : [article];
    }
};
