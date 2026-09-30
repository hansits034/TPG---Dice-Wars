// ==========================================================
// PUZZLE MODE
// Hand-picked, solver-verified one-turn puzzles: fixed dice faces, odd-shaped maps,
// rocks, a fixed hand of cards and (sometimes) a limited number of actions.
// Goal: destroy every red die before your turn ends.
// ==========================================================
// Data format: tiles/rocks are [q, r] pairs. dice: { a: class, q, r, face }. enemies: { a, q, r, hp }.
// actions: optional limit on moves + attacks (cards are free).
const PUZZLES = [
    {"id":"p01","name":"Knock Knock","tier":"easy","hint":"The Rage cannot finish it alone. Hit it so that it lands right next to the Ninja.","tiles":[[0,0],[0,-1],[0,1],[-1,0],[-1,1],[0,2],[-2,2],[-2,1]],"rocks":[[-2,1],[-1,1]],"dice":[{"a":"rage","q":0,"r":-1,"face":4},{"a":"ninja","q":0,"r":2,"face":2}],"enemies":[{"a":"defender","q":-1,"r":0,"hp":6}],"cards":[],"actions":3,"solution":[{"t":"mv","d":0,"q":0,"r":0},{"t":"atk","d":0,"q":-1,"r":0,"f":[0,0]},{"t":"atk","d":1,"q":0,"r":0,"f":[0,1]}]},
    {"id":"p02","name":"Pull and Punch","tier":"easy","hint":"A surviving enemy lands on the tile you struck from. Pick that tile so the Ninja can reach it with moves to spare.","tiles":[[0,0],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1],[-2,0],[0,2],[-3,0]],"rocks":[[-1,-1]],"dice":[{"a":"doctor","q":-2,"r":0,"face":3},{"a":"ninja","q":0,"r":1,"face":3}],"enemies":[{"a":"dracula","q":0,"r":-1,"hp":8}],"cards":[],"actions":3,"solution":[{"t":"mv","d":0,"q":0,"r":0},{"t":"atk","d":0,"q":0,"r":-1,"f":[0,0]},{"t":"atk","d":1,"q":0,"r":0,"f":[0,1]}]},
    {"id":"p03","name":"Double Tap","tier":"easy","hint":"Attack Again lets the Defender hit a second, different enemy. Start with the one that leaves you close to the other.","tiles":[[0,0],[0,1],[0,2],[1,1],[1,2],[2,0],[0,3],[0,-1],[3,-1],[-1,3],[2,-1]],"rocks":[[0,0],[3,-1],[0,3]],"dice":[{"a":"defender","q":1,"r":1,"face":4}],"enemies":[{"a":"rage","q":2,"r":-1,"hp":4},{"a":"defender","q":1,"r":2,"hp":3}],"cards":["atkAgain"],"actions":2,"solution":[{"t":"atk","d":0,"q":1,"r":2,"f":[1,1]},{"t":"card","c":"atkAgain"},{"t":"atk","d":0,"q":2,"r":-1,"f":[2,0]}]},
    {"id":"p04","name":"Small Change","tier":"easy","hint":"Even a 1 helps: let the Ninja chip one target before the Doctor finishes both.","tiles":[[0,0],[0,-1],[-1,-1],[0,1],[-1,2],[-1,1],[-1,0],[-2,0],[1,-1],[0,2],[-3,1],[1,0],[1,1],[-2,1]],"rocks":[[1,0],[-1,-1],[-1,0]],"dice":[{"a":"ninja","q":0,"r":1,"face":1},{"a":"doctor","q":-2,"r":0,"face":4}],"enemies":[{"a":"defender","q":-3,"r":1,"hp":4},{"a":"mage","q":1,"r":1,"hp":4}],"cards":["atkAgain"],"actions":3,"solution":[{"t":"atk","d":0,"q":1,"r":1,"f":[0,1]},{"t":"atk","d":1,"q":-3,"r":1,"f":[-2,0]},{"t":"card","c":"atkAgain"},{"t":"atk","d":1,"q":0,"r":1,"f":[-1,1]}]},
    {"id":"p05","name":"Tiny Helper","tier":"easy","hint":"The Angel does the heavy lifting: after Attack Again it walks on to the second target. The little Samurai finishes what is left.","tiles":[[0,0],[1,-1],[-1,0],[1,-2],[-2,1],[-3,2],[2,-2],[2,-1],[-2,0],[2,0],[-3,1],[-4,3],[1,0],[0,-1],[-4,4],[-3,4],[0,1],[-1,-1],[3,-3]],"rocks":[[2,-2],[1,-2],[-3,2],[-4,3]],"dice":[{"a":"samurai","q":1,"r":0,"face":1},{"a":"angel","q":-2,"r":1,"face":4}],"enemies":[{"a":"rage","q":-1,"r":0,"hp":3},{"a":"necromancer","q":0,"r":-1,"hp":5}],"cards":["atkAgain"],"actions":4,"solution":[{"t":"atk","d":1,"q":-1,"r":0,"f":[-2,1]},{"t":"card","c":"atkAgain"},{"t":"mv","d":1,"q":0,"r":0},{"t":"atk","d":1,"q":0,"r":-1,"f":[0,0]},{"t":"atk","d":0,"q":0,"r":0,"f":[1,0]}]},
    {"id":"p06","name":"Heavy Hitter","tier":"mid","hint":"Double damage applies to the next hit of every die, so land it on the big one. Sprint gets the small Piercer to the far side.","tiles":[[0,0],[0,1],[-1,0],[0,2],[0,3],[-2,0],[1,-1],[2,-1],[-2,1],[-3,0],[-1,1],[1,0],[1,-2],[1,3],[0,-1],[1,2],[2,-2],[-3,1],[2,1],[-2,2],[-4,1],[-4,2]],"rocks":[[-4,1],[1,3],[0,-1]],"dice":[{"a":"piercer","q":-1,"r":0,"face":6},{"a":"piercer","q":-3,"r":0,"face":3}],"enemies":[{"a":"necromancer","q":-2,"r":1,"hp":12},{"a":"dracula","q":0,"r":1,"hp":3}],"cards":["dmg2","sprint"],"actions":2,"solution":[{"t":"card","c":"dmg2"},{"t":"atk","d":0,"q":-2,"r":1,"f":[-1,0]},{"t":"card","c":"sprint","d":1},{"t":"atk","d":1,"q":0,"r":1,"f":[0,0]}]},
    {"id":"p07","name":"Changing Places","tier":"mid","hint":"Triple damage first. The Ninja softens the tank, then Swap puts the Samurai right where it needs to be.","tiles":[[0,0],[-1,1],[0,1],[1,0],[1,1],[1,-1],[2,-1],[0,-1],[1,-2],[1,-3],[0,2],[1,-4],[2,-3],[0,-3],[2,-2]],"rocks":[[2,-2],[0,0]],"dice":[{"a":"samurai","q":0,"r":-3,"face":4},{"a":"ninja","q":0,"r":-1,"face":6}],"enemies":[{"a":"defender","q":1,"r":1,"hp":5},{"a":"mage","q":1,"r":0,"hp":13}],"cards":["dmg3","swap"],"actions":2,"solution":[{"t":"card","c":"dmg3"},{"t":"atk","d":1,"q":1,"r":0,"f":[1,-1]},{"t":"card","c":"swap","d":0,"d2":1},{"t":"atk","d":0,"q":1,"r":1,"f":[1,0]}]},
    {"id":"p08","name":"Relay","tier":"mid","hint":"The Samurai softens the big die and the small Piercer finishes it. Attack Again then sends the Samurai on to the Mage with the moves it saved.","tiles":[[0,0],[-1,0],[1,0],[-2,1],[-2,0],[2,-1],[-1,1],[0,1],[1,-1],[2,-2],[-1,-1],[3,-2],[-3,1],[-2,-1],[-3,2],[1,-2],[-2,2],[0,-2],[2,0],[3,-1],[-3,0]],"rocks":[[-3,0],[3,-1],[-3,1],[2,-1],[-1,-1]],"dice":[{"a":"samurai","q":1,"r":-1,"face":5},{"a":"piercer","q":-2,"r":2,"face":2}],"enemies":[{"a":"mage","q":-2,"r":-1,"hp":4},{"a":"defender","q":-1,"r":0,"hp":7}],"cards":["atkAgain"],"actions":3,"solution":[{"t":"atk","d":0,"q":-1,"r":0,"f":[0,0]},{"t":"atk","d":1,"q":0,"r":0,"f":[-1,1]},{"t":"card","c":"atkAgain"},{"t":"atk","d":0,"q":-2,"r":-1,"f":[-2,0]}]},
    {"id":"p09","name":"Wrong Seats","tier":"mid","hint":"Both dice start in the wrong seat. Power up first, then swap.","tiles":[[0,0],[-1,1],[-1,2],[-1,0],[0,-1],[0,2],[-1,3],[-1,-1],[-2,2],[1,1],[0,3],[-1,4],[-2,3],[1,2],[-2,1],[1,3],[0,1],[2,2]],"rocks":[[-2,3],[0,0],[0,2],[-1,1]],"dice":[{"a":"ninja","q":-1,"r":4,"face":5},{"a":"doctor","q":0,"r":1,"face":4}],"enemies":[{"a":"mage","q":1,"r":2,"hp":5},{"a":"dracula","q":-1,"r":-1,"hp":9}],"cards":["dmg2","swap"],"actions":2,"solution":[{"t":"card","c":"dmg2"},{"t":"card","c":"swap","d":0,"d2":1},{"t":"atk","d":0,"q":-1,"r":-1,"f":[-1,0]},{"t":"atk","d":1,"q":1,"r":2,"f":[0,3]}]},
    {"id":"p10","name":"Stand-In","tier":"mid","hint":"The little Samurai barely scratches the Rage, but its knockback can leave the Rage on a tile that turns to rock after your second action. Swap gets the Samurai into position.","tiles":[[0,0],[-1,1],[0,1],[0,-1],[-1,-1],[-1,0],[-2,0],[0,2],[-2,-1],[-1,2],[-1,-2],[1,2],[1,0],[-3,-1],[0,-2],[-2,2],[-1,4]],"rocks":[[1,2],[-2,0],[1,0],[0,-2]],"dice":[{"a":"defender","q":-1,"r":0,"face":4},{"a":"ninja","q":-2,"r":2,"face":4},{"a":"samurai","q":0,"r":2,"face":1}],"enemies":[{"a":"rage","q":-1,"r":-2,"hp":5},{"a":"mage","q":0,"r":-1,"hp":9}],"cards":["swap"],"actions":4,"events":[{"at":2,"kind":"mountain","tiles":[[-1,-1],[0,1]]}],"solution":[{"t":"mv","d":0,"q":-1,"r":-1},{"t":"card","c":"swap","d":0,"d2":2},{"t":"atk","d":2,"q":-1,"r":-2,"f":[-1,-1]},{"t":"atk","d":1,"q":0,"r":-1,"f":[-1,0]},{"t":"atk","d":0,"q":-1,"r":0,"f":[-1,1]}]},
    {"id":"p11","name":"Double Trouble","tier":"mid","hint":"The Necromancer can Raise and still attack. Double damage turns its hit into a one-shot on the big Mage.","tiles":[[0,0],[1,-1],[0,1],[-1,1],[-1,0],[0,2],[-1,-1],[1,0],[-1,-2],[-2,0],[-2,-2],[0,-1],[2,-1],[-2,-1],[-2,1],[-3,2],[2,-2],[-3,1],[-3,-1]],"rocks":[[0,-1]],"dice":[{"a":"necromancer","q":-2,"r":-1,"face":6},{"a":"ninja","q":0,"r":2,"face":4}],"enemies":[{"a":"telekinator","q":-2,"r":-2,"hp":3},{"a":"samurai","q":-1,"r":1,"hp":8},{"a":"mage","q":2,"r":-2,"hp":12}],"cards":["dmg2"],"actions":3,"events":[{"at":2,"kind":"hole","tiles":[[-2,1],[-1,0]]}],"solution":[{"t":"raise","d":0,"q":-1,"r":-2},{"t":"card","c":"dmg2"},{"t":"atk","d":0,"q":2,"r":-2,"f":[1,-1]},{"t":"atk","d":1,"q":-1,"r":1,"f":[0,1]}]},
    {"id":"p12","name":"Trapdoor","tier":"mid","hint":"A 2 cannot beat a 3 HP die, but a pit can. Knock it onto the striped tile just before the ground gives way.","tiles":[[0,0],[1,-1],[1,0],[0,-1],[0,1],[2,0],[1,-2],[-1,2],[2,-2],[2,-1],[3,-2],[1,1],[0,2],[2,-3],[0,3],[-1,1]],"rocks":[[2,-2]],"dice":[{"a":"angel","q":1,"r":-2,"face":2},{"a":"defender","q":2,"r":0,"face":6}],"enemies":[{"a":"defender","q":-1,"r":1,"hp":3},{"a":"telekinator","q":1,"r":0,"hp":6}],"cards":["swap","sprint"],"actions":2,"events":[{"at":1,"kind":"hole","tiles":[[3,-2],[0,1]]}],"solution":[{"t":"card","c":"sprint","d":0},{"t":"card","c":"swap","d":0,"d2":1},{"t":"atk","d":0,"q":-1,"r":1,"f":[0,1]},{"t":"atk","d":1,"q":1,"r":0,"f":[1,-1]}]},
    {"id":"p13","name":"Detour","tier":"mid","hint":"The ground in the middle gives way after your first action, so plan the Defender's route around it. The Archer can soften anyone from anywhere.","tiles":[[0,0],[1,0],[0,1],[1,1],[0,2],[-1,2],[0,-1],[2,-1],[1,-1],[-1,3],[-2,2],[-2,3],[-2,1],[0,3]],"rocks":[[-1,3],[0,3]],"dice":[{"a":"archer","q":0,"r":-1,"face":3},{"a":"defender","q":-2,"r":2,"face":5}],"enemies":[{"a":"samurai","q":-2,"r":1,"hp":5},{"a":"rage","q":1,"r":1,"hp":7}],"cards":["atkAgain"],"actions":3,"events":[{"at":1,"kind":"hole","tiles":[[0,1]]}],"solution":[{"t":"shot","d":0,"q":1,"r":1},{"t":"atk","d":1,"q":-2,"r":1,"f":[-2,2]},{"t":"card","c":"atkAgain"},{"t":"atk","d":1,"q":1,"r":1,"f":[0,2]}]},
    {"id":"p14","name":"Chain Reaction","tier":"hard","hint":"The Ninja does most of the work: every move left after a hit adds damage. Give it both Attack Again cards and let the Piercer clean up.","tiles":[[0,0],[-1,0],[-1,1],[1,0],[2,0],[1,-1],[3,0],[0,-1],[-1,-1],[3,-1],[0,1],[-2,-1],[3,-2],[1,-2],[4,-1],[0,-2]],"rocks":[[4,-1],[-2,-1],[1,-1]],"dice":[{"a":"ninja","q":-1,"r":1,"face":5},{"a":"piercer","q":0,"r":1,"face":5}],"enemies":[{"a":"telekinator","q":2,"r":0,"hp":9},{"a":"telekinator","q":1,"r":0,"hp":7},{"a":"dracula","q":3,"r":-2,"hp":6}],"cards":["atkAgain","atkAgain"],"actions":5,"solution":[{"t":"atk","d":0,"q":1,"r":0,"f":[0,0]},{"t":"card","c":"atkAgain"},{"t":"atk","d":0,"q":2,"r":0,"f":[1,0]},{"t":"atk","d":1,"q":1,"r":0,"f":[0,1]},{"t":"card","c":"atkAgain"},{"t":"atk","d":0,"q":3,"r":-2,"f":[3,-1]},{"t":"atk","d":1,"q":3,"r":-1,"f":[2,0]}]},
    {"id":"p15","name":"Heavy Artillery","tier":"hard","hint":"Play both cards before anyone attacks: every first hit is tripled and every die gets a second attack. The Samurai clears the way, the Piercer finishes.","tiles":[[0,0],[-1,1],[1,0],[-1,0],[-2,1],[0,1],[0,-1],[-1,-1],[1,-1],[1,1],[-1,-2],[0,-2],[-2,2],[2,0]],"rocks":[[0,-2],[0,-1]],"dice":[{"a":"piercer","q":1,"r":1,"face":3},{"a":"samurai","q":-1,"r":-1,"face":6}],"enemies":[{"a":"necromancer","q":0,"r":0,"hp":12},{"a":"archer","q":-2,"r":1,"hp":3},{"a":"rage","q":-1,"r":0,"hp":9}],"cards":["atkAgain","dmg3"],"actions":5,"solution":[{"t":"card","c":"atkAgain"},{"t":"card","c":"dmg3"},{"t":"atk","d":1,"q":-1,"r":0,"f":[-1,-1]},{"t":"mv","d":1,"q":-1,"r":1},{"t":"atk","d":1,"q":0,"r":0,"f":[-1,1]},{"t":"atk","d":0,"q":-1,"r":1,"f":[0,1]},{"t":"atk","d":0,"q":-2,"r":1,"f":[-1,1]}]},
    {"id":"p16","name":"Graveyard Shift","tier":"hard","hint":"Raise first: one ghoul in the right spot bites two enemies at once. Mind the striped tiles, the ground there gives way after your third action.","tiles":[[0,0],[1,0],[1,-1],[0,-1],[0,1],[1,1],[-1,1],[2,1],[0,2],[1,-2],[-1,2],[0,-2],[1,2],[2,-2],[-1,-1],[-3,3]],"rocks":[[-1,-1],[1,1],[-1,2],[0,-1]],"dice":[{"a":"necromancer","q":-1,"r":1,"face":4},{"a":"ninja","q":0,"r":2,"face":5},{"a":"rage","q":2,"r":1,"face":6}],"enemies":[{"a":"necromancer","q":0,"r":-2,"hp":11},{"a":"telekinator","q":2,"r":-2,"hp":6},{"a":"samurai","q":1,"r":-2,"hp":4}],"cards":[],"actions":4,"events":[{"at":3,"kind":"hole","tiles":[[0,1],[1,0]]}],"solution":[{"t":"raise","d":0,"q":1,"r":-1},{"t":"atk","d":1,"q":0,"r":-2,"f":[1,-2]},{"t":"atk","d":2,"q":1,"r":-2,"f":[1,-1]},{"t":"atk","d":0,"q":2,"r":-2,"f":[1,-1]}]},
    {"id":"p17","name":"Shifting Ground","tier":"hard","hint":"Two groups of striped tiles close at different times, so the order of your moves matters. Save the ghoul for the last enemy.","tiles":[[0,0],[0,-1],[-1,1],[-1,0],[-1,-1],[-2,-1],[-2,0],[0,-2],[0,-3],[0,-4],[-1,-2],[1,-4],[1,-3],[-2,1],[2,-4],[1,-2],[-3,3]],"rocks":[[1,-3],[0,-4],[-1,1],[1,-4]],"dice":[{"a":"necromancer","q":0,"r":-3,"face":3},{"a":"samurai","q":0,"r":0,"face":4}],"enemies":[{"a":"mage","q":-2,"r":0,"hp":5},{"a":"dracula","q":-1,"r":-1,"hp":12},{"a":"mage","q":0,"r":-1,"hp":9}],"cards":["atkAgain"],"actions":5,"events":[{"at":3,"kind":"mountain","tiles":[[-2,1],[-2,-1]]},{"at":2,"kind":"hole","tiles":[[-1,0],[1,-2]]}],"solution":[{"t":"atk","d":1,"q":-1,"r":-1,"f":[-1,0]},{"t":"card","c":"atkAgain"},{"t":"atk","d":1,"q":0,"r":-1,"f":[-1,-1]},{"t":"atk","d":0,"q":-1,"r":-1,"f":[0,-2]},{"t":"atk","d":0,"q":-2,"r":0,"f":[-1,-1]},{"t":"raise","d":0,"q":-1,"r":-2}]},
    {"id":"p18","name":"Rock Bottom","tier":"hard","hint":"A rock bursts out right after your first action. Make sure an enemy is standing there when it does: a knockback can put it in place.","tiles":[[0,0],[1,0],[0,1],[-1,0],[-2,1],[0,2],[0,-1],[0,-2],[-1,1],[2,-1],[-1,-1],[-2,2],[1,-2],[-1,2],[1,1],[0,4]],"rocks":[[-1,1],[1,0]],"dice":[{"a":"mage","q":1,"r":1,"face":2,"zap":2},{"a":"rage","q":-1,"r":-1,"face":5}],"enemies":[{"a":"samurai","q":0,"r":4,"hp":8},{"a":"dracula","q":1,"r":-2,"hp":5},{"a":"necromancer","q":0,"r":-1,"hp":5}],"cards":["swap"],"actions":4,"events":[{"at":1,"kind":"mountain","tiles":[[-2,1],[0,-2]]}],"solution":[{"t":"card","c":"swap","d":0,"d2":1},{"t":"atk","d":0,"q":1,"r":-2,"f":[0,-2]},{"t":"atk","d":1,"q":0,"r":-1,"f":[0,0]},{"t":"zap","d":0},{"t":"zap","d":0}]},
    {"id":"p19","name":"Pitfall","tier":"hard","hint":"The big Archer is too tough to beat by hand. Lure it onto the striped tiles, then Zap from far away: the farther the target, the harder it hits.","tiles":[[0,0],[0,1],[0,-1],[-1,2],[-1,1],[-1,0],[-1,3],[0,2],[1,0],[1,-1],[-2,2],[0,3],[-1,-1],[3,-1],[3,0]],"rocks":[[-1,0],[-1,3],[0,3],[-1,2]],"dice":[{"a":"mage","q":-1,"r":-1,"face":5,"zap":2},{"a":"piercer","q":0,"r":0,"face":3}],"enemies":[{"a":"necromancer","q":3,"r":0,"hp":9},{"a":"archer","q":1,"r":-1,"hp":11}],"cards":[],"actions":4,"events":[{"at":2,"kind":"hole","tiles":[[1,0],[0,1]]}],"solution":[{"t":"mv","d":1,"q":1,"r":0},{"t":"atk","d":1,"q":1,"r":-1,"f":[1,0]},{"t":"zap","d":0},{"t":"zap","d":0}]},
    {"id":"p20","name":"Musical Chairs","tier":"hard","hint":"Double the Rage's hit for the Telekinator, then swap so the Mage ends up far from the last enemy: Zap hits harder from farther away.","tiles":[[0,0],[-1,0],[-1,-1],[0,-1],[1,-1],[1,0],[0,-2],[2,-1],[2,-2],[1,-3],[-1,1],[1,-2],[1,1],[0,1],[2,0],[1,-4],[-2,1],[3,-2],[-1,-2],[0,-3],[-1,3]],"rocks":[[1,-2],[3,-2],[2,-1],[1,0]],"dice":[{"a":"mage","q":1,"r":1,"face":4,"zap":1},{"a":"rage","q":-2,"r":1,"face":3}],"enemies":[{"a":"rage","q":-1,"r":3,"hp":4},{"a":"telekinator","q":-1,"r":-1,"hp":6},{"a":"rage","q":1,"r":-3,"hp":2}],"cards":["swap","dmg2"],"actions":3,"solution":[{"t":"card","c":"dmg2"},{"t":"atk","d":1,"q":-1,"r":-1,"f":[-1,0]},{"t":"card","c":"swap","d":0,"d2":1},{"t":"atk","d":0,"q":1,"r":-3,"f":[0,-2]},{"t":"zap","d":0}]},
];

