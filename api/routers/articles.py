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
{request.article}

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
    
    try:
        message = client.messages.create(
            model=model,
            max_tokens=2048,
            system="You are an English learning assistant helping intermediate learners understand English articles. Always respond in valid JSON format.",
            messages=[{
                "role": "user",
                "content": f"""Analyze this paragraph and create learning content in JSON format:

Paragraph:
{request.paragraph}

Create a JSON response with exactly this structure:
{{
  "translation": "中文翻譯 (translate the paragraph to Traditional Chinese)",
  "simpleSummary": "A simple English summary using basic vocabulary (2-3 sentences)",
  "simpleSummaryTranslation": "簡單英文總結的中文翻譯",
  "questions": [
    {{
      "question": "Discussion question in English",
      "questionTranslation": "問題的中文翻譯",
      "answer": "Sample answer in English (2-3 sentences)",
      "answerTranslation": "答案的中文翻譯"
    }},
    {{
      "question": "Second question in English",
      "questionTranslation": "第二個問題的中文翻譯",
      "answer": "Sample answer in English",
      "answerTranslation": "答案的中文翻譯"
    }},
    {{
      "question": "Third question in English",
      "questionTranslation": "第三個問題的中文翻譯",
      "answer": "Sample answer in English",
      "answerTranslation": "答案的中文翻譯"
    }}
  ]
}}

Important:
- Use simple, clear English for the summary and questions
- Questions should encourage discussion and thinking
- Provide helpful sample answers that use vocabulary from the paragraph
- All translations should be in Traditional Chinese
- Return ONLY valid JSON, no markdown formatting"""
            }]
        )
        
        # Parse JSON response
        response_text = message.content[0].text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith('```'):
            response_text = re.sub(r'^```json?\n?', '', response_text)
            response_text = re.sub(r'```\n?$', '', response_text)
        
        content = json.loads(response_text)
        
        return {
            "index": request.index,
            "original": request.paragraph,
            **content
        }
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")
    except anthropic.APIError as e:
        raise HTTPException(status_code=500, detail=f"Claude API error: {str(e)}")


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
