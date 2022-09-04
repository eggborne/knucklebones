import './css/style.css';
import fscreen from 'fscreen';
const axios = require('axios');
console.log('node env', process.env.NODE_ENV);
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

if (process.env.NODE_ENV === 'development') {
  document.getElementById('debug').style.display = 'block';
}

window.onload = () => { document.body.style.opacity = 1 };

// don't show full screen button if user can't or already is from PWA
if (!fscreen.fullscreenEnabled || fscreen.fullscreenElement !== null) {
  document.getElementById('full-screen-button').style.display = 'none';
};

const initialHeight = window.innerHeight;
let gameScreenHeight, gameScreenWidth, gameScreenX, gameScreenY, pixelUnit;


function detectScreen() {
  document.documentElement.style.setProperty('--actual-height', window.innerHeight + 'px');
}

const game = {
  opponent: {
    userName: 'Opponent',
    atBat: undefined,
    lanes: [[], [], []],
    totalScore: 0,
  },
  player: {
    userName: 'Player',
    atBat: undefined,
    lanes: [[], [], []],
    totalScore: 0,
  },
  activeDice: {
    player: [],
    opponent: [],
  },
  currentTurn: undefined
};
let currentDieID = 0;

function assignHandlers() {
  // document.getElementById('high-scores-button').addEventListener('pointerdown', () => { listHighScores(); showHighScoreScreen(); }, { passive: true });
  // document.getElementById('back-button').addEventListener('pointerdown', dismissHighScoreScreen, { passive: true });
  // document.getElementById('start-button').addEventListener('pointerdown', startGame, { passive: true });
  // document.getElementById('start-advanced-button').addEventListener('pointerdown', () => startGame(5), { passive: true });
  // document.getElementById('touch-control-panel').addEventListener('pointerdown', beginRound, { passive: true });
  // document.getElementById('touch-control-panel').addEventListener('touchstart', handleTouchStart, { passive: false });
  // document.getElementById('touch-control-panel').addEventListener('touchmove', handleTouchMove, { passive: false });
  // document.getElementById('touch-control-panel').addEventListener('touchend', handleTouchEnd, { passive: false });
  // document.getElementById('settings-button').addEventListener('pointerdown', toggleMenu, { passive: false });
  // document.getElementById('full-screen-button').addEventListener('pointerdown', toggleFullScreen, { passive: false });
  // document.getElementById('countdown-switch').addEventListener('pointerdown', () => { toggleCountdown(); storeUserState() }, { passive: false });
  // document.getElementById('difficulty-switch').addEventListener('pointerdown', () => { switchDifficulty(); storeUserState() }, { passive: false });
  // document.getElementById('high-score-input-box').addEventListener('input', validateName);
  // document.getElementById('submit-score-button').addEventListener('click', submitHighScore);
  // document.getElementById('end-game-button').addEventListener('click', showEndGameConfirm);
  // document.getElementById('cancel-end-game-button').addEventListener('click', cancelEndGame);
  // document.getElementById('confirm-end-game-button').addEventListener('click', endGame);
  // document.getElementById('acceleration-slider').addEventListener('input', handleAccelerationSlider);
  // document.getElementById('acceleration-slider').addEventListener('change', storeUserState);
  // document.getElementById('tv-mode-switch').addEventListener('pointerdown', () => { toggleTVMode(); storeUserState() });
  // document.getElementById('game-height-slider').addEventListener('input', handleGameHeightSlider);
  // document.getElementById('game-height-slider').addEventListener('change', storeUserState);

  // let laneElements = [...document.querySelectorAll('.die-lane')];
  // console.log('laneElements', laneElements);
  // for (let lane in laneElements) {
  //   let element = laneElements[lane];
  //   if (element.classList.contains('opponent')) {
  //     element.addEventListener('pointerdown', () => {
  //       addDieToLane('opponent', game.opponent.atBat, 0);
  //       document.querySelector(`#player-area .new-die-box`).innerHTML = '';
  //     });
  //   }
  // }

  document.querySelector('#opponent-area .die-lane:nth-child(1)').addEventListener('pointerdown', () => { 
    addDieToLane('opponent', game.opponent.atBat, 0);
  });
  document.querySelector('#opponent-area .die-lane:nth-child(2)').addEventListener('pointerdown', () => { 
    addDieToLane('opponent', game.opponent.atBat, 1);
  });
  document.querySelector('#opponent-area .die-lane:nth-child(3)').addEventListener('pointerdown', () => { 
    addDieToLane('opponent', game.opponent.atBat, 2);
  });

  document.querySelector('#player-area .die-lane:nth-child(1)').addEventListener('pointerdown', () => { 
    addDieToLane('player', game.player.atBat, 0);
  });
  document.querySelector('#player-area .die-lane:nth-child(2)').addEventListener('pointerdown', () => { 
    addDieToLane('player', game.player.atBat, 1);
  });
  document.querySelector('#player-area .die-lane:nth-child(3)').addEventListener('pointerdown', () => { 
    addDieToLane('player', game.player.atBat, 2);
  });

  document.querySelector('#player-area .new-die-box').addEventListener('pointerdown', () => { 
    dealDie('player', randomInt(1, 6));
  });
  document.querySelector('#opponent-area .new-die-box').addEventListener('pointerdown', () => { 
    dealDie('opponent', randomInt(1, 6));
  });
  
  // document.getElementById('message').addEventListener('click', () => {
  //   localStorage.clear();
  //   alert('cleared that shit yo. Now reload this');

  // });
}

