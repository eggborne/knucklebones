import { game } from '../index.js'

export default function exec() {
  if (game.titleShowing) {
    if (game.counter % 24 === 0) {
      if (game.counter > 0 && game.counter % 24 === 0) {
        game.rainBombs();
      }
      if (game.counter % 72 === 0) {
        game.animateLogo();
      }
      if (game.counter % 120 === 0) {
        game.wobbleView();
      }
    }
    game.titleBombs.forEach((bomb, b) => {
      bomb.burn();
      bomb.descend();
    });
  } else {
    if (game.roundStarted) {
      if (game.bombsLeftInWave) {
        game.bomber.prowl();
      }
      game.bombs.forEach((bomb, b) => {
        if (bomb.doomed) {
          bomb.remove();
          b--;
        } else {
          bomb.checkForBuckets();
          bomb.fall();
          bomb.burn();
        }      
      });
    } else {
      game.bombs.forEach((bomb) => {
        if (bomb.exploding) {
          bomb.explode();
        } else {
          // held bomb
          // bomb.burn();
        }
      });
    }
    if (process.env.NODE_ENV === 'development') {
      document.getElementById('debug').innerHTML = `
        <div>Level ${game.currentWave.level}</div>
        <div>Total bombs: ${game.currentWave.totalBombs}</div>
        <div>Bombs left: ${game.bombsLeftInWave}</div>
        <div>Fall speed: ${game.currentWave.fallSpeed}</div>
        <div>Frequency: 1/${game.currentWave.bombFrequency}</div>
        <div>Bomber speed: ${game.currentWave.bomberSpeed}</div>
        <div>Direction change freq: ${game.bomber.directionChangeFrequency}</div>
      `;
    }

  }
  game.counter++
  // if (summoningBuckets) {
  //   moveBuckets(bucketsOffset + (summoningBuckets * pixelUnit * 6));
  // }    
  requestAnimationFrame(exec);
}
