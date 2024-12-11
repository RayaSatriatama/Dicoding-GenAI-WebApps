import fs from 'fs';
import path from 'path';
import multer from 'multer';

const uploadDir = path.join('D:', 'Projects', 'Programming_Projects', 'Dicoding-Gen-AI', 'self-hosted-ai-starter-kit', 'shared', 'document');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + file.originalname;
    cb(null, uniqueSuffix);
  }
});

// Menetapkan storage di multer
const upload = multer({ storage: storage });

export default upload;
