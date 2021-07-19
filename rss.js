#!/usr/bin/node
const { Readability } = require('@mozilla/readability');
const { JSDOM, VirtualConsole } = require('jsdom');
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
           AND name='articles';
    `)
    if (existsRows.length == 0) {
        await db.asyncRun(`
            CREATE TABLE articles (
                objectID integer primary key,
                createTime integer,
                title text,
                description text,
                url text
            )
        `);
    }
}

function getJSDOM(text, url) {
    const virtualConsole = new VirtualConsole()
    for (let event of [ 'jsdomError', 'error', 'warn', 'info', 'dir' ]) {
        virtualConsole.on(event, (error) => {
            if (error.detail && error.detail.length &&
                error.detail.length > detailLimit) {
                error.detail =
                    `long string, length:${
                    error.detail.length}, first ${detailLimit
                    } chars:\n${error.detail.substring(0, detailLimit)}`
            }
            console.log("vconsole " + event, error)
        });
    }
    return new JSDOM(text, { virtualConsole, url })
}

async function readability(url) {
    const response = await axios.get(url)
    html = response.data
    var doc = getJSDOM(html, url)
    let reader = new Readability(doc.window.document);
    let article = reader.parse();
    return article != null ? article.content : '&lt;Unparsable&gt;';
}

async function dbHasArticle(objectID) {
    let row = await db.asyncGet(
        `SELECT objectID FROM articles WHERE objectID=?`,
        objectID
    )
    return !!row
}

function getHNewsURL(hit) {
    return `https://news.ycombinator.com/item?id=${hit.objectID}`
}

function getArticleURL(hit) {
    return hit.url ? hit.url : getHNewsURL(hit)
}

async function getDescription(hit) {
    const mainDescription = await readability(getArticleURL(hit));

    let description = '<p>';
    if (hit.url) {
        const encURL = he.encode(hit.url)
        description += `URL: <a href="${encURL}">${encURL}</a>, `
    }
    description += `See on <a href="${he.encode(getHNewsURL(hit))}">Hacker News</a></p>\n`
    return description + mainDescription
}

async function addHitToDB(hit) {
    const url = getArticleURL(hit)
    const hnewsURL = getHNewsURL(hit)

    process.stderr.write(`Getting: ${url}\n`);

    let description = '<p>';
    if (hit.url) {
        const encURL = he.encode(hit.url)
        description += `URL: <a href="${encURL}">${encURL}</a>, `
    }
    description +=
        `See on <a href="${he.encode(hnewsURL)}">Hacker News</a></p>\n`
    description += await readability(url);

    const title =
        `${hit.url ? '' : 'HNInternal: '}${hit.title} (${hit.points} pts)`

    await db.asyncRun(`
        INSERT INTO articles (
            objectID,
            createTime,
            title,
            description,
            url
        )
        VALUES(?,?,?,?,?)`,
        hit.objectID,
        hit.created_at_i,
        title,
        description,
        url
    )
}

async function addArticleToFeed(feed, article) {
    const date = new Date(article.createTime * 1000)
    // console.log("   ", date.toISOString())
    feed.addItem({
        title: article.title,
        id: article.objectID,
        link: article.url,
        description: article.description,
        date,
    })
}

async function start() {
    initDatabase()

    const response = await axios.get(jsonURL);
    for (hit of response.data.hits) {
        // Don't add the same article twice
        if (await dbHasArticle(hit.objectID)) {
            continue;
        }
        await addHitToDB(hit);
    }

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

    let articles = await db.asyncAll(
        `SELECT *
           FROM articles
          WHERE createTime > strftime('%s', 'now') - 24*60*60
       ORDER BY createTime DESC`
    )
    for (let article of articles) {
        addArticleToFeed(feed, article)
    }

    process.stdout.write(feed.rss2());

    db.close()
}

start()
