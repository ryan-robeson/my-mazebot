#!/usr/bin/env node

var http = require('http');
var url = require('url');
var fs = require('fs');

// Written for GitHub's Noops Challenge (Mazebot)
// https://github.com/noops-challenge/mazebot

// keepAlive saves substantial time for online runs
http.globalAgent.keepAlive = true;

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

// Priority Queue based on a pairing heap
// See: https://en.wikipedia.org/wiki/Pairing_heap
const priorityQueuePairing = () => {
  let length = 0;
  let itemsInHeap = {};
  let heap = {};

  const merge = (newHeap) => {
    if (heap.elem === undefined) {
      heap = newHeap;
      length = 1;
      return;
    }

    length += 1;

    if (heap.elem < newHeap.elem) {
      heap.subheaps.push(newHeap);
    } else {
      newHeap.subheaps.push(heap);
      heap = { node: newHeap.node, elem: newHeap.elem, subheaps: newHeap.subheaps };
    }
  };

  const findMin = () => {
    if (length < 1) {
      return undefined;
    }
    return heap.node;
  };

  const deleteMin = () => {
    if (isEmpty()) {
      return;
    }

    const minNode = findMin();
    const subheaps = heap.subheaps
    length -= 1;

    delete itemsInHeap[minNode];

    if (subheaps.length < 1) {
      heap.elem = undefined;
      heap.node = undefined;
      return;
    }

    if (subheaps.length === 1) {
      heap.elem = subheaps[0].elem;
      heap.node = subheaps[0].node;
      heap.subheaps = subheaps[0].subheaps;
      return ;
    }

    // 2 part merge
    // part 1
    let i = 0;
    let l = subheaps.length;
    let newHeaps = [];
    for (i; i < l; i+=2) {
      if (subheaps[i+1] === undefined) {
        newHeaps.push({ node: subheaps[i].node, elem: subheaps[i].elem, subheaps: []});
        break;
      }
      if (subheaps[i].elem < subheaps[i+1].elem) {
        // subheaps[i] wins
        newHeaps.push({ node: subheaps[i].node, elem: subheaps[i].elem, subheaps: subheaps[i].subheaps.concat(subheaps[i+1])});
      } else {
        // subheaps[i+1] wins
        newHeaps.push({ node: subheaps[i+1].node, elem: subheaps[i+1].elem, subheaps: subheaps[i+1].subheaps.concat(subheaps[i])});
      }
    }

    const newHeapsLength = newHeaps.length;
    if (newHeapsLength === 1) {
      heap.elem = newHeaps[0].elem;
      heap.node = newHeaps[0].node;
      heap.subheaps = newHeaps[0].subheaps;
      return;
    }

    for (i = newHeapsLength - 1; i > 0; i--) {
      if (newHeaps[i].elem <= newHeaps[i-1].elem) {
        newHeaps[i].subheaps.push(newHeaps[i-1]);
        newHeaps[i-1] = newHeaps[i];
        newHeaps[i] = undefined;
      } else {
        newHeaps[i-1].subheaps.push(newHeaps[i]);
      }
    }

    heap.elem = newHeaps[0].elem;
    heap.node = newHeaps[0].node;
    heap.subheaps = newHeaps[0].subheaps;
  };

  const insert = (node, startToGoal) => {
    if (startToGoal === undefined) {
      startToGoal = Infinity;
    }

    merge({ node: node, elem: startToGoal, subheaps: [] });
    itemsInHeap[node] = 1;
  };

  const peek = () => {
    return findMin();
  };

  const pop = () => {
    const node = findMin()
    deleteMin();
    return node;
  };

  const isEmpty = () => {
    return length < 1 ? true : false;
  };

  const has = (node) => {
    return itemsInHeap[node] === 1;
  };

  return {
    pop: pop,
    insert: insert,
    peek: peek,
    isEmpty: isEmpty,
    has: has,
    _heap: () => { return heap }
  }
};

