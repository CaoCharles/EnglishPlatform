# English Practice - 英文會話練習

一個基於 AI 的英文會話練習網頁應用，幫助您透過文章閱讀和互動練習來提升英文能力。

## ✨ 功能特色

- 📝 **文章輸入** - 直接貼上文章或輸入網址自動擷取
- 📋 **智能摘要** - AI 生成 3-5 個重點摘要
- 📖 **智能分段** - 將長文章分成適合學習的段落（100-150 字）
- 🌐 **中英對照** - 每段提供中文翻譯（可切換顯示）
- 💡 **簡易英文總結** - 使用簡單詞彙重述每段內容
- ❓ **延伸問題** - 每段 3 個思考問題及參考答案
- 🔊 **語音朗讀** - 使用 Web Speech API 朗讀所有英文內容
- 🌙 **深色模式** - 支援淺色/深色主題切換
- 📱 **響應式設計** - 支援手機、平板、電腦

## 🏗️ 專案架構

```
EnglishPlatform/
├── api/                    # Python FastAPI 後端
│   ├── main.py             # 主應用
│   └── routers/
│       ├── articles.py     # 文章處理 API
│       └── health.py       # 健康檢查
├── js/                     # 前端 JavaScript
│   ├── app.js              # 主應用邏輯
│   ├── api.js              # API 呼叫
│   ├── tts.js              # 語音功能
│   └── utils.js            # 工具函數
├── css/
│   └── styles.css          # 樣式表
├── index.html              # 主頁面
├── pyproject.toml          # Python 依賴
└── .env                    # 環境變數（需自行建立）
```

## 🚀 快速開始

### 1. 設定環境變數

複製 `.env.example` 並建立 `.env` 檔案：

```bash
cp .env.example .env
```

編輯 `.env`，填入您的 Claude API Key：

```
ANTHROPIC_API_KEY=sk-ant-api-xxxxx
```

### 2. 安裝 Python 依賴

使用 uv 建立虛擬環境並安裝依賴：

```bash
# 建立虛擬環境並安裝依賴
uv sync

# 或者分開執行
uv venv
uv pip install -e .
```

### 3. 啟動後端伺服器

```bash
# 使用 uv run
uv run uvicorn api.main:app --reload --port 8000

# 或者啟動虛擬環境後執行
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # macOS/Linux
uvicorn api.main:app --reload --port 8000
```

### 4. 開啟瀏覽器

訪問 `http://localhost:8000`

> 後端會同時提供前端靜態檔案，無需另外啟動前端伺服器。

## 📡 API 端點

| 端點 | 方法 | 說明 |
|------|------|------|
| `/health` | GET | 健康檢查 |
| `/api/fetch-url` | POST | 從 URL 擷取文章內容 |
| `/api/generate-summary` | POST | 生成文章摘要 |
| `/api/generate-paragraph-content` | POST | 生成段落學習內容 |
| `/api/process-article` | POST | 處理整篇文章 |

## 🔑 取得 Claude API Key

1. 前往 [Anthropic Console](https://console.anthropic.com/)
2. 註冊或登入帳號
3. 前往 API Keys 頁面
4. 建立新的 API Key

## 🎨 UI 功能說明

| 功能 | 說明 |
|------|------|
| 🔊 按鈕 | 點擊播放英文語音，再次點擊停止 |
| 👁 按鈕 | 切換顯示/隱藏中文翻譯 |
| ▼ 按鈕 | 展開/收合段落內容 |
| 🌙/☀️ | 切換深色/淺色模式 |

## ⚙️ 技術細節

### 後端
- **框架**: FastAPI
- **AI**: Anthropic Claude API
- **網頁擷取**: httpx + BeautifulSoup4
- **套件管理**: uv

### 前端
- **純原生**: HTML, CSS, JavaScript（無框架）
- **語音**: Web Speech API
- **樣式**: CSS Grid, Flexbox, CSS Variables

## 📝 使用建議

1. **選擇適當長度的文章** - 建議 300-1000 字的文章效果最佳
2. **調整語速** - 初學者可將語速調慢至 0.8x
3. **先聽後讀** - 先聽語音，再看文字
4. **回答問題** - 嘗試自己回答問題後再查看參考答案
5. **善用翻譯** - 先嘗試理解英文，不懂再看翻譯

## ⚠️ 注意事項

- 需要有效的 Claude API Key（設定在 `.env` 檔案中）
- API 呼叫會產生費用，請注意使用量
- 網址擷取功能可能對某些網站無效（有防爬蟲機制的網站）

## 🔧 故障排除

**Q: 後端無法啟動？**  
A: 請確認已正確設定 `.env` 檔案，並已安裝所有依賴。

**Q: API 呼叫失敗？**  
A: 請確認 API Key 正確，並檢查後端 console 的錯誤訊息。

**Q: 語音沒有聲音？**  
A: 請確認瀏覽器支援 Web Speech API，並允許音訊播放。

## 📄 授權

MIT License