const userPreferences = {
  animationSpeed: 300
}

document.documentElement.style.setProperty('--die-animation-speed', userPreferences.animationSpeed + 'ms');

export function init() {
  detectScreen();
  assignHandlers();
  let knownUser = localStorage.getItem('kbones-prefs');
  if (knownUser) {
    loadUserState(knownUser);
  } else {
    console.error('UNKNOWN USER');
  }  
  window.onresize = function () {    
    detectScreen();
  };  
  // dealDie('player', randomInt(1, 6));
  // addDieToLane('player', 4, 1);
  // addDieToLane('player', 5, 2);
  // addDieToLane('player', 6, 2);

  // addDieToLane('opponent', 1, 0);
  // addDieToLane('opponent', 2, 0);
  // addDieToLane('opponent', 3, 0);
}

function validateName(e) {
  let enteredValue = e.target.value;
  let valid = true;
  let tooShort = enteredValue.length < 2;
  valid = !tooShort;
  document.getElementById('submit-score-button').disabled = !valid;
  e.target.value = enteredValue.replace(/\s+/g, '').slice(0, 10);
}

class Die {
  constructor(denomination, targetDivQuery, lane) {
    console.log('calling new Die() in lane', lane);
    console.log(denomination, targetDivQuery);
    this.denomination = denomination;
    this.lane;
    this.elementID = 'die-' + currentDieID;
    let dieDotsHTML;
    switch (denomination) {
      case 1:
        dieDotsHTML = `
          <div class='die-dot-grid'>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
          </div>
        `;
        break;
      case 2:
        dieDotsHTML = `
          <div class='die-dot-grid'>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
          </div>
        `;
        break;
      case 3:
        dieDotsHTML = `
          <div class='die-dot-grid'>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
          </div>
        `;
        break;
      case 4:
        dieDotsHTML = `
          <div class='die-dot-grid'>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
          </div>
        `;
        break;
      case 5:
        dieDotsHTML = `
          <div class='die-dot-grid'>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
          </div>
        `;
        break;
      case 6:
        dieDotsHTML = `
          <div class='die-dot-grid'>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot filled'></div>
            <div class='die-dot'></div>
            <div class='die-dot filled'></div>
          </div>
        `;
        break;
    }
    let dieClass = lane !== undefined ? `die value-${denomination} lane-${lane} active` : `die value-${denomination}`;
    let newDieHTML = `
    <div id="${this.elementID}" class="${dieClass}">${dieDotsHTML}</div>
    `;
    document.querySelector(targetDivQuery).innerHTML += newDieHTML;
    const dieElement = document.querySelector(`#${this.elementID}`)
    requestAnimationFrame(() => {
      dieElement.classList.add('showing');
    });
    currentDieID++;
  }
}