// Implemented from memory/intuition, but this is just a fun coding exercise.
// The behavior appears to be correct and offers a small speedup.
// Probably leaves performance on the table since I didn't use a heap.
const priorityQueue = () => {
  let items = [];
  let queue = undefined
  let itemsInQueue = {};
  let length = 0;

  const isEmpty = () => {
    return length < 1 ? true : false;
  };

  const insert = (node, startToGoal) => {
    if (startToGoal === undefined) {
      startToGoal = Infinity;
    }
    let thisNode = {
      node: node,
      value: startToGoal,
      index: 0, // First node will be at 0
      prev: undefined
    };

    itemsInQueue[node] = 1;

    length += 1;

    if (queue === undefined || queue.first === undefined) {
      items.push(thisNode);

      queue = {
        first: thisNode,
      }
      return;
    }

    thisNode.index = items.push(thisNode) - 1;

    if (thisNode.value < queue.first.value) {
      // New top node
      thisNode.prev = queue.first.index;
      queue.first = thisNode;
      return;
    }

    // Find out where this node fits in the queue
    let headNode = queue.first;
    let nextNode = items[headNode.prev];
    let found = false;

    while (nextNode !== undefined) {
      if (thisNode.value <= nextNode.value) {
        headNode.prev = thisNode.index;
        thisNode.prev = nextNode.index;
        found = true;
        break;
      } else {
        headNode = nextNode;
        nextNode = items[headNode.prev];
      }
    }

    if (!found) {
      // Must be at the end
      headNode.prev = thisNode.index;
    }
  };

  const pop = () => {
    if (isEmpty() || queue.first === undefined) {
      return undefined;
    }

    let node = queue.first.node;
    let index = queue.first.index;

    queue.first = items[queue.first.prev];
    delete items[index];
    delete itemsInQueue[node];

    length -= 1;

    return node;
  };

  const has = (node) => {
    return itemsInQueue[node] === 1 ? true : false;
  };

  return {
    isEmpty: isEmpty,
    insert: insert,
    pop: pop,
    has: has
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
  //let discovered = priorityQueue();
  let discovered = priorityQueuePairing();

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

  discovered.insert(start, startToGoal[start]); // Start is the only known node

  // The actual path through the maze => [ [1,1], [1,2], [2,2]... ]
  let path = [];
  // The compass directions through the maze => ['E','N'...]
  let directions = [];

  const nextNode = () => {
    return discovered.pop();
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

  while (!discovered.isEmpty()) {
    let current = nextNode();
    if (current[0] == end[0] && current[1] == end[1]) {
      //console.log('Found the end');
      path = toPath(cameFrom, current);
      directions = toCompass(path);
      break;
    }

    // Add it to evaluated nodes
    evaluated[current] = 1;

    for (let n of neighbors(current)) {
      if (evaluated[n] !== undefined) {
        continue;
      }

      // Distance from start to neighbor
      // We add one because we can only move one unit at a time.
      tentativeStartToNodeScore = startToNode[current] + 1

      if (!discovered.has(n))  {
        discovered.insert(n, startToGoal[n]);
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

  console.log(`Solving ${name}`);

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
  const mode = 'single'; // 'race' or 'single'

  const online = true;
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


const pqTest = () => {
  const q = priorityQueuePairing();

  q.insert([1,2], 7);
  q.insert([5,4], 3);
  q.insert([1,9], 2);
  q.insert([8,4], 5);
  q.insert([5,8], 6);
  q.insert([6,9], 2);
  q.insert([7,8], 2);
  console.log(q.pop());
  console.log(q.pop());
  console.log(q.pop());
  console.log(q.pop());
  console.log(q.pop());
  console.log(q.pop());
  //q.insert([6,8], 1);
  //console.dir(q._heap().subheaps[0].subheaps, { depth: null });
  //console.log(q.has([1,2]));
};

//pqTest();
