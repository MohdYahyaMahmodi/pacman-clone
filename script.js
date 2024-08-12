import { map, CELL_SIZE, PACMAN_SIZE, GHOST_SIZE } from './map.js';

const WALL = 0;
const COIN = 1;
const EMPTY = 2;
const POWER_PELLET = 3;

const DIRECTIONS = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }
};

const gameBoard = document.getElementById('game-board');
const scoreElement = document.getElementById('score-value');
const livesElement = document.getElementById('lives-value');
const levelElement = document.getElementById('level-value');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const restartButton = document.getElementById('restart-button');

let score = 0;
let lives = 3;
let level = 1;
let pacman = { x: 1, y: 1, direction: 'ArrowRight' };
let ghosts = [
    { x: 13, y: 11, name: 'blinky', direction: 'ArrowUp', mode: 'scatter', target: { x: 27, y: 0 } },
    { x: 14, y: 11, name: 'pinky', direction: 'ArrowUp', mode: 'scatter', target: { x: 0, y: 0 } },
    { x: 13, y: 13, name: 'inky', direction: 'ArrowDown', mode: 'scatter', target: { x: 27, y: 30 } },
    { x: 14, y: 13, name: 'clyde', direction: 'ArrowDown', mode: 'scatter', target: { x: 0, y: 30 } }
];
let powerPelletActive = false;
let powerPelletTimer = null;
let gameInterval = null;
let paused = false;

function createGameBoard() {
    gameBoard.innerHTML = '';
    gameBoard.style.width = `${map[0].length * CELL_SIZE}px`;
    gameBoard.style.height = `${map.length * CELL_SIZE}px`;

    for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            
            switch (map[y][x]) {
                case WALL:
                    cell.classList.add('wall');
                    break;
                case COIN:
                    cell.classList.add('coin');
                    break;
                case POWER_PELLET:
                    cell.classList.add('coin', 'power-pellet');
                    break;
            }
            
            gameBoard.appendChild(cell);
        }
    }
}

function updateGameBoard() {
    const cells = gameBoard.children;
    for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
            const index = y * map[0].length + x;
            cells[index].className = 'cell';
            
            switch (map[y][x]) {
                case WALL:
                    cells[index].classList.add('wall');
                    break;
                case COIN:
                    cells[index].classList.add('coin');
                    break;
                case POWER_PELLET:
                    cells[index].classList.add('coin', 'power-pellet');
                    break;
            }
        }
    }
    
    // Update Pac-Man
    let pacmanElement = document.getElementById('pacman');
    if (!pacmanElement) {
        pacmanElement = document.createElement('div');
        pacmanElement.id = 'pacman';
        pacmanElement.classList.add('pacman');
        gameBoard.appendChild(pacmanElement);
    }
    pacmanElement.style.left = `${pacman.x * CELL_SIZE}px`;
    pacmanElement.style.top = `${pacman.y * CELL_SIZE}px`;
    pacmanElement.style.transform = `rotate(${getPacmanRotation(pacman.direction)}deg)`;
    
    // Update ghosts
    ghosts.forEach((ghost, index) => {
        let ghostElement = document.getElementById(`ghost-${index}`);
        if (!ghostElement) {
            ghostElement = document.createElement('div');
            ghostElement.id = `ghost-${index}`;
            ghostElement.classList.add('ghost');
            gameBoard.appendChild(ghostElement);
        }
        ghostElement.style.left = `${ghost.x * CELL_SIZE}px`;
        ghostElement.style.top = `${ghost.y * CELL_SIZE}px`;
        ghostElement.style.backgroundColor = getGhostColor(ghost);
    });
}

function getPacmanRotation(direction) {
    switch (direction) {
        case 'ArrowRight': return 0;
        case 'ArrowDown': return 90;
        case 'ArrowLeft': return 180;
        case 'ArrowUp': return 270;
    }
}

function getGhostColor(ghost) {
    if (powerPelletActive) return '#0000FF';
    switch (ghost.name) {
        case 'blinky': return '#FF0000';
        case 'pinky': return '#FFB8FF';
        case 'inky': return '#00FFFF';
        case 'clyde': return '#FFB852';
    }
}

