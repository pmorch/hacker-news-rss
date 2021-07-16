#!/usr/bin/node
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const process = require('process');
const fs = require('fs')
const { Feed } = require("feed");
const sqlite3 = require('sqlite3').verbose();
const util = require('util');
const he = require('he');

const jsonURL = 'https://hn.algolia.com/api/v1/search_by_date?tags=%28story,poll%29&numericFilters=points%3E100';

const dbFile = 'hacker-news-descriptions.db';
const db = new sqlite3.Database(dbFile)
db.serialize()

db.asyncRun = util.promisify(db.run);
db.asyncGet = util.promisify(db.get);
db.asyncAll = util.promisify(db.all);

const NULL_DEVICE='/dev/null';

async function initDatabase() {
    const existsRows = await db.asyncAll(`
        SELECT name
          FROM sqlite_master
         WHERE type='table'
           AND name='descriptions';
    `)
    if (existsRows.length == 0) {
        await db.asyncRun(`
            CREATE TABLE descriptions (
                objectID integer primary key,
                description text,
                createTime integer
            )
        `);
    }
}

function muteStderr(lambda) {
    const oldWrite = process.stderr.write;
    const stderrStream = fs.createWriteStream(NULL_DEVICE)
    const stderrStreamWrite = stderrStream.write.bind(stderrStream)
    process.stderr.write = stderrStreamWrite
    let returnvalue;
    try {
        returnvalue = lambda()
    } catch(error) {
        throw error;
    } finally {
        process.stderr.write = oldWrite
    }
    return returnvalue
}

async function readability(url) {
    const response = await axios.get(url)
    html = response.data
    var doc = muteStderr(() => {
        // console.log(html, url);
        return new JSDOM(html, { url });
    });
    let reader = new Readability(doc.window.document);
    let article = reader.parse();
    return article != null ? article.content : '&lt;Unparsable&gt;';
}

async function getMainDescription(hit, url) {
    const row = await db.asyncGet(
        `
            SELECT *
              FROM descriptions
             WHERE objectID=?
        `,
        hit.objectID
    )
    if (row) {
        return row.description
    }

    process.stderr.write(`Getting: ${url}\n`);
    const description = await readability(url);
    await db.asyncRun('INSERT INTO descriptions (objectID, description, createTime) VALUES(?,?,?)', hit.objectID, description, hit.created_at_i)
    return description
}

async function getDescription(hit, url) {
    const hnewsURL = getHNewsURL(hit)
    const mainDescription = await getMainDescription(hit, url);

    let description = '<p>';
    if (hit.url) {
        const encURL = he.encode(hit.url)
        description += `URL: <a href="${encURL}">${encURL}</a>, `
    }
    description += `See on <a href="${he.encode(hnewsURL)}">Hacker News</a></p>\n`
    return description + mainDescription
}

function getHNewsURL(hit) {
    return `https://news.ycombinator.com/item?id=${hit.objectID}`
}

function getArticleURL(hit) {
    return hit.url ? hit.url : getHNewsURL(hit)
}

async function addHit(feed, hit) {
    const articleURL = getArticleURL(hit)
    let description;
    try {
        description = await getDescription(hit, articleURL)
    } catch(error) {
        process.stderr.write(`    Failed: ${error}\n`);
        description = `Couldn't get: ${articleURL} - ${error}`
    }
    const date = new Date(hit.created_at_i * 1000)
    // console.error("   ", date.toISOString())

    feed.addItem({
        title:
            `${hit.url ? '' : 'HNInternal '}${hit.title} (${hit.points} pts)`,
        link: hit.url,
        // content: description,
        description,
        date,
    })
}

async function start() {
    initDatabase()
    const feed = new Feed({
      title: "Hacker News 100 - Readable Contents",
      link: jsonURL,
      description: "Uses Readability to add bodies to the RSS feed",
      language: "en",
      author: {
        name: "Peter V. Mørch",
        email: "peter@morch.com",
        link: "https://www.morch.com"
      }
    });

    const response = await axios.get(jsonURL);
    for (hit of response.data.hits) {
        await addHit(feed, hit);
        // break;
    }
    process.stdout.write(feed.rss2());
    db.close()
}

start()
