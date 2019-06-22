#!/usr/bin/env node

var http = require('http');
var url = require('url');
var fs = require('fs');

// Written for GitHub's Noops Challenge (Mazebot)
// https://github.com/noops-challenge/mazebot

const apiGet = async (path, parameters = {}) => {
  let query = url.format({query: parameters});
  return new Promise((resolve, reject) => {
    http.get('http://api.noopschallenge.com/' + path + query, function(res) {
      const { statusCode } = res;

      if (statusCode < 200 || statusCode > 299) {
        reject(new Error('API Response failure: ' + statusCode));
      }

      res.setEncoding('utf8');

      let data = '';

      res.on('data', (chunk) => { data += chunk; } );

      res.once('end', function() {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Failed to parse JSON'));
        }
      })
    })
  })
};

const fromFile = async (number) => {
  return new Promise((resolve, reject) => {
    fs.readFile('./mazes/' + number + '.json', (err, data) => {
      if (err) { reject(err) };
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e)
      }
    });
  });
};

const logMaze = (map, path) => {
  let m = map;
  if (path) {
    for (let f of path) {
      if (m[f[0]][f[1]] == ' ') {
        m[f[0]][f[1]] = '.';
      }
    }
  }
  for (let row of m) {
    console.log(row.join(''));
  }
};

const solve = (map, start, end) => {
  const heuristic = (n, goal) => {
    return Math.abs(goal[0] - n[0]) + Math.abs(goal[1] - n[1]);
  }

  let evaluated = {};
  let discovered = {};
  discovered[start] = 1;
  let cameFrom = {};
  let startToNode = {}; // gScore
  startToNode[start] = 0;

  let startToGoal = {}; // fScore
  startToGoal[start] = heuristic(start,end);

  let path = [];
  let directions = [];

  const nextNode = (discoveredNodes) => {
    const keys = Object.keys(discoveredNodes).filter(k => discoveredNodes[k] !== undefined);
    let lowestNode = keys[0];
    let lowestScore = startToGoal[lowestNode];
    for (let i = 1; i < keys.length; i++) {
      let node = keys[i];
      let nodeScore = startToGoal[node];

      if (nodeScore < lowestScore) {
        lowestNode = node;
        lowestScore = nodeScore;
      }
    }
    // Convert string back to array
    return lowestNode.split(',').map(i => Number.parseInt(i));
  };

  const neighbors = (node) => {
    let n = node;
    return [
      [ n[0], n[1]+1],
      [ n[0], n[1]-1],
      [ n[0]+1, n[1]],
      [ n[0]-1, n[1]]
    ].filter((r) => {
      return r[0] < map.length &&
        r[0] >= 0 &&
        r[1] < map.length &&
        r[1] >= 0 &&
        map[r[0]][r[1]] != 'X';
    });
  };

  const toPath = (cameFromNodes, currentNode) => {
    let totalPath = [currentNode];
    for (let i = 0; i < Object.keys(cameFromNodes).length; i++) {
      currentNode = cameFromNodes[currentNode];
      if (currentNode === undefined) {
        break;
      }
      totalPath.push(currentNode);
    }

    return totalPath.reverse()
  };

  const toCompass = (path) => {
    const length = path.length;
    let directions = [];
    for (let i = 0; i < length; i++) {
      let node = path[i];
      let nextNode = path[i+1];

      if (nextNode === undefined) break;

      let ns = nextNode[0] - node[0];
      let ew = nextNode[1] - node[1];

      if (ns == 0) {
        if (ew == 1) {
          // East
          directions.push('E');
        } else {
          // West
          directions.push('W');
        }
      } else {
        if (ns == 1) {
          // South
          directions.push('S');
        } else {
          // North
          directions.push('N');
        }
      }
    }

    return directions;
  };

  while (Object.values(discovered).some(v => v !== undefined)) {
    let current = nextNode(discovered);
    if (current[0] == end[0] && current[1] == end[1]) {
      //console.log('Found the end');
      path = toPath(cameFrom, current);
      directions = toCompass(path);
      break;
    }

    // Remove the current node from discovered nodes
    discovered[current] = undefined;

    // Add it to evaluated nodes
    evaluated[current] = 1;

    for (let n of neighbors(current)) {
      if (evaluated[n] !== undefined) {
        continue;
      }

      // Distance from start to neighbor
      // We add one because we can only move one unit at a time.
      tentativeStartToNodeScore = startToNode[current] + 1

      if (discovered[n] === undefined)  {
        discovered[n] = 1;
      } else if (tentativeStartToNodeScore >= startToNode[n]) {
        continue;
      }

      // This is the best path so far, save it
      cameFrom[n] = current;
      startToNode[n] = tentativeStartToNodeScore;
      startToGoal[n] = startToNode[n] + heuristic(n, end);
    }
  }

  return {
    directions: directions,
    path: path
  }
};

async function main() {
  let online = true;
  let onlineParams = {
    maxSize: 200,
    //minSize: 200
  };
  let saveMaze = false && online;
  let localNumber = 417;
  let maze = '';

  // [  0 0 0 0 0 0
  //    0 1 2 3 4 5
  // 0 [X, , ,X,X,X],
  // 1 [X, ,., ,X,X],
  // 2 [X, , , , ,X]
  // ]
  // . = 1, 2
  // N = [-1,0]
  // S = [1,0]
  // E = [0,1]
  // W = [0,-1]

  if (online) {
    maze = await apiGet('mazebot/random', onlineParams).catch(err => {
      console.log(err);
      process.exit(1);
    });
  } else {
    maze = await fromFile(localNumber).catch(err => {
      console.log(err);
      process.exit(1);
    });
  }

  let { name, map, startingPosition, endingPosition, mazePath } = maze;
  // Starting and ending positions are given backwards?
  startingPosition = [startingPosition[1], startingPosition[0]];
  endingPosition = [endingPosition[1], endingPosition[0]];

  let number = name.match(/#(\d+)/)[1];

  if (saveMaze) {
    fs.writeFile('./mazes/' + number + '.json', JSON.stringify(maze), (err) => {
      if (err) console.log(err);
    });
  }

  console.log(name);

  let { directions, path } = solve(map, startingPosition, endingPosition);

  // Print solution
  logMaze(map, path);
}

main();