function isPuzzle() { return !!(game && game.mode === 'puzzle'); }
function currentPuzzle() { return PUZZLES[game.puzzleIndex] || null; }

// ---------- progress ----------
const PUZZLE_STORE = 'diceWars.puzzles';
function puzzleProgress() {
    try { return JSON.parse(localStorage.getItem(PUZZLE_STORE)) || {}; } catch (e) { return {}; }
}
function markPuzzleSolved(id) {
    const p = puzzleProgress();
    p[id] = true;
    try { localStorage.setItem(PUZZLE_STORE, JSON.stringify(p)); } catch (e) {}
}
// A puzzle opens once the one before it is solved (the first three are always open)
function puzzleUnlocked(i) {
    if (i < 3) return true;
    const p = puzzleProgress();
    return !!p[PUZZLES[i - 1].id] || !!p[PUZZLES[i].id];
}

// ---------- setup (called from applyModeSetup) ----------
function applyPuzzleSetup() {
    const P = currentPuzzle();
    if (!P) return;
    const inPuzzle = new Set(P.tiles.map(([q, r]) => hKey(q, r)));
    game.puzzleGaps = new Set(allHexes.filter(h => !inPuzzle.has(hKey(h.q, h.r))).map(h => hKey(h.q, h.r)));
    game.puzzleTiles = inPuzzle;
    game.puzzleRadius = Math.max(...P.tiles.map(([q, r]) => hexDist(0, 0, q, r)));
    for (const [q, r] of P.rocks || []) game.voidTiles.set(hKey(q, r), { kind: 'mountain', wavesLeft: 999, puzzle: true });
    const plain = die => { die.skills.forEach(s => s.curLvl = 0); die.zapStacks = 0; return die; };
    game.playerDice = P.dice.map((d, i) => {
        const die = plain(createDie('p' + (i + 1), d.q, d.r, 'player', d.a));
        die.hp = die.maxHp = 10;
        die.puzzleFace = d.face;
        // puzzle abilities: Archer Long Shot never misses, Mage has its Zap charges, Necromancer can Raise once
        if (d.a === 'archer') { const ls = die.skills.find(s => s.id === 'longShot'); if (ls) ls.curLvl = 3; }
        if (d.a === 'mage') die.zapStacks = d.zap || 0;
        die.puzzleRaised = false;
        return die;
    });
    game.cpuDice = P.enemies.map((e, i) => {
        const die = plain(createDie('c' + (i + 1), e.q, e.r, 'cpu', e.a));
        die.hp = die.maxHp = e.hp;
        die.baseDamage = 0;
        return die;
    });
    game.playerHand = (P.cards || []).map(id => ({ ...CARD_DEFS.find(c => c.id === id) }));
    game.cpuHand = [];
    game.puzzleActionsLeft = P.actions == null ? null : P.actions;
    game.puzzleActionsUsed = 0;
    game.puzzleLog = [];
    game.puzzleHintMode = false;
    game.puzzleHintMark = null;
    game.puzzleHintsUsed = 0;
    game.puzzleEventsDone = (P.events || []).map(() => false);
    game.wave = 1;
}

