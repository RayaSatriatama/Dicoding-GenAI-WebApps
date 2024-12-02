module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('UserChats', 'chats', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('UserChats', 'chats');
  },
};