function movePacman() {
    const newX = pacman.x + DIRECTIONS[pacman.direction].x;
    const newY = pacman.y + DIRECTIONS[pacman.direction].y;
    
    if (map[newY][newX] !== WALL) {
        pacman.x = newX;
        pacman.y = newY;
        
        if (map[newY][newX] === COIN) {
            map[newY][newX] = EMPTY;
            score += 10;
            scoreElement.textContent = score;
        } else if (map[newY][newX] === POWER_PELLET) {
            map[newY][newX] = EMPTY;
            score += 50;
            scoreElement.textContent = score;
            activatePowerPellet();
        }
        
        // Handle tunnel
        if (newX < 0) pacman.x = map[0].length - 1;
        if (newX >= map[0].length) pacman.x = 0;
        
        updateGameBoard();
        checkCollision();
        
        if (checkLevelComplete()) {
            levelUp();
        }
    }
}

function moveGhosts() {
    ghosts.forEach(ghost => {
        const newDirection = getGhostDirection(ghost);
        const newX = ghost.x + DIRECTIONS[newDirection].x;
        const newY = ghost.y + DIRECTIONS[newDirection].y;
        
        if (map[newY][newX] !== WALL) {
            ghost.x = newX;
            ghost.y = newY;
            ghost.direction = newDirection;
        }
        
        // Handle tunnel
        if (ghost.x < 0) ghost.x = map[0].length - 1;
        if (ghost.x >= map[0].length) ghost.x = 0;
    });
    
    updateGameBoard();
    checkCollision();
}

function getGhostDirection(ghost) {
    const possibleDirections = Object.keys(DIRECTIONS).filter(dir => {
        const newX = ghost.x + DIRECTIONS[dir].x;
        const newY = ghost.y + DIRECTIONS[dir].y;
        return map[newY][newX] !== WALL;
    });

    if (powerPelletActive) {
        // Run away from Pacman
        return possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
    }

    // Calculate distances to target for each possible direction
    const distances = possibleDirections.map(dir => {
        const newX = ghost.x + DIRECTIONS[dir].x;
        const newY = ghost.y + DIRECTIONS[dir].y;
        const dx = ghost.target.x - newX;
        const dy = ghost.target.y - newY;
        return dx * dx + dy * dy;
    });

    // Choose the direction with the shortest distance to target
    const minDistance = Math.min(...distances);
    const bestDirections = possibleDirections.filter((_, index) => distances[index] === minDistance);
    return bestDirections[Math.floor(Math.random() * bestDirections.length)];
}

function checkCollision() {
    ghosts.forEach(ghost => {
        if (ghost.x === pacman.x && ghost.y === pacman.y) {
            if (powerPelletActive) {
                // Eat the ghost
                resetGhost(ghost);
                score += 200;
                scoreElement.textContent = score;
            } else {
                // Pacman loses a life
                lives--;
                livesElement.textContent = lives;
                
                if (lives === 0) {
                    endGame();
                } else {
                    resetPositions();
                }
            }
        }
    });
}

function resetGhost(ghost) {
    ghost.x = 13;
    ghost.y = 11;
    ghost.mode = 'scatter';
}

