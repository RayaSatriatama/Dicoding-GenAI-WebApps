# Troubleshooting Guide

## Common Issues and Solutions

### 1. Kotaemon: "Skip retrieval because of no selected files"

**Symptom:**
```
INFO:ktem.index.file.pipelines:Skip retrieval because of no selected files
```

**Root Cause:**
- Frontend tidak mengirim `selectedDocuments` dengan benar
- Backend tidak mengaktifkan `file_selection_mode`
- Kotaemon `/chat_fn` tidak menerima parameter seleksi file

**Solution (SUDAH DIPERBAIKI di v2.0):**

Backend sekarang mengirim parameter eksplisit untuk file selection:

```python
# File selection mode
file_selection_mode = 'select' if docs_for_rag else 'full'

# Login sebelum request (Kotaemon stateless)
kotaemon_client.predict(KOTAEMON_USERNAME, KOTAEMON_PASSWORD, api_name="/login_1")

# Load files untuk LightRAG
if docs_for_rag:
    kotaemon_client.predict(selected_files=docs_for_rag, api_name="/load_files_2")

# Chat dengan file selection parameters
chat_result = kotaemon_client.predict(
    chat_history=updated_history,
    llm_type=llm_type,
    language="id",
    param_11=file_selection_mode,  # File Index
    param_12=docs_for_rag,         # File Index files
    param_17=file_selection_mode,  # LightRAG
    param_18=docs_for_rag,         # LightRAG files
    api_name="/chat_fn"
)
```

**Verifikasi:**
- Cek log backend untuk: `📂 Loaded files for LightRAG: ['namafile.pdf']`
- Cek log backend untuk: `🔍 Querying with file selection mode: select`
- Response harus berisi konteks dari dokumen terpilih

---

### 2. Kotaemon: "API key not valid. Please pass a valid API key."

**Symptom:**
```
google.api_core.exceptions.InvalidArgument: 400 API key not valid
```

**Root Cause:**
- `GOOGLE_API_KEY` tidak dikonfigurasi di Kotaemon
- API key tidak valid atau expired
- API key tidak memiliki akses ke Gemini API

**Solution:**

1. **Konfigurasi API Key di Kotaemon UI:**
   ```
   http://localhost:7860
   → Settings → LLM Configuration → Google
   → Masukkan GOOGLE_API_KEY Anda
   → Pilih model: gemini-2.0-flash atau gemini-1.5-pro
   ```

2. **Generate API Key:**
   ```
   https://aistudio.google.com/app/apikey
   → Create API Key
   → Copy key
   → Paste ke Kotaemon Settings
   ```

3. **Verifikasi API Key:**
   ```bash
   curl -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
     "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=YOUR_API_KEY"
   ```

**Environment Variable (Alternative):**
```env
# File: .env.docker.example atau docker-compose.yml
GOOGLE_API_KEY=your_actual_api_key_here
```

Restart Kotaemon Docker container setelah perubahan.

---

### 3. Kotaemon: "Quota exceeded for metric"

**Symptom:**
```
Resource exhausted: Quota exceeded for metric: 
generativelanguage.googleapis.com/generate_content_free_tier_requests
```

**Root Cause:**
- Free tier Gemini API memiliki batas:
  - 15 RPM (Requests Per Minute)
  - 1 Million TPM (Tokens Per Minute)
  - 1,500 RPD (Requests Per Day)

**Solution:**

**Immediate Fix:**
1. **Tunggu beberapa menit** (quota reset setiap menit)
2. **Reduce request frequency**
3. **Use smaller prompts** untuk mengurangi token usage

**Long-term Fix:**
1. **Upgrade to Paid Plan:**
   ```
   Google Cloud Console → APIs & Services → Gemini API
   → Enable Billing
   → Increased quota: 1000 RPM, 4M TPM
   ```

2. **Use Alternative Models:**
   - `gemini-2.0-flash`: Faster, lebih murah
   - `gemini-1.5-flash-8b`: Paling murah untuk free tier

3. **Implement Rate Limiting di Backend:**
   ```python
   from slowapi import Limiter
   from slowapi.util import get_remote_address
   
   limiter = Limiter(key_func=get_remote_address)
   app.state.limiter = limiter
   
   @app.post("/api/kotaemon/chat")
   @limiter.limit("10/minute")  # Max 10 requests per minute
   async def chat(request: ChatRequest):
       ...
   ```

---

### 4. Backend: "Not connected to Kotaemon"

**Symptom:**
```
503 Service Unavailable: Not connected to Kotaemon
```

**Root Cause:**
- Kotaemon Docker tidak berjalan
- Port 7860 tidak accessible
- Network issue antara backend dan Kotaemon

**Solution:**

1. **Start Kotaemon Docker:**
   ```bash
   docker run -e GRADIO_SERVER_NAME=0.0.0.0 -e GRADIO_SERVER_PORT=7860 \
     -v ./ktem_app_data:/app/ktem_app_data -p 7860:7860 -it --rm \
     ghcr.io/cinnamon/kotaemon:main-full
   ```

