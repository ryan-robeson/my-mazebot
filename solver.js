#!/usr/bin/env node

var http = require('http');
var url = require('url');
var fs = require('fs');

// Written for GitHub's Noops Challenge (Mazebot)
// https://github.com/noops-challenge/mazebot

// parameters are converted to a query string format
const apiGet = async (path, parameters = {}) => {
  let query = url.format({query: parameters});
  return new Promise((resolve, reject) => {
    http.get('http://api.noopschallenge.com' + path + query, function(res) {
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

// Assumes a JSON API.
// parameters will be JSON.stringify'd.
const apiPost = async (path, parameters = {}) => {
  const postData = JSON.stringify(parameters);

  let options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }

  return new Promise((resolve, reject) => {
    const req = http.request('http://api.noopschallenge.com' + path, options, function(res) {
      const { statusCode } = res;
      // 400 is a valid code when an incorrect solution is sent.
      if (statusCode < 200 || ( statusCode > 299 && statusCode != 400 )) {
        reject(new Error('API Response failure: ' + statusCode));
      }

      res.setEncoding('utf8');

      let data = '';

      res.on('data', chunk => { data += chunk; } );

      res.once('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse JSON: ' + e));
        }
      })
    });

    req.write(postData);
    req.end();
  })
};

const postSolution = (path, directions) => {
  if (Array.isArray(directions)) {
    directions = directions.join('');
  }
  return apiPost(path, {directions: directions});
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

// Logs the simple representation of the maze to the console.
// If `path` is given, also draws the path from start to finish.
// map - Array of Arrays describing the maze
//       (North -> South, West -> East)
// path - Array of Arrays describing the solution for the maze.
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

// Solve with A*
// Thanks Wikipedia
// See: https://en.wikipedia.org/wiki/A*_search_algorithm
const solve = (map, start, end) => {
  // heuristic is the straight line distance from
  // the given node to the goal
  const heuristic = (n, goal) => {
    return Math.abs(goal[0] - n[0]) + Math.abs(goal[1] - n[1]);
  }

  // evaluated records nodes that have been visited already
  let evaluated = {};
  // discovered records nodes that are found but have not been
  // evaluated
  let discovered = {};
  discovered[start] = 1; // Start is the only known node
  // for each node, the most efficient node that it can be reached
  // from.
  let cameFrom = {};
  // Distance from the start node to a given node.
  let startToNode = {}; // gScore
  startToNode[start] = 0; // start is zero units from start

  // Distance from the start node to the goal node through a given node.
  // Partially based on heuristic.
  let startToGoal = {}; // fScore
  startToGoal[start] = heuristic(start,end); // entirely heuristic for the start

  // The actual path through the maze => [ [1,1], [1,2], [2,2]... ]
  let path = [];
  // The compass directions through the maze => ['E','N'...]
  let directions = [];

  const nextNode = (discoveredNodes) => {
    const keys = Object.keys(discoveredNodes);
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
      [ n[0], n[1]+1 ],
      [ n[0], n[1]-1 ],
      [ n[0]+1, n[1] ],
      [ n[0]-1, n[1] ]
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

    while (cameFromNodes[currentNode]) {
      currentNode = cameFromNodes[currentNode];
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

  while (Object.keys(discovered).length > 0) {
    let current = nextNode(discovered);
    if (current[0] == end[0] && current[1] == end[1]) {
      //console.log('Found the end');
      path = toPath(cameFrom, current);
      directions = toCompass(path);
      break;
    }

    // Remove the current node from discovered nodes
    delete discovered[current];

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

const runSingle = async (online, onlineParams, saveMaze, sendSolution, localNumber) => {
  saveMaze = saveMaze && online;
  sendSolution = sendSolution && online;

  let maze = '';
  // Measure perf
  let startTime = process.hrtime.bigint();
  let endTime;

  if (online) {
    maze = await apiGet('/mazebot/random', onlineParams).catch(err => {
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

  // Measure perf
  endTime = process.hrtime.bigint();

  let measuredElapsed = endTime - startTime;
  // Convert nanoseconds to seconds
  let measuredElapsedSeconds = Number(measuredElapsed * 1000n / BigInt(1e9)) / 1000;
  console.log(`Elapsed: ${measuredElapsed}ns => ${measuredElapsedSeconds}s`);

  if (sendSolution) {
    let { result, message, shortestSolutionLength, yourSolutionLength, elapsed } = await postSolution(mazePath, directions).catch(err => {
      console.log(err);
      console.log(`mazePath => ${mazePath}\ndirections => ${directions}`);
      return {}; // keeps destructuring from failing on error
    });

    if (result == "success") {
      console.log(`${message}\nShortest: ${shortestSolutionLength}, Yours: ${yourSolutionLength}`);
    } else {
      console.log(message);
    }
  }

  // Print solution
  //logMaze(map, path);
};

const runRace = async () => {
  let login = 'ryan-robeson';
  // Start race
  let { nextMaze } = await apiPost('/mazebot/race/start',
    { 'login': login }).catch(err => {
      console.log(err.message);
      process.exit(1);
    });

  let maze = await apiGet(nextMaze).catch(err => {
    //console.log('Getting next maze');
    console.log(err.message);
    process.exit(1);
  });

  let { name, map, startingPosition, endingPosition, mazePath } = maze;

  // Starting and ending positions are given backwards?
  startingPosition = [startingPosition[1], startingPosition[0]];
  endingPosition = [endingPosition[1], endingPosition[0]];

  let { directions, path } = solve(map, startingPosition, endingPosition);

  let res = await postSolution(mazePath, directions);

  while (res['result'] == 'success') {
    let { nextMaze } = res;

    let maze = await apiGet(nextMaze).catch(err => {
      console.log(err.message);
      process.exit(1);
    });

    let { name, map, startingPosition, endingPosition, mazePath } = maze;
    startingPosition = [startingPosition[1], startingPosition[0]];
    endingPosition = [endingPosition[1], endingPosition[0]];

    console.log(`Solving ${name}`);

    let { directions, path } = solve(map, startingPosition, endingPosition);
    res = await postSolution(mazePath, directions);
  }

  if (res['result'] == 'finished') {
    let border = '='.repeat(40);
    let cert = res['certificate'];
    let fullCert = `http://api.noopschallenge.com${cert}`;

    console.log(border);
    console.log(res['message']);
    console.log(fullCert);
    console.log(border);

    let { completed, elapsed, message, err } = await apiGet(cert).catch(err => {
      console.log(`Failed to get certificate: ${err.message}`);
      return { err: true };
    });

    if (!err) {
      let certFile = fs.createWriteStream('completion-certs.txt', { 'flags': 'a' });
      certFile.write(`${completed} - ${elapsed}:\n`);
      certFile.end(fullCert + "\n");
    }

  } else {
    console.log('I think something went wrong \\_(^.^)_/');
    console.log(res);
  }
};

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

async function main() {
  const mode = 'race'; // 'race' or 'single'

  const online = false;
  const onlineParams = {
    maxSize: 200,
    minSize: 200
  };
  const saveMaze = true;
  const sendSolution = true;
  const localNumber = 1480;

  if (mode == 'single') {
    await runSingle(online, onlineParams, saveMaze, sendSolution, localNumber);
  } else if (mode == 'race') {
    await runRace();
  }

}

main();
