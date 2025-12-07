"""
Articles API endpoints
"""
import os
import re
import json
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import httpx
from bs4 import BeautifulSoup
import anthropic

router = APIRouter()

# Claude client (initialized lazily)
_claude_client: Optional[anthropic.Anthropic] = None


def get_claude_client() -> anthropic.Anthropic:
    """Get or create Claude client"""
    global _claude_client
    if _claude_client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="ANTHROPIC_API_KEY not configured"
            )
        _claude_client = anthropic.Anthropic(api_key=api_key)
    return _claude_client


# Request/Response Models
class FetchURLRequest(BaseModel):
    url: str = Field(..., description="URL to fetch article from")


class FetchURLResponse(BaseModel):
    content: str
    title: Optional[str] = None


class ProcessArticleRequest(BaseModel):
    article: str = Field(..., description="Article text to process")


class Question(BaseModel):
    question: str
    questionTranslation: str
    answer: str
    answerTranslation: str


class ParagraphContent(BaseModel):
    index: int
    original: str
    translation: str
    simpleSummary: str
    simpleSummaryTranslation: str
    questions: list[Question]


class ProcessArticleResponse(BaseModel):
    summary: str
    paragraphs: list[ParagraphContent]


class GenerateSummaryRequest(BaseModel):
    article: str


class GenerateParagraphRequest(BaseModel):
    paragraph: str
    index: int


# Helper functions
def split_into_paragraphs(article: str) -> list[str]:
    """Split article into logical paragraphs (100-150 words each)"""
    # Split by natural paragraph breaks
    natural_paragraphs = [p.strip() for p in re.split(r'\n\n+', article) if p.strip()]
    
    result = []
    current_chunk = ''
    
    for para in natural_paragraphs:
        word_count = len(para.split())
        
        if not current_chunk:
            current_chunk = para
        else:
            combined_word_count = len((current_chunk + ' ' + para).split())
            
            if combined_word_count <= 150:
                current_chunk += '\n\n' + para
            else:
                if len(current_chunk.split()) >= 50:
                    result.append(current_chunk)
                    current_chunk = para
                else:
                    current_chunk += '\n\n' + para
    
    if current_chunk:
        result.append(current_chunk)
    
    return result if result else [article]


def try_fix_json(json_str: str) -> str:
    """Try to fix common JSON issues"""
    # Remove any trailing incomplete content after the last complete brace
    # Find the last complete JSON structure
    brace_count = 0
    last_complete_pos = 0
    
    for i, char in enumerate(json_str):
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0:
                last_complete_pos = i + 1
    
    if last_complete_pos > 0:
        json_str = json_str[:last_complete_pos]
    
    # Try to close any unclosed strings or brackets
    # Count quotes
    quote_count = json_str.count('"') - json_str.count('\\"')
    if quote_count % 2 == 1:
        # Unclosed string, try to close it
        json_str = json_str.rstrip()
        if not json_str.endswith('"'):
            json_str += '"'
    
    return json_str


def parse_json_safely(response_text: str) -> dict:
    """Parse JSON with multiple fallback strategies"""
    # Clean up the response
    response_text = response_text.strip()
    
    # Remove markdown code blocks if present
    if response_text.startswith('```'):
        response_text = re.sub(r'^```json?\n?', '', response_text)
        response_text = re.sub(r'```\n?$', '', response_text)
        response_text = response_text.strip()
    
    # Try direct parsing first
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        pass
    
    # Try to fix and parse
    try:
        fixed = try_fix_json(response_text)
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass
    
    # Try to extract JSON object using regex
    try:
        # Find the outermost JSON object
        match = re.search(r'\{[\s\S]*\}', response_text)
        if match:
            return json.loads(match.group())
    except json.JSONDecodeError:
        pass
    
    raise ValueError(f"Cannot parse JSON response: {response_text[:200]}...")


# API Endpoints
@router.post("/fetch-url", response_model=FetchURLResponse)
async def fetch_url(request: FetchURLRequest):
    """Fetch article content from a URL"""
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=30.0,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        ) as client:
            response = await client.get(request.url)
            response.raise_for_status()
            
            # Parse HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove unwanted elements
            for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'iframe', 'noscript']):
                tag.decompose()
            
            # Try to find main content
            content_selectors = [
                'article',
                '[role="main"]',
                '.article-content',
                '.post-content',
                '.entry-content',
                '.content',
                'main',
                '.story-body',
            ]
            
            content = None
            for selector in content_selectors:
                element = soup.select_one(selector)
                if element and len(element.get_text(strip=True)) > 100:
                    content = element.get_text(separator='\n', strip=True)
                    break
            
            if not content:
                # Fallback to body
                content = soup.body.get_text(separator='\n', strip=True) if soup.body else ""
            
            # Clean up content
            content = re.sub(r'\n\s*\n', '\n\n', content)
            content = re.sub(r' +', ' ', content)
            
            # Get title
            title = soup.title.string if soup.title else None
            
            return FetchURLResponse(content=content.strip(), title=title)
            
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing URL: {str(e)}")


