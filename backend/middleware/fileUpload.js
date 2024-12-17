import fs from 'fs';
import path from 'path';
import multer from 'multer';

if (!fs.existsSync(process.env.UPLOAD_DIR)) {
  fs.mkdirSync(process.env.UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + file.originalname;
    cb(null, uniqueSuffix);
  }
});

// Menetapkan storage di multer
const upload = multer({ storage: storage });

export default upload;
