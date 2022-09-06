import './css/style.css';
import fscreen from 'fscreen';
const axios = require('axios');
// console.log('node env', process.env.NODE_ENV);
// if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker
//       .register('service-worker.js')
//       .then((registration) => {
//         console.log('SW registered: ', registration);
//       })
//       .catch((registrationError) => {
//         console.log('SW registration failed: ', registrationError);
//       });
//   });
// }

if (process.env.NODE_ENV === 'development') {
  // document.getElementById('debug').style.display = 'block';
}

window.onload = async () => {
  document.body.style.opacity = 1;
  populateUserList();
  await printLobbyMessages(10);
  document.querySelector('#lobby-chat-window').style.setProperty('scroll-behavior', 'smooth');
};

// don't show full screen button if user can't or already is from PWA
if (!fscreen.fullscreenEnabled || fscreen.fullscreenElement !== null) {
  document.getElementById('full-screen-button').style.display = 'none';
};

const initialHeight = window.innerHeight;

function detectScreen() {
  document.documentElement.style.setProperty('--actual-height', window.innerHeight + 'px');
}

const game = {
  opponent: {
    userName: 'Opponent',
    atBat: undefined,
    lanes: [[], [], []],
    laneElements: [[], [], []],
    totalScore: 0,
  },
  player: {
    userName: 'Player',
    atBat: undefined,
    lanes: [[], [], []],
    laneElements: [[], [], []],
    totalScore: 0,
  },
  currentTurn: undefined
};
let playerState = {
  userName: undefined,
  visitorID: undefined,
  status: 'lobby',
  lastMessageSeen: 0
}
let currentDieID = 0;

function assignHandlers() {

  // let laneElements = [...document.querySelectorAll('.die-lane')];
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

  // for testing
  document.querySelector('#player-area .new-die-box').addEventListener('pointerdown', () => { 
    if (!game.player.atBat) { dealDie('player', randomInt(1, 6)) };
  });
  document.querySelector('#opponent-area .new-die-box').addEventListener('pointerdown', () => { 
    if (!game.opponent.atBat) { dealDie('opponent', randomInt(1, 6)) }
  });

  // document.querySelector('#header').addEventListener('pointerdown', populateUserList);
  document.querySelector('#footer').addEventListener('pointerdown', resetGame);
  document.querySelector('#chat-area').addEventListener('pointerdown', () => getLobbyMessages);
  // document.querySelector('#lobby-control-panel').addEventListener('pointerdown', (e) => {    
  //   document.querySelector('#lobby-screen').style.display = 'none';
  // });
  
  document.querySelector('#chat-submit-button').addEventListener('click', () => {
    let message = document.querySelector('#lobby-chat-field').value.trim();
    document.querySelector('#lobby-chat-field').value = '';
    if (message) {
      sendLobbyMessage(message);      
    }
  });
  document.querySelector('#toggle-ready-button').addEventListener('click', async (e) => {
    if (playerState.status !== 'ready') {
      playerState.status = 'ready';
      await handshake({ visitorID: playerState.visitorID, status: playerState.status });
      await populateUserList();
      e.target.innerHTML = 'Stop Searching';
    } else {
      playerState.status = 'lobby'
      await handshake({ visitorID: playerState.visitorID, status: playerState.status });
      await populateUserList();
      e.target.innerHTML = 'Find Game';
    }
  });  
  document.querySelector('#clear-cookies-button').addEventListener('click', () => {
    localStorage.clear();
    window.location.reload(true);
  });

  addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keycode === 13) {
      e.preventDefault();
      console.log(e)
      let lobbyChatField = document.querySelector('#lobby-chat-field');
      if (document.activeElement === lobbyChatField) {
        console.warn('enter pressed!!');
        document.querySelector('#chat-submit-button').click();
        // let newMessage = lobbyChatField.value.trim();
      }
    } 
  });
}

