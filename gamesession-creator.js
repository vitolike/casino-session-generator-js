const express = require('express');
const axios = require('axios');
const { json } = require('express');

const app = express();
const port = 3000;

app.get('/gamesession-creator', async (req, res) => {
    // Game ID, for example: softswiss:AllLuckyClover
    if (!req.query.gameID) {
        return res.status(400).json({
            message: 'No game ID selected.'
        });
    }

    // Origin target where to try hijack session create URL
    if (!req.query.origin_target) {
        return res.status(400).json({
            message: 'No origin_target specified, pick between: bets.io | bitstarz.com | duxcasino.com'
        });
    }

    // Origin target variables to use
    let originTarget, gameRequest;

    if (req.query.origin_target.includes('bets.io')) {
        originTarget = 'bets.io';
        gameRequest = 'https://api.bets.io';
    } else if (req.query.origin_target.includes('duxcasino.com')) {
        originTarget = 'duxcasino.com';
        gameRequest = 'https://www.duxcasino.com';
    } else if (req.query.origin_target.includes('bitstarz.com')) {
        originTarget = 'bitstarz.com';
        gameRequest = 'https://bitstarz.com/';
    } else {
        return res.status(400).json({
            message: 'Incorrect origin_target specified, pick between: bets.io | bitstarz.com | duxcasino.com'
        });
    }

    // Selecting game in local database
    const findGame = await queryDatabase(req.query.gameID, originTarget);

    if (!findGame) {
        // Game not found, search local database for other "origin_target" that might support this game
        const queryBiggerScope = await queryDatabase(req.query.gameID);
        const get = queryBiggerScope ? await queryDatabase(req.query.gameID, null, true) : null;
        return res.status(400).json({
            message: 'Game not found.',
            other_origin_results: get,
            origin_target: originTarget
        });
    }

    if (findGame.demoplay === 0) {
        // Demo Play not found
        return res.status(400).json({
            message: 'Demo is toggled disabled status, probably a live game.',
            origin_target: originTarget
        });
    }

    // Demo url not found
    if (findGame.internal_origin_demolink === null) {
        return res.status(400).json({
            message: 'Demo request could not be completed.',
            origin_target: originTarget
        });
    }

    // Fire off the softswiss wrapper request URL
    const requestUrl = gameRequest + findGame.internal_origin_demolink;
    const getHttp = await axios.get(requestUrl);

    // Find and select the session URL noted in the pre-fire softswiss wrapper
    const inBetweenRegex = /{"game_url":"(.*?)","strategy":"i/s;
    const match = getHttp.data.match(inBetweenRegex);

    // If the pregmatch didn't find the game_url, use a proxy server
    if (!match) {
        const demoPrefix = findGame.internal_origin_demolink;
        const proxyUrl = `http://vps-70325c4a.vps.ovh.net/api/${originTarget}${demoPrefix}`;
        const getHttpProxied = await axios.get(proxyUrl);

        const matchProxy = getHttpProxied.data.match(/{"game_url":"(.*?)","strategy":"/s);

        if (!matchProxy) {
            return res.status(400).json({
                message: 'API unable to retrieve URL regularly and through proxy',
                regex: matchProxy,
                proxy_url: proxyUrl
            });
        } else {
            const loadedThrough = 'proxy';
            const matchURL = matchProxy[1];
            return sendResponse(req, res, matchURL, requestUrl, loadedThrough, proxyUrl);
        }
    } else {
        const loadedThrough = 'local';
        const matchURL = match[1];
        const proxyUrl = false;
        return sendResponse(req, res, matchURL, requestUrl, loadedThrough, proxyUrl);
    }
});

// Helper function to query the database
async function queryDatabase(gameID, originTarget = null, biggerScope = false) {
    // Implement your database querying logic here
}

// Helper function to send the response based on user's request
function sendResponse(req, res, gameURL, requestURL, loadedThrough, proxyURL) {
    // Remove any unicoded '&' functions
    const finalGameURL = decodeURIComponent(gameURL).replace(/\\u0026/g, '&');

    if (req.query.load_content) {
        if (req.query.load_content !== '0') {
            if (proxyURL === false) {
                return res.send(getHttp.data);
            } else {
                return res.send(getHttpProxied.data);
            }
        }
    }
    if (req.query.redirect) {
        if (req.query.redirect === 'to_game_url') {
            return res.redirect(finalGameURL);
        }
        if (req.query.redirect === 'to_origin_wrapper') {
            return res.redirect(requestURL);
        }
        if (req.query.redirect === 'to_proxied_wrapper') {
            if (proxyURL === false) {
                const message = 'You set to redirect to proxied wrapper, however it was not used in the request so please manually proxy or set redirect mode to \'to_origin_wrapper\' or \'to_game_url\'';
                return res.status(400).json({
                    message: message,
                    game_url: finalGameURL,
                    request_url: requestURL,
                    internal_technique: loadedThrough,
                    proxy_url: proxyURL
                });
            } else {
                return res.redirect(proxyURL);
            }
        }
    }

    return res.status(200).json({
        message: 'success',
        game_url: finalGameURL,
        request_url: requestURL,
        internal_technique: loadedThrough,
        proxy_url: proxyURL
    });
}

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
