import './css/style.css';
import fscreen from 'fscreen';
import axios from 'axios';

require('console-green');

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
const localStorageName = process.env.NODE_ENV === 'development' ? 'kbones-dev' : 'kbones-prefs';
if (process.env.NODE_ENV === 'development') {
  document.title = 'DEV | ' + document.title;
}
const totalQueries = {
  handshake: 0,
  getUsers: 0,
  lobbyMessages: 0
};

window.onresize = async () => {
  if (document.activeElement.tagName !== 'INPUT') {
    await pause(1000); // give keyboard time to go away if present
    detectScreen();
    if (fscreen.fullscreenElement) {
      document.getElementById('full-screen-switch').classList.add('on');
    } else {
      // document.documentElement.style.setProperty('--actual-height', `${initialHeight}px`);
      document.getElementById('full-screen-switch').classList.remove('on');
    }
  }
};

const fonts = ["sans-serif","Montez","Lobster","Josefin Sans","Shadows Into Light","Pacifico","Amatic SC", "Orbitron", "Rokkitt","Righteous","Dancing Script","Bangers","Chewy","Sigmar One","Architects Daughter","Abril Fatface","Covered By Your Grace","Kaushan Script","Gloria Hallelujah","Satisfy","Lobster Two","Comfortaa","Cinzel","Courgette"];

window.onload = async () => {
  console.error('>>>>>>>>>>>>>>>>>>> ONLOAD >>>>>>>>>>>>>>>>>>>>>')
  detectScreen();
  assignHandlers();  
  document.body.style.opacity = '1';
  animateTitle();
  await populateUserList(true);
  console.error('finished populate')
  updateLobbyCount();
  console.error('finished lobbycount')
  await printLobbyMessages(10);
  
  document.getElementById('lobby-chat-window').style.setProperty('scroll-behavior', 'smooth');
  startPolling();
  let selectedFont = playerState.preferences.customizations['--player-username-font'];
  var fontSelect = document.getElementById('font-select');
  for (var a = 0; a < fonts.length; a++) {
    var opt = document.createElement('option');
    opt.value = opt.innerHTML = fonts[a];
    opt.style.fontFamily = fonts[a];
    fontSelect.add(opt);
    if (fonts[a] === selectedFont) {
      opt.selected = true;
    }
  }
};

async function animateTitle() {
  let letterElementArray = [...document.getElementById('title-legend').children];
  for (let i = 1; i < letterElementArray.length; i++) {
    letterElementArray[i].classList.add('revealed');
    await pause(50);
  }
  await pause(600);
  document.getElementById('title-legend').classList.add('animating');
}

// don't show full screen button if user can't or already is from PWA
if (!fscreen.fullscreenEnabled || fscreen.fullscreenElement !== null) {
  document.getElementById('full-screen-button').style.display = 'none';
};

const initialHeight = window.innerHeight;

function detectScreen() {
  if (CSS.supports('height: 100dvh')) {
    document.documentElement.style.setProperty('--actual-height', '100dvh');
  } else {
    document.documentElement.style.setProperty('--actual-height', window.innerHeight + 'px');
  }
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

let palleteMarkerPositions = {
  'bg-color': { x: 0, y: 0 },
  'die-color': { x: 0, y: 0 },
  'die-dot-color': { x: 0, y: 0 },
}

let playerState = {
  userName: 'Player',
  visitorID: undefined,
  status: 'title',
  previousStatus: 'title',
  lastMessageSeen: 0,
  initiator: false,
  latency: 0,
  preferences: {
    animationSpeed: 200,
    CPUTurnSpeed: 500,
    CPUDifficulty: 1,
    customizations: {
      '--player-area-bg-color': '#223b3b',
      '--die-color': '#c9c9c9',
      '--die-dot-color': '#000000',
      '--die-border-radius': '0.12',
      '--player-username-font': 'sans-serif'
    }
  },
}
let queryTimes = {
  lobbyMessages: Date.now(),
  users: Date.now(),
  handshake: Date.now()
}
let clickTimes = {
  lane: Date.now(),
  button: Date.now()
}

let confirmMessages = [
  'Formulating tubes...',
  'Reticulating splines...',
  'Checking for '
];

let currentDieID = 0;

let knownUser = window.localStorage.getItem(localStorageName);
console.log('known user', knownUser);
console.log('playerState', playerState)
assimilateKnownUser();

function assignHandlers() {
  console.error('>>>>>>>>>>> assignHandlers <<<<<<<<<<<<<');
  document.querySelector('#player-area .die-lane:nth-child(1)').addEventListener('pointerdown', () => {
    if (Date.now() - clickTimes.lane > 500) {
      addDieToLane('player', game.player.atBat, 0);
      clickTimes.lane = Date.now();
    }
  });
  document.querySelector('#player-area .die-lane:nth-child(2)').addEventListener('pointerdown', () => {
    if (Date.now() - clickTimes.lane > 500) {
      addDieToLane('player', game.player.atBat, 1);
      clickTimes.lane = Date.now();
    }
  });
  document.querySelector('#player-area .die-lane:nth-child(3)').addEventListener('pointerdown', () => {
    if (Date.now() - clickTimes.lane > 500) {
      addDieToLane('player', game.player.atBat, 2);
      clickTimes.lane = Date.now();
    }querySelector
  });

  document.getElementById('chat-submit-button').addEventListener('click', async (e) => {
    console.log('hit the button!', Date.now());
    let message = convertToPlain(document.getElementById('lobby-chat-field').value.trim());
    document.getElementById('lobby-chat-field').value = '';
    if (message) {
      e.target.disabled = true;
      await sendLobbyMessage(message);
    }
  });
  document.getElementById('confirm-game-button').addEventListener('click', async () => {
    const preferences = await getOpponentCustomizations(game.opponent.visitorID);
    game.opponent.preferences = preferences;
    applyOpponentCustomizations();
    console.warn('confirmer got opponent customizations')
    await reportNewStatus('playing');
    console.warn('confirmer reported "playing" status')
    dismissConfirmModal();
    document.getElementById('player-name').textContent = playerState.userName;
    document.getElementById('opponent-name').textContent = game.opponent.userName;
    document.getElementById('lobby-screen').classList.add('hidden');
    await pause(userPreferences.animationSpeed);
    document.getElementById('lobby-screen').classList.remove('blurred');
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('clear-local-storage-button').style.display = 'none';
    document.getElementById('header-message').textContent = `Knucklebones game #${game.gameID}`;     
    // await pause(200);
    callCoinModal(game.firstPlayer);
  });

  document.getElementById('toggle-ready-button').addEventListener('click', async (e) => {
    let lobbyPanel = document.getElementById('lobby-control-panel');
    if (playerState.status !== 'ready') {
      // playerState.status = 'ready';
      let readyUserList = await getReadyUsers();
      if (readyUserList.length) {        
        let newOpponent = readyUserList[0];
        game.opponent.userName = newOpponent.userName;
        game.opponent.visitorID = newOpponent.visitorID;
        console.log('FOUND READY USER', newOpponent);
        // await handshake({ visitorID: playerState.visitorID, status: playerState.status });
        await reportNewStatus('ready');
        playerState.initiator = true;
        callConfirmModal(newOpponent);      
      } else {
        lobbyPanel.classList.add('searching');
        // await handshake({ visitorID: playerState.visitorID, status: playerState.status });
        await reportNewStatus('ready');
        await populateUserList();
        e.target.innerHTML = 'Stop Searching';
      }
    } else {
      lobbyPanel.classList.remove('searching');
      await reportNewStatus('lobby');
      // playerState.status = 'lobby';
      // await handshake({ visitorID: playerState.visitorID, status: playerState.status });
      await populateUserList();
      e.target.innerHTML = 'Find Game';
    }
  });
  document.getElementById('clear-local-storage-button').addEventListener('click', () => {
    window.localStorage.clear();
    window.location.reload(true);
  });

  addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keycode === 13) {
      e.preventDefault();
      console.log(e);
      let lobbyChatField = document.getElementById('lobby-chat-field');
      if (document.activeElement === lobbyChatField) {
        console.warn('enter pressed!!');
        document.getElementById('chat-submit-button').click();
      }
      let nameEntryField = document.getElementById('name-entry-field');
      if (document.activeElement === nameEntryField) {
        console.warn('enter pressed!!');
        document.getElementById('enter-lobby-button').click();
      }
    }
  });
  document.getElementById('full-screen-switch').addEventListener('click', async (e) => {
    e.target.classList.add('disabled');
    await toggleFullScreen();
    
    e.target.classList.remove('disabled');
  });
  document.getElementById('die-radius-slider').addEventListener('input', async (e) => {
    let newValue = parseFloat(e.target.value);
    document.documentElement.style.setProperty('--die-border-radius', `calc(var(--die-size) * ${newValue})`);
  });
  document.getElementById('die-radius-slider').addEventListener('change', async (e) => {
    let newValue = parseFloat(e.target.value);
    playerState.preferences.customizations['--die-border-radius'] = newValue;
    console.log('storing newValue?', newValue);
    await sendPreferences(playerState.preferences);
    storeUserState();
  });
  document.getElementById('bg-color-input').addEventListener('input', async (e) => {
    let newValue = e.target.value;
    document.documentElement.style.setProperty('--player-area-bg-color', newValue);
  });
  document.getElementById('bg-color-input').addEventListener('change', async (e) => {
    let newValue = e.target.value;
    document.documentElement.style.setProperty('--player-area-bg-color', newValue);
    playerState.preferences.customizations['--player-area-bg-color'] = newValue;
    console.log('storing newValue?', newValue)
    await sendPreferences(playerState.preferences);
    storeUserState();
  });
  document.getElementById('die-color-input').addEventListener('input', async (e) => {
    let newValue = e.target.value;
    console.log('new is?', newValue)
    document.documentElement.style.setProperty('--die-color', newValue);
  });
  document.getElementById('die-color-input').addEventListener('change', async (e) => {
    let newValue = e.target.value;
    document.documentElement.style.setProperty('--die-color', newValue);
    playerState.preferences.customizations['--die-color'] = newValue;
    console.log('storing newValue?', newValue)
    await sendPreferences(playerState.preferences);
    storeUserState();
  });
  document.getElementById('die-dot-color-input').addEventListener('input', async (e) => {
    let newValue = e.target.value;
    console.log('new is?', newValue)
    document.documentElement.style.setProperty('--die-dot-color', newValue);
  });
  document.getElementById('die-dot-color-input').addEventListener('change', async (e) => {
    let newValue = e.target.value;
    document.documentElement.style.setProperty('--die-dot-color', newValue);
    playerState.preferences.customizations['--die-dot-color'] = newValue;
    console.log('storing newValue?', newValue)
    await sendPreferences(playerState.preferences);
    storeUserState();
  });
  document.getElementById('font-select').addEventListener('change', async (e) => {
    let newValue = e.target.value;
    document.documentElement.style.setProperty('--player-username-font', newValue);
    playerState.preferences.customizations['--player-username-font'] = newValue;
    console.log('storing newValue?', newValue)
    await sendPreferences(playerState.preferences);
    storeUserState();
  });

  document.getElementById('vs-cpu-button').addEventListener('click', async () => {
    game.singlePlayer = true;
    resetGame();
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('opponent-area').classList.remove('dim');
    document.getElementById('header-message').textContent = `CPU Battle (difficulty ${playerState.preferences.CPUDifficulty})`;
    game.opponent.userName = 'CPU';
    document.getElementById('player-name').textContent = playerState.userName;
    document.getElementById('opponent-name').textContent = game.opponent.userName;
    document.getElementById('cpu-game-back-button').style.display = 'block';
    await pause(200);
    // document.getElementById('title-screen').style.display = 'none';
    dealToCPU();
  });
  document.getElementById('cpu-game-back-button').addEventListener('click', async () => {
    // document.getElementById('title-screen').style.display = 'grid';
    document.getElementById('title-screen').classList.remove('hidden');
    document.getElementById('opponent-area').classList.remove('dim');
    document.getElementById('player-area').classList.remove('dim');
    await pause(200);
    document.getElementById('lobby-screen').style.display = 'flex';
    playerState.singlePlayer = false;
    resetGame();
  });
  document.getElementById('how-to-play-button').addEventListener('click', async () => {
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('opponent-area').classList.remove('dim');
    document.getElementById('player-name').textContent = playerState.userName;
    await pause(100);
    document.getElementById('game-area').classList.add('demo-mode');
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('header').classList.add('hidden');
    document.getElementById('tutorial-screen').classList.add('showing');
    await pause(500);
    playTutorial();
  });
  document.getElementById('tutorial-exit-button').addEventListener('click', async () => {
    document.getElementById('tutorial-top-text-area').innerHTML = '';
    document.getElementById('opponent-area').classList.add('dim');
    document.getElementById('game-area').classList.remove('demo-mode');
    document.getElementById('title-screen').classList.remove('hidden');
    document.getElementById('header').classList.remove('hidden');
    resetGame();
    document.getElementById('tutorial-screen').classList.remove('showing');
    await pause(500);
    document.getElementById('lobby-screen').style.display = 'flex';
  });
  document.getElementById('back-to-title-button').addEventListener('click', async () => {
    if (playerState.status === 'ready') {
      lobbyPanel.classList.remove('searching');
    } else if (playerState.status === 'confirming') {
      return;
    }
    await reportNewStatus('title');
    // await handshake({ visitorID: playerState.visitorID, status: playerState.status });
    document.getElementById('title-screen').style.display = 'grid';
    await pause(50);
    document.getElementById('title-screen').classList.remove('hidden');
    await pause(50);
    document.getElementById('lobby-screen').classList.add('hidden');
  });
  document.getElementById('options-button').addEventListener('click', async () => {
    document.getElementById('options-screen').classList.add('showing');
    
  });
  document.getElementById('options-exit-button').addEventListener('click', async () => {
    document.getElementById('options-screen').classList.remove('showing');    
  });
  document.getElementById('cpu-difficulty-slider').addEventListener('change', (e) => {
    let newDifficulty = parseInt(e.target.value);
    console.log('set new diff', newDifficulty);
    // if (newDifficulty === 10) {
    //   document.documentElement.style.setProperty('--opponent-die-color', 'black');
    //   document.documentElement.style.setProperty('--opponent-die-dot-color', 'black');
    // }
    playerState.preferences.CPUDifficulty = newDifficulty;
    storeUserState();
  });

  // document.addEventListener('visibilitychange', (e) => {
  //   let newStatus;
  //   if (document.visibilityState === 'visible') {
  //     newStatus = playerState.previousStatus;
  //   } else {
  //     newStatus = 'away';     
  //   }
  //   reportNewStatus(newStatus);
  // });

}

async function reportNewStatus(newStatus) {
  playerState.previousStatus = playerState.status;
  playerState.status = newStatus;
  await handshake({ status: playerState.status, visitorID: playerState.visitorID });
}

