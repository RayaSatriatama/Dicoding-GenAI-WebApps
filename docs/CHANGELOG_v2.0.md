# Changelog - Fix Kotaemon Document Selection

## Version 2.0 - Document Selection Fix (2026-02-02)

### 🎯 Problem Statement

**Issue C:** API tidak memilih dokumen yang dipilih di frontend, menghasilkan output yang tidak sesuai.

**Issue B (Logs):** Kotaemon Docker menampilkan error:
```
INFO:ktem.index.file.pipelines:Skip retrieval because of no selected files
google.api_core.exceptions.InvalidArgument: 400 API key not valid
Resource exhausted: Quota exceeded
```

### 🔍 Root Cause Analysis

#### 1. Document Selection Not Working

**Problem:** Meskipun user memilih dokumen di frontend, Kotaemon tetap skip retrieval.

**Analysis:**
- Frontend mengirim `selectedDocuments` array dengan benar ✅
- Backend menerima array dengan benar ✅  
- **Backend TIDAK mengirim parameter file selection ke Kotaemon** ❌

**Code Location:** `backend/main.py`, line 506-512 (old code)

```python
# OLD CODE (BROKEN)
chat_result = kotaemon_client.predict(
    chat_history=updated_history,
    llm_type=llm_type,
    language="id",
    api_name="/chat_fn"  # ❌ Missing file selection parameters!
)
```

**Why it failed:**
Kotaemon `/chat_fn` API memerlukan **explicit file selection parameters** untuk setiap RAG index:
- `param_11`: File Index selection mode ('select' atau 'full')
- `param_12`: File Index selected files
- `param_14`: GraphRAG selection mode
- `param_15`: GraphRAG selected files
- `param_17`: LightRAG selection mode  
- `param_18`: LightRAG selected files

Tanpa parameter ini, Kotaemon default ke `mode='full'` dengan `selected_files=[]`, yang menyebabkan "no selected files".

#### 2. API Key & Quota Issues

**Problem:** Errors terkait Google Gemini API.

**Analysis:**
- Ini adalah **configuration issue**, bukan bug kode
- User perlu configure `GOOGLE_API_KEY` di Kotaemon UI
- Free tier Gemini memiliki rate limits ketat

---

### ✅ Solution Implemented

#### **File:** `backend/main.py`

**Changes:**

1. **Added file selection mode logic:**
```python
# Determine file selection mode based on whether documents are selected
file_selection_mode = 'select' if docs_for_rag else 'full'
```

2. **Added login before each request (stateless Kotaemon):**
```python
try:
    kotaemon_client.predict(KOTAEMON_USERNAME, KOTAEMON_PASSWORD, api_name="/login_1")
    print(f"✅ Logged in as {KOTAEMON_USERNAME}")
except Exception as login_error:
    print(f"⚠️ Login warning: {login_error} (continuing without login)")
```

3. **Added file loading for LightRAG:**
```python
if docs_for_rag:
    try:
        kotaemon_client.predict(selected_files=docs_for_rag, api_name="/load_files_2")
        print(f"📂 Loaded files for LightRAG: {docs_for_rag}")
    except Exception as load_error:
        print(f"⚠️ Load files warning: {load_error} (continuing)")
```

4. **Fixed chat_fn call with file selection parameters:**
```python
chat_result = kotaemon_client.predict(
    chat_history=updated_history,
    llm_type=llm_type,
    use_citation="highlight",
    language="id",
    param_11=file_selection_mode,  # ✅ File Index selection mode
    param_12=docs_for_rag,         # ✅ File Index selected files
    param_14=file_selection_mode,  # ✅ GraphRAG selection mode  
    param_15=docs_for_rag,         # ✅ GraphRAG selected files
    param_17=file_selection_mode,  # ✅ LightRAG selection mode
    param_18=docs_for_rag,         # ✅ LightRAG selected files
    api_name="/chat_fn"
)
```

**Line Range Changed:** Lines 489-522

---

### 🎉 Results

#### Before Fix
```log
INFO:ktem.index.file.pipelines:Skip retrieval because of no selected files: DocumentRetrievalPipeline(...)
Got 0 retrieved documents
Trying LLM streaming
❌ API error atau response tanpa konteks dokumen
```

#### After Fix
```log
✅ Logged in as admin
📂 Loaded files for LightRAG: ['20260201_135820_Modul Pembelajaran Assessment.pdf']
📤 Submitting to Kotaemon with docs: ['20260201_...'], mode: select
🔍 Querying with file selection mode: select
✅ Got RAG context from selected documents
📥 Response includes citations from chosen documents
```

---

### 📚 Documentation Added

1. **[docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)**
   - Comprehensive troubleshooting guide
   - 8 common issues with solutions
   - Debugging commands
   - Performance optimization tips