// Called for every move or attack the player commits
function spendPuzzleAction(die, info, path) {
    if (!isPuzzle()) return;
    if (die && info && info.step) { game.puzzleActionsUsed++; if (game.puzzleActionsLeft != null) game.puzzleActionsLeft = Math.max(0, game.puzzleActionsLeft - 1); recordPuzzleStep(info.step); updatePuzzleHud(); return; }
    game.puzzleActionsUsed++;
    if (game.puzzleActionsLeft != null) game.puzzleActionsLeft = Math.max(0, game.puzzleActionsLeft - 1);
    if (die && info) {
        const step = { t: info.isAttack ? 'atk' : 'mv', d: game.playerDice.indexOf(die), q: info.q, r: info.r };
        if (info.isAttack && path && path.length >= 2) step.f = [path[path.length - 2].q, path[path.length - 2].r];
        recordPuzzleStep(step);
    }
    updatePuzzleHud();
}

// ---------- step-by-step hints ----------
// Each puzzle ships the solver's solution. The player's own actions are compared against it,
// so the hint always points at the next step from where they are.
function recordPuzzleStep(step) {
    if (!isPuzzle()) return;
    game.puzzleLog = game.puzzleLog || [];
    game.puzzleLog.push(step);
    if (game.puzzleHintMode) matchTimeout(() => { if (game.phase !== 'GAME_OVER') showPuzzleHint(true); }, 650);
}
function recordPuzzleCard(card, targets) {
    if (!isPuzzle() || !card) return;
    const step = { t: 'card', c: card.id };
    const idx = (targets || []).map(t => game.playerDice.indexOf(t)).filter(i => i >= 0);
    if (card.id === 'sprint' && idx.length) step.d = idx[0];
    if (card.id === 'swap' && idx.length === 2) { step.d = Math.min(...idx); step.d2 = Math.max(...idx); }
    recordPuzzleStep(step);
}
function sameStep(a, b) {
    if (!a || !b || a.t !== b.t) return false;
    if (a.t === 'card') return a.c === b.c && (a.d == null || a.d === b.d) && (a.d2 == null || a.d2 === b.d2);
    if (a.t === 'zap') return a.d === b.d;
    if (a.d !== b.d || a.q !== b.q || a.r !== b.r) return false;
    return a.t !== 'atk' || !a.f || !b.f || (a.f[0] === b.f[0] && a.f[1] === b.f[1]);
}
// how many solution steps the player has already done, or -1 once they left the path
function puzzleHintProgress() {
    const sol = (currentPuzzle() || {}).solution || [];
    const log = game.puzzleLog || [];
    for (let i = 0; i < log.length; i++) if (!sameStep(sol[i], log[i])) return -1;
    return log.length;
}

