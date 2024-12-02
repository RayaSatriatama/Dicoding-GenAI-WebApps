// models/chat.js
import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';
import { v4 as uuidv4 } from 'uuid';  // Import UUID library

const Chat = sequelize.define('Chat', {
  _id: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true,
    defaultValue: () => uuidv4(),  // Generate a unique ID using UUID v4
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  history: {
    type: DataTypes.JSONB,  // Storing chat history as JSON
    allowNull: false,
  },
}, {
  timestamps: true,
});

export default Chat;
