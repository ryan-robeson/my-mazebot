# Mazebot
![Completing the Mazebot 500](https://ryan-robeson.github.io/my-mazebot/running-the-race.svg)

## About
One of GitHub's 2019 [noopschallenges](https://noopschallenge.com/) is the [Mazebot][mazebot].
The Mazebot has 2 modes: random and race.

The random mode provides a single maze to solve that is randomly selected from a pool of mazes ranging from 10x10 to 200x200.

The race mode requires solving a series of mazes from 5x5 to 250x250 within a time limit in order to complete it.
A stage must be successfully completed before the next maze is given.

`solver.js` uses A\* as its pathfinding algorithm in order to find the shortest possible path through the maze fairly quickly. As can be seen above, it completes the race's 11 stages in a little over 3 seconds.

## Example API Response
```json
{
    "name": "Maze #95 (10x10)",
    "mazePath": "/mazebot/mazes/bJkAZlsmQgZ2VANe3OgHVSFCHtGDtlReybGbO57flDI",
    "startingPosition": [
        0,
        4
    ],
    "endingPosition": [
        3,
        5
    ],
    "message": "When you have figured out the solution, post it back to this url in JSON format. See the exampleSolution for more information.",
    "exampleSolution": {
        "directions": "ENWNNENWNNS"
    },
    "map": [
        [
            " ", " ", " ", " ", " ", "X", " ", " ", " ", " "
        ],
        [
            " ", " ", "X", " ", " ", " ", " ", "X", " ", " "
        ],
        [
            "X", " ", "X", "X", "X", "X", " ", "X", " ", " "
        ],
        [
            " ", " ", " ", " ", " ", "X", " ", "X", "X", " "
        ],
        [
            "A", "X", "X", "X", "X", " ", "X", " ", "X", " "
        ],
        [
            " ", "X", " ", "B", "X", " ", "X", " ", "X", " "
        ],
        [
            "X", " ", " ", "X", " ", " ", "X", " ", "X", " "
        ],
        [
            "X", "X", " ", "X", " ", "X", " ", "X", "X", " "
        ],
        [
            "X", "X", " ", " ", " ", "X", " ", "X", " ", " "
        ],
        [
            "X", "X", "X", "X", " ", " ", " ", " ", " ", " "
        ]
    ]
}
```

[mazebot]: https://github.com/noops-challenge/mazebot
