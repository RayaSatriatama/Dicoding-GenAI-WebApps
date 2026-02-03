# Quick Fix Guide: Kotaemon Document Not Retrieving

## Problem
```
Got 0 from vectorstore
Got 0 from docstore
Generate nothing: (Sorry, I don't know)
```

## Root Cause
File baru diupload tapi **indexing belum selesai** atau **vectorstore corrupted**.

## Solution Steps

### Step 1: Check Kotaemon Docker Logs
```bash
# Check if indexing is still running
docker logs <kotaemon_container_id> | tail -50

# Look for:
# "Adding documents to doc store"
# "indexing step took X.XX seconds"
# "[New Docs] inserting 1 docs"
```

### Step 2: Wait for Indexing to Complete
- **PDF 217KB** biasanya butuh **1-2 menit** untuk:
  - Text extraction
  - Embedding generation (via Gemini API)
  - Vector store insertion

### Step 3: Verify via Kotaemon UI
1. Open: http://localhost:7860
2. Go to "Files" tab
3. Check status dokumen:
   - ✅ Green checkmark = Indexed
   - ⏳ Processing = Wait
   - ❌ Error = Reindex

### Step 4: Force Reindex (If Needed)
```
Kotaemon UI → Files → Select file → Click "..." → Reindex
```

### Step 5: Alternative - Delete & Reupload
1. Delete file dari Kotaemon UI
2. Upload ulang via UI (bukan via frontend app)
3. Tunggu indexing selesai (cek Docker logs)
4. Test lagi dari frontend

### Step 6: Check Backend Logs
```powershell
# If using start-dev.ps1 with logs
Get-Content logs/backend_*.log -Tail 50

# Look for:
# ✅ "Loaded files for LightRAG: ['file.pdf']"
# ✅ "Querying with file selection mode: select"
# ❌ "Got 0 from vectorstore" = PROBLEM
```

## Debug Commands

### Check if file exists in Kotaemon database
```bash
cd C:/Users/rayas/.cursor/worktrees/Dicoding-GenAI-Webapps/hey

# Check LightRAG files
ls -lah ktem_app_data/user_data/files/lightrag/*/input/*.json

# Check vectorstore size (should be > 500KB if indexed)
ls -lah ktem_app_data/user_data/vectorstore/chroma.sqlite3
```

### Test Kotaemon API directly
```python
from gradio_client import Client

client = Client("http://localhost:7860")

# Login
client.predict("admin", "admin", api_name="/login_1")

# Load files
client.predict(
    selected_files=["20260201_215530_Mohammad Raya Satriatama_Soal Kuis 2 Verval 5B_2025.pdf"],
    api_name="/load_files_2"
)

# Test retrieval
result = client.predict(
    chat_input={'text': 'Test retrieval', 'files': []},
    chat_history=[],
    conv_name=None,
    first_selector_choices=["20260201_215530_Mohammad Raya Satriatama_Soal Kuis 2 Verval 5B_2025.pdf"],
    api_name="/submit_msg"
)

print("Submit result:", result)
```

## Common Issues

### Issue 1: "Got 0 from vectorstore"
**Cause:** Indexing not complete OR vectorstore corrupted
**Fix:** Wait 2-3 minutes, then retry. If still fails, reindex.

### Issue 2: "GRAPHRAG_API_KEY is not set"
**Cause:** GraphRAG not configured (optional feature)
**Fix:** Ignore this warning - LightRAG should still work

### Issue 3: "Cohere API key not found"
**Cause:** Reranking not configured (optional feature)
**Fix:** Ignore this warning - retrieval should still work

### Issue 4: Gemini API quota exceeded during indexing
**Cause:** Free tier limit hit during embedding generation
**Fix:** 
- Wait for quota reset (1 hour)
- OR upgrade to paid plan
- OR use smaller documents

## Verification Checklist

After fix, verify:
- [ ] Backend logs show: `📂 Loaded files for LightRAG: ['file.pdf']`
- [ ] Backend logs show: `🔍 Querying with file selection mode: select`
- [ ] Kotaemon logs show: `Got X retrieved documents` (X > 0)
- [ ] Frontend displays response with document context
- [ ] Citations appear in response

## Expected Timeline

| Action | Time |
|--------|------|
| Upload file | Instant |
| Text extraction | 10-20s |
| Embedding generation | 30-60s |
| Vector store insertion | 10-20s |
| **Total** | **1-2 minutes** |

## Next Steps

1. ✅ **Wait 2-3 minutes** after upload
2. ✅ **Refresh frontend** page
3. ✅ **Select document** again
4. ✅ **Ask question** about document
5. ✅ **Verify response** includes document context

---

**If problem persists after 5 minutes:**
1. Check Kotaemon Docker logs for errors
2. Reindex file via Kotaemon UI
3. Check Gemini API quota status
4. Contact support with full error logs