async function populateUserList() {
  console.warn('calling populateUserList');
  let userList = await getUsersFromDatabase();
  document.querySelector('#user-list').innerHTML = '';
  let nowInSeconds = Math.round(Date.now() / 1000);
  userList.forEach((user) => {
    let lastSeen = nowInSeconds - parseInt(user.lastPing);
    let lastSeenMessage;
    if (lastSeen > 59) {
      let minutes = secondsToMinutes(lastSeen);
      let minuteCount = minutes.minutes;
      let minuteDecimal = (minutes.seconds / 60).toFixed(1).toString().slice(2);
      lastSeenMessage = `${minuteCount}.${minuteDecimal} minutes ago`;
      console.log('using minutes', minutes);
      console.log('using decimal', minuteDecimal);
    } else {
      lastSeenMessage = `${lastSeen} seconds ago`;
      if (lastSeen < 3) {
        lastSeenMessage = 'now';
      }
    }
    let userRowClass = 'user-list-row'
    let nameListing = user.userName;
    if (parseInt(user.visitorID) === playerState.visitorID) {
      userRowClass += ' self'
      nameListing += ' (you)';
    }
   
    document.querySelector('#user-list').innerHTML += `
      <div class='${userRowClass}'>
        <div>${nameListing}</div>
        <div>#${user.visitorID}</div>
        <div${user.status === 'ready' ? ' style="color:green; text-transform:uppercase"' : ''}>${user.status}</div>
        <div>${lastSeenMessage}</div>
      </div>
    `;
  });
}

const userPreferences = {
  animationSpeed: 200
}

const pollInterval = 2000;

async function performInitialHandshake(enteredName) {
  console.warn('---------> INITIAL handshake!');
  const firstShakeData = {
    userName: enteredName,
    status: 'lobby',
  };
  const visitorID = await handshake(JSON.stringify(firstShakeData));
  document.querySelector('#player-name').innerHTML = enteredName + ' #' + visitorID;
  playerState.visitorID = visitorID;
  playerState.userName = enteredName;
  console.warn('established new user #' + visitorID);
  storeUserState();
  // setTimeout(async () => {
    // console.warn('shaking...');
    // let updateShake = {
    //   status: playerState.status,
    //   visitorID: playerState.visitorID,
    // };
    // let startedShakeAt = Date.now();
    // await handshake(JSON.stringify(updateShake));
    // let shakeTime = Date.now() - startedShakeAt;
    // console.warn('took', shakeTime);
  // }, 1000);

  startPolling();
  
}

function startPolling() {
  setInterval(() => {
    populateUserList();
    printLobbyMessages();
    let updateShake = {
      status: playerState.status,
      visitorID: playerState.visitorID,
    };
    handshake(JSON.stringify(updateShake));
  }, pollInterval);
}

document.documentElement.style.setProperty('--die-animation-speed', userPreferences.animationSpeed + 'ms');

export async function init() {
  detectScreen();
  assignHandlers();
  // let enteredName = 'User';
  // let knownUser = localStorage.getItem('kbones-prefs');
  // if (knownUser) {
  //   console.error('KNOWN USER');
  //   loadUserState(knownUser);
  //   enteredName = playerState.userName;
  // } else {
  //   console.error('UNKNOWN USER');
  // }
  // document.querySelector('#player-name').innerHTML = enteredName;
  // game.player.userName = enteredName;
  // document.querySelector('#player-name').innerHTML = playerState.userName;
  game.player.userName = playerState.userName;
  if (knownUser) {
    await handshake({ visitorID: playerState.visitorID, status: playerState.status });
    startPolling();
  } else {
    await performInitialHandshake(playerState.userName);
    populateUserList();
  }
  window.onresize = function () {    
    detectScreen();
  };
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
    this.denomination = denomination;
    this.lane = lane;
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
  document.querySelector(`#${contestant}-area .new-die-box`).classList.add('highlighted');
  availableLanes.forEach((lane) => {
    lane.classList.add('highlighted');
  });
  for (let i = 0; i < availableLanes.length;  i++) {
      availableLanes[i].classList.add('available');
      await pause(150);
  }
}

const totalDiceInPlay = (contestant) =>
  [...game[contestant].laneElements[0], ...game[contestant].laneElements[1], ...game[contestant].laneElements[2]].length;