function puzzleZapTarget(mage) {
    let best = null, bd = Infinity;
    for (const e of aliveDice('cpu')) { if (e.concealed) continue; const dd = hexDist(mage.q, mage.r, e.q, e.r); if (dd < bd) { bd = dd; best = e; } }
    return best;
}
const DIR_WORDS = { '1,0': 'right', '-1,0': 'left', '0,1': 'lower right', '0,-1': 'upper left', '1,-1': 'upper right', '-1,1': 'lower left' };
function describePuzzleStep(step) {
    const die = game.playerDice[step.d];
    const who = die ? `your ${archName(die.archetype)} (${die.puzzleFace})` : 'a die';
    if (step.t === 'card') {
        const name = (CARD_DEFS.find(c => c.id === step.c) || {}).name || step.c;
        if (step.c === 'sprint') return `Play <b>${name}</b> on ${who}.`;
        if (step.c === 'swap') return `Play <b>${name}</b> on ${who} and your ${archName(game.playerDice[step.d2].archetype)} (${game.playerDice[step.d2].puzzleFace}).`;
        return `Play the <b>${name}</b> card.`;
    }
    if (step.t === 'mv') return `Move ${who} to the marked tile.`;
    if (step.t === 'shot') { const f = getDieAt(step.q, step.r); return `Use <b>Long Shot</b> with ${who} on the marked ${f ? `${archName(f.archetype)} (${f.hp} HP)` : 'enemy'}.`; }
    if (step.t === 'zap') { const t = die && puzzleZapTarget(die); return `Use <b>Zap</b> with ${who}: it hits the nearest enemy${t ? `, the marked ${archName(t.archetype)}, for ${hexDist(die.q, die.r, t.q, t.r)}` : ''}.`; }
    if (step.t === 'raise') return `Use <b>Raise</b> with ${who} on the marked tile.`;
    const foe = getDieAt(step.q, step.r);
    const target = foe ? `the marked ${archName(foe.archetype)} (${foe.hp} HP)` : 'the marked enemy';
    const standing = die && step.f && die.q === step.f[0] && die.r === step.f[1];
    const side = step.f ? DIR_WORDS[`${step.f[0] - step.q},${step.f[1] - step.r}`] : '';
    return `Attack ${target} with ${who}${standing ? ' from where it stands' : side ? `, striking from its ${side} side (marked)` : ''}.`;
}