@router.post("/generate-summary")
async def generate_summary(request: GenerateSummaryRequest):
    """Generate article summary using Claude"""
    client = get_claude_client()
    model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
    
    # Truncate article if too long (to avoid token limits)
    article = request.article
    if len(article) > 8000:
        article = article[:8000] + "\n\n[Article truncated for processing...]"
    
    try:
        message = client.messages.create(
            model=model,
            max_tokens=1024,
            system="You are an English learning assistant. Create summaries using simple, easy-to-understand vocabulary suitable for intermediate English learners.",
            messages=[{
                "role": "user",
                "content": f"""Please read the following article and create a summary with 3-5 key points. Use simple English vocabulary that intermediate learners can understand.

Format your response as a bullet point list, with each point being 1-2 sentences.

Article:
{article}

Respond with ONLY the bullet points, no additional text."""
            }]
        )
        
        return {"summary": message.content[0].text}
        
    except anthropic.APIError as e:
        raise HTTPException(status_code=500, detail=f"Claude API error: {str(e)}")


@router.post("/generate-paragraph-content")
async def generate_paragraph_content(request: GenerateParagraphRequest):
    """Generate learning content for a paragraph"""
    client = get_claude_client()
    model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
    
    # Truncate paragraph if too long
    paragraph = request.paragraph
    if len(paragraph) > 2000:
        paragraph = paragraph[:2000] + "..."
    
    max_retries = 2
    last_error = None
    
    for attempt in range(max_retries + 1):
        try:
            message = client.messages.create(
                model=model,
                max_tokens=2500,  # Increased to avoid truncation
                system="You are an English learning assistant. You MUST respond with valid JSON only. No markdown, no explanations, just the JSON object.",
                messages=[{
                    "role": "user",
                    "content": f"""Create learning content for this English paragraph. Return ONLY a valid JSON object.

Paragraph:
{paragraph}

Return this exact JSON structure (fill in the values):
{{"translation": "繁體中文翻譯", "simpleSummary": "Simple 2-3 sentence summary in easy English", "simpleSummaryTranslation": "簡單總結的中文翻譯", "questions": [{{"question": "First discussion question?", "questionTranslation": "第一個問題的中文", "answer": "Sample answer in English.", "answerTranslation": "答案的中文翻譯"}}, {{"question": "Second discussion question?", "questionTranslation": "第二個問題的中文", "answer": "Sample answer.", "answerTranslation": "答案中文"}}, {{"question": "Third discussion question?", "questionTranslation": "第三個問題的中文", "answer": "Sample answer.", "answerTranslation": "答案中文"}}]}}

IMPORTANT: Return ONLY the JSON object, nothing else."""
                }]
            )
            
            # Parse JSON response with fallback strategies
            response_text = message.content[0].text.strip()
            content = parse_json_safely(response_text)
            
            # Validate required fields exist
            required_fields = ['translation', 'simpleSummary', 'simpleSummaryTranslation', 'questions']
            for field in required_fields:
                if field not in content:
                    raise ValueError(f"Missing required field: {field}")
            
            if len(content['questions']) < 3:
                raise ValueError("Not enough questions generated")
            
            return {
                "index": request.index,
                "original": request.paragraph,
                **content
            }
            
        except (json.JSONDecodeError, ValueError) as e:
            last_error = e
            if attempt < max_retries:
                print(f"Retry {attempt + 1} for paragraph {request.index}: {str(e)}")
                continue
        except anthropic.APIError as e:
            raise HTTPException(status_code=500, detail=f"Claude API error: {str(e)}")
    
    # All retries failed, return a fallback response
    print(f"All retries failed for paragraph {request.index}, using fallback")
    return {
        "index": request.index,
        "original": request.paragraph,
        "translation": "[翻譯生成失敗，請重試]",
        "simpleSummary": "This paragraph discusses the topic mentioned above.",
        "simpleSummaryTranslation": "[總結生成失敗]",
        "questions": [
            {
                "question": "What is the main idea of this paragraph?",
                "questionTranslation": "這段的主要內容是什麼？",
                "answer": "The main idea is discussed in the paragraph above.",
                "answerTranslation": "主要內容在上面的段落中討論。"
            },
            {
                "question": "What details support the main idea?",
                "questionTranslation": "有哪些細節支持主要觀點？",
                "answer": "The paragraph provides several supporting details.",
                "answerTranslation": "段落提供了幾個支持的細節。"
            },
            {
                "question": "How does this relate to the overall topic?",
                "questionTranslation": "這與整體主題有什麼關係？",
                "answer": "This paragraph contributes to the overall discussion.",
                "answerTranslation": "這段對整體討論有所貢獻。"
            }
        ]
    }


@router.post("/process-article", response_model=ProcessArticleResponse)
async def process_article(request: ProcessArticleRequest):
    """Process entire article - generate summary and paragraph content"""
    client = get_claude_client()
    
    # Step 1: Generate summary
    summary_response = await generate_summary(GenerateSummaryRequest(article=request.article))
    summary = summary_response["summary"]
    
    # Step 2: Split into paragraphs
    paragraphs = split_into_paragraphs(request.article)
    
    # Step 3: Process each paragraph
    processed_paragraphs = []
    for i, para in enumerate(paragraphs):
        content = await generate_paragraph_content(
            GenerateParagraphRequest(paragraph=para, index=i + 1)
        )
        processed_paragraphs.append(ParagraphContent(**content))
    
    return ProcessArticleResponse(
        summary=summary,
        paragraphs=processed_paragraphs
    )