function pause(duration) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, duration);
  });
}

async function destroyDie(query) {
  const dieElement = document.querySelector(query);
  dieElement.classList.remove('showing');
  await pause(userPreferences.animationSpeed);
  dieElement.parentNode.removeChild(dieElement);
}

async function dealDie(contestant, denomination) {
  new Die(denomination, `#${contestant}-area .new-die-box`);
  game[contestant].atBat = denomination;
  let availableLanes = [...document.querySelectorAll(`#${contestant}-area .die-lane`)].filter((lane) => [...lane.children].length < 3);
  for (let i = 0; i < availableLanes.length;  i++) {
      availableLanes[i].classList.add('available');
      await pause(150);
  }
}

async function addDieToLane(contestant, denomination, lane) {
  game[contestant].lanes[lane].push(denomination);
  const newDie = new Die(denomination, `#${contestant}-area .die-lane:nth-child(${lane + 1})`, lane);
  newDie.lane = lane;
  newDie.denomination = denomination;
  game.activeDice[contestant].push(newDie)
  game[contestant].atBat = undefined;
  [...document.querySelectorAll(`#${contestant}-area .die-lane`)].forEach((lane) => {
    lane.classList.remove('available');
  });
  await destroyDie(`#${contestant}-area .new-die-box .die`);
  updateContestantScore(contestant);
  colorMatchingDice(contestant);
  await pause(userPreferences.animationSpeed);
  if (game.activeDice[contestant].length === 9) {
    alert('Game over. ' + game.player.totalScore + ' vs. ' + game.opponent.totalScore);
  }
}

function printLaneTotal(contestant, lane) {
  let laneArray = game[contestant].lanes[lane];
  if (!laneArray.length) {
    return 0;
  }
  let laneTotal;
  let uniqueArray = [...new Set(laneArray)];
  let uniqueValues = uniqueArray.length;
  console.log('laneArray', laneArray);
  console.log('uniqueArray', uniqueArray);
  if (uniqueValues === laneArray.length) { // all different or only one
    laneTotal = laneArray.reduce((a, b) => a + b);
  } else { // more than one and not all unique
    if (laneArray.length === 2) { // size is two, must be two of the same
      laneTotal = (laneArray[0] * 2) * 2;
    } else if (laneArray.length === 3) { // size is three and two or three are the same
      if (uniqueValues === 1) { // all three are the same
        laneTotal = (laneArray[0] * 3) * 3;
      } else { // two are the same
        let singleton;
        let valueCounts = {};
        for (let i = 0; i < laneArray.length; i++) { // identify singleton
          let currentValue = laneArray[i];
          if (!valueCounts[currentValue]) {
            valueCounts[currentValue] = 1
          } else {
            valueCounts[currentValue]++;
          }
        }
        for (const value in valueCounts) {
          if (valueCounts[value] === 1) {
            singleton = parseInt(value);
          }
        }
        let newValueArray = [];
        uniqueArray.forEach((dieValue, i) => {
          if (dieValue !== singleton) {
            let newValue = (dieValue * 2) * 2;
            newValueArray.push(newValue);
          } else {
            newValueArray.push(dieValue);
          }
        });
        laneTotal = newValueArray.reduce((a, b) => a + b);
      }
    }
  } 
  let totalElement = document.querySelector(`#${contestant}-area .die-lane-total:nth-child(${lane + 1})`);
  totalElement.innerHTML = laneTotal;
  return laneTotal;
}