async function addDieToLane(contestant, denomination, lane) {

  game[contestant].lanes[lane].push(denomination); // get rid of game[contestant].lanes

  const newDie = new Die(denomination, `#${contestant}-area .die-lane:nth-child(${lane + 1})`, lane);
  game[contestant].laneElements[lane].push(newDie);
  document.querySelector(`#${contestant}-area .new-die-box`).classList.remove('highlighted');
  [...document.querySelectorAll(`#${contestant}-area .die-lane`)].forEach((lane) => {
    lane.classList.remove('available');
    lane.classList.remove('highlighted');
  });
  await destroyDie(`#${contestant}-area .new-die-box .die`);
  game[contestant].atBat = undefined;
  updateContestantScore(contestant);
  await checkForCrossMatches(contestant, newDie);
  colorMatchingDice(contestant);
  await pause(userPreferences.animationSpeed);
  if (totalDiceInPlay(contestant) === 9) {
    let winner, loser;
    if (game.player.totalScore > game.opponent.totalScore) {
      winner = 'player';
      loser = 'opponent';
    } else {
      winner = 'opponent';
      loser = 'player';
    }
    await pause(60);
    document.querySelector(`#${winner}-area.turn-area`).classList.add('won');
    document.querySelector(`#${loser}-area.turn-area`).classList.add('lost');
  }
}

function printLaneTotal(contestant, lane) {
  let laneArray = [];
  [...game[contestant].laneElements[lane]].forEach((element) => {
    laneArray.push(element.denomination);
  });
  console.log('laneArray', laneArray)
  let totalElement = document.querySelector(`#${contestant}-area .die-lane-total:nth-child(${lane + 1})`);
  if (!laneArray.length) {
    totalElement.innerHTML = 0;
    return 0;
  }
  let laneTotal;
  let uniqueArray = [...new Set(laneArray)];
  let uniqueValues = uniqueArray.length;
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

async function checkForCrossMatches(aggressor, attackingDie) {
  let doomedDice = [];
  let doomLaneIndex;
  const nemesis = aggressor === 'player' ? 'opponent' : 'player';

  game[aggressor].laneElements.forEach((laneArray, i) => {
    const oppositeLane = game[nemesis].laneElements[i];
    laneArray.forEach((die) => {
      let dieValue = die.denomination;
      oppositeLane.forEach((oppositeDie) => {
        let oppositeDieValue = oppositeDie.denomination;
        if (oppositeDieValue === dieValue) {
          console.error('MATCH', oppositeDieValue, 'and', dieValue, 'in lane', i);
          doomedDice = [...document.querySelectorAll(`#${nemesis}-area .lane-${i} .value-${dieValue}`)];
          doomLaneIndex = i;
          // game[nemesis].lanes[i] = game[nemesis].lanes[i].filter((val) => val !== dieValue);
        }
      });
    });
  });  
  let attacker = document.querySelector(`#${attackingDie.elementID}`);
  doomedDice.forEach(async (die) => {
    let doomLane = game[nemesis].laneElements[doomLaneIndex];
    doomLane.splice(doomLane.indexOf(die), 1);
    die.classList.add('angry');
    attacker.classList.add('angry');
    die.classList.remove('showing');
    await pause(userPreferences.animationSpeed);
    die.parentNode.removeChild(die);
    attacker.classList.remove('angry');
  });
  if (doomedDice.length) {
    updateContestantScore(nemesis);
  }
  document.querySelector('#debug').innerHTML = `o - ${totalDiceInPlay('opponent')} <br /> p - ${totalDiceInPlay('player')}`;
}

function colorMatchingDice(contestant) {
  const allActiveDice = [...game[contestant].laneElements[0], ...game[contestant].laneElements[1], ...game[contestant].laneElements[2]];
  const organizedDice = [[], [], []];
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
        console.warn('COLORING', contestant, match)
        document.querySelector(`#${match.elementID}`).classList.add(specialClass);
      });
    }
  });
}

function resetGame() {
  game.player.laneElements = [[], [], []];
  game.opponent.laneElements = [[], [], []];
  [...document.querySelectorAll(`.die`)].forEach((die) => {
    die.parentNode.removeChild(die);
  });
  [...document.querySelectorAll(`.turn-area`)].forEach((area) => {
    area.classList = 'turn-area';
  });
  [...document.querySelectorAll(`.die-lane`)].forEach((lane) => {
    lane.classList.remove('available');
  });
  updateContestantScore('player');
  updateContestantScore('opponent');
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
  let toStore = JSON.stringify({ ...playerState});
  localStorage.setItem('kbones-prefs', toStore);
  console.log('---------> stored user', playerState);
}
function loadUserState(rawData) {
  let newState = JSON.parse(rawData);
  playerState = { ...newState };
  console.warn('loaded user', playerState);
}

