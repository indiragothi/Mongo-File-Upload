const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const {GridFsStorage} = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(methodOverride('_method'));
// EJS
app.set('view engine', 'ejs');

// Mongo URI
const mongoURI = 'mongodb://127.0.0.1:27017/mongoUploads';

// Create mongo connection
const conn = mongoose.createConnection(mongoURI);

// Init gfs
let gfs;

conn.once('open', () => {
  // Init stream
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// Create storage engine
const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads'
          };
          resolve(fileInfo);
        });
      });
    }
});
const upload = multer({ storage });
  
// @route GET /
// @desc Loads form
app.get('/', async(req, res) => {
    const files = await gfs.files.find().toArray()
      // Check if files
    if (!files || files.length === 0) {
        res.render('index', { files: false });
    } else {
        files.map(file => {
          if (
            file.contentType === 'image/jpeg' ||
            file.contentType === 'image/png' ||
            file.contentType === 'image/jpg'
          ) {
            file.isImage = true;
          } else {
            file.isImage = false;
          }
        });
        res.render('index', { files: files });
    }
});

// @route POST /upload
// @desc  Uploads file to DB
app.post('/upload', upload.single('file'), (req, res) => {
    // res.json({ file: req.file });
    res.redirect('/');
});

// @route GET /files
// @desc  Display all files in JSON
app.get("/files", async (req, res) => {
    try {
        let files = await gfs.files.find().toArray();
        res.json({files})
    } catch (err) {
        res.json({err:'No files exist'})
    }
});

// @route GET /files/:filename
// @desc  Display single file object
app.get('/files/:filename', async(req, res) => {
    try {
        let file = await gfs.files.findOne({ filename: req.params.filename }) 
        res.json({file})
    } catch (err) {
        res.json({err:'No file exists'})
    }
});

// @route GET /image/:filename
// @desc Display Image
app.get('/image/:filename', async(req, res) => {
     const file = await gfs.files.find({ filename: req.params.filename }).toArray () 
      // Check if file
      if (!file || file.length === 0) {
        return res.status(404).json({
          err: 'No file exists'
        });
    }
       
      // Check if image
    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png' || file.contentType === 'image/jpg') {
        // Read output to browser
        const readstream = gfs.createReadStream(file.filename);
        readstream.pipe(res);
    } else {
        res.status(404).json({
          err: 'Not an image'
        });
    } 
});

// @route DELETE /files/:id
// @desc  Delete file
app.delete('/files/:id', (req, res) => {
    gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
      if (err) {
        return res.status(404).json({ err: err });
      }
  
      res.redirect('/');
    });
});

const PORT = 5000;

app.listen(PORT, ()=>console.log(`Server started on ${PORT}`));