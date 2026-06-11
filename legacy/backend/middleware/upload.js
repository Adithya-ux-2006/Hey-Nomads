const fs = require("fs");
const multer = require("multer");
const path = require("path");

const uploadsDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
        const safeName = `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, safeName);
    },
});

module.exports = multer({ storage });
