import { Sequelize } from 'sequelize';

// Establish the connection to PostgreSQL
const sequelize = new Sequelize(process.env.POSTGRES_URL, {
  dialect: "postgres",
  logging: false,
});

const connect = async () => {
  try {
    await sequelize.authenticate();
    console.log("Connection to PostgreSQL has been established successfully.");
  } catch (err) {
    console.error('Unable to connect to the database:', err);
  }
};

export { sequelize, connect };
