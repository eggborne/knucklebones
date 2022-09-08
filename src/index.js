import './css/style.css';
import fscreen from 'fscreen';
const axios = require('axios');
require('console-green');
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
  detectScreen();
  document.body.style.opacity = '1';  
  populateUserList();
  await printLobbyMessages(10);
  document.querySelector('#lobby-chat-window').style.setProperty('scroll-behavior', 'smooth');
  await pause(50);
  // document.querySelector('#title-legend').classList.add('showing');
  animateTitle();
  pause(200);
  assignHandlers();
  startPolling();
};

async function animateTitle() {
  let letterElementArray = [...document.querySelector('#title-legend').children];
  for (let i = 1; i < letterElementArray.length; i++) {
    letterElementArray[i].classList.add('revealed');
    await pause(50);
  }
  await pause(600);
  document.querySelector('#title-legend').classList.add('animating');
}

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
    userName: undefined,
    visitorID: undefined,
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
  currentTurn: undefined,
  gameID: undefined,
  deals: 0,
  singlePlayer: false,
};
let playerState = {
  userName: undefined,
  visitorID: undefined,
  status: 'title',
  lastMessageSeen: 0,
  initiator: false,
}
let queryTimes = {
  lobbyMessages: Date.now(),
  users: Date.now(),
  handshake: Date.now()
}
let currentDieID = 0;

function assignHandlers() {
  // for testing

  document.querySelector('#player-area .new-die-box').addEventListener('pointerdown', () => {
    // if (!game.player.atBat) { dealDie('player', randomInt(1, 6)) };
    document.querySelector('#opponent-area .die-lane:nth-child(3)').classList.add('highlighted');
    document.querySelector('#player-area .die-lane:nth-child(3)').classList.add('highlighted');
  });
  // document.querySelector('#opponent-area .new-die-box').addEventListener('pointerdown', () => {
  //   if (!game.opponent.atBat) { dealDie('opponent', randomInt(1, 6)) }
  // });
  // document.querySelector('#opponent-area .die-lane:nth-child(1)').addEventListener('pointerdown', () => {
    // addDieToLane('opponent', game.opponent.atBat, 0);    
  // });
  // document.querySelector('#opponent-area .die-lane:nth-child(2)').addEventListener('pointerdown', () => {
  //   addDieToLane('opponent', game.opponent.atBat, 1);
  // });
  // document.querySelector('#opponent-area .die-lane:nth-child(3)').addEventListener('pointerdown', () => {
  //   addDieToLane('opponent', game.opponent.atBat, 2);
  // });

  document.querySelector('#player-area .die-lane:nth-child(1)').addEventListener('pointerdown', () => {
    addDieToLane('player', game.player.atBat, 0);
  });
  document.querySelector('#player-area .die-lane:nth-child(2)').addEventListener('pointerdown', () => {
    addDieToLane('player', game.player.atBat, 1);
  });
  document.querySelector('#player-area .die-lane:nth-child(3)').addEventListener('pointerdown', () => {
    addDieToLane('player', game.player.atBat, 2);
  });

  document.querySelector('#chat-submit-button').addEventListener('click', () => {
    let message = convertToPlain(document.querySelector('#lobby-chat-field').value.trim());
    document.querySelector('#lobby-chat-field').value = '';
    if (message) {
      sendLobbyMessage(message);
    }
  });
  document.querySelector('#confirm-game-button').addEventListener('click', async () => {
    playerState.status = `playing vs. ${game.opponent.userName}`;
    let updateShake = {
      status: playerState.status,
      visitorID: playerState.visitorID,
    };
    handshake(updateShake);
    dismissConfirmModal();
    document.querySelector('#player-name').textContent = playerState.userName;
    document.querySelector('#opponent-name').textContent = game.opponent.userName;
    document.querySelector('#lobby-screen').classList.add('hidden');
    await pause(userPreferences.animationSpeed);
    document.querySelector('#lobby-screen').classList.remove('blurred');
    document.querySelector('#lobby-screen').style.display = 'none';
    document.querySelector('#clear-cookies-button').style.display = 'none';
    document.querySelector('#header-message').textContent = `Knucklebones game #${game.gameID}`;     
    await pause(200);
    callCoinModal(game.firstPlayer);
  });

  document.querySelector('#toggle-ready-button').addEventListener('click', async (e) => {
    let lobbyPanel = document.querySelector('#lobby-control-panel');
    if (playerState.status !== 'ready') {
      playerState.status = 'ready';
      let readyUserList = await getReadyUsers();
      if (readyUserList.length) {        
        let newOpponent = readyUserList[0];
        game.opponent.userName = newOpponent.userName;
        game.opponent.visitorID = newOpponent.visitorID;
        console.log('READY USER', newOpponent);
        await handshake({ visitorID: playerState.visitorID, status: playerState.status });
        playerState.initiator = true;
        callConfirmModal(newOpponent);
      } else {
        lobbyPanel.classList.add('searching');
        await handshake({ visitorID: playerState.visitorID, status: playerState.status });
        await populateUserList();
        e.target.innerHTML = 'Stop Searching';
      }
    } else {
      lobbyPanel.classList.remove('searching');
      playerState.status = 'lobby';
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
      console.log(e);
      let lobbyChatField = document.querySelector('#lobby-chat-field');
      if (document.activeElement === lobbyChatField) {
        console.warn('enter pressed!!');
        document.querySelector('#chat-submit-button').click();
      }
      let nameEntryField = document.querySelector('#name-entry-field');
      if (document.activeElement === nameEntryField) {
        console.warn('enter pressed!!');
        document.querySelector('#enter-lobby-button').click();
      }
    }
  });
}

