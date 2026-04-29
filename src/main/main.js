const GameApp = require('../game-app');

function start() {
  const app = new GameApp();
  app.start();
}

module.exports = {
  start
};