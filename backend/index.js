import express from "express";
import cors from "cors";
import path from "path";
import url, { fileURLToPath } from "url";
import ImageKit from "imagekit";
import mongoose from "mongoose";
import Chat from "./models/chat.js";
import UserChats from "./models/userChats.js";
import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";
import dotenv from "dotenv";
import upload from "./middleware/fileUpload.js";
import fileDelete from "./middleware/fileDelete.js";
import Document from './models/document.js';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config();

const port = process.env.PORT || 3000;
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

const connect = async () => {
  try {
    await mongoose.connect(process.env.MONGO);
    console.log("Connected to MongoDB");
  } catch (err) {
    console.log(err);
  }
};

const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
});

app.get("/api/upload", (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

app.post("/api/upload", ClerkExpressRequireAuth(), upload.single("file"), async (req, res) => {
  const userId = req.auth.userId;
  console.log(userId);

  if (req.file) {
    console.log("File uploaded:", req.file);

    try {
      const newDocument = new Document({
        userId: userId,
        title: req.file.originalname,
        path: req.file.path.replace(/\\/g, "/").replace(process.env.UPLOAD_DIR, ''),
        size: req.file.size,
        type: req.file.mimetype.split('/')[1], // Extract type from mimetype
      });

      const savedDocument = await newDocument.save();
      console.log("Document saved to MongoDB:", savedDocument);

      res.json({
        message: "File uploaded and document saved successfully",
        filePath: req.file.path.replace(/\\/g, "/"), // Ensure path is URL-friendly
        fileName: req.file.originalname,             // Return the original file name
      });
    } catch (err) {
      console.error("Error saving document to MongoDB:", err);
      res.status(500).json({ message: "Error saving document to MongoDB", error: err.message });
    }
  } else {
    console.log("No file uploaded");
    res.status(400).json({ message: "No file uploaded" });
  }
});

app.post("/api/chats", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const { text } = req.body;

  try {
    // CREATE A NEW CHAT
    const newChat = new Chat({
      userId: userId,
      history: [{ role: "user", parts: [{ text }] }],
    });

    const savedChat = await newChat.save();

    // CHECK IF THE USERCHATS EXISTS
    const userChats = await UserChats.find({ userId: userId });

    // IF DOESN'T EXIST CREATE A NEW ONE AND ADD THE CHAT IN THE CHATS ARRAY
    if (!userChats.length) {
      const newUserChats = new UserChats({
        userId: userId,
        chats: [
          {
            _id: savedChat._id,
            title: text.substring(0, 40),
          },
        ],
      });

      await newUserChats.save();
    } else {
      // IF EXISTS, PUSH THE CHAT TO THE EXISTING ARRAY
      await UserChats.updateOne(
        { userId: userId },
        {
          $push: {
            chats: {
              _id: savedChat._id,
              title: text.substring(0, 40),
            },
          },
        }
      );

      res.status(201).send(newChat._id);
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating chat!");
  }
});

app.get("/api/userchats", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;

  try {
    const userChats = await UserChats.find({ userId });

    res.status(200).send(userChats[0].chats);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching userchats!");
  }
});

app.get("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;

  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId });

    res.status(200).send(chat);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching chat!");
  }
});

app.put("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const { question, answer, img } = req.body;

  const newItems = [
    ...(question
      ? [{ role: "user", parts: [{ text: question }], ...(img && { img }) }]
      : []),
    { role: "model", parts: [{ text: answer }] },
  ];

  try {
    const updatedChat = await Chat.findOneAndUpdate(
      { _id: req.params.id, userId },
      {
        $push: {
          history: {
            $each: newItems,
          },
        },
      },
      { new: true }
    );

    if (!updatedChat) {
      console.error("Chat not found.");
      return res.status(404).send("Chat not found.");
    }

    res.status(200).send(updatedChat);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error adding conversation!");
  }
});


app.delete("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const chatId = req.params.id;

  console.log(`Attempting to delete chat with ID: ${chatId} for user ID: ${userId}`);

  try {
    // Find and delete the chat
    const deletedChat = await Chat.findOneAndDelete({ _id: chatId, userId });

    if (!deletedChat) {
      console.log("Chat not found or does not belong to the user.");
      return res.status(404).send("Chat not found!");
    }

    // Optionally, remove the chat from UserChats if necessary
    await UserChats.updateOne(
      { userId: userId },
      { $pull: { chats: { _id: chatId } } }
    );

    res.status(200).send("Chat deleted successfully!");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error deleting chat!");
  }
});

app.delete('/api/delete/:userId/:path', ClerkExpressRequireAuth(), async (req, res) => {
  const { userId, path: filePath } = req.params;

  console.log(`Attempting to delete document for user ID: ${userId} with path: ${filePath}`);

  try {
    // Log the file path for debugging
    console.log(`Looking for document with path: ${filePath}`);

    // Find the document in the database using the path
    const document = await Document.findOneAndDelete({ userId, path: filePath });

    if (!document) {
      console.log("Document not found in database.");
      return res.status(404).json({ message: "Document not found" });
    }

    // Delete the file from the server
    fs.unlink(path.join(process.env.UPLOAD_DIR, filePath), (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return res.status(500).json({ message: "Error deleting file" });
      }

      res.status(200).json({ message: "Document and file deleted successfully" });
    });
  } catch (err) {
    console.error("Error deleting document:", err);
    res.status(500).json({ message: "Error deleting document" });
  }
});

app.post("/api/documents", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const { title, size, type } = req.body;

  try {
    // Create a new document
    const newDocument = new Document({
      userId,
      title,
      size,
      type,
    });

    const savedDocument = await newDocument.save();
    res.status(201).json(savedDocument);
  } catch (err) {
    console.error("Error creating document:", err);
    res.status(500).json({ message: "Error creating document" });
  }
});

app.get("/api/documents", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;

  try {
    // Only fetch documents for the current user
    const documents = await Document.find({ userId });
    res.status(200).json(documents);
  } catch (err) {
    console.error("Error fetching documents:", err);
    res.status(500).json({ message: "Error fetching documents" });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(401).send("Unauthenticated!");
});

// PRODUCTION
app.use(express.static(path.join(__dirname, "../client/dist")));

// Serve static files from the uploads directory
app.use('/uploads', express.static(process.env.UPLOAD_DIR));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist", "index.html"));
});

app.listen(port, () => {
  connect();
  console.log("Server running on 3000");
});