async function populateUserList(initial) {
  console.error('starting populateUserList')
  totalQueries.getUsers++;
  let nowInSeconds = Math.floor(Date.now() / 1000);
  let userList = await getUsersFromDatabase(initial);
  console.error('finished getting userlist', userList)
  let currentUserElement = document.getElementById('user-list');
  userList.forEach((user) => {
    let sinceLastPing = nowInSeconds - parseInt(user.lastPing);
    let timeInLobby = parseInt(user.lastPing) - parseInt(user.joinTime);
    console.log(user.userName, 'ffuu time here is', timeInLobby);
    let lastPingMessage; // updated for every user
    let rowID = `user-row-${user.visitorID}`;
    let listed = document.querySelector(`#${rowID}`);
    if (listed) { // only replace ping and status
      if (sinceLastPing > 5 || user.status === 'title') {        
        listed.classList.add('dying');
      } else {
        if (sinceLastPing <= 3) {
          if (listed.classList.contains('late')) {
            listed.classList.remove('late');
          }
          lastPingMessage = 'now';
        } else {
          listed.classList.add('late');
          lastPingMessage = `${sinceLastPing} seconds ago`;          
        }
      }
      document.querySelector(`#${rowID} .user-last-seen`).textContent = lastPingMessage;
      document.querySelector(`#${rowID} .user-status`).textContent = user.status;
      // let latencyArea = document.querySelector(`#${rowID} .user-latency`);
      // latencyArea.textContent = user.latency;
      drawPingBars(`#${rowID} .ping-bars`, user.latency);
      let lastInClasslist = document.querySelector(`#${rowID} .user-status`).classList.item(document.querySelector(`#${rowID} .user-status`).classList.length - 1);
      document.querySelector(`#${rowID} .user-status`).classList.replace(lastInClasslist, user.status);
    } else if ((sinceLastPing < 5 && user.status !== 'title')) {
      // not in list but recently handshook (or self)
      let userRowClasses = ['user-list-row'];
      let nameListing = user.userName;
      let lastPingMessage = initial ? 'now' : 'just joined';
      if (user.visitorID == playerState.visitorID) {
        userRowClasses.push('self');
        // nameListing += '<p style="font-family: sans-serif"> (you)</p>';
      }
      console.error('CREATING ENTIRE DIV FOR NEW VISITOR', user.userName);
      let newUserRow = document.createElement('div');
      newUserRow.classList.add(...userRowClasses);
      newUserRow.setAttribute('id', rowID);
      let userFont = user.preferences.customizations['--player-username-font'];
      let userBgColor = user.preferences.customizations['--player-area-bg-color'];
      let userDieColor = user.preferences.customizations['--die-color'];
      let userDieDotColor = user.preferences.customizations['--die-dot-color'];
      let userDieRadius = user.preferences.customizations['--die-border-radius'];
      newUserRow.style.setProperty('background-color', userBgColor);
      newUserRow.innerHTML = `
      <div style="font-family: ${userFont}">${nameListing}</div>
      <div class="user-status">${user.status}</div>
      <div class="user-last-seen">${lastPingMessage}</div>
      <div id="ping-bars-${user.visitorID}" class="ping-bars">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      `;
      let displayDie = produceDieHTML(randomInt(1, 6), `display-die-${user.visitorID}`, 'option');
      displayDie.style.setProperty('background-color', userDieColor);
      displayDie.style.borderRadius = `calc(var(--die-size) * ${userDieRadius})`;
      [...displayDie.children[0].children].forEach((dot) => {
        dot.style.backgroundColor = userDieDotColor;
      });
      newUserRow.prepend(displayDie);
      currentUserElement.appendChild(newUserRow);

      drawPingBars(`#ping-bars-${user.visitorID}`, user.latency);

      document.querySelector(`#${rowID} .user-status`).classList.add('lobby');
      newUserRow.classList.add('newly-joined');
      setTimeout(() => {
        newUserRow.classList.remove('newly-joined');
      }, 500);
    } else {
      if (sinceLastPing >= 5) {
        console.warn(user.userName, 'showed up in the DB list, but too high sinceLastPing to print');
      } else {
        console.warn(user.userName, 'showed up in the DB list but is at title screen');
      }
    }
  });  
  let disconnectedArray = [...document.getElementsByClassName('dying')];
  for (const doomedUser in disconnectedArray) {
    const doomedElement = disconnectedArray[doomedUser];
    doomedElement.classList.add('disconnected');
    await pause(300);
    currentUserElement.removeChild(doomedElement);
  };
}
function drawPingBars(query, ping) {
  let pingBars = document.querySelector(query);
  let barsShowing = 6;
  let amountOver = ping - 125;
  if (amountOver < 0) amountOver = 0;
  barsShowing -= Math.round(amountOver / 24);
  if (barsShowing < 0) barsShowing = 0;
  console.log('fucker gets', barsShowing, 'bars for ping', ping);
  let barArray = [...pingBars.children];
  for (let i = 0; i < barArray.length; i++) {
    if (i >= barsShowing) {
      barArray[i].classList.add('flattened');
    } else {
      barArray[i].classList.remove('flattened');
    }
  }
  pingBars.className = 'ping-bars';
  if (barsShowing >= 4) {

  } else if (barsShowing >= 2) {
    pingBars.classList.add('medium');
  } else {
    pingBars.classList.add('low');
  }
}

function updateLobbyCount() {
  // let totalUsersListed = [...document.querySelectorAll('.user-list-row:not(.dying)')].filter(row => row.id.indexOf((playerState.visitorID + '') === -1)).length;
  let totalUsersListed = [...document.getElementsByClassName('user-list-row')].filter((row) => (row.id.indexOf(playerState.visitorID + '' === -1) && !row.classList.contains('dying'))).length;
  console.log('raw totalusers is', [...document.getElementsByClassName('user-list-row')]);
  let lobbyReport = `${totalUsersListed} other players online`;
  if (!totalUsersListed) {
    lobbyReport = 'no other players online :(';
  } else if (totalUsersListed === 1) {
    lobbyReport = '1 other player online';
  }
  document.getElementById('lobby-report').textContent = lobbyReport;
  console.log(totalUsersListed, 'users total.');
}

function sortByLastSeen(userList) {
  console.log('sorting userList', userList);
  let sortedList = userList.sort((a, b) => {
    a.lastPing < b.lastPing;
  });
  console.log('SORTED', sortedList)
  return sortedList;
}

const userPreferences = {
  animationSpeed: 200,
  CPUTurnSpeed: 500,
  CPUDifficulty: 0,
  colors: {
    '--player-area-bg-color': '#223b3b',
    '--die-color': '#c9c9c9',
    '--die-dot-color': '#000000',
  }
}

// const pollInterval = 1500;
const pollInterval = 900;

async function performInitialHandshake(nameEntered) {  
  const firstShakeData = {
    userName: nameEntered,
    status: 'lobby',
  };
  console.warn('---------> INITIAL handshake!', firstShakeData);
  const visitorID = await handshake(firstShakeData);
  playerState.visitorID = visitorID;
  playerState.userName = nameEntered;
  storeUserState();
  await sendPreferences(playerState.preferences);
  document.getElementById('demo-username').textContent = nameEntered;
  console.warn('established new user #' + visitorID);
  knownUser = playerState; // so that leaving and clicking Enter Lobby again will not create new user
}

let pollLoop;
let confirmWaitTime = 0;

