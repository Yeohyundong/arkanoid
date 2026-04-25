import './style.css';
import { Game } from './game/Game';
import { loadBalanceSnapshot } from './game/Balance';

if (import.meta.env.DEV) {
  loadBalanceSnapshot();
}

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error('#game-canvas element not found');
}

const game = new Game(canvas);
game.start();

if (import.meta.env.DEV) {
  const app = document.getElementById('app');
  if (app) {
    void import('./dashboard/BalanceDashboard').then(({ mountLiveDashboard, mountLobbyDashboard }) => {
      mountLiveDashboard(app);
      const lobby = mountLobbyDashboard(app);
      game.onStateChange((state) => lobby.setVisible(state === 'menu'));
    });
  }
}