function resetPositions() {
    pacman = { x: 1, y: 1, direction: 'ArrowRight' };
    ghosts = [
        { x: 13, y: 11, name: 'blinky', direction: 'ArrowUp', mode: 'scatter', target: { x: 27, y: 0 } },
        { x: 14, y: 11, name: 'pinky', direction: 'ArrowUp', mode: 'scatter', target: { x: 0, y: 0 } },
        { x: 13, y: 13, name: 'inky', direction: 'ArrowDown', mode: 'scatter', target: { x: 27, y: 30 } },
        { x: 14, y: 13, name: 'clyde', direction: 'ArrowDown', mode: 'scatter', target: { x: 0, y: 30 } }
      ];
      updateGameBoard();
  }
  
  function activatePowerPellet() {
      powerPelletActive = true;
      ghosts.forEach(ghost => ghost.mode = 'frightened');
      clearTimeout(powerPelletTimer);
      powerPelletTimer = setTimeout(() => {
          powerPelletActive = false;
          ghosts.forEach(ghost => ghost.mode = 'chase');
      }, 10000);
  }
  
  function startGame() {
      if (!gameInterval) {
          gameInterval = setInterval(() => {
              if (!paused) {
                  movePacman();
                  updateGhostTargets();
                  moveGhosts();
              }
          }, 200);
          startButton.textContent = 'Restart';
          startModeChanges();
      } else {
          resetGame();
      }
  }
  
  function pauseGame() {
      paused = !paused;
      pauseButton.textContent = paused ? 'Resume' : 'Pause';
  }
  
  function resetGame() {
      clearInterval(gameInterval);
      gameInterval = null;
      stopModeChanges();
      score = 0;
      lives = 3;
      level = 1;
      paused = false;
      powerPelletActive = false;
      clearTimeout(powerPelletTimer);
      
      scoreElement.textContent = score;
      livesElement.textContent = lives;
      levelElement.textContent = level;
      pauseButton.textContent = 'Pause';
      startButton.textContent = 'Start Game';
      
      resetPositions();
      resetCoins();
      createGameBoard();
      updateGameBoard();
  }
  
  function resetCoins() {
      for (let y = 0; y < map.length; y++) {
          for (let x = 0; x < map[y].length; x++) {
              if (map[y][x] === EMPTY) {
                  map[y][x] = COIN;
              }
          }
      }
  }
  
  function endGame() {
      clearInterval(gameInterval);
      gameInterval = null;
      alert(`Game Over! Your score: ${score}`);
      resetGame();
  }
  
  function checkLevelComplete() {
      for (let y = 0; y < map.length; y++) {
          for (let x = 0; x < map[y].length; x++) {
              if (map[y][x] === COIN || map[y][x] === POWER_PELLET) {
                  return false;
              }
          }
      }
      return true;
  }
  
  function levelUp() {
      level++;
      levelElement.textContent = level;
      resetPositions();
      resetCoins();
      createGameBoard();
      updateGameBoard();
      // Increase ghost speed or adjust difficulty here
  }
  
  function updateGhostTargets() {
      ghosts.forEach(ghost => {
          switch (ghost.mode) {
              case 'scatter':
                  // Use predefined scatter targets
                  break;
              case 'chase':
                  if (ghost.name === 'blinky') {
                      ghost.target = { x: pacman.x, y: pacman.y };
                  } else if (ghost.name === 'pinky') {
                      const offset = 4;
                      ghost.target = {
                          x: pacman.x + DIRECTIONS[pacman.direction].x * offset,
                          y: pacman.y + DIRECTIONS[pacman.direction].y * offset
                      };
                  } else if (ghost.name === 'inky') {
                      const blinky = ghosts.find(g => g.name === 'blinky');
                      const offset = 2;
                      const pivotX = pacman.x + DIRECTIONS[pacman.direction].x * offset;
                      const pivotY = pacman.y + DIRECTIONS[pacman.direction].y * offset;
                      ghost.target = {
                          x: pivotX + (pivotX - blinky.x),
                          y: pivotY + (pivotY - blinky.y)
                      };
                  } else if (ghost.name === 'clyde') {
                      const distance = Math.sqrt(Math.pow(ghost.x - pacman.x, 2) + Math.pow(ghost.y - pacman.y, 2));
                      if (distance > 8) {
                          ghost.target = { x: pacman.x, y: pacman.y };
                      } else {
                          ghost.target = ghost.scatterTarget;
                      }
                  }
                  break;
              case 'frightened':
                  // Random movement, no specific target
                  ghost.target = { x: Math.floor(Math.random() * map[0].length), y: Math.floor(Math.random() * map.length) };
                  break;
          }
      });
  }
  
  let modeChangeInterval;
  const modeDurations = [
      { mode: 'scatter', duration: 7000 },
      { mode: 'chase', duration: 20000 },
      { mode: 'scatter', duration: 7000 },
      { mode: 'chase', duration: 20000 },
      { mode: 'scatter', duration: 5000 },
      { mode: 'chase', duration: 20000 },
      { mode: 'scatter', duration: 5000 },
      { mode: 'chase', duration: Infinity }
  ];
  
  function startModeChanges() {
      let modeIndex = 0;
      
      function changeMode() {
          const currentMode = modeDurations[modeIndex];
          ghosts.forEach(ghost => {
              if (ghost.mode !== 'frightened') {
                  ghost.mode = currentMode.mode;
              }
          });
          
          modeIndex++;
          if (modeIndex < modeDurations.length) {
              modeChangeInterval = setTimeout(changeMode, currentMode.duration);
          }
      }
      
      changeMode();
  }
  
  function stopModeChanges() {
      clearTimeout(modeChangeInterval);
  }
  
  document.addEventListener('keydown', (event) => {
      if (DIRECTIONS.hasOwnProperty(event.code)) {
          pacman.direction = event.code;
      }
  });
  
  startButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', pauseGame);
  restartButton.addEventListener('click', resetGame);
  
  // Initial game setup
  createGameBoard();
  updateGameBoard();