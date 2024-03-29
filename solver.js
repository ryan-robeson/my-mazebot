#!/usr/bin/env node

var http = require('http');
var url = require('url');
var fs = require('fs');
var zlib = require('zlib');

// Written for GitHub's Noops Challenge (Mazebot)
// https://github.com/noops-challenge/mazebot

// keepAlive saves substantial time for online runs
http.globalAgent.keepAlive = true;

// parameters are converted to a query string format
const apiGet = async (path, parameters = {}) => {
  const query = url.format({query: parameters});
  const options = {
    headers: {
      'Accept-Encoding': 'gzip'
    }
  };

  return new Promise((resolve, reject) => {
    http.get('http://api.noopschallenge.com' + path + query, options, function(res) {
      const { statusCode } = res;

      if (statusCode < 200 || statusCode > 299) {
        reject(new Error('API Response failure: ' + statusCode));
      }

      const chunks = [];

      res.on('data', (chunk) => { chunks.push(chunk) } );

      res.once('end', function() {
        const data = Buffer.concat(chunks);

        try {
          if (res.headers['content-encoding'] === 'gzip') {
            zlib.gunzip(data, (err, d) => {
              if (err !== null) { throw(err); }
              resolve(JSON.parse(d));
            });
          } else {
            resolve(JSON.parse(data));
          }
        } catch (e){
          reject(new Error('GET - Failed to parse JSON: ' + e.message));
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
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip'
    }
  }

  return new Promise((resolve, reject) => {
    const req = http.request('http://api.noopschallenge.com' + path, options, function(res) {
      const { statusCode } = res;
      // 400 is a valid code when an incorrect solution is sent.
      if (statusCode < 200 || ( statusCode > 299 && statusCode != 400 )) {
        reject(new Error('API Response failure: ' + statusCode));
      }

      const chunks = [];

      res.on('data', chunk => { chunks.push(chunk); } );

      res.once('end', () => {
        const data = Buffer.concat(chunks);

        try {
          if (res.headers['content-encoding'] === 'gzip') {
            zlib.gunzip(data, (err, d) => {
              if (err !== null) { throw(err); }
              resolve(JSON.parse(d));
            });
          } else {
            resolve(JSON.parse(data));
          }
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

// Measure run time of code
// Takes a key and an optional callback
// The callback can be given at the start of the measurement, where it will be
// stored and ran when the measurement ends, or at the end of the measurement,
// where it will override any previous callback.
// If true is given as the callback at the end of the measurement, the default
// callback will be used, overriding any previous callback.
// Returns
// the 'state' of the measurement 'started' or 'finished'
// the elapsed time 'asNanoseconds'
// and as 'seconds'
const measure = (() => {
  let measurements = {};
  let defaultCallback = (ns, s, key) => {
    console.log(`Elapsed (${key}): ${ns}ns => ${s}s`);
  };

  return (key, cb) => {
    if (typeof measurements[key] === 'undefined') {
      // Starting measurement
      measurements[key] = { start: process.hrtime.bigint() };
      if (typeof cb === 'function') {
        measurements[key].cb = cb;
      }
      return { state: 'started' }
    } else {
      // Finishing measurement
      let m = measurements[key];
      let start = m['start'];
      let ns = process.hrtime.bigint();
      let elapsed = ns - start;
      let seconds = Number(elapsed * 1000n / BigInt(1e9)) / 1000;

      if (typeof cb !== 'undefined') {
        if (cb === true) {
          defaultCallback(elapsed, seconds, key);
        } else {
          cb(elapsed, seconds, key);
        }
      } else if (typeof m['cb'] !== 'undefined') {
        m['cb'](elapsed, seconds, key);
      }

      delete measurements[key];

      return {
        state: 'finished',
        asNanoseconds: elapsed,
        asSeconds: seconds
      }
    }
  }
})();

// Priority Queue based on a pairing heap
// See: https://en.wikipedia.org/wiki/Pairing_heap
const priorityQueuePairing = () => {
  let length = 0;
  let itemsInHeap = {};
  let heap = {};

  const merge = (newHeap) => {
    if (heap.elem === undefined) {
      heap = newHeap;
      return;
    }

    if (heap.elem < newHeap.elem) {
      heap.subheaps.push(newHeap);
    } else {
      newHeap.subheaps.push(heap);
      heap = { node: newHeap.node, elem: newHeap.elem, subheaps: newHeap.subheaps };
    }
  };

  const findMin = () => {
    return heap.node;
  };

  const deleteMin = () => {
    if (heap.node === undefined) {
      return;
    }

    const minNode = findMin();
    const subheaps = heap.subheaps
    length -= 1;

    delete itemsInHeap[minNode];

    if (subheaps.length < 1) {
      heap.elem = undefined;
      heap.node = undefined;
      length = 0;
      return;
    }

    if (subheaps.length === 1) {
      heap.elem = subheaps[0].elem;
      heap.node = subheaps[0].node;
      heap.subheaps = subheaps[0].subheaps;
      return;
    }

    // 2 part merge
    // part 1 - Left to right in pairs
    let i = 0;
    let l = subheaps.length;
    let newHeaps = [];
    for (i; i < l; i+=2) {
      if (subheaps[i+1] === undefined) {
        newHeaps.push({ node: subheaps[i].node, elem: subheaps[i].elem, subheaps: subheaps[i].subheaps});
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

    // part 2 - Right to left
    const newHeapsLength = newHeaps.length;
    if (newHeapsLength === 1) {
      heap.elem = newHeaps[0].elem;
      heap.node = newHeaps[0].node;
      heap.subheaps = newHeaps[0].subheaps;
      return;
    }

    for (i = newHeapsLength - 1; i > 0; i--) {
      // I believe <= preserves LIFO (as opposed to <)
      if (newHeaps[i].elem <= newHeaps[i-1].elem) {
        newHeaps[i].subheaps.push(newHeaps[i-1]);
        newHeaps[i-1] = newHeaps[i];
      } else {
        newHeaps[i-1].subheaps.push(newHeaps[i]);
      }
    }

    heap.elem = newHeaps[0].elem;
    heap.node = newHeaps[0].node;
    heap.subheaps = newHeaps[0].subheaps;
  };

  // Find the node
  // Change it's priority
  // Extract and merge if necessary
  // Should be faster when previousValue is known, but an incorrect
  // value can cause the update to fail silently. This is acceptable for now.
  const decreaseKey = (node, startToGoal, previousValue) => {
    if (!has(node)) {
      return;
    }

    // Find the node
    let found;

    if (heap.node[0] == node[0] && heap.node[1] == node[1]) {
      // Found at the root node
      heap.elem = startToGoal;
      return;
    }

    // We know the node is in the heap, and if we haven't
    // found it already, there must be subheaps to search.
    let searchSpace = [{ parentHeap: heap, subheaps: heap.subheaps }];
    let search;
    let parentHeap;
    let subheaps;
    let i;

    while (searchSpace.length > 0) {
      search = searchSpace.pop();
      parentHeap = search.parentHeap;
      subheaps = search.subheaps;

      for (i = 0; i < subheaps.length; i++) {
        if (subheaps[i].node[0] == node[0] && subheaps[i].node[1] == node[1]) {
          // Found it
          found = subheaps[i];
          found.elem = startToGoal;

          //if (parentHeap.elem >= found.elem) {
          if (found.elem > parentHeap.elem) {
            // We're still fine where we are
          } else {
            // Extract and merge
            // subheaps.splice(i,1);
            // merge(found);
            merge(subheaps.splice(i,1)[0]);
          }

          return;
        } else {
          // This should be an optimization if previousValue is given
          if (previousValue !== undefined) {
            if (subheaps[i].elem <= previousValue && subheaps[i].subheaps.length > 0) {
              searchSpace.push({ parentHeap: subheaps[i], subheaps: subheaps[i].subheaps});
            }
          } else {
            if (subheaps[i].subheaps.length > 0) {
              searchSpace.push({ parentHeap: subheaps[i], subheaps: subheaps[i].subheaps});
            }
          }
        }
      }
    }
  };

  const insert = (node, startToGoal) => {
    //if (startToGoal === undefined) {
    if (typeof startToGoal === 'undefined') {
      startToGoal = Infinity;
    }

    length += 1;

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
    decreaseKey: decreaseKey,
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

  let previousStartToGoal;

  //while (discovered.peek() !== undefined) {
  while (!discovered.isEmpty()) {
  //while (typeof discovered.peek() !== 'undefined') {
    let current = nextNode();
    if (current[0] === end[0] && current[1] === end[1]) {
      //console.log('Found the end');
      path = toPath(cameFrom, current);
      directions = toCompass(path);
      break;
    }

    // Add it to evaluated nodes
    evaluated[current] = 1;

    for (let n of neighbors(current)) {
      if (typeof evaluated[n] !== 'undefined') {
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
      previousStartToGoal = startToGoal[n];
      startToGoal[n] = startToNode[n] + heuristic(n, end);
      // Update discovered
      if (typeof previousStartToGoal === 'undefined') {
        previousStartToGoal = Infinity;
      }
      discovered.decreaseKey(n, startToGoal[n], previousStartToGoal);
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
  measure('Run single including load');

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

  measure('Solve only');
  let { directions, path } = solve(map, startingPosition, endingPosition);
  measure('Solve only', true);

  measure('Run single including load', true);

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
  const gatherMetrics = true;

  let metrics = [];
  const addMetric = (key) => {

    metrics.push({ name: key, result: measure(key) });
  };

  let login = 'ryan-robeson';

  measure('StartRace');
  // Start race
  let { nextMaze } = await apiPost('/mazebot/race/start',
    { 'login': login }).catch(err => {
      console.log(err.message);
      process.exit(1);
    });

  // The challenge seems to start measuring here.
  measure('WholeRace');

  let maze = await apiGet(nextMaze).catch(err => {
    //console.log('Getting next maze');
    console.log(err.message);
    process.exit(1);
  });
  addMetric('StartRace');

  let { name, map, startingPosition, endingPosition, mazePath } = maze;

  // Starting and ending positions are given backwards?
  startingPosition = [startingPosition[1], startingPosition[0]];
  endingPosition = [endingPosition[1], endingPosition[0]];

  console.log(`Solving ${name}`);

  measure(`Solve-${name}`);
  let { directions, path } = solve(map, startingPosition, endingPosition);
  addMetric(`Solve-${name}`);

  measure(`Response-${name}`);
  let res = await postSolution(mazePath, directions);
  addMetric(`Response-${name}`);

  while (res['result'] == 'success') {
    let { nextMaze } = res;

    measure(`Get-${nextMaze}`);
    let maze = await apiGet(nextMaze).catch(err => {
      console.log(err.message);
      process.exit(1);
    });
    addMetric(`Get-${nextMaze}`);

    let { name, map, startingPosition, endingPosition, mazePath } = maze;
    startingPosition = [startingPosition[1], startingPosition[0]];
    endingPosition = [endingPosition[1], endingPosition[0]];

    console.log(`Solving ${name}`);

    measure(`Solve-${name}`);
    let { directions, path } = solve(map, startingPosition, endingPosition);
    addMetric(`Solve-${name}`);

    measure(`Response-${name}`);
    res = await postSolution(mazePath, directions);
    addMetric(`Response-${name}`);
  }
  addMetric('WholeRace');

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

  let analysis = {
    solveTime: {},
    responseTime: {},
    getTime: {}
  };
  for (let m of metrics) {
    let key;
    if (m.name.startsWith('Solve')) {
      key = 'solveTime';
    } else if (m.name.startsWith('Response')) {
      key = 'responseTime';
    } else if (m.name.startsWith('Get')) {
      key = 'getTime';
    }

    if (typeof key !== 'undefined') {
      analysis[key].total = (analysis[key].total || 0) + m.result.asSeconds;
      analysis[key].count = (analysis[key].count || 0 ) + 1;
    }
  }

  analysis['networkTime'] = { total: analysis['getTime'].total + analysis['responseTime'].total };

  console.log(analysis);
  //console.dir(metrics, { depth: null });
  //console.log(metrics[metrics.length-1]);
  //console.log(metrics);
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

  const online = true;
  const onlineParams = {
    maxSize: 200,
    minSize: 200
  };
  const saveMaze = false;
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
  console.dir(q._heap(), { depth: null });
  q.decreaseKey([8,4], 3, 1);
  console.dir(q._heap(), { depth: null });
  console.log(q.pop());
  console.log(q.pop());
  console.log(q.pop());
  console.dir(q._heap(), { depth: null });
  console.log(q.pop());
  console.log(q.pop());
  console.log(q.pop());
  //q.insert([6,8], 1);
  //console.dir(q._heap().subheaps[0].subheaps, { depth: null });
  //console.log(q.has([1,2]));
};

//pqTest();