2. **Check Kotaemon Status:**
   ```bash
   curl http://localhost:7860
   ```
   Should return Kotaemon UI HTML.

3. **Verify Backend Config:**
   ```env
   # backend/.env
   KOTAEMON_URL=http://localhost:7860
   ```

4. **Reconnect dari Backend:**
   ```bash
   curl -X POST http://localhost:8000/api/kotaemon/reconnect
   ```

---

### 5. Frontend: Document Selector tidak menampilkan file

**Symptom:**
- Document Selector kosong
- Tidak ada file yang muncul setelah upload

**Root Cause:**
- File belum diindeks di Kotaemon
- Backend tidak bisa akses Kotaemon database
- Path `KOTAEMON_DB_PATH` salah

**Solution:**

1. **Verifikasi File Terindeks:**
   ```bash
   # Check Kotaemon database
   sqlite3 ktem_app_data/user_data/sql.db
   > SELECT name FROM ktem__index;
   > SELECT name FROM index__3__source;  # LightRAG index
   ```

2. **Check Backend Config:**
   ```env
   # backend/.env
   KOTAEMON_DB_PATH=../ktem_app_data/user_data/sql.db
   ```

3. **Force Reindex Document:**
   - Buka Kotaemon UI: http://localhost:7860
   - Upload file lagi via UI
   - Tunggu hingga indexing selesai

4. **Get Documents API:**
   ```bash
   curl http://localhost:8000/api/kotaemon/documents
   ```
   Should return list of indexed documents.

---

### 6. SQLAlchemy: "No row was found when one was required"

**Symptom:**
```
sqlalchemy.exc.NoResultFound: No row was found when one was required
```

**Root Cause:**
- Conversation tidak ada di database
- Database kosong atau belum diinisialisasi
- Query error dalam Kotaemon code

**Solution:**

1. **Check Kotaemon Database:**
   ```bash
   sqlite3 ktem_app_data/user_data/sql.db
   > .tables
   > SELECT * FROM ktem__conversations LIMIT 5;
   ```

2. **Create New Conversation:**
   - Buka Kotaemon UI
   - Start new chat (akan auto-create conversation)

3. **Clear Invalid Sessions:**
   ```bash
   # Reset database (WARNING: menghapus semua chat history)
   rm ktem_app_data/user_data/sql.db
   # Kotaemon akan auto-create database baru
   ```

---

### 7. MongoDB Connection Error

**Symptom:**
```
pymongo.errors.ServerSelectionTimeoutError: localhost:27017
```

**Solution:**

1. **Start MongoDB:**
   ```bash
   # Windows
   net start MongoDB
   
   # Linux/Mac
   sudo systemctl start mongod
   
   # Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   ```

2. **Verify Connection:**
   ```bash
   mongosh "mongodb://localhost:27017/aichat"
   ```

3. **Update .env:**
   ```env
   MONGO=mongodb://localhost:27017/aichat
   ```

---

### 8. Clerk Authentication Error

**Symptom:**
```
401 Unauthenticated!
JWTExpired / Invalid token
```

**Solution:**

1. **Update Clerk Keys:**
   ```env
   # Frontend: client/.env
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   
   # Backend: backend/.env
   CLERK_SECRET_KEY=sk_test_...
   CLERK_PUBLISHABLE_KEY=pk_test_...
   ```

2. **Clear Browser Cookies:**
   - Open DevTools → Application → Cookies
   - Delete all cookies for localhost:5173

3. **Re-login:**
   - Logout dari aplikasi
   - Login lagi dengan credentials yang valid

---

## Performance Optimization

### 1. Slow Response from Kotaemon

**Solutions:**
- Use faster models: `gemini-2.0-flash` atau `gemini-1.5-flash-8b`
- Reduce `maxTokens` di frontend (default: 2048)
- Limit retrieved documents: max 3-5 files per query
- Use shorter prompts

### 2. High Memory Usage

**Solutions:**
- Restart Kotaemon Docker periodically
- Limit document uploads (max 10MB per file)
- Clear ChromaDB cache: `rm -rf ktem_app_data/user_data/vectorstore`

---

## Debugging Commands

### Check All Services Status

```bash
# Backend
curl http://localhost:8000

# Kotaemon
curl http://localhost:7860

# MongoDB
mongosh "mongodb://localhost:27017" --eval "db.runCommand({ ping: 1 })"
```

### View Backend Logs

```bash
# If using start-dev.ps1 with -EnableLogs
Get-Content logs/backend_*.log -Tail 50 -Wait
```

### Check Kotaemon Docker Logs

```bash
docker logs -f <container_id>
```

### Test Kotaemon API

```python
from gradio_client import Client

client = Client("http://localhost:7860")
print(client.view_api())
```

---

## Contact & Support

Jika masalah masih berlanjut:
1. Buka GitHub Issues: [Dicoding-GenAI-Webapps Issues](https://github.com/yourusername/Dicoding-GenAI-Webapps/issues)
2. Sertakan log error lengkap
3. Sertakan versi Python, Node.js, dan Docker yang digunakan