function secondsToMinutes(seconds) {
  let wholeMinutes = Math.floor(seconds / 60);
  return {
    minutes: wholeMinutes,
    seconds: seconds - (wholeMinutes * 60),
  };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function printLobbyMessages(forceHistory) {
  let calledAt = Date.now();
  let messagesArray = await getLobbyMessages(forceHistory);
  console.log('got', messagesArray);
  console.log('took', Date.now() - calledAt);
  if (messagesArray.length === 0) {
    return;
  }
  let highestMessageID = messagesArray[messagesArray.length-1].messageID;
  playerState.lastMessageSeen = highestMessageID;
  let chatWindow = document.querySelector('#lobby-chat-window');
  // chatWindow.innerHTML = '';
  messagesArray.forEach((messageRow) => {
    let rawDate = new Date(messageRow.timePosted);
    let convertedTime = rawDate.toLocaleString([], { hour: 'numeric', minute: 'numeric', hour12: true });
    let timeOfDay = `${convertedTime.slice(0, -3)} ${convertedTime.slice(-2).toLowerCase()}`;
    let messageClass = parseInt(messageRow.visitorID) === playerState.visitorID ? 'chat-message self' : 'chat-message';
    let rowHTML = `
      <div class="${messageClass}">
        <div>${messageRow.userName} (#${messageRow.visitorID})</div>
        <div>message #${messageRow.messageID}</div>
        <div>${messageRow.message}</div>
        <div>${timeOfDay}</div>
      </div>
    `;
    chatWindow.innerHTML += rowHTML;
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;
  if (!forceHistory) {
    storeUserState();
  }
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
async function getUsersFromDatabase() {
  // console.warn('CALLING getUsersFromDatabase');
  let calledAt = Date.now();
  let response = await axios({
    method: 'get',
    url: 'https://mikedonovan.dev/kbones/php/getusers.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    }
  });
  const usersArray = [...response.data];
  usersArray.forEach((row, i, self) => {
    self[i] = JSON.parse(row)
  });
  // console.warn('got', usersArray.length, 'users in', Date.now() - calledAt);
  return usersArray;
}
async function getLobbyMessages(forceHistory=0) {
  // console.warn('CALLING getLobbyMessages');
  let calledAt = Date.now();
  let response = await axios({
    method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/getlobbymessages.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: {
      lastMessageSeen: playerState.lastMessageSeen - forceHistory,
    },
  });
  const messagesArray = [...response.data];
  messagesArray.forEach((row, i, self) => {
    self[i] = JSON.parse(row);
  });
  // console.warn('got', messagesArray.length, 'messasges in', Date.now() - calledAt);
  return messagesArray.reverse();
}
async function sendLobbyMessage(message) {
  let messageData = {
    userName: game.player.userName,
    visitorID: playerState.visitorID,
    message: message
  }
  // console.warn('CALLING sendLobbyMessage with', messageData);
  messageData = JSON.stringify(messageData);
  let calledAt = Date.now();
  let response = await axios({
     method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/sendlobbymessage.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: messageData
  });
  // console.warn('sent message? in', Date.now() - calledAt);
  printLobbyMessages();
  console.log(response);
  return response;
}

async function handshake(shakeData) {
  let startedShake = Date.now();
  const shakeResult = await axios({
    method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/handshake.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: shakeData
  });
  let shakeTime = Date.now() - startedShake;
  document.querySelector('#debug').innerHTML = 'ping: ' + shakeTime;
  console.warn(shakeResult.data + ' in ' + shakeTime);
  return shakeResult.data
}

document.querySelector('#enter-lobby-button').addEventListener('click', () => {
  playerState.userName = document.querySelector('#name-entry-field').value;
  init();
  document.querySelector('#name-entry-screen').style.display = 'none';
});
document.querySelector('#name-entry-field').addEventListener('input', (e) => {
  if (e.target.value.trim().length > 2) {
    document.querySelector('#enter-lobby-button').disabled = false;
  } else {
    document.querySelector('#enter-lobby-button').disabled = true;
  }
  e.target.value = e.target.value.trim();
});

let knownUser = localStorage.getItem('kbones-prefs');
if (knownUser) {
  console.error('KNOWN USER');
  loadUserState(knownUser);
  document.querySelector('#name-entry-field').value = playerState.userName;
  document.querySelector('#enter-lobby-button').disabled = false;
  document.querySelector('#known-user-confirmation').textContent = `Recognized as user #${playerState.visitorID}`;
} else {
  console.error('UNKNOWN USER');
}


// init();