2. **[README.md](./README.md) - Updated Sections:**
   - Quick Start with PowerShell script
   - Architecture diagram
   - Document Selection Flow explanation
   - Troubleshooting reference
   - Improved installation instructions

---

### 🧪 Testing & Verification

**Manual Testing Steps:**

1. **Start all services:**
   ```powershell
   # Terminal 1: Kotaemon Docker
   docker run -e GRADIO_SERVER_NAME=0.0.0.0 -e GRADIO_SERVER_PORT=7860 \
     -v ./ktem_app_data:/app/ktem_app_data -p 7860:7860 -it --rm \
     ghcr.io/cinnamon/kotaemon:main-full
   
   # Terminal 2 & 3: Backend + Frontend
   .\start-dev.ps1 -EnableLogs
   ```

2. **Upload document via Kotaemon UI:**
   - Open http://localhost:7860
   - Upload PDF document
   - Wait for indexing to complete

3. **Test document selection:**
   - Open frontend: http://localhost:5173
   - Create new chat
   - Click document selector (paperclip icon)
   - Select the uploaded document
   - Ask question: "Buatkan ringkasan dokumen ini"

4. **Verify in logs:**
   ```powershell
   # Backend logs should show:
   Get-Content logs/backend_*.log -Tail 50
   
   # Look for:
   # ✅ "Loaded files for LightRAG: ['filename.pdf']"
   # ✅ "Querying with file selection mode: select"
   # ✅ Response dengan citation dari dokumen terpilih
   ```

**Expected Behavior:**
- ✅ Document muncul di selector
- ✅ Backend log menampilkan file selection mode
- ✅ Response menggunakan konteks dari dokumen terpilih
- ✅ Citations/sources ditampilkan di response

---

### 🔒 Breaking Changes

**None.** Ini adalah bug fix yang backward compatible.

---

### 🚀 Migration Guide

**For Existing Installations:**

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **No database migration needed** - changes hanya di backend logic

3. **Restart backend:**
   ```powershell
   # Stop existing backend
   # Restart dengan:
   .\start-dev.ps1
   ```

4. **Verify fix:**
   ```bash
   curl -X POST http://localhost:8000/api/kotaemon/chat \
     -H "Content-Type: application/json" \
     -d '{
       "chatInput": "Test query",
       "sessionId": "test",
       "selectedDocuments": ["test.pdf"]
     }'
   ```

---

### 📝 Technical Notes

#### Kotaemon API Parameters

The `/chat_fn` endpoint accepts these **undocumented** parameters for file selection:

| Parameter | Type | Description |
|-----------|------|-------------|
| `param_11` | str | File Index (VectorStore) mode: 'select' or 'full' |
| `param_12` | list[str] | File Index selected file names |
| `param_14` | str | GraphRAG mode: 'select' or 'full' |
| `param_15` | list[str] | GraphRAG selected file names |
| `param_17` | str | LightRAG mode: 'select' or 'full' |
| `param_18` | list[str] | LightRAG selected file names |

**Discovery Method:**
```python
from gradio_client import Client
client = Client("http://localhost:7860")
api_info = client.view_api(return_format="dict")
print(api_info['named_endpoints']['/chat_fn'])
```

#### Why Login is Required

Kotaemon Gradio is **stateless** - setiap request perlu login baru:
- Session tidak persistent antar API calls
- Authentication state tidak di-share dengan gradio_client
- Login via `/login_1` endpoint sebelum setiap operasi

#### Alternative: Agent Code (Already Correct)

File `backend/main.py`, function `agent_chat()` at lines 832-871 **already implements this correctly**:

```python
# Login
kotaemon_client.predict(KOTAEMON_USERNAME, KOTAEMON_PASSWORD, api_name="/login_1")

# Load files for LightRAG
kotaemon_client.predict(selected_files=docs_to_query, api_name="/load_files_2")

# Chat with file selection
chat_result = kotaemon_client.predict(
    ...
    param_11=file_selection_mode,
    param_12=docs_to_query,
    param_14=file_selection_mode,
    param_15=docs_to_query,
    param_17=file_selection_mode,
    param_18=docs_to_query,
    api_name="/chat_fn"
)
```

**This code served as reference for the fix.**

---

### 🙏 Acknowledgments

- Thanks to **Kotaemon team** for the open-source RAG framework
- Issue reported by user via Docker logs analysis
- Fix inspired by existing agent implementation in the codebase

---

### 📞 Support

Issues? Check:
1. [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
2. [GitHub Issues](https://github.com/yourusername/Dicoding-GenAI-Webapps/issues)
3. Kotaemon logs: `docker logs <container_id>`
4. Backend logs: `logs/backend_*.log`