function puzzleHintBanner() {
    let el = document.getElementById('puzzle-hint-banner');
    if (!el) {
        const wrap = document.getElementById('canvas-wrapper');
        if (!wrap || !wrap.appendChild) return null;
        el = document.createElement('div');
        el.id = 'puzzle-hint-banner';
        wrap.appendChild(el);
    }
    return el;
}
function hidePuzzleHint() {
    game.puzzleHintMark = null;
    const el = document.getElementById('puzzle-hint-banner');
    if (el && el.classList) el.classList.remove('show');
}

function showPuzzleHint(auto) {
    if (!isPuzzle() || game.phase === 'GAME_OVER') return;
    const P = currentPuzzle();
    const sol = P.solution || [];
    const k = puzzleHintProgress();
    const el = puzzleHintBanner();
    game.puzzleHintMode = true;
    let html;
    if (k < 0) {
        game.puzzleHintMark = null;
        html = `<b>Off the solution path.</b> The hints follow one exact solution. <button class="clay-btn gold small" onclick="restartWithHints()">Restart with hints</button>`;
    } else if (k >= sol.length) {
        game.puzzleHintMark = null;
        html = 'That was the last step.';
    } else {
        const step = sol[k];
        game.puzzleHintMark = step;
        game.puzzleHintsUsed = Math.max(game.puzzleHintsUsed || 0, k + 1);
        html = `<span class="hint-step">Step ${k + 1} of ${sol.length}</span> ${describePuzzleStep(step)}`;
    }
    if (el) {
        el.innerHTML = `${html}<button class="hint-close" onclick="game.puzzleHintMode = false; hidePuzzleHint();" aria-label="Hide hint">${iconSVG('close')}</button>`;
        el.classList.add('show');
    }
    if (!auto) SFX.powerUp && SFX.powerUp();
}
function restartWithHints() {
    restartPuzzle();
    hideOverlay();
    showPuzzleHint();
}

