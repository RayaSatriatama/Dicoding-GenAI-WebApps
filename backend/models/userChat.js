import { DataTypes } from 'sequelize';
import { sequelize } from './db.js';
import Chat from './chat.js';

const UserChats = sequelize.define('UserChats', {
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,  // Ensure user can only have one record
  },
  chats: {
    type: DataTypes.JSONB, // Store chats as a JSON array
    allowNull: false,
    defaultValue: [], // Default to empty array if not provided
  },
}, {
  timestamps: true,
});

// Change the alias of the association to avoid collision with 'chats' attribute
UserChats.hasMany(Chat, { foreignKey: 'userChatId', as: 'userChatsList' });  // Renamed 'chats' to 'userChatsList'
Chat.belongsTo(UserChats, { foreignKey: 'userChatId', as: 'userChats' });  // Same alias here

export default UserChats;
