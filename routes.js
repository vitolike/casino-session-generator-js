const express = require('express');
const axios = require('axios');

const app = express();
const port = 3000;

const createProxy = async (req, res, targetUrl, path) => {
    try {
        const response = await axios({
            method: req.method,
            url: `${targetUrl}/${path}`,
            data: req.body,
            params: req.query,
            headers: {
                ...req.headers,
                cookie: 'referral_params=eJwrSk0szs+zTU/MTY0vSi0uKcpMLklNic/Mi0/OL80rKaoEAOQvDaE=; dateamlutsk-_zldp=M6KbIcofZ5OdbzCklHE/wT4m8vct0Wfje3KHtA0uoRoY8NE801Jy2Psphbw8i4k+WGzG+PDOVsw=; dateamlutsk-_zldt=7698a211-3f3c-4241-b261-240e437d0678-0; locale=ImVuIg$'
            }
        });

        res.status(response.status).send(response.data);
    } catch (error) {
        res.status(error.response.status).send(error.response.data);
    }
};

app.all('/bets.io_cookied/:slug', async (req, res) => {
    await createProxy(req, res, 'https://api.bets.io', 'api/bets.io_cookied');
});

app.all('/bets.io/:slug', async (req, res) => {
    await createProxy(req, res, 'https://api.bets.io', 'api/bets.io');
});

app.all('/arlekincasino.com/:slug', async (req, res) => {
    await createProxy(req, res, 'https://arlekincasino.com', 'api/arlekincasino.com');
});

app.all('/bitstarz.com/:slug', async (req, res) => {
    await createProxy(req, res, 'https://bitstarz.com', 'api/bitstarz.com');
});

app.all('/duxcasino.com/:slug', async (req, res) => {
    await createProxy(req, res, 'https://duxcasino.com', 'api/duxcasino.com');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