function startPolling() {
  // let lastPoll = 0;  
  pollLoop = setInterval(async () => {
    if (playerState.status === 'title') {
      if ((Date.now() - queryTimes.users) > 3000) {
        console.log('only querying lobby users due to title screen (uncomment below to actually do it!)');
        await populateUserList();
        updateLobbyCount();
      } else {
        // console.error('skipped title populate due to since last < 5000', Date.now() - queryTimes.users);
      }
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
      let waitingForConfirm = document.getElementById('confirm-game-modal').classList.contains('showing');
      if (waitingForConfirm) {
        // console.green('ALREADY FOUND READY OPPONENT');
        confirmWaitTime += pollInterval;
        if (!playerState.initiator) {
          if (playerState.status !== 'confirming') {
            console.green('I am RESPONDANT polling findGameWithIDs for the one INITIATOR just created with our IDs!');
            let newGame = await findGameWithIDs([game.opponent.visitorID, playerState.visitorID]);
            if (newGame) {
              console.log('RESPONDANT found a game', newGame);
              console.log('game obj was', game);
              game.gameID = newGame.gameID;
              game.player.userName = playerState.userName;
              game.firstPlayer = newGame.playerTurn;
              game.atBat = parseInt(newGame.atBat);
              game.currentTurn = newGame.playerTurn;
              await reportNewStatus('confirming');
              // playerState.status = 'confirming';
              // await handshake([playerState.visitorID, playerState.status]);
              document.getElementById('opponent-check').classList.add('checked');
              await pause(500);
              document.getElementById('player-check').classList.add('checked');
              document.getElementById('confirm-message').textContent = 'CONNECTED!';
              document.getElementById('confirm-game-button').disabled = false;
            } else {
              console.log('checked but did not find a newly-created game with both players');
            }
          } else {
            console.green('button enabled now.');
          }            
        } else { // initiator
          console.log('i am INITIATOR, checking if opponent status is confirming --------->');
          let opponentStatus = await checkUserStatus(game.opponent.visitorID);
          if (opponentStatus === 'confirming') {
            document.getElementById('opponent-check').classList.add('checked');
            await pause(500);
            document.getElementById('player-check').classList.add('checked');
            document.getElementById('confirm-message').textContent = 'CONNECTED!';
            document.getElementById('confirm-game-button').disabled = false;
            // playerState.status = 'confirming';
            await reportNewStatus('confirming');
          } else {
            console.log('checked, but opponent status is still', opponentStatus, ', not confirming');
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
            await pause(200);
          }          
        } else {
          console.error('throttled populateUserList', (now - queryTimes.users));
        }        
        if (now - queryTimes.lobbyMessages >= (pollInterval / 1.5)) {
          console.log('poll calling printlobbymessages')
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
          document.getElementById('opponent-area').classList.remove('dim');
          console.green('--------- GAME START! ---------------------------')
        }
      } else { // both have flipped and the game has started
        let currentGameData = await getGameData(game.gameID);
        if (!game.deals) { // first turn
          if (!game.player.atBat && playerState.visitorID == game.firstPlayer) {     
            console.log('DEALING a', game.atBat, 'to player on first turn');
            dealDie('player', game.atBat);
          } else if (!game.opponent.atBat) {
            console.log('DEALING a', game.atBat, 'to opponent on first turn');
            dealDie('opponent', game.atBat);
          }          
        } else {
          // 2nd turn onward
          console.log('new data', currentGameData)
          console.log('game.player.atBat', game.player.atBat);
          console.log('currentGameData.currentTurn', currentGameData.playerTurn);
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

// document.documentElement.style.setProperty('--die-animation-speed', userPreferences.animationSpeed + 'ms');

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
  let modal = document.getElementById('coin-flip-modal');
  if (modal.classList.contains('showing')) {
    return;
  }
  console.log('game obj is', game)
  console.warn('CALLING COIN MODAL', firstTurnID);
  modal.style.display = 'flex';
  document.getElementById('coin-name').textContent = playerState.userName;
  await pause(100);
  modal.classList.add('showing');
  await pause(userPreferences.animationSpeed);
  let coin = document.getElementById('coin');
  let flipCount = 5;
  while (flipCount) {
    coin.classList.add('turned');
    await pause(100);
    if (flipCount % 2 === 0) {
      document.getElementById('coin-name').textContent = playerState.userName;
    } else {
      document.getElementById('coin-name').textContent = game.opponent.userName;
    }
    coin.classList.remove('turned');
    await pause(100);
    if (flipCount <= 4 && document.getElementById('coin-name').textContent === contestantWithID(firstTurnID).userName) {
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
  let modal = document.getElementById('confirm-game-modal');
  if (modal.classList.contains('showing')) {
    return;
  }
  console.error('CALLING CONFIRM MODAL')
  document.getElementById('lobby-screen').classList.add('blurred');
  modal.style.display = 'flex';
  document.getElementById('player-confirm-name').textContent = playerState.userName;
  document.getElementById('opponent-confirm-name').textContent = opponent.userName;
  await pause(50);
  modal.classList.add('showing');
  if (playerState.initiator) {
    console.green('CREATING GAME');
    let newGame = await createGame([playerState.visitorID, opponent.visitorID]);
    console.log('game?', newGame);
    let firstTurnID = parseInt(newGame[1]);
    game.gameID = newGame[0];
    if (playerState.visitorID == firstTurnID) {
      game.firstPlayer = firstTurnID;
      game.secondPlayer = opponent.visitorID;
    } else {
      game.firstPlayer = opponent.visitorID;
      game.secondPlayer = firstTurnID;
    }
    game.currentTurn = game.firstPlayer;
    game.atBat = parseInt(newGame[2]);

    console.log('now local game obj is', game);
    document.getElementById('player-check').classList.add('checked');
  } else {
    console.log('not the initiator');
  }
}
async function dismissConfirmModal() {
  let modal = document.getElementById('confirm-game-modal');
  modal.classList.remove('showing');
  document.getElementById('lobby-screen').classList.remove('blurred');
  await pause(userPreferences.animationSpeed);
  modal.style.display = 'none';
  document.getElementById('confirm-message').textContent = 'Connecting players...';
  document.getElementById('opponent-check').classList.remove('checked');
  document.getElementById('player-check').classList.remove('checked');
}
  

export async function introduceToLobby() {
  game.player.userName = playerState.userName;
  game.singlePlayer = false;
  if (knownUser) {
    if (playerState.visitorID) { // in DB already
      console.warn('in DB already: normal handshake')
      await handshake({ visitorID: playerState.visitorID, status: playerState.status });
    } else { // has changed prefs but not entered a name
      console.warn('beginHandshake known but no ID: performInitialHandshake');
      await performInitialHandshake(playerState.userName);
    }
  } else { // nothing was in local storage
    console.warn('beginHandshake !knownUser: performInitialHandshake');
    await performInitialHandshake(playerState.userName);
  }  
}
export async function beginHandshake() {
  game.player.userName = playerState.userName;
  if (knownUser) {
    if (playerState.visitorID) { // in DB already
      console.warn('in DB already: normal handshake')
      await handshake({ visitorID: playerState.visitorID, status: playerState.status });
    } else { // has changed prefs but not entered a name
      console.warn('beginHandshake known but no ID: performInitialHandshake');
      await performInitialHandshake(playerState.userName);
    }
  } else { // nothing was in local storage
    console.warn('beginHandshake !knownUser: performInitialHandshake');
    await performInitialHandshake(playerState.userName);
  }
}

function validateName(e) {
  let enteredValue = e.target.value;
  let valid = true;
  let tooShort = enteredValue.length < 2;
  valid = !tooShort;
  document.getElementById('submit-score-button').disabled = !valid;
  e.target.value = enteredValue.replace(/\s+/g, '').slice(0, 10);
}
let dieDotSlots = [
  [5], [3, 7], [3, 5, 7], [1, 3, 7, 9], [1, 3, 5, 7, 9], [1, 3, 4, 6, 7, 9]
];
function produceDieHTML(denomination, id, dieClass) {
  let dieElement = document.createElement('div');
  dieElement.setAttribute('id', id);
  dieElement.classList.add(dieClass);
  let dotGrid = document.createElement('div');
  dieElement.classList.add('die', 'user-list', 'showing');
  dotGrid.classList.add('die-dot-grid');
  for (let i = 0; i < 9; i++) {
    dotGrid.innerHTML += `<div class='die-dot'></div>`
  }
  dieDotSlots[denomination - 1].forEach((ind) => {
    [...dotGrid.children][ind-1].classList.add('filled');
  });
  dieElement.appendChild(dotGrid);
  console.log('made element', dieElement)
  return dieElement;
}

class Die {
  constructor(denomination, targetDivQuery, lane, demo) {
    if (demo && !document.getElementById('tutorial-screen').classList.contains('showing')) {
      console.green('cancelled die creation because tutorial not showing');
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
    // let newDieHTML = `
    //   <div id="${this.elementID}" class="${dieClass}">D-${denomination}|L${lane !== undefined ? 'L' + lane : ''}-</div>
    // `;
    document.querySelector(targetDivQuery).innerHTML += newDieHTML;
    // document.querySelector(`#${this.elementID}`).innerHTML += `<p class='floating-number'>${this.elementID}</p>`;
    ;
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

async function sendMove(lane, winningMove) {
  let moveData = {
    gameID: game.gameID,
    visitorID: playerState.visitorID,
    opponentID: game.opponent.visitorID,
    chosenLane: lane,
  }
  let nextDie = await postNewMove(moveData);
  if (!winningMove) {
    dealDie('opponent', parseInt(nextDie));
  }
}

async function destroyDie(query, crosscheck) {
  console.green('destroyDie called');
  const dieElement = document.querySelector(query);
  if (!dieElement) {
    console.error('destroyDie was passed', query, 'to produce undefined document.querySelector(query)');
  }
  if (crosscheck) {
    console.green(`DESTROYING query ${query} via checkForCrossMatches`);
  }
  dieElement.classList.remove('showing');
  await pause(userPreferences.animationSpeed);
  dieElement.parentNode.removeChild(dieElement);
}



async function dealDie(contestant, denomination) {
  console.green('dealDie DEALING a', denomination, 'to', contestant);
  console.log('dealDie DEALING a', denomination, 'to', contestant);
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
  console.warn(contestant, 'ADDING DEALING a', denomination, 'to', contestant, 'lane', lane);
  if (demo && !document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('cancelled addDieToLane due to tutorial closed');
    return;
  }
  game[contestant].lanes[lane].push(denomination); // get rid of game[contestant].lanes
  let chosenLane = lane + 1;
  const newDie = new Die(denomination, `#${contestant}-area .die-lane:nth-child(${chosenLane})`, lane);
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
    // await pause(userPreferences.animationSpeed);
    if (totalDiceInPlay(contestant) === 9) {
      let winner, loser;
      if (game.player.totalScore > game.opponent.totalScore) {
        console.error('------------------- WINNER:', game.player.userName, '-', game.player.totalScore, ' vs LOSER:', game.opponent.userName, '-', game.opponent.totalScore);
        winner = 'player';
        loser = 'opponent';        
      } else if (game.player.totalScore < game.opponent.totalScore) {
        console.error('------------------- WINNER:', game.opponent.userName, '-', game.opponent.totalScore, ' vs LOSER:', game.player.userName, '-', game.player.totalScore);
        winner = 'opponent';
        loser = 'player';
      } else {
        alert(`IT'S A GODDAMNED TIE`);
      }
      if (contestant === 'player') {
        sendMove(lane, true);
      }
      await pause(100);
      document.querySelector(`#${winner}-area.turn-area`).classList.add('won');
      document.querySelector(`#${loser}-area.turn-area`).classList.add('lost');
    } else {
      if (contestant === 'player') {
        if (!game.singlePlayer) {
          sendMove(lane);
        } else {
          dealToCPU();
        }
      }
    }
  } else { 
  }
  return newDie;
}

function printLaneTotal(contestant, lane) {
  console.error('PRINTING LANE TOTALS FOR', contestant, 'LANE', lane, '-------------------')
  let laneArray = [];
  [...game[contestant].laneElements[lane]].forEach((element) => {
    laneArray.push(element.denomination);
  });
  console.log('printLaneTotal made laneArray', laneArray)
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
  const nemesis = aggressor === 'player' ? 'opponent' : 'player';
  console.green('checkForCrossMatches called by', aggressor)
  console.log('with attackingDie', attackingDie);
  console.green('----------')
  let doomedDice = [];
  let attackerElement = document.querySelector(`#${attackingDie.elementID}`);
  let oppositeLaneArray = game[nemesis].laneElements[attackingDie.lane];
  for (const dieIndex in oppositeLaneArray) { // an array which represents a lane
      let laneMember = oppositeLaneArray[dieIndex]; // a Die() object
      console.log('laneMemeber is', laneMember);
      if (attackingDie.denomination == laneMember.denomination) {
        console.error('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> MATCH!')
        console.error('attacker', attackingDie, 'and victim', laneMember);
        doomedDice.push(laneMember);
      }
    }
  console.error('checkForCrossMatches produced doomedDice', doomedDice);
  if (doomedDice.length) {
    await pause(250);
    attackerElement.classList.add('attacking');
    for (const ind in doomedDice) {
      let victimObj = doomedDice[ind];
      let victimElement = document.querySelector(`#${victimObj.elementID}`);
      victimElement.classList.add('angry');
      destroyDie(`#${victimObj.elementID}`, true);
      console.warn('before doomedDice loop', ind, 'game[nemesis].laneElements is', game[nemesis].laneElements);
      oppositeLaneArray.splice(oppositeLaneArray.indexOf(victimObj), 1);
      console.warn('after doomedDice loop', ind, 'game[nemesis].laneElements is now', game[nemesis].laneElements);
    }
    await pause(userPreferences.animationSpeed);
    attackerElement.classList.remove('attacking');
    await pause(userPreferences.animationSpeed);
    updateContestantScore(nemesis);
  }
  console.error('checkForCrossMatches END -------------------------------------');
}

function colorMatchingDice(contestant) {
  console.green('colorMatchingDice called');
  console.log('colorMatchingDice is analyzing');
  console.log(contestant, 'laneElements', game[contestant].laneElements);
  const allActiveDice = [...game[contestant].laneElements[0], ...game[contestant].laneElements[1], ...game[contestant].laneElements[2]];
  console.log(contestant, 'allActiveDice', allActiveDice);
  const organizedDice = [[], [], []];
  allActiveDice.forEach((die) => {
    const dieEl = document.querySelector(`#${die.elementID}`);
    if (organizedDice[die.lane].indexOf(die.denomination) === -1) {
      organizedDice[die.lane].push(die.denomination);
    } else {
      const numberOfDuplicates = organizedDice[die.lane].filter((e) => e === die.denomination).length;
      console.warn('colorMatchingDice found', numberOfDuplicates, 'duplicates for', die.denomination, 'in', contestant, 'lane', die.lane);
      let specialClass;
      if (numberOfDuplicates === 2) {
        specialClass = 'tripled';
      } else {
        specialClass = 'doubled';
      }
      organizedDice[die.lane].push(die.denomination);
      allActiveDice
        .filter((e) => e.elementID !== die.elementID && e.lane == die.lane && e.denomination == die.denomination)
        .forEach((match) => {
          console.log('determined', match, 'matches', die, 'class to be', specialClass);
          const matchEl = document.querySelector(`#${match.elementID}`);
          if (matchEl) {
            if (!matchEl.classList.contains(specialClass)) {
              matchEl.classList.add(specialClass);
              dieEl.classList.add(specialClass);
            } else {
              // console.warn('SKIPPING already colored', contestant, match);
            }
          } else {
            console.warn('--- match element missing!');
          }
        });
    }
  });
}

function resetGame() {
  game.player.laneElements = [[], [], []];
  game.opponent.laneElements = [[], [], []];
  [...document.querySelectorAll(`.die:not(.options):not(.user-list)`)].forEach((die) => {
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

// document.body.addEventListener('fullscreenchange', async (e) => {
//   console.log(e);
//   if (document.fullscreenElement) {
//     document.getElementById('full-screen-switch').classList.add('on');
//   } else {
//     document.documentElement.style.setProperty('--actual-height', `${initialHeight}px`);
//     document.getElementById('full-screen-switch').classList.remove('on');
//   }
// });
// fscreen.onfullscreenchange = (e) => {
//   if (fscreen.fullscreenElement) {
//     document.getElementById('full-screen-switch').classList.add('on');
//   } else {
//     document.documentElement.style.setProperty('--actual-height', `${initialHeight}px`);
//     document.getElementById('full-screen-switch').classList.remove('on');
//   }
// }

async function toggleFullScreen() {
  let resizeTries = 0;
  if (fscreen.fullscreenElement !== null) {
    fscreen.exitFullscreen(document.body);
    document.getElementById('full-screen-switch').classList.remove('on');
    // await pause(500)
    document.documentElement.style.setProperty('--actual-height', `${initialHeight}px`);
    // document.getElementById('full-screen-off-icon').classList.add('hidden');
    // document.getElementById('full-screen-icon').classList.remove('hidden');   
  } else {
    fscreen.requestFullscreen(document.body);
    document.getElementById('full-screen-switch').classList.add('on');
    // detectScreen();
    // document.getElementById('full-screen-off-icon').classList.remove('hidden');
    // document.getElementById('full-screen-icon').classList.add('hidden');
  }
  while (window.innerHeight === initialHeight && resizeTries < 20) {
    console.warn('not grown yet!', window.innerHeight, '===', initialHeight);
    await pause(1);
    resizeTries++;
  }
  detectScreen();
}

function applyPlayerCustomizations() {
  document.getElementById('cpu-difficulty-slider').value = playerState.preferences.CPUDifficulty;
  document.getElementById('die-radius-slider').value = playerState.preferences.customizations['--die-border-radius'];
  document.getElementById('bg-color-input').value = playerState.preferences.customizations['--player-area-bg-color'];
  document.getElementById('die-color-input').value = playerState.preferences.customizations['--die-color'];
  document.getElementById('die-dot-color-input').value = playerState.preferences.customizations['--die-dot-color'];    
}

function getStorageSize() {
  let data = '';
  for (var key in window.localStorage) {
    if (window.localStorage.hasOwnProperty(key)) {
      data += window.localStorage[key];
    }
  }
  let size = data ? ((data.length * 16) / (8 * 1024)).toFixed(3) : '0';
  if (size < 1) {
    size *= 1000;
    size += ' bytes'
  } else {
    size += ' kb'
  }
  return size;
};

function storeUserState() {
  let toStore = JSON.stringify({ ...playerState});
  window.localStorage.setItem(localStorageName, toStore);
  console.log('---------> stored user', playerState);
  document.getElementById('storage-space-used').textContent = getStorageSize();
  if (document.getElementById('clear-local-storage-button').disabled) {
    document.getElementById('clear-local-storage-button').disabled = false;
  }
  

  console.log('size is', window.localStorage[localStorageName].length)
}
function loadUserState(rawData) {
  let newState = JSON.parse(rawData);
  playerState = { ...newState };
  playerState.status = 'title';
  applyPlayerCustomizations();

  let newRadius = parseFloat(playerState.preferences.customizations['--die-border-radius']);
  document.documentElement.style.setProperty('--die-border-radius', `calc(var(--die-size) * ${newRadius})`);
  document.documentElement.style.setProperty('--player-area-bg-color', playerState.preferences.customizations['--player-area-bg-color']);
  document.documentElement.style.setProperty('--die-color', playerState.preferences.customizations['--die-color']);
  document.documentElement.style.setProperty('--die-dot-color', playerState.preferences.customizations['--die-dot-color']);
  document.documentElement.style.setProperty('--player-username-font', playerState.preferences.customizations['--player-username-font']);
  // document.documentElement.style.setProperty('--die-animation-speed', playerState.preferences.animationSpeed + 'ms');
  console.warn('loaded user', playerState);
  document.getElementById('storage-space-used').textContent = getStorageSize();
  if (document.getElementById('clear-local-storage-button').disabled) {
    document.getElementById('clear-local-storage-button').disabled = false;
  }
}

function applyOpponentCustomizations() {
  console.log('applying opponent prefs', game.opponent.preferences.customizations);
  let newRadius = parseFloat(game.opponent.preferences.customizations['--die-border-radius']);
  document.documentElement.style.setProperty('--opponent-die-border-radius', `calc(var(--die-size) * ${newRadius})`);
  document.documentElement.style.setProperty('--opponent-area-bg-color', game.opponent.preferences.customizations['--player-area-bg-color']);
  document.documentElement.style.setProperty('--opponent-die-color', game.opponent.preferences.customizations['--die-color']);
  document.documentElement.style.setProperty('--opponent-die-dot-color', game.opponent.preferences.customizations['--die-dot-color']);
  document.documentElement.style.setProperty('--opponent-username-font', game.opponent.preferences.customizations['--player-username-font']);

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
  console.log('printlobb got messages', messagesArray)
  if (messagesArray.length === 0) {
    return;
  }
  let highestMessageID = messagesArray[messagesArray.length - 1].messageID;
  let chatWindow = document.getElementById('lobby-chat-window');
  playerState.lastMessageSeen = highestMessageID
  for (const row in messagesArray) {
    if (!forceHistory && messagesArray[row].messageID < playerState.lastMessageSeen) {
      console.error('ABOUT TO REPRINT A SEEN MESSAGE! highestmessageID', highestMessageID, 'when lastmessseen', playerState.lastMessageSeen);
    } else {
      let messageRow = messagesArray[row];
      let preferences = await getOpponentCustomizations(messageRow.visitorID);
      let rawDate = new Date(messageRow.timePosted);
      let convertedTime = rawDate.toLocaleString([], { hour: 'numeric', minute: 'numeric', hour12: true });
      let timeOfDay = `${convertedTime.slice(0, -3)} ${convertedTime.slice(-2).toLowerCase()}`;
      let messageClass = parseInt(messageRow.visitorID) === playerState.visitorID ? 'chat-message self' : 'chat-message';
      let rowHTML = `
        <div id="${messageRow.messageID}" class="${messageClass}">
          <div><span style="font-family: ${preferences.customizations['--player-username-font']}">${messageRow.userName}</span> (#${messageRow.visitorID})</div>
          <div>message #${messageRow.messageID}</div>
          <div>${convertToPlain(messageRow.message)}</div>
          <div>${timeOfDay}</div>
        </div>
      `;
      chatWindow.innerHTML += rowHTML;      
    }
  };
  // playerState.lastMessageSeen = highestMessageID;
  chatWindow.scrollTop = chatWindow.scrollHeight;
  if (!forceHistory) {
    storeUserState();
  }
  if (document.getElementById('chat-submit-button').disabled) {
    document.getElementById('chat-submit-button').disabled = false;
  }
}

async function getOpponentCustomizations(opponentID) {
  console.log('querying for prefs of', opponentID)
  console.log(opponentID)
  let response = await axios({
    method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/getopponentcustomizations.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: {
      visitorID: parseInt(opponentID),
    },
  });
  console.log('raw is', response)
  const preferences = JSON.parse(response.data.preferences);
  return preferences;
  // game.opponent.preferences = preferences;
  // applyOpponentCustomizations();
}

async function postNewMove(moveData) {
  console.error(game.player.userName, 'posting move', moveData);
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
async function getUsersFromDatabase(initial) {
  console.warn('CALLING getUsersFromDatabase');
  let response = await axios({
    method: 'get',
    url: 'https://mikedonovan.dev/kbones/php/getusers.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    }
  });
  console.log('getUsers got', response.data)
  queryTimes.users = Date.now();  
  const usersArray = [...response.data];
  usersArray.forEach((row, i, self) => {
    self[i] = JSON.parse(row);
    self[i].preferences = JSON.parse(self[i].preferences);
  });
  if (initial) {
    // document.getElementById('enter-lobby-button').disabled = false;
  }
  console.log('getUsers parsed', usersArray)
  return usersArray;
}
async function getReadyUsers() {
  console.warn('CALLING getReadyUsers');
  queryTimes.users = Date.now();
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
  return usersArray;
}
async function getLobbyMessages(forceHistory=0) {
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
  console.log(messagesArray)
  return messagesArray.reverse();
}
async function sendLobbyMessage(message) {
  
  let messageData = {
    userName: playerState.userName,
    visitorID: playerState.visitorID,
    message: message
  }
  console.log('sending lobby message', messageData)
  messageData = JSON.stringify(messageData);
  let response = await axios({
     method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/sendlobbymessage.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: messageData
  });
  // await printLobbyMessages();
  console.log(response);
  return response;
}

async function sendPreferences(preferences) {
  if (!playerState.visitorID) {
    console.log('no visitorID associated');
    return;
  }
  const response = await axios({
    method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/sendpreferences.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: JSON.stringify({
      visitorID: playerState.visitorID,
      preferences: JSON.stringify(preferences),
    }),
  });
  return response;
}
async function changeUserName(newName) {
  const response = await axios({
    method: 'post',
    url: 'https://mikedonovan.dev/kbones/php/changeusername.php',
    headers: {
      'Content-type': 'application/x-www-form-urlencoded',
    },
    data: JSON.stringify({
      visitorID: playerState.visitorID,
      newName: newName
    }),
  });
  console.log('changed name?', response.data);
  document.getElementById('user-list').innerHTML = '';  
  document.getElementById('demo-username').textContent = newName;
}
async function handshake(shakeData) {
  shakeData.latency = playerState.latency;
  console.warn('shaking with', shakeData);
  queryTimes.handshake = Date.now();
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
  document.getElementById('debug').innerHTML = 'ping: ' + shakeTime;
  console.warn('got shakeResult', shakeResult.data + ' in ' + shakeTime);
  playerState.latency = shakeTime;
  return shakeResult.data
}

document.getElementById('enter-lobby-button').addEventListener('click', async () => {
  console.log('playerstate when enter lobby clicked:', playerState)
  let nameEntered = document.getElementById('name-entry-field').value;
  nameEntered = convertToPlain(document.getElementById('name-entry-field').value);
  if (nameEntered.trim().length < 2 || nameEntered.trim().length > 18) {
    return;
  }
  if (knownUser) {
    if (playerState.visitorID) {
      if (playerState.userName !== nameEntered) {        
        console.error('known visitor changing name', playerState.userName, 'to', nameEntered);
        playerState.userName = nameEntered;
        storeUserState();
        await changeUserName(nameEntered);
        document.getElementById('user-list').innerHTML = ''; // only need to remove self
        await reportNewStatus('lobby');
        await populateUserList();
      } else {
        console.log('known same-named user calling populate');
        await reportNewStatus('lobby');
        await populateUserList();    
      }
    } else {
      playerState.userName = nameEntered;
      console.warn('known but no ID: performInitialHandshake');
      playerState.status = 'lobby';
      await performInitialHandshake(playerState.userName);  
    }
  } else {
    playerState.userName = nameEntered;
    console.warn('completely unknown: performInitialHandshake');
    playerState.status = 'lobby';
    await performInitialHandshake(playerState.userName);
  }
  

  document.getElementById('cpu-game-back-button').style.display = 'none';
  document.getElementById('lobby-screen').classList.remove('hidden');
  await pause(100);
  document.getElementById('title-screen').classList.add('hidden');
  await pause(100);
  document.getElementById('title-screen').style.display = 'none';
  console.log('finished func')
});
document.getElementById('name-entry-field').addEventListener('input', (e) => {
  let trimmed = e.target.value.trim(); 
  if (trimmed.length > 2) {
    document.getElementById('enter-lobby-button').disabled = false;
    const previewString = convertToPlain(trimmed);
    document.getElementById('demo-username').textContent = previewString;
  } else {
    document.getElementById('demo-username').textContent = 'Player';
    document.getElementById('enter-lobby-button').disabled = true;
  }
  // e.target.value = e.target.value.trim();
});

// let knownUser = window.localStorage.getItem(localStorageName);
// assimilateKnownUser();

async function assimilateKnownUser() {
  if (knownUser) {
    loadUserState(knownUser);
    console.log('assimilate found playerstate', playerState)
    if (playerState.visitorID) {
      console.green('KNOWN VISITOR (has entered a username)');
      document.getElementById('name-entry-field').value = playerState.userName;
      document.getElementById('enter-lobby-button').disabled = false;
      document.getElementById('demo-username').textContent = playerState.userName;
      reportNewStatus('title');
      document.getElementById('known-user-confirmation').textContent = `Recognized as user #${playerState.visitorID}`;
      // console.log('updating list again to print own data before clicking to lobby');
      // populateUserList();
    } else {
      console.green('KNOWN USER (has adjusted preferences only)');
      document.getElementById('enter-lobby-button').disabled = true;
      document.getElementById('name-entry-field').placeholder = 'Enter a name';
    }
  } else {
    console.green('UNKNOWN USER (never adjusted or entered a username)');
    document.getElementById('enter-lobby-button').disabled = true;
    document.getElementById('name-entry-field').placeholder = 'Enter a name';
  }
}

function createTitleDie() {
  let titleDie = new Die(5, '#title-screen', 0);
  document.querySelector(`#${titleDie.elementID}`).classList.add('title-die');
  setTimeout(() => {
    document.getElementById('title-screen').removeChild(document.querySelector(`#${titleDie.elementID}`));
  }, 900);
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

async function dealToCPU() {
  dealDie('opponent', randomInt(1, 6));
  await pause(userPreferences.animationSpeed + userPreferences.CPUTurnSpeed);
  makeCPUMove();
}

async function makeCPUMove() {
  let availableLanes = [];
  game.opponent.laneElements.forEach((arr, i) => {
    if (arr.length < 3) availableLanes.push(i);
  });
  let chosenLane = availableLanes[randomInt(0, availableLanes.length - 1)];
  await addDieToLane('opponent', game.opponent.atBat, chosenLane);
  dealDie('player', randomInt(1, 6));
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

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(500);

  new Die(5, `#player-area .new-die-box`);
  document.querySelector(`#player-area .new-die-box`).classList.add('highlighted');
  await pause(500);

  let playerLanes = [...document.querySelectorAll(`#player-area .die-lane`)];

  for (const lane in playerLanes) {
    playerLanes[lane].classList.add('tutorial-flash');
    await pause(400);
  }

  await pause(600);

  document.querySelector(`#player-area .new-die-box`).classList.remove('highlighted');

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await addDieToLane('player', 5, 1, true);
  for (const lane in playerLanes) {
    playerLanes[lane].classList.remove('tutorial-flash');
    await pause(400);
  }

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  document.getElementById('tutorial-top-text-area').innerHTML = '';
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

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
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
  document.getElementById('tutorial-top-text-area').innerHTML = '';
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

  document.querySelector('#player-area .die-lane:nth-child(1)').classList.add('tutorial-highlight');
  
  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }
  
  await pause(1200);
  
  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(1200);

  document.querySelector('#player-area .die-lane:nth-child(1)').classList.remove('tutorial-highlight');

  let secondFour = await addDieToLane('player', 4, 0, true);

  await pause(500);
  document.getElementById('tutorial-top-text-area').innerHTML = '';
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

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(500);

  document.getElementById('' + firstFour.elementID).classList.add('doubled');
  document.getElementById(secondFour.elementID).classList.add('doubled');
  await pause(userPreferences.animationSpeed);
  document.getElementById('' + firstFour.elementID).classList.remove('doubled');
  document.getElementById(secondFour.elementID).classList.remove('doubled');
  await pause(userPreferences.animationSpeed);
  document.getElementById('' + firstFour.elementID).classList.add('doubled');
  document.getElementById(secondFour.elementID).classList.add('doubled');
  await pause(userPreferences.animationSpeed);
  document.getElementById('' + firstFour.elementID).classList.remove('doubled');
  document.getElementById(secondFour.elementID).classList.remove('doubled');
  await pause(userPreferences.animationSpeed);
  document.getElementById('' + firstFour.elementID).classList.add('doubled');
  document.getElementById(secondFour.elementID).classList.add('doubled');

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(500);

  new Die(4, `#player-area .new-die-box`, true);

  document.getElementById('tutorial-top-text-area').innerHTML = '';
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

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(500);

  let thirdFour = await addDieToLane('player', 4, 0, true);
  document.getElementById('' + firstFour.elementID).classList.remove('doubled');
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

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(1000);  

  let attackingDie = await playDemoTurn('player', 3, 2);

  document.getElementById('tutorial-top-text-area').innerHTML = '';
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

  document.querySelector('#opponent-area .die-lane:nth-child(3)').classList.add('tutorial-highlight');
  document.querySelector('#player-area .die-lane:nth-child(3)').classList.add('tutorial-highlight');

  await pause(1200);

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }
  
  await pause(1200);

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }
  
  document.querySelector('#opponent-area .die-lane:nth-child(3)').classList.remove('tutorial-highlight');
  document.querySelector('#player-area .die-lane:nth-child(3)').classList.remove('tutorial-highlight');

    
  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }  

  await pause(500);

  document.getElementById('tutorial-top-text-area').innerHTML = '';
  await typeSentence(
    '#tutorial-top-text-area',
    'typed-sentence',
    [
      {
        string: 'All',
        sectionClass: 'bold',
      },
      {
        string: 'of their matching dice in that lane',
      },
      {
        string: 'are destroyed.',
        sectionClass: 'bold',
      },
    ],
    tutorialTypeSpeed
  );

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(500);
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
  document.querySelector('#opponent-area .die-lane-total:nth-child(3)').innerHTML = '4';

  await pause(500);

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  document.getElementById('tutorial-top-text-area').innerHTML = '';
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

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }

  await pause(1000);

  await playDemoTurn('opponent', 3, 1);
   document.querySelector('#opponent-area .die-lane-total:nth-child(3)').innerHTML = '4';
  await pause(200);
  await playDemoTurn('player', 4, 1);
   document.querySelector('#opponent-area .die-lane-total:nth-child(3)').innerHTML = '4';
  await pause(200);
  await playDemoTurn('opponent', 3, 0);
   document.querySelector('#opponent-area .die-lane-total:nth-child(3)').innerHTML = '4';
  await pause(200);
  await playDemoTurn('player', 1, 2);
   document.querySelector('#opponent-area .die-lane-total:nth-child(3)').innerHTML = '4';
  await pause(200);
  await playDemoTurn('opponent', 2, 1);
   document.querySelector('#opponent-area .die-lane-total:nth-child(3)').innerHTML = '4';
  await pause(200);
  await playDemoTurn('player', 2, 2);
   document.querySelector('#opponent-area .die-lane-total:nth-child(3)').innerHTML = '4';

  if (!document.getElementById('tutorial-screen').classList.contains('showing')) {
    console.log('--------------canceled demo!!');
    return;
  }
  
  await pause(500);

  document.getElementById('opponent-area').classList.add('lost');
  document.getElementById('player-area').classList.add('won');

  // show 'play again' button?
}

async function playDemoTurn(contestant, denomination, lane, dealPlayGap=500) {
  if (document.getElementById('tutorial-screen').classList.contains('showing')) {
    new Die(denomination, `#${contestant}-area .new-die-box`, true);
    document.querySelector(`#${contestant}-area .new-die-box`).classList.add('highlighted');
    await pause(dealPlayGap);
    document.querySelector(`#${contestant}-area .new-die-box`).classList.remove('highlighted');
    let newDie = await addDieToLane(contestant, denomination, lane, true);
    return newDie;
  } else {
    console.log('skipped demo turn due to no tutorial')
  }
  
}

function printShimmeryLine(string, speed) {
  let lineElement = document.createElement('div');
  lineElement.classList.add('line-container');
  let charArray = string.split('');
  for (const ind in charArray) {
    let char = charArray[ind];
    let charElement = document.createElement('div');
    charElement.classList.add('square');
    // if (char === ' ') {
    //   char = '&nbsp;';
    // }
    // charElement.innerHTML = `<p>${char}</p>`;
    charElement.classList.add('shimmery');
    let delay = `${ind * speed}ms`;
    charElement.style.setProperty('animation-delay', delay);
    lineElement.appendChild(charElement);
  }
  return lineElement;
}
async function test() {
   console.warn('CALLING test');

   let response = await axios({
     method: 'get',
     url: 'https://eggborne.com/namegenerator/php/getallrulesets.php',
     headers: {
       'Content-type': 'application/x-www-form-urlencoded',
     },
   });
   console.log('GOT test', response.data);
}
function getElementPosition(obj) {
  var curleft = 0,
    curtop = 0;
  if (obj.offsetParent) {
    do {
      curleft += obj.offsetLeft;
      curtop += obj.offsetTop;
    } while ((obj = obj.offsetParent));
    return { x: curleft, y: curtop };
  }
  return undefined;
}

function getEventLocation(element, event) {
  let pos = getElementPosition(element);
  let scrollAmount = document.getElementById('options-body').scrollTop
  let adjustedPos = {
    x: event.pageX - pos.x,
    y: event.pageY - pos.y + scrollAmount,
  };
  return adjustedPos;
}

function rgbToHex(r, g, b) {
  if (r > 255 || g > 255 || b > 255) throw 'Invalid color component';
  return ((r << 16) | (g << 8) | b).toString(16);
}

// let loadLine = printShimmeryLine('..........', 25);
// document.getElementById('transfer-icon').appendChild(loadLine);
