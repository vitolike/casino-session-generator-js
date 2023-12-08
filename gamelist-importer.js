const express = require('express');
const axios = require('axios');
const { json } = require('express');
const FormData = require('form-data');

const app = express();
const port = 3000;

app.get('/gamelist-importer', async (req, res) => {
    // Origin target right now 1 of 3, for demo games best is bets.io as being fastest & probably most accurate
    // Use duxcasino.com or arlekincasino.com (or search dama N.V. casino on google to find centrifuge casino's)
    if (!req.query.origin_target) {
        return res.status(400).json({
            message: 'Origin target not specified'
        });
    }

    // Variables for origin target
    let originTarget, apiLocationGamelist, storageGamelist;

    if (req.query.origin_target.includes('bets.io')) {
        originTarget = 'bets.io';
        apiLocationGamelist = 'https://bets.io/api/games/allowed_desktop';
        storageGamelist = 'https://gitlab.freedesktop.org/ryan-gate-2/casino-montik/-/raw/main/games255__2_.json';
    } else if (req.query.origin_target.includes('duxcasino.com')) {
        originTarget = 'duxcasino.com';
        apiLocationGamelist = 'https://www.duxcasino.com/api/games/allowed_desktop';
        storageGamelist = 'https://gitlab.freedesktop.org/ryan-gate-2/casino-montik/-/raw/main/gamesdux.json';
    } else if (req.query.origin_target.includes('bitstarz.com')) {
        originTarget = 'bitstarz.com';
        apiLocationGamelist = 'https://www.bitstarz.com/api/games/allowed_desktop';
        storageGamelist = 'https://pix-api.pointdns.rest/games-bitstarz.json';
        // storageGamelist = 'https://gitlab.freedesktop.org/ryan-gate-2/casino-montik/-/raw/main/games_bitstarz.json'; 
    } else {
        return res.status(400).json({
            message: 'Incorrect origin_target specified, pick between: bets.io | bitstarz.com | duxcasino.com'
        });
    }

    // Check if request wants us to proxy the gamelist from proxy server
    let getGames;
    if (req.query.origin_proxied === '1') {
        try {
            getGames = await axios.get('http://vps-70325c4a.vps.ovh.net/api/gamelist', {
                headers: {
                    'check-url': apiLocationGamelist
                }
            });
        } catch (error) {
            return res.status(401).json({
                message: 'Error retrieving games, please check the source',
                error: error.response.data
            });
        }
    } else {
        try {
            getGames = await axios.get(storageGamelist);
        } catch (error) {
            return res.status(401).json({
                message: 'Error retrieving games, please check the source',
                error: error.response.data
            });
        }
    }

    const getGamesDecode = getGames.data;

    if (getGamesDecode === null) {
        return res.status(401).json({
            message: 'Error decoding games, please check the source',
            error: getGames
        });
    }

    // Check if request wants to truncate previous mySQL list entries
    if (req.query.clean) {
        // Implement DB cleanup logic as needed
    }

    const gameArray = [];

    for (const [gameID, data] of Object.entries(getGamesDecode)) {
        const explodeSSid = gameID.split('/');
        const bindTogether = `${explodeSSid[0]}:${explodeSSid[1]}`;
        let typeGame = 'generic';
        let hasBonusBuy = 0;
        let hasJackpot = 0;
        let demoMode = 0;
        let demoPrefix = 0;
        let typeRatingGame = 0;
        let internal_origin_realmoneylink = [];

        if (data['demo']) {
            demoMode = true;
            demoPrefix = decodeURIComponent(data['demo']);
            if (originTarget === 'bitstarz.com') {
                demoPrefix = demoPrefix.replace('http://bitstarz.com', '');
            }
        }

        if (data['real']) {
            internal_origin_realmoneylink = data['real'];
        }

        const stringifyDetails = JSON.stringify(data['collections']);
        if (stringifyDetails.includes('slots')) {
            typeGame = 'slots';
            typeRatingGame = data['collections']['slots'] || 100;
        }
        if (stringifyDetails.includes('live')) {
            typeGame = 'live';
            typeRatingGame = data['collections']['live'] || 100;
        }
        if (stringifyDetails.includes('bonusbuy')) {
            hasBonusBuy = 1;
        }
        if (stringifyDetails.includes('jackpot')) {
            hasJackpot = 1;
        }

        const prepareArray = {
            gid: bindTogether,
            name: data['title'],
            provider: data['provider'],
            type: typeGame,
            typeRating: typeRatingGame,
            popularity: data['collections']['popularity'],
            bonusbuy: hasBonusBuy,
            jackpot: hasJackpot,
            demoplay: demoMode,
            internal_softswiss_prefix: gameID,
            internal_origin_demolink: demoPrefix,
            internal_origin_identifier: originTarget,
            internal_origin_realmoneylink: JSON.stringify(internal_origin_realmoneylink),
            internal_enabled: 0,
        };

        gameArray.push(prepareArray);

        if (req.query.import) {
            // Implement DB insertion logic as needed
        }
    }

    if (req.query.raw_list_output) {
        return res.status(200).json(getGamesDecode);
    }

    return res.status(200).json(gameArray);
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