async function populateUserList() {
  let nowInSeconds = Math.round(Date.now() / 1000);
  let userList = await getUsersFromDatabase();  
  document.querySelector('#user-list').innerHTML = '';
  userList.forEach((user) => {
    let lastSeen = nowInSeconds - parseInt(user.lastPing);
    let lastSeenMessage;
    if (lastSeen > 59) {
      // let minutes = secondsToMinutes(lastSeen);
      // let minuteCount = minutes.minutes;
      // let minuteDecimal = (minutes.seconds / 60).toFixed(1).toString().slice(2);
      // lastSeenMessage = `${minuteCount}.${minuteDecimal} minutes ago`;
      // console.log('using minutes', minutes);
      // console.log('using decimal', minuteDecimal);
    } else {
      lastSeenMessage = `${lastSeen} seconds ago`;
      if (lastSeen <= 3) {
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

const pollInterval = 1000;

async function performInitialHandshake(enteredName) {  
  console.warn('---------> INITIAL handshake!');
  const firstShakeData = {
    userName: enteredName,
    status: 'lobby',
  };
  const visitorID = await handshake(firstShakeData);
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
}

let pollLoop;

function startPolling() {
  // let lastPoll = 0;  
  pollLoop = setInterval(async () => {
    if (playerState.status === 'title') {
      // console.log('only handshaking due to title screen');
      // let updateShake = {
      //   visitorID: playerState.visitorID,
      //   status: playerState.status,
      // };
      // handshake(updateShake);
      return
    }
    if (playerState.status === 'lobby' || playerState.status === 'ready') {
      let now = Date.now();
      // console.green(`POLLING LOBBY ${!lastPoll || now - lastPoll}`)
      // lastPoll = now;
      let waitingForConfirm = document.querySelector('#confirm-game-modal').classList.contains('showing');
      if (waitingForConfirm) {
        // console.green('ALREADY FOUND READY OPPONENT');
        if (!playerState.initiator) {
          if (playerState.status !== 'confirming') {
            console.green('I am RESPONDANT polling findGameWithIDs!');
            let newGame = await findGameWithIDs([game.opponent.visitorID, playerState.visitorID]);
            if (newGame) {
              console.log('RESPONDANT found a game', newGame);
              console.log('game obj was', game);
              game.gameID = newGame.gameID;
              game.player.userName = playerState.userName;
              game.firstPlayer = newGame.playerTurn;
              game.atBat = parseInt(newGame.atBat);
              game.currentTurn = newGame.playerTurn;

              playerState.status = 'confirming';
              await handshake([playerState.visitorID, playerState.status]);
              document.querySelector('#opponent-check').classList.add('checked');
              await pause(500);
              document.querySelector('#player-check').classList.add('checked');
              document.querySelector('#confirm-message').textContent = 'CONNECTED!';
              document.querySelector('#confirm-game-button').disabled = false;
            } else {
              console.log('checked but did not find a newly-created game with both players');
            }
          } else {
            console.green('button enabled now.');
          }
            
        } else { // initiator
          console.log('i am initiator --------->');
          let opponentStatus = await checkUserStatus(game.opponent.visitorID);
          if (opponentStatus === 'confirming') {
            document.querySelector('#opponent-check').classList.add('checked');
            await pause(500);
            document.querySelector('#player-check').classList.add('checked');
            document.querySelector('#confirm-message').textContent = 'CONNECTED!';
            document.querySelector('#confirm-game-button').disabled = false;
            playerState.status = 'confirming';
          } else {
            console.log('checked, but opponent is still', opponentStatus);
          }

        }
      } else { // confirm modal not showing (waiting in lobby)
        if (now - queryTimes.users >= (pollInterval / 1.5)) {
          if (playerState.status === 'ready') {
            let readyUserList = await getReadyUsers(); // check for ready users before updating HTML list            
            readyUserList = readyUserList.filter((userRow) => {
              return parseInt(userRow.visitorID) !== playerState.visitorID;
            });
            if (readyUserList.length) {
              let newOpponent = readyUserList[0];
              game.opponent.userName = newOpponent.userName;
              game.opponent.visitorID = newOpponent.visitorID;
              await handshake({ visitorID: playerState.visitorID, status: playerState.status });
              callConfirmModal(newOpponent);
            } else {
              populateUserList(); // only update HTML if ready user not found
            }
          } else {
            populateUserList();
          }          
        } else {
          console.error('throttled populateUserList', (now - queryTimes.users));
        }        
        if (now - queryTimes.lobbyMessages >= (pollInterval / 1.5)) {
          printLobbyMessages();
        } else {
          console.error('throttled printLobbyMessages', (now - queryTimes.lobbyMessages));
        }         
      }
      let updateShake = {
        status: playerState.status,
        visitorID: playerState.visitorID,
      };
      handshake(updateShake);
    } else if (playerState.status.indexOf('playing' !== -1)) { // player has flipped coin
      if (!game.started) { // opponent has not yet flipped
        let opponentStatus = await checkUserStatus(game.opponent.visitorID);
        if (opponentStatus.indexOf('playing') !== -1) { // opponent has flipped
          game.started = true;
          document.querySelector('#opponent-area').classList.remove('dim');
          console.green('--------- GAME START! ---------------------------')
        }
      } else { // both have flipped and the game has started
        let currentGameData = await getGameData(game.gameID);
        if (!game.deals) { // first turn
          if (!game.player.atBat && playerState.visitorID == game.firstPlayer) {            
            dealDie('player', game.atBat);
          } else if (!game.opponent.atBat) {
            dealDie('opponent', game.atBat);
          }          
        } else {
          // 2nd turn onward
          console.log('2ND TURN PLUS POLLING ------------------------------>');
          console.log('new data', currentGameData)
          console.log('game.player.atBat', game.player.atBat);
          console.log('currentGameData.currentTurn', currentGameData.playerTurn);
          console.log('vis id', playerState.visitorID);
          let convertedLane = parseInt(currentGameData.lastMove);
          console.log('orig lane', convertedLane);
          if (convertedLane == 0) {
            convertedLane = 2;
          } else if (convertedLane == 2) {
            convertedLane = 0;
          }
          console.log('conv lane', convertedLane);
          if (game.opponent.atBat && !game.player.atBat && currentGameData.playerTurn == playerState.visitorID) {
            await addDieToLane('opponent', game.opponent.atBat, convertedLane);
            // sendMove()
            dealDie('player', parseInt(currentGameData.atBat));
          }
        }
      }
      let updateShake = {
        status: playerState.status,
        visitorID: playerState.visitorID,
      };
      handshake(updateShake);
    }
  }, pollInterval);
}

document.documentElement.style.setProperty('--die-animation-speed', userPreferences.animationSpeed + 'ms');

function contestantWithID(visitorID) {
  let contestant;
  console.green('checking id to find name', visitorID);
  if (playerState.visitorID == visitorID) {
    contestant = playerState;
  } else if (game.opponent.visitorID == visitorID) {
    contestant = game.opponent;
  }
  if (!contestant) {
    console.log('-------------------------------')
    console.log('contestantWithID failed with playerState', playerState)
    console.log('contestantWithID failed with game obj', game)
    console.log('-------------------------------')
  }
  return contestant;
}

async function callCoinModal(firstTurnID) { // called once at the beginning of each game
  let modal = document.querySelector('#coin-flip-modal');
  if (modal.classList.contains('showing')) {
    return;
  }
  console.log('game obj is', game)
  console.warn('CALLING COIN MODAL', firstTurnID);
  modal.style.display = 'flex';
  document.querySelector('#coin-name').textContent = playerState.userName;
  await pause(100);
  modal.classList.add('showing');
  await pause(userPreferences.animationSpeed);
  let coin = document.querySelector('#coin');
  let flipCount = randomInt(8,12);
  while (flipCount) {
    coin.classList.add('turned');
    await pause(100);
    if (flipCount % 2 === 0) {
      document.querySelector('#coin-name').textContent = playerState.userName;
    } else {
      document.querySelector('#coin-name').textContent = game.opponent.userName;
    }
    coin.classList.remove('turned');
    await pause(100);
    if (flipCount <= 4 && document.querySelector('#coin-name').textContent === contestantWithID(firstTurnID).userName) {
      flipCount = 0;
    } else {
      flipCount--
    }
  }
  await pause(200);
  coin.classList.add('landed');
  await pause(1000);
  modal.classList.remove('showing');
  await pause(userPreferences.animationSpeed);
  modal.style.display = 'none';
  coin.classList.remove('landed');

  // let opponentStatus = await checkUserStatus(game.opponent.visitorID);
  // let opponentFlipped = opponentStatus.indexOf('playing') !== -1;
  // console.log('------- OPP FLIPPED?', opponentFlipped);
  // if (opponentFlipped) {
  //   if (!game.opponent.atBat && !game.player.atBat) {
  //     // dealDie(game.firstPlayer == playerState.visitorID ? 'player' : 'opponent');
  //     if (game.firstPlayer == playerState.visitorID) {
  //       let firstDie = await getInitialGameDie();
  //       console.error('flipped a', firstDie);
  //     }
  //   }
  // }
}
async function callConfirmModal(opponent) {
  let modal = document.querySelector('#confirm-game-modal');
  if (modal.classList.contains('showing')) {
    return;
  }
  console.error('CALLING CONFIRM MODAL')
  document.querySelector('#lobby-screen').classList.add('blurred');
  modal.style.display = 'flex';
  document.querySelector('#player-confirm-name').textContent = playerState.userName;
  document.querySelector('#opponent-confirm-name').textContent = opponent.userName;
  // document.querySelector('#confirm-message').textContent = opponent.userName;
  await pause(50);
  modal.classList.add('showing');
  if (playerState.initiator) {
    console.green('CREATING GAME');
    let newGame = await createGame([playerState.visitorID, opponent.visitorID]);
    console.log('game?', newGame);
    let firstTurnID = parseInt(newGame[1]);
    game.gameID = newGame[0];
    if (playerState.visitorID === firstTurnID) {
      game.firstPlayer = firstTurnID;
      game.secondPlayer = opponent.visitorID;
    } else {
      game.firstPlayer = opponent.visitorID;
      game.secondPlayer = firstTurnID;
    }
    game.currentTurn = game.firstPlayer;
    game.atBat = parseInt(newGame[2]);

    console.log('now local game obj is', game);
    document.querySelector('#player-check').classList.add('checked');
  } else {
    console.log('not the initiator');
  }
}
async function dismissConfirmModal() {
  let modal = document.querySelector('#confirm-game-modal');
  modal.classList.remove('showing');
  document.querySelector('#lobby-screen').classList.remove('blurred');
  await pause(userPreferences.animationSpeed);
  modal.style.display = 'none';
  document.querySelector('#confirm-message').textContent = 'Connecting players...';
  document.querySelector('#opponent-check').classList.remove('checked');
  document.querySelector('#player-check').classList.remove('checked');
}
  

export async function init() {
  game.player.userName = playerState.userName;
  if (knownUser) {
    await handshake({ visitorID: playerState.visitorID, status: playerState.status });
  } else {
    await performInitialHandshake(playerState.userName);
  }
   // so that self is in list sooner
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
  constructor(denomination, targetDivQuery, lane, demo) {
    if (demo && !document.querySelector('#tutorial-screen').classList.contains('showing')) {
      console.green('cancelled die creation because no tutorial');
    }
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
    setTimeout(() => {
      dieElement.classList.add('showing');
    }, 50);
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

async function sendMove(lane) {
  let moveData = {
    gameID: game.gameID,
    visitorID: playerState.visitorID,
    opponentID: game.opponent.visitorID,
    chosenLane: lane,
  }
  let nextDie = await postNewMove(moveData);
  dealDie('opponent', parseInt(nextDie));
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
  game.deals++;
}

const totalDiceInPlay = (contestant) =>
  [...game[contestant].laneElements[0], ...game[contestant].laneElements[1], ...game[contestant].laneElements[2]].length;

async function addDieToLane(contestant, denomination, lane, demo) {
  if (demo && !document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('cancelled addDieToLane due to tutorial closed');
    return;
  }
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
  if (!demo) {
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
      await pause(100);
      document.querySelector(`#${winner}-area.turn-area`).classList.add('won');
      document.querySelector(`#${loser}-area.turn-area`).classList.add('lost');
    } else {
      if (contestant === 'player') {
        if (!game.singlePlayer) {
          sendMove(lane)
        } else {
          dealToCPU();
        }
      }
    }
  } else {
    return newDie;
  }
}

function printLaneTotal(contestant, lane) {
  let laneArray = [];
  [...game[contestant].laneElements[lane]].forEach((element) => {
    laneArray.push(element.denomination);
  });
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
  // document.querySelector('#debug').innerHTML = `o - ${totalDiceInPlay('opponent')} <br /> p - ${totalDiceInPlay('player')}`;
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
        const matchEl = document.querySelector(`#${match.elementID}`);
        if (!matchEl.classList.contains(specialClass)) {
          matchEl.classList.add(specialClass);
        } else {
          console.warn('SKIPPING already colored', contestant, match)
        }
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
  document.querySelector(`#player-area .new-die-box`).innerHTML = '';
  document.querySelector(`#opponent-area .new-die-box`).innerHTML = '';
  updateContestantScore('player');
  updateContestantScore('opponent');
  console.warn('after reset, .die arr is', [...document.querySelectorAll(`.die`)]);
  console.warn('after reset, game is', game);
  console.log(playerState)
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
  playerState.status = 'title';
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

function convertToPlain(html) {
  var tempDivElement = document.createElement('div');
  tempDivElement.innerHTML = html;
  return tempDivElement.textContent || tempDivElement.innerText || '';
}

async function printLobbyMessages(forceHistory) {
  let messagesArray = await getLobbyMessages(forceHistory);
  if (messagesArray.length === 0) {
    return;
  }
  let highestMessageID = messagesArray[messagesArray.length-1].messageID;
  playerState.lastMessageSeen = highestMessageID;
  let chatWindow = document.querySelector('#lobby-chat-window');
  messagesArray.forEach((messageRow) => {
    let rawDate = new Date(messageRow.timePosted);
    let convertedTime = rawDate.toLocaleString([], { hour: 'numeric', minute: 'numeric', hour12: true });
    let timeOfDay = `${convertedTime.slice(0, -3)} ${convertedTime.slice(-2).toLowerCase()}`;
    let messageClass = parseInt(messageRow.visitorID) === playerState.visitorID ? 'chat-message self' : 'chat-message';
    let rowHTML = `
      <div id="${messageRow.messageID}" class="${messageClass}">
        <div>${messageRow.userName} (#${messageRow.visitorID})</div>
        <div>message #${messageRow.messageID}</div>
        <div>${convertToPlain(messageRow.message)}</div>
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
async function postNewMove(moveData) {
  const response = await axios({
    method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/sendmove.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: JSON.stringify(moveData),
  });
  return response.data;
}
async function getGameData(gameID) {
  let response = await axios({
    method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/getgamebyid.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: gameID,
  });
  return response.data;
}
async function checkUserStatus(visitorID) {
  const response = await axios({
    method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/checkuserstatus.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: visitorID,
  });
  let userStatus = response.data;
  return userStatus;
}
async function findGameWithIDs(visitorIDs) {
  const response = await axios({
    method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/findassociatedgame.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: JSON.stringify(visitorIDs),
  });
  let gamesArray = response.data;
  console.log('raw', gamesArray)
  gamesArray.forEach((gameRow, g) => {
    gamesArray[g] = JSON.parse(gameRow);
  })
  console.log('parsed', gamesArray)
  return gamesArray[0];
}
async function createGame(visitorIDs) {
  const response = await axios({
    method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/creategame.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: visitorIDs,
  });
  return response.data;
}
async function getInitialGameDie() {
  console.warn('CALLING getInitialGameDie');
  let calledAt = Date.now();
  queryTimes.users = calledAt;
  let response = await axios({
    method: 'get',
    url: 'https://mikedonovan.dev/kbones/php/getinitialdie.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
  });
  return response.data
}
async function getRandomFlipFromDatabase() {
  console.warn('CALLING getRandomFlipFromDatabase');
  let calledAt = Date.now();
  queryTimes.users = calledAt;
  let response = await axios({
    method: 'get',
    url: 'https://mikedonovan.dev/kbones/php/getrandomflip.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
  });
  console.log('GOT RAND', response.data)
}
async function getUsersFromDatabase() {
  // console.warn('CALLING getUsersFromDatabase');
  let calledAt = Date.now();
  queryTimes.users = calledAt;
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
  console.warn('got', usersArray.length, 'users in', Date.now() - calledAt);
  return usersArray;
}
async function getReadyUsers() {
  // console.warn('CALLING getUsersFromDatabase');
  let calledAt = Date.now();
  queryTimes.users = calledAt;
  let response = await axios({
    method: 'get',
    url: 'https://mikedonovan.dev/kbones/php/getreadyusers.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    }
  });
  const usersArray = [...response.data];
  usersArray.forEach((row, i, self) => {
    self[i] = JSON.parse(row)
  });
  console.warn('got', usersArray.length, 'READY users in', Date.now() - calledAt);
  return usersArray;
}
async function getLobbyMessages(forceHistory=0) {
  let calledAt = Date.now(); 
  queryTimes.lobbyMessages = Date.now();
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
  console.warn('got', messagesArray.length, 'messasges in', Date.now() - calledAt);
  return messagesArray.reverse();
}
async function sendLobbyMessage(message) {
  let messageData = {
    userName: game.player.userName,
    visitorID: playerState.visitorID,
    message: message
  }
  messageData = JSON.stringify(messageData);
  let response = await axios({
     method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/sendlobbymessage.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: messageData
  });
  printLobbyMessages();
  console.log(response);
  return response;
}

async function handshake(shakeData) {
  let startedShake = Date.now();
  queryTimes.handshake = Date.now();
  
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

document.querySelector('#enter-lobby-button').addEventListener('click', async () => {
  playerState.userName = convertToPlain(document.querySelector('#name-entry-field').value);
  playerState.status = 'lobby';
  init();
  document.querySelector('#lobby-screen').classList.remove('hidden');
  await pause(100);
  document.querySelector('#title-screen').classList.add('hidden');
  await pause(100);
  document.querySelector('#title-screen').style.display = 'none';
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
assimilateKnownUser();

async function assimilateKnownUser() {
  if (knownUser) {
    console.green('KNOWN USER');
    await handshake({ visitorID: playerState.visitorID, status: 'title' });
    populateUserList();
    loadUserState(knownUser);
    document.querySelector('#name-entry-field').value = playerState.userName;
    document.querySelector('#name-entry-field').disabled = true;
    document.querySelector('#enter-lobby-button').disabled = false;
    document.querySelector('#known-user-confirmation').textContent = `Recognized as user #${playerState.visitorID}`;
  } else {
    console.green('UNKNOWN USER');
  }
}

function createTitleDie() {
  let titleDie = new Die(5, '#main', 0);
  return titleDie;
}

async function typeSentence(destinationQuery, containerClass, stringObjArr, typeSpeed) {
  let sentenceDiv = document.createElement('div');
  document.querySelector(destinationQuery).appendChild(sentenceDiv);
  sentenceDiv.classList.add('typed-sentence');
  sentenceDiv.classList.add(containerClass);
  stringObjArr.forEach((stringObj) => {
    let wordArray = stringObj.string.split(' ');
    wordArray.forEach(wordString => {
      let wordDiv = document.createElement('div');
      wordDiv.classList.add('typed-word');
      if (stringObj.sectionClass) {
        wordDiv.classList.add(stringObj.sectionClass);
      }
      [...wordString].forEach((char, i, arr) => {
        wordDiv.innerHTML += `
          <p class="typed-character">${char}</p>
        `;
      });
      sentenceDiv.appendChild(wordDiv);
      sentenceDiv.innerHTML += '&nbsp';
    });
  });
  for (const word of [...sentenceDiv.children]) {
    for (const letter of [...word.children]) {
      letter.style.setProperty('transition-duration', typeSpeed + 'ms');
      letter.classList.add('revealed');
      await pause(typeSpeed);
    }
  }
}

async function makeCPUMove() {
  let availableLanes = [];
  game.opponent.laneElements.forEach((arr, i) => {
    if (arr.length < 3) availableLanes.push(i);
  });
  let chosenLane = availableLanes[randomInt(0, availableLanes.length - 1)];
  await addDieToLane('opponent', game.opponent.atBat, chosenLane);
  await pause(200);
  dealDie('player', randomInt(1, 6));
}
async function dealToCPU() {
  dealDie('opponent', randomInt(1, 6));
  await pause(randomInt(1000, 1000));
  makeCPUMove();
}

let tutorialTypeSpeed = 40;

async function playTutorial() {
  await typeSentence(
    '#tutorial-top-text-area',
    'typed-sentence',
    [
      {
        string: 'On your turn you receive a',
      },
      {
        string: 'random die',
        sectionClass: 'bold',
      },
      {
        string: 'and place it in one of three',
      },
      {
        string: 'lanes.',
        sectionClass: 'bold'
      },
    ],
    tutorialTypeSpeed
  );

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(500);

  new Die(5, `#player-area .new-die-box`);
  document.querySelector(`#player-area .new-die-box`).classList.add('highlighted');
  await pause(500);

  let playerLanes = [...document.querySelectorAll(`#player-area .die-lane`)];

  for (const lane in playerLanes) {
    playerLanes[lane].classList.add('available');
    await pause(150);
  }

  await pause(500);

  document.querySelector(`#player-area .new-die-box`).classList.remove('highlighted');
  await addDieToLane('player', 5, 1, true);
  for (const lane in playerLanes) {
    playerLanes[lane].classList.remove('available');
  }

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(500);

  document.querySelector('#tutorial-top-text-area').innerHTML = '';
  typeSentence(
    '#tutorial-top-text-area',
    'typed-sentence',
    [
      {
        string: 'Your score is the combined value of',
      },
      {
        string: 'all dice in your lanes.',
        sectionClass: 'bold',
      },
    ],
    tutorialTypeSpeed
  );

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(1000);
  let doomedDie = await playDemoTurn('opponent', 3, 2);
  await pause(200);
  let firstFour = await playDemoTurn('player', 4, 0);
  await pause(200);
  await playDemoTurn('opponent', 6, 0);
  await pause(200);
  await playDemoTurn('player', 1, 1);
  await pause(200);
  await playDemoTurn('opponent', 4, 2);
  await pause(200);
  new Die(4, `#player-area .new-die-box`);
  document.querySelector(`#player-area .new-die-box`).classList.add('highlighted');
  
  await pause(500);
  document.querySelector('#tutorial-top-text-area').innerHTML = '';
  await typeSentence(
    '#tutorial-top-text-area',
    'typed-sentence',
    [
      {
        string: 'If you place two dice of the same value',
      },
      {
        string: 'in the same lane...',
        sectionClass: 'bold',
      },
    ],
    tutorialTypeSpeed
  );

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(500);

  let secondFour = await addDieToLane('player', 4, 0, true);

  await pause(500);
  document.querySelector('#tutorial-top-text-area').innerHTML = '';
  await typeSentence(
    '#tutorial-top-text-area',
    'typed-sentence',
    [
      {
        string: 'The value of both dice',
      },
      {
        string: 'is doubled.',
        sectionClass: 'double-color',
      },
    ],
    tutorialTypeSpeed
  );

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(500);

  document.querySelector('#' + firstFour.elementID).classList.add('doubled');
  document.getElementById(secondFour.elementID).classList.add('doubled');
  await pause(userPreferences.animationSpeed);
  document.querySelector('#' + firstFour.elementID).classList.remove('doubled');
  document.getElementById(secondFour.elementID).classList.remove('doubled');
  await pause(userPreferences.animationSpeed);
  document.querySelector('#' + firstFour.elementID).classList.add('doubled');
  document.getElementById(secondFour.elementID).classList.add('doubled');
  await pause(userPreferences.animationSpeed);
  document.querySelector('#' + firstFour.elementID).classList.remove('doubled');
  document.getElementById(secondFour.elementID).classList.remove('doubled');
  await pause(userPreferences.animationSpeed);
  document.querySelector('#' + firstFour.elementID).classList.add('doubled');
  document.getElementById(secondFour.elementID).classList.add('doubled');

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(500);

  new Die(4, `#player-area .new-die-box`);

  document.querySelector('#tutorial-top-text-area').innerHTML = '';
  await typeSentence(
    '#tutorial-top-text-area',
    'typed-sentence',
    [
      {
        string: 'Three of the same die in a lane have each value',
      },
      {
        string: 'tripled.',
        sectionClass: 'triple-color',
      },
    ],
    tutorialTypeSpeed
  );

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(500);

  let thirdFour = await addDieToLane('player', 4, 0, true);
  document.querySelector('#' + firstFour.elementID).classList.remove('doubled');
  document.getElementById(secondFour.elementID).classList.remove('doubled');
  document.getElementById(firstFour.elementID).classList.add('tripled');
  document.getElementById(secondFour.elementID).classList.add('tripled');
  document.getElementById(thirdFour.elementID).classList.add('tripled');
  await pause(userPreferences.animationSpeed);
  document.getElementById(firstFour.elementID).classList.remove('tripled');
  document.getElementById(secondFour.elementID).classList.remove('tripled');
  document.getElementById(thirdFour.elementID).classList.remove('tripled');
  await pause(userPreferences.animationSpeed);
  document.getElementById(firstFour.elementID).classList.add('tripled');
  document.getElementById(secondFour.elementID).classList.add('tripled');
  document.getElementById(thirdFour.elementID).classList.add('tripled');
  await pause(userPreferences.animationSpeed);
  document.getElementById(firstFour.elementID).classList.remove('tripled');
  document.getElementById(secondFour.elementID).classList.remove('tripled');
  document.getElementById(thirdFour.elementID).classList.remove('tripled');
  await pause(userPreferences.animationSpeed);
  document.getElementById(firstFour.elementID).classList.add('tripled');
  document.getElementById(secondFour.elementID).classList.add('tripled');
  document.getElementById(thirdFour.elementID).classList.add('tripled');

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(1000);

  document.querySelector('#tutorial-top-text-area').innerHTML = '';
  await typeSentence(
    '#tutorial-top-text-area',
    'typed-sentence',
    [
      {
        string: 'If you place a die that matches one or more',
      },
      {
        string: 'in your opponent\'s same lane...',
        sectionClass: 'bold',
      },
    ],
    tutorialTypeSpeed
  );
  
  let attackingDie = await playDemoTurn('player', 3, 2);

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }
  
  await pause(200);

  document.querySelector('#tutorial-top-text-area').innerHTML = '';
  await typeSentence(
    '#tutorial-top-text-area',
    'typed-sentence',
    [
      {
        string: 'ALL of your opponent\'s matching dice',
      },
      {
        string: 'are destroyed',
        sectionClass: 'bold',
      },
    ],
    tutorialTypeSpeed
  );

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(500);
  console.log('att', attackingDie)
  console.log('doom', doomedDie)
  document.querySelector(`#${attackingDie.elementID}`).classList.add('angry');
  document.querySelector(`#${doomedDie.elementID}`).classList.add('angry');
  await pause(userPreferences.animationSpeed);
  document.querySelector(`#${attackingDie.elementID}`).classList.remove('angry');
  document.querySelector(`#${doomedDie.elementID}`).classList.remove('angry');
  await pause(userPreferences.animationSpeed);
  document.querySelector(`#${attackingDie.elementID}`).classList.add('angry');
  document.querySelector(`#${doomedDie.elementID}`).classList.add('angry');
  await pause(userPreferences.animationSpeed);
  document.querySelector(`#${attackingDie.elementID}`).classList.remove('angry');

  destroyDie(`#${doomedDie.elementID}`);
  await pause(userPreferences.animationSpeed);

  await pause(500);

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  document.querySelector('#tutorial-top-text-area').innerHTML = '';
  typeSentence(
    '#tutorial-top-text-area',
    'typed-sentence',
    [
      {
        string: 'The game ends when either player has',
      },
      {
        string: 'filled their lanes',
        sectionClass: 'bold',
      },
      {
        string: 'with dice.',
      },
    ],
    tutorialTypeSpeed
  );

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(1000);

  await playDemoTurn('opponent', 3, 1);
  await pause(200);
  await playDemoTurn('player', 4, 1);
  await pause(200);
  await playDemoTurn('opponent', 3, 0);
  await pause(200);
  await playDemoTurn('player', 1, 2);
  await pause(200);
  await playDemoTurn('opponent', 2, 1);
  await pause(200);
  await playDemoTurn('player', 2, 2);

  if (!document.querySelector('#tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }
  
  await pause(500);

  document.querySelector('#opponent-area').classList.add('lost');
  document.querySelector('#player-area').classList.add('won');

  // show 'play again' button?
}

async function playDemoTurn(contestant, denomination, lane) {
  if (document.querySelector('#tutorial-screen').classList.contains('showing')) {
    new Die(denomination, `#${contestant}-area .new-die-box`, true);
    document.querySelector(`#${contestant}-area .new-die-box`).classList.add('highlighted');
    await pause(500);
    document.querySelector(`#${contestant}-area .new-die-box`).classList.remove('highlighted');
    let newDie = await addDieToLane(contestant, denomination, lane, true);
    return newDie;
  } else {
    console.log('skipped demo turn due to no tutorial')
  }
  
}

document.querySelector('#vs-cpu-button').addEventListener('click', async () => {
  resetGame();
  document.querySelector('#title-screen').classList.add('hidden');
  document.querySelector('#lobby-screen').style.display = 'none';
  document.querySelector('#opponent-area').classList.remove('dim');
  document.querySelector('#header-message').textContent = 'CPU Battle';
  game.singlePlayer = true;
  game.opponent.userName = 'CPU';
  document.querySelector('#player-name').textContent = playerState.userName;
  document.querySelector('#opponent-name').textContent = game.opponent.userName;
  await pause(200);
  document.querySelector('#title-screen').style.display = 'none';  
  dealToCPU();
});
document.querySelector('#how-to-play-button').addEventListener('click', async () => {
  document.querySelector('#lobby-screen').style.display = 'none';
  document.querySelector('#opponent-area').classList.remove('dim');
  await pause(100);
  document.querySelector('#game-area').classList.add('demo-mode');
  document.querySelector('#title-screen').classList.add('hidden');
  document.querySelector('#header').classList.add('hidden');
  document.querySelector('#tutorial-screen').classList.add('showing');
  await pause(500);
  playTutorial();
});
document.querySelector('#tutorial-exit-button').addEventListener('click', async () => {
  document.querySelector('#tutorial-top-text-area').innerHTML = '';  
  document.querySelector('#opponent-area').classList.add('dim');
  document.querySelector('#game-area').classList.remove('demo-mode');
  document.querySelector('#title-screen').classList.remove('hidden');
  document.querySelector('#header').classList.remove('hidden');
  resetGame();
  document.querySelector('#tutorial-screen').classList.remove('showing');
  await pause(500);
  document.querySelector('#lobby-screen').style.display = 'flex';
});
document.querySelector('#back-to-title-button').addEventListener('click', async () => {
  if (playerState.status === 'ready') {
    lobbyPanel.classList.remove('searching');
  } else if (playerState.status === 'confirming') {
    return;
  }
  playerState.status = 'title';
  await handshake({ visitorID: playerState.visitorID, status: playerState.status });
  document.querySelector('#title-screen').style.display = 'grid';
  await pause(50);
  document.querySelector('#title-screen').classList.remove('hidden');
  await pause(50);
  document.querySelector('#lobby-screen').classList.add('hidden');
});
document.querySelector('#options-button').addEventListener('click', async () => {
  document.querySelector('#options-screen').classList.add('showing'); 
});
document.querySelector('#options-exit-button').addEventListener('click', async () => {
  document.querySelector('#options-screen').classList.remove('showing');
});


// init();
