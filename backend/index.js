import express from "express";
import cors from "cors";
import path from "path";
import url, { fileURLToPath } from "url";
import ImageKit from "imagekit";
import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";
import dotenv from "dotenv";
import { sequelize, connect } from './models/db.js';
import Chat from "./models/chat.js";
import UserChats from "./models/userChat.js";

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

const imagekit = new ImageKit({
  urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
  publicKey: process.env.IMAGE_KIT_PUBLIC_KEY,
  privateKey: process.env.IMAGE_KIT_PRIVATE_KEY,
});

app.get("/api/upload", (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

app.post("/api/chats", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const { text } = req.body;

  try {
    // CREATE A NEW CHAT
    const newChat = await Chat.create({
      userId: userId,
      history: [{ role: "user", parts: [{ text }] }],
    });

    // CHECK IF THE USERCHATS EXISTS
    const userChats = await UserChats.findOne({ where: { userId: userId } });

    if (!userChats) {
      // IF DOESN'T EXIST CREATE A NEW ONE AND ADD THE CHAT IN THE CHATS ARRAY
      await UserChats.create({
        userId: userId,
        chats: [
          {
            _id: newChat._id,
            title: text.substring(0, 40),
          },
        ],
      });
    } else {
      // MAKE SURE chats is always an array
      const chats = Array.isArray(userChats.chats) ? userChats.chats : [];

      // IF EXISTS, PUSH THE CHAT TO THE EXISTING ARRAY
      await userChats.update({
        chats: [
          ...chats,
          { _id: newChat._id, title: text.substring(0, 40) },
        ],
      });
    }

    res.status(201).send(newChat._id);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error creating chat!");
  }
});

app.get("/api/userchats", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;

  try {
    const userChats = await UserChats.findOne({
      where: { userId },
      include: {
        model: Chat,
        as: 'chats',
      },
    });

    if (userChats) {
      res.status(200).send(userChats.chats);
    } else {
      res.status(404).send("No chats found for this user!");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Error fetching userchats!");
  }
});

app.get("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;

  try {
    const chat = await Chat.findOne({ where: { _id: req.params.id, userId } });

    if (chat) {
      res.status(200).send(chat);
    } else {
      res.status(404).send("Chat not found!");
    }
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
    const updatedChat = await Chat.update(
      { history: sequelize.fn('array_append', sequelize.col('history'), newItems) },
      { where: { _id: req.params.id, userId } }
    );

    res.status(200).send(updatedChat);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error adding conversation!");
  }
});

app.delete("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
  const userId = req.auth.userId;
  const chatId = req.params.id;

  try {
    const deletedChat = await Chat.destroy({ where: { _id: chatId, userId } });

    if (deletedChat) {
      await UserChats.update(
        { userId: userId },
        { $pull: { chats: { _id: chatId } } }
      );

      res.status(200).send("Chat deleted successfully!");
    } else {
      res.status(404).send("Chat not found or does not belong to the user.");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Error deleting chat!");
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(401).send("Unauthenticated!");
});

// PRODUCTION
app.use(express.static(path.join(__dirname, "../client/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist", "index.html"));
});

app.listen(port, async () => {
  await connect();
  console.log(`Server running on port ${port}`);
});