// ---------- timed hazards ----------
// events: [{ at: N, kind: 'hole' | 'mountain', tiles: [[q, r], ...] }] trigger after the player's Nth action.
// Any die standing on those tiles is destroyed (yours too), then the tile is closed for good.
async function puzzleAfterAction() {
    if (!isPuzzle()) return;
    const evs = (currentPuzzle() || {}).events || [];
    for (let i = 0; i < evs.length; i++) {
        const ev = evs[i];
        if (game.puzzleEventsDone[i] || game.puzzleActionsUsed < ev.at) continue;
        game.puzzleEventsDone[i] = true;
        const hole = ev.kind === 'hole';
        const now = performance.now();
        for (const [q, r] of ev.tiles) {
            const d = getDieAt(q, r);
            game.voidTiles.set(hKey(q, r), { kind: hole ? 'hole' : 'mountain', wavesLeft: 999, puzzle: true, bornAt: now });
            if (d) applyIndirectDamage(d, d.hp, hole ? 'Fell into the pit' : 'Crushed by the rock', '#6E6A80', null);
        }
        addCombatLog(hole ? 'The ground gave way' : 'A rock burst out of the ground', '', '#6E6A80');
        shakeBoard(450);
        SFX.quake();
        updateDiceHP();
        await delay(650);
    }
    updateMoves();
}
function pendingHazardAt(q, r) {
    const evs = (currentPuzzle() || {}).events || [];
    for (let i = 0; i < evs.length; i++) {
        if (game.puzzleEventsDone && game.puzzleEventsDone[i]) continue;
        if (evs[i].tiles.some(([tq, tr]) => tq === q && tr === r)) return { ...evs[i], left: evs[i].at - game.puzzleActionsUsed };
    }
    return null;
}
function drawPuzzleWarnings(now) {
    if (!isPuzzle()) return;
    const evs = (currentPuzzle() || {}).events || [];
    const blink = 0.5 + Math.sin(now / 260) * 0.2;
    evs.forEach((ev, i) => {
        if (game.puzzleEventsDone && game.puzzleEventsDone[i]) return;
        const left = ev.at - game.puzzleActionsUsed;
        for (const [q, r] of ev.tiles) {
            const p = hexScreen(q, r);
            if (ctx.setLineDash) ctx.setLineDash([7 * DPR, 5 * DPR]);
            tileOverlay(p.x, p.y, `rgba(242,184,75,${left <= 1 ? blink : 0.32})`, left <= 1 ? '#A3313D' : '#9A6B10', 3, 0.9);
            if (ctx.setLineDash) ctx.setLineDash([]);
            const bx = p.x + HEX_SIZE * 0.5, by = p.y - HEX_SIZE * 0.42, br = 10 * DPR;
            ctx.fillStyle = left <= 1 ? '#A3313D' : '#2F2A45';
            ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = `900 ${12 * DPR}px Nunito, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(Math.max(0, left)), bx, by + 0.5 * DPR);
            drawIcon(ctx, ev.kind === 'hole' ? 'drop' : 'flag', p.x - HEX_SIZE * 0.5, by, br * 1.3, ev.kind === 'hole' ? '#2F2A45' : '#5F5A70', 2.2);
        }
    });
    // Raise targets
    if (game.phase === 'PLAYER_RAISE_TARGET' && game.raiseSource) {
        for (const t of puzzleRaiseTiles(game.raiseSource)) {
            const p = hexScreen(t.q, t.r);
            if (ctx.setLineDash) ctx.setLineDash([6 * DPR, 4 * DPR]);
            tileOverlay(p.x, p.y, 'rgba(132,104,196,0.45)', '#3B2D5C', 3.5, 0.86);
            if (ctx.setLineDash) ctx.setLineDash([]);
        }
    }
}

// ---------- abilities ----------
function puzzleDieHasAbility(d) {
    if (!isPuzzle() || !d || d.team !== 'player' || d.hp <= 0 || puzzleOutOfActions()) return false;
    if (d.archetype === 'archer' && !d.hasAttackedThisTurn) return true;
    if (d.archetype === 'mage' && (d.zapStacks || 0) > 0) return true;
    if (d.archetype === 'necromancer' && !d.puzzleRaised) return true;
    return false;
}
function puzzleRaiseTiles(necro) {
    return allHexes.filter(h => game.puzzleTiles.has(hKey(h.q, h.r)) && !isBlocked(h.q, h.r) && !getDieAt(h.q, h.r)
        && hexDist(h.q, h.r, necro.q, necro.r) <= 2);
}
function triggerPuzzleRaise(forDie) {
    if (!isPuzzle() || game.phase !== 'PLAYER_TURN' || puzzleOutOfActions()) return;
    const necro = forDie || aliveDice('player').find(d => d.archetype === 'necromancer' && !d.puzzleRaised);
    if (!necro || necro.puzzleRaised) return;
    game.selectedDie = null; game.reachable = null; game.parents = null;
    game.raiseSource = necro;
    game.phase = 'PLAYER_RAISE_TARGET';
    setMessage(`Raise: pick a green tile within 2 of your Necromancer. The ghoul bites every enemy next to it for ${necro.puzzleFace}.`);
    setButtons(false, true);
}
async function handleRaiseTarget(q, r) {
    const necro = game.raiseSource;
    if (!necro || !puzzleRaiseTiles(necro).some(t => t.q === q && t.r === r)) {
        game.raiseSource = null; game.phase = 'PLAYER_TURN'; setButtons(true, false);
        setMessage('Raise cancelled.');
        return false;
    }
    game.raiseSource = null;
    game.phase = 'PLAYER_ANIMATING';
    spendPuzzleAction(necro, { step: { t: 'raise', d: game.playerDice.indexOf(necro), q, r } });
    necro.puzzleRaised = true;
    const ghoul = { id: Math.random(), q, r, team: 'player', damage: necro.puzzleFace, wavesLeft: 1, bornAt: performance.now(), puzzleGhoul: true };
    game.zombies.push(ghoul);
    SFX.crumble();
    await delay(520);
    const bitten = aliveDice('cpu').filter(e => !e.concealed && hexDist(e.q, e.r, q, r) === 1);
    for (const e of bitten) applyIndirectDamage(e, necro.puzzleFace, 'Ghoul bite', '#7FB24A', 'player');
    addCombatLog(`The ghoul bit ${bitten.length} ${bitten.length === 1 ? 'enemy' : 'enemies'} for ${necro.puzzleFace}`, '', '#7FB24A');
    updateDiceHP();
    await delay(520);
    game.zombies = game.zombies.filter(z => z !== ghoul);
    await puzzleAfterAction();
    if (checkWin()) return true;
    game.phase = 'PLAYER_TURN';
    updateSkillButtons(); updateMoves();
    finishPlayerSkillAction();
    return true;
}

// pulsing marks on the board for the current hint step
function drawPuzzleHint(now) {
    if (!isPuzzle() || !game.puzzleHintMark) return;
    const s = game.puzzleHintMark;
    const pulse = 0.35 + Math.sin(now / 220) * 0.2;
    const mark = (q, r, fill, stroke, dashed) => {
        const p = hexScreen(q, r);
        if (dashed && ctx.setLineDash) ctx.setLineDash([6 * DPR, 5 * DPR]);
        tileOverlay(p.x, p.y, fill, stroke, 3.5, 0.9);
        if (dashed && ctx.setLineDash) ctx.setLineDash([]);
    };
    const die = s.d != null ? game.playerDice[s.d] : null;
    if (die && die.hp > 0) mark(die.q, die.r, `rgba(242,184,75,${pulse})`, '#7A5510');
    if (s.t === 'card' && s.d2 != null) { const d2 = game.playerDice[s.d2]; if (d2) mark(d2.q, d2.r, `rgba(242,184,75,${pulse})`, '#7A5510'); }
    if (s.t === 'mv') mark(s.q, s.r, `rgba(255,236,160,${pulse + 0.1})`, '#7A5510', true);
    if (s.t === 'shot') mark(s.q, s.r, `rgba(224,96,126,${pulse + 0.15})`, '#7A2440');
    if (s.t === 'raise') mark(s.q, s.r, `rgba(139,195,74,${pulse + 0.15})`, '#3E6B1F', true);
    if (s.t === 'zap' && die) { const t = puzzleZapTarget(die); if (t) mark(t.q, t.r, `rgba(224,96,126,${pulse + 0.15})`, '#7A2440'); }
    if (s.t === 'atk') {
        if (s.f && !(die && die.q === s.f[0] && die.r === s.f[1])) mark(s.f[0], s.f[1], `rgba(255,236,160,${pulse})`, '#7A5510', true);
        mark(s.q, s.r, `rgba(224,96,126,${pulse + 0.15})`, '#7A2440');
    }
}
function puzzleOutOfActions() { return isPuzzle() && game.puzzleActionsLeft != null && game.puzzleActionsLeft <= 0; }

// ---------- flow ----------
function startPuzzle(i) {
    if (!PUZZLES[i]) return;
    if (game) game.aborted = true;
    if (fastAutoMode) toggleFastAutoModeOff();
    gameSettings.mode = 'puzzle';
    gameSettings.puzzleIndex = i;
    stopTurnTimer();
    stopStopwatch();
    resetGame(); // applyModeSetup builds the puzzle from gameSettings.puzzleIndex
    hideOverlay();
    startBGM();
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.add('active');
    document.body.classList.add('mode-puzzle');
    setupCanvas();
    updateSideLabels();
    beginPuzzleTurn();
    showPuzzleIntro();
}
function restartPuzzle() { if (game) hidePuzzleHint(); startPuzzle(game && game.puzzleIndex != null ? game.puzzleIndex : (gameSettings.puzzleIndex || 0)); }

function beginPuzzleTurn() {
    game.phase = 'PLAYER_TURN';
    game.currentTurn = 'player';
    game.turnEnding = false;
    const alive = aliveDice('player');
    for (const d of alive) {
        d.turnRoll = d.baseDamage = d.puzzleFace;
        d.moveAllowance = d.puzzleFace;
        d.damageMultiplier = 1;
        d.attackAgainActive = false;
        d.bonusAttackReady = false;
        d.strikeOnly = false;
        d.hasAttackedThisTurn = false;
        d.lastAttackedEnemyId = null;
    }
    updateRollDisplay(alive.map(d => d.puzzleFace), 'player');
    updateDiceHP(); updateMoves(); updateCardHand(); updateSkillButtons(); updateStatsDisplay();
    updatePuzzleHud();
    setButtons(true, false);
    setMessage('Destroy every red die this turn.');
}

function updatePuzzleHud() {
    const el = document.getElementById('puzzle-badge');
    if (!el) return;
    if (!isPuzzle()) { el.style.display = 'none'; return; }
    const P = currentPuzzle();
    el.style.display = '';
    el.innerHTML = `<span class="pz-label">Puzzle ${game.puzzleIndex + 1}</span>${game.puzzleActionsLeft != null
        ? `<b class="${game.puzzleActionsLeft <= 1 ? 'low' : ''}">${game.puzzleActionsLeft}/${P.actions} actions</b>` : ''}
        <button class="puzzle-hint-btn" onclick="showPuzzleHint()" title="Show the next step (H)">${iconSVG('puzzle')}<span class="hint-label">Hint</span></button>`;
}

const TIER_NAMES = { easy: 'Easy', mid: 'Tricky', hard: 'Hard' };

// What every card does in a puzzle, in the words the tutorial uses
const PUZZLE_CARD_HELP = {
    atkAgain: 'Every die gets one more attack this turn, on a <b>different</b> enemy than the one it just hit. A die that already attacked is unlocked and can use its saved moves again.',
    sprint: 'One die gets +3 moves. A die that already attacked can only walk with them.',
    dmg2: 'The next hit of every die deals double damage.',
    dmg3: 'The next hit of every die deals triple damage.',
    swap: 'Two of your dice trade places. Cards never use an action.',
};
const PUZZLE_SEEN = 'diceWars.puzzleSeen';
function puzzleSeen() { try { return JSON.parse(localStorage.getItem(PUZZLE_SEEN)) || {}; } catch (e) { return {}; } }
function markPuzzleSeen(keys) {
    const s = puzzleSeen();
    keys.forEach(k => s[k] = true);
    try { localStorage.setItem(PUZZLE_SEEN, JSON.stringify(s)); } catch (e) {}
}

function puzzleRulesHTML(P) {
    const rules = [];
    if (P.dice.some(d => d.a === 'ninja')) rules.push('Ninja hits +1 harder for every move it still has left after the attack.');
    if (P.actions != null) rules.push(`You have only <b>${P.actions}</b> actions: every move or attack uses one, cards are free.`);
    return rules.length ? `<ul class="puzzle-rules">${rules.map(r => `<li>${r}</li>`).join('')}</ul>` : '';
}

const PUZZLE_MECH_HELP = {
    'role:archer': ['archer', 'Archer: Long Shot', 'Hits any enemy anywhere on the map for the Archer\'s number. Never misses. It counts as the Archer\'s attack: its moves stay saved for Attack Again. Uses 1 action.'],
    'role:mage': ['mage', 'Mage: Zap', 'Always hits the <b>nearest</b> enemy, for damage equal to the distance. Each charge uses 1 action and does not end the Mage\'s turn.'],
    'role:necromancer': ['necromancer', 'Necromancer: Raise', 'Once per puzzle: raise a ghoul on an empty tile within 2 of the Necromancer, even across rocks and gaps. It bites every enemy next to it for the Necromancer\'s number. Uses 1 action.'],
    'hazard:hole': ['drop', 'Collapsing ground', 'Striped tiles give way after the action number on their badge. Any die standing there falls, yours too. Knock enemies onto them!'],
    'hazard:mountain': ['flag', 'Rising rocks', 'Striped tiles turn into rock after the action number on their badge, crushing any die standing there, yours too. The rock then blocks the way.'],
};
function puzzleMechanics(P) {
    const keys = [];
    for (const r of ['archer', 'mage', 'necromancer']) if (P.dice.some(d => d.a === r)) keys.push('role:' + r);
    for (const k of ['hole', 'mountain']) if ((P.events || []).some(e => e.kind === k)) keys.push('hazard:' + k);
    return keys;
}
function puzzleCardsHTML(P) {
    const ids = [...new Set(P.cards || [])];
    const mech = puzzleMechanics(P);
    if (!ids.length && !mech.length) return '';
    const seen = puzzleSeen();
    const mechRows = mech.map(k => {
        const [icon, name, desc] = PUZZLE_MECH_HELP[k];
        return `<div class="pch-row"><span class="pch-icon ${k.startsWith('hazard') ? 'hazard' : 'role'}">${iconSVG(icon)}</span>
            <div><div class="pch-name">${name}${seen[k] ? '' : ' <span class="pch-new">New</span>'}</div><div class="pch-desc">${desc}</div></div></div>`;
    }).join('');
    return `<div class="puzzle-cards-help">${mechRows}${ids.map(id => {
        const def = CARD_DEFS.find(c => c.id === id) || { name: id };
        const count = P.cards.filter(c => c === id).length;
        return `<div class="pch-row">
            <span class="pch-icon">${iconSVG(CARD_ICONS[id] || 'cards')}</span>
            <div><div class="pch-name">${def.name}${count > 1 ? ` ×${count}` : ''}${seen['card:' + id] ? '' : ' <span class="pch-new">New</span>'}</div>
            <div class="pch-desc">${PUZZLE_CARD_HELP[id] || def.desc}</div></div>
        </div>`;
    }).join('')}</div>`;
}

// First visit: how puzzles work, step by step
function showPuzzleTutorial(then) {
    window._afterPuzzleTutorial = () => { markPuzzleSeen(['tutorial']); (then || openPuzzleSelect)(); };
    showOverlay(`
        <div class="overlay-box puzzle-tutorial" style="max-width:560px;">
            <div class="overlay-icon gold">${iconSVG('puzzle')}</div>
            <h2>How puzzles work</h2>
            <p>Every puzzle is one turn. Destroy all red dice before it ends.</p>
            <ol class="tutorial-steps">
                <li><b>No rolling.</b> The number on each of your dice is how many tiles it can move <i>and</i> how much damage it deals.</li>
                <li><b>Move and attack.</b> Pick a die: pale tiles are moves, red tiles are attacks. Every tile costs one move, including the step onto the enemy you attack.</li>
                <li><b>Knockback.</b> An enemy that survives your hit is pushed onto the tile you attacked from, and your die takes its tile. Use it to line enemies up.</li>
                <li><b>One attack per die.</b> After attacking, a die stops. Its leftover moves stay saved (shown in the bottom bar) and only Attack Again unlocks them, to move and attack once more.</li>
                <li><b>Special rules.</b> Later puzzles add striped warning tiles that collapse or turn to rock after a set number of actions, and dice with abilities (Archer, Mage, Necromancer). The intro explains each one.</li>
                <li><b>Cards are free.</b> Each puzzle gives you a fixed hand. The intro of every puzzle explains its cards, marked <span class="pch-new">New</span> the first time you meet one.</li>
                <li><b>Stuck?</b> Press <b>Hint</b> (or H) for the next step of a solution, shown on the board. R restarts.</li>
            </ol>
            <div class="overlay-actions"><button class="clay-btn gold big" onclick="_afterPuzzleTutorial()">Got it</button></div>
        </div>`);
}

function showPuzzleIntro() {
    const P = currentPuzzle();
    showOverlay(`
        <div class="overlay-box puzzle-intro" style="max-width:520px;">
            <div class="overlay-icon gold">${iconSVG('puzzle')}</div>
            <div class="puzzle-tier ${P.tier}">${TIER_NAMES[P.tier] || ''} · Puzzle ${game.puzzleIndex + 1}</div>
            <h2>${P.name}</h2>
            <p>Destroy all ${P.enemies.length} red ${P.enemies.length === 1 ? 'die' : 'dice'} in a single turn.</p>
            ${puzzleCardsHTML(P)}
            ${puzzleRulesHTML(P)}
            <div class="overlay-actions">
                <button class="clay-btn plain" onclick="openPuzzleSelect()">${iconSVG('left')}All puzzles</button>
                <button class="clay-btn plain" onclick="showPuzzleTutorial(showPuzzleIntro)">How to play</button>
                <button class="clay-btn gold big" onclick="markPuzzleSeen((currentPuzzle().cards || []).map(c => 'card:' + c).concat(puzzleMechanics(currentPuzzle()))); hideOverlay()">Play</button>
            </div>
        </div>`);
}

function puzzleSolved() {
    const P = currentPuzzle();
    game.phase = 'GAME_OVER';
    hidePuzzleHint();
    const first = !puzzleProgress()[P.id];
    markPuzzleSolved(P.id);
    SFX.win();
    const next = game.puzzleIndex + 1 < PUZZLES.length ? game.puzzleIndex + 1 : null;
    matchTimeout(() => showOverlay(`
        <div class="overlay-box" style="max-width:440px;">
            <div class="overlay-icon gold">${iconSVG('trophy')}</div>
            <h2>Puzzle solved</h2>
            <p><b>${P.name}</b> cleared in ${game.puzzleActionsUsed} ${game.puzzleActionsUsed === 1 ? 'action' : 'actions'}${game.puzzleHintsUsed ? `, with ${game.puzzleHintsUsed} of ${(P.solution || []).length} steps hinted` : ' without hints'}.${first ? ' Next puzzle unlocked.' : ''}</p>
            <div class="overlay-actions">
                <button class="clay-btn plain" onclick="openPuzzleSelect()">All puzzles</button>
                <button class="clay-btn plain" onclick="restartPuzzle()">${iconSVG('restart')}Replay</button>
                ${next != null ? `<button class="clay-btn gold" onclick="startPuzzle(${next})">Next puzzle${iconSVG('right')}</button>` : ''}
            </div>
        </div>`), 700);
    return true;
}

function puzzleFailed() {
    const P = currentPuzzle();
    game.phase = 'GAME_OVER';
    game.puzzleFails = (game.puzzleFails || 0) + 1;
    gameSettings.puzzleFails = gameSettings.puzzleFails || {};
    gameSettings.puzzleFails[P.id] = (gameSettings.puzzleFails[P.id] || 0) + 1;
    const left = aliveDice('cpu').length;
    hidePuzzleHint();
    SFX.lose();
    showOverlay(`
        <div class="overlay-box" style="max-width:440px;">
            <div class="overlay-icon berry">${iconSVG('restart')}</div>
            <h2>Not quite</h2>
            <p>${left} red ${left === 1 ? 'die is' : 'dice are'} still standing. Every puzzle has a solution; try a different order.</p>
            <div class="puzzle-hint"><b>Idea:</b> ${P.hint}</div>
            <div class="overlay-actions">
                <button class="clay-btn plain" onclick="openPuzzleSelect()">All puzzles</button>
                <button class="clay-btn plain" onclick="restartWithHints()">${iconSVG('puzzle')}Step-by-step hints</button>
                <button class="clay-btn gold" onclick="restartPuzzle()">${iconSVG('restart')}Try again</button>
            </div>
        </div>`);
}

// ---------- puzzle select ----------
function openPuzzleSelect() {
    if (!puzzleSeen().tutorial) return showPuzzleTutorial();
    const prog = puzzleProgress();
    const solved = PUZZLES.filter(p => prog[p.id]).length;
    const groups = ['easy', 'mid', 'hard'].map(tier => {
        const items = PUZZLES.map((p, i) => ({ p, i })).filter(x => x.p.tier === tier);
        if (!items.length) return '';
        return `<div class="settings-section-title">${TIER_NAMES[tier]}</div>
            <div class="puzzle-grid">${items.map(({ p, i }) => {
                const open = puzzleUnlocked(i), done = !!prog[p.id];
                return `<button class="puzzle-card ${done ? 'done' : ''}" ${open ? `onclick="startPuzzle(${i})"` : 'disabled'}>
                    <span class="puzzle-num">${done ? iconSVG('check') : open ? i + 1 : iconSVG('lock')}</span>
                    <span class="puzzle-name">${open ? p.name : 'Locked'}</span>
                    <span class="puzzle-meta">${p.dice.length} vs ${p.enemies.length}${p.actions != null ? ` · ${p.actions} actions` : ''}</span>
                </button>`;
            }).join('')}</div>`;
    }).join('');
    showOverlay(`
        <div class="overlay-box puzzle-select" style="max-width:620px;">
            <h2>Puzzles</h2>
            <p class="overlay-lead" style="margin:0;">One turn, fixed dice, no luck. ${solved}/${PUZZLES.length} solved.</p>
            ${groups}
            <div class="overlay-actions" style="justify-content:flex-end;">
                <button class="clay-btn plain" onclick="showPuzzleTutorial()">How to play</button>
                <button class="clay-btn plain" onclick="${isPuzzle() && game.phase !== 'GAME_OVER' ? 'hideOverlay()' : 'closePuzzleSelect()'}">Back</button>
            </div>
        </div>`);
}
function closePuzzleSelect() {
    hideOverlay();
    if (isPuzzle()) quitToMainMenu();
}

// ---------- board drawing: only the puzzle's tiles, floating in the sky ----------
function puzzleBoardHexes() {
    return allHexes.filter(h => game.puzzleTiles.has(hKey(h.q, h.r)));
}