function updateContestantScore(contestant) {
  const scoreElement = document.querySelector(`#${contestant}-area .contestant-score`);
  let score = 0;
  for (let i = 0; i < 3; i++) {
    score += printLaneTotal(contestant, i);
  }
  scoreElement.innerHTML = score;
  game[contestant].totalScore = score;
}
function colorMatchingDice(contestant) {
  const allActiveDice = game.activeDice[contestant];
  const organizedDice = [[], [], []];
  console.log('ACTIVE DICE', allActiveDice);
  allActiveDice.forEach((die) => {
    if (organizedDice[die.lane].indexOf(die.denomination) === -1) {
      organizedDice[die.lane].push(die.denomination);
    } else {
      const numberOfDuplicates = organizedDice[die.lane].filter((e) => e === die.denomination).length;
      let specialClass;
      if (numberOfDuplicates === 2) {
        specialClass = 'tripled'
      } else {
        specialClass = 'doubled';
      }
      organizedDice[die.lane].push(die.denomination);
      allActiveDice.filter((e) => e.lane === die.lane && e.denomination === die.denomination).forEach((match) => {
        document.querySelector(`#${match.elementID}`).classList.add(specialClass);
      });
    }
  });
}

async function toggleFullScreen() {
  if (fscreen.fullscreenElement !== null) {
    await fscreen.exitFullscreen(document.body);
    document.documentElement.style.setProperty('--actual-height', `${initialHeight}px`);
    document.getElementById('full-screen-off-icon').classList.add('hidden');
    document.getElementById('full-screen-icon').classList.remove('hidden');
    
  } else {
    await fscreen.requestFullscreen(document.body);
    document.getElementById('full-screen-off-icon').classList.remove('hidden');
    document.getElementById('full-screen-icon').classList.add('hidden');
  }
}

function storeUserState() {
  let toStore = JSON.stringify({ ...userData });
  localStorage.setItem('kbones-prefs', toStore);
  console.log('---------> stored user', userData);
}
function loadUserState(rawData) {
  let newState = JSON.parse(rawData);
  userData = { ...newState };
  console.warn('loaded user', userData);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// async function getScoresFromDatabase(gameName) {
//   console.warn('CALLING getScoresFromDatabase');
//   let calledAt = Date.now();
//   let response = await axios({
//     method: 'get',
//     url: 'https://mikedonovan.dev/csskaboom/php/getscores.php',
//     headers: {
//       'Content-type': 'application/x-www-form-urlencoded',
//     },
//     params: {
//       game: gameName,
//     },
//   });
//   let scoreArray = [];
//   console.log('got response', response)
//   if (response.data) {
//     let pairArray = response.data.split(' - ');
//     for (let item in pairArray) {
//       let scoreEntry = pairArray[item].split(' ');
//       if (scoreEntry.length > 3) {
//         let fixedEntry = [];
//         fixedEntry[1] = scoreEntry.pop();
//         fixedEntry[0] = scoreEntry.join(' ');
//         scoreArray.push(fixedEntry);
//       } else if (scoreEntry.length === 3) {
//         scoreArray.push(scoreEntry);
//       }
//       scoreEntry[0] = scoreEntry[0].toUpperCase();
//       scoreEntry[1] = parseInt(scoreEntry[1]);
//       scoreEntry[2] = parseInt(scoreEntry[2]);
//     }
//   } else {
//     console.log('got a response of VOID :(');
//     scoreArray = [['void', 1212]];
//   }
//   if (scoreArray.length > highScoresShown) {
//     scoreArray.length = highScoresShown;
//   }
//   console.warn('retrieved high scores in', Date.now() - calledAt);
//   highScores = [...scoreArray];
//   return scoreArray;
// }

// async function saveScoreToDatabase(gameName, playerName, playerScore) {
//   playerName = playerName.toUpperCase();
//   let calledAt = Date.now();
//   const scoreID = await axios({
//     method: 'post',
//     url: 'https://mikedonovan.dev/csskaboom/php/savescore.php',
//     headers: {
//       'Content-type': 'application/x-www-form-urlencoded',
//     },
//     data: {
//       game: gameName,
//       name: playerName,
//       score: playerScore,
//     },
//   });
//   userData.scoreIDs.push(scoreID.data);
//   storeUserState();
//   console.warn('saved score in', Date.now() - calledAt);
// }

init();
