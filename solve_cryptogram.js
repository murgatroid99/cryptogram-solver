"use strict";
importScripts('./word_list.js');
const wordList = globalThis.wordList;
const UPPERCASE = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
function wordIsSolved(cryptoWord, partialMap) {
    return cryptoWord.split('').filter(x => UPPERCASE.has(x)).every(x => x in partialMap);
}
function mapsAreConsistent(map1, map2) {
    for (const [k1, v1] of Object.entries(map1)) {
        for (const [k2, v2] of Object.entries(map2)) {
            if (k1 === k2 && v1 !== v2) {
                return false;
            }
            if (v1 === v2 && k1 !== k2) {
                return false;
            }
        }
    }
    return true;
}
function mapsEqual(map1, map2) {
    if (Object.keys(map1).length !== Object.keys(map2).length) {
        return false;
    }
    for (const [k1, v1] of Object.entries(map1)) {
        if (v1 !== map2[k1]) {
            return false;
        }
    }
    return true;
}
function validateMap(partialMap) {
    return (new Set(Object.values(partialMap))).size === Object.keys(partialMap).length && Object.entries(partialMap).every(([key, value]) => key !== value);
}
function applyMap(text, fullMap) {
    return text.split('').map(letter => fullMap[letter] ?? letter).join('');
}
function applyPartialMap(text, partialMap) {
    return text.split('').map(letter => partialMap[letter] ?? (UPPERCASE.has(letter) ? '_' : letter)).join('');
}
function getMissingLetterRegex(letter, partialMap) {
    return `[${[...UPPERCASE].filter(l => !Object.values(partialMap).includes(l) && l !== letter).join('')}]`;
}
function getWordRegex(word, partialMap) {
    const letterGroup = {};
    let nextGroup = 1;
    const regexParts = ['^'];
    for (const letter of word) {
        if (UPPERCASE.has(letter)) {
            if (letter in letterGroup) {
                regexParts.push(letterGroup[letter]);
            }
            else if (letter in partialMap) {
                regexParts.push(partialMap[letter]);
            }
            else {
                letterGroup[letter] = `\\${nextGroup++}`;
                regexParts.push(`(${getMissingLetterRegex(letter, partialMap)})`);
            }
        }
        else {
            regexParts.push(letter);
        }
    }
    regexParts.push('$');
    return new RegExp(regexParts.join(''));
}
function countMatching(cryptoWord, partialMap) {
    const regex = getWordRegex(cryptoWord, partialMap);
    return wordList.filter(word => regex.test(word)).length;
}
function validateWord(cryptoWord, partialMap) {
    if (wordIsSolved(cryptoWord, partialMap)) {
        return wordList.includes(applyMap(cryptoWord, partialMap));
    }
    else {
        const wordRegex = getWordRegex(cryptoWord, partialMap);
        return wordList.filter(word => word.length === cryptoWord.length).some(word => wordRegex.test(word));
    }
}
function* trySolveWord(cryptoList, partialMap, tried, cryptoWord, word, sequence) {
    if (!(word.length === cryptoWord.length)) {
        return;
    }
    if (wordIsSolved(cryptoWord, partialMap)) {
        return;
    }
    if (!getWordRegex(cryptoWord, partialMap).test(word)) {
        return;
    }
    const cryptoLetters = cryptoWord.split('').filter(x => UPPERCASE.has(x));
    const wordLetters = word.split('').filter(x => UPPERCASE.has(x));
    const wordMap = Object.fromEntries(cryptoLetters.map((letter, index) => [letter, wordLetters[index]]));
    if (!(validateMap(wordMap) && wordIsSolved(cryptoWord, wordMap) && mapsAreConsistent(wordMap, partialMap))) {
        return;
    }
    const combinedMap = { ...wordMap, ...partialMap };
    if (tried.some(triedMap => mapsEqual(combinedMap, triedMap))) {
        return;
    }
    if (cryptoList.every(cWord => validateWord(cWord, combinedMap))) {
        if (cryptoList.every(cWord => wordIsSolved(cWord, combinedMap))) {
            yield {
                finalMap: combinedMap,
                solutionSequence: sequence
            };
        }
        else {
            yield* solveCryptogramHelper(cryptoList, combinedMap, tried, [...sequence, combinedMap]);
        }
    }
    tried.push(combinedMap);
}
function* splitContractions(cryptoList) {
    for (const [index, word] of cryptoList.entries()) {
        if (word.includes("'")) {
            const apostropheIndex = word.indexOf("'");
            if (apostropheIndex > 0) {
                yield [...cryptoList.slice(0, index), word.slice(0, apostropheIndex), word.slice(apostropheIndex), ...cryptoList.slice(index + 1)];
            }
        }
    }
}
function* solveCryptogramHelper(cryptoList, partialMap, tried, sequence) {
    if (cryptoList.every(cryptoWord => wordIsSolved(cryptoWord, partialMap))) {
        yield {
            finalMap: partialMap,
            solutionSequence: sequence
        };
    }
    const cryptoWord = [...cryptoList].filter(word => !wordIsSolved(word, partialMap)).sort((a, b) => countMatching(a, partialMap) - countMatching(b, partialMap))[0];
    let foundAnySolutions = false;
    for (const word of wordList) {
        for (const solution of trySolveWord(cryptoList, partialMap, tried, cryptoWord, word, sequence)) {
            yield solution;
            foundAnySolutions = true;
        }
    }
    if (!foundAnySolutions) {
        for (const splitCryptoList of splitContractions(cryptoList)) {
            yield* solveCryptogramHelper(splitCryptoList, partialMap, tried, sequence);
        }
    }
}
function* solveCryptogram(cryptogram) {
    const cryptoList = cryptogram.split(/\s|-/).map(word => word.replace(/[,.!?:;"')]+$/, '').replace(/^["(]+/, ''));
    yield* solveCryptogramHelper(cryptoList, {}, [], []);
}
let currentCryptogram = null;
let currentProblem = null;
let stopped = false;
function sendSolutions() {
    if (!currentProblem || !currentCryptogram) {
        return;
    }
    for (const solution of currentProblem) {
        postMessage({
            solution: applyMap(currentCryptogram, solution.finalMap),
            steps: solution.solutionSequence.map(step => applyPartialMap(currentCryptogram, step))
        });
        if (stopped) {
            return;
        }
    }
    postMessage({
        finished: true
    });
}
onmessage = event => {
    const message = event.data;
    switch (message.command) {
        case 'SOLVE':
            currentCryptogram = message.cryptogram;
            stopped = false;
            currentProblem = solveCryptogram(currentCryptogram);
            sendSolutions();
            break;
        case 'STOP':
            stopped = true;
            break;
        case 'RESUME':
            stopped = false;
            sendSolutions();
            break;
    }
};
