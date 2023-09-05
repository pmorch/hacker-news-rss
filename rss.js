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
const detailLimit = 200;
const AXIOS_TIMEOUT = 10000

const dbFile = 'data/articles.db';
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
                points integer,
                description text,
                url text
            );
        `);
        await db.asyncRun(`
            CREATE INDEX createTimeIndex on articles(createTime);
        `);
    }
}

async function deleteOldArtcilesFromDatabase() {
    // 30 days ago
    await db.asyncRun(`
        DELETE FROM articles
        WHERE createTime < STRFTIME('%s') - 30*24*60*60;
    `);
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
            console.error("vconsole " + event, error)
        });
    }
    return new JSDOM(text, { virtualConsole, url })
}

async function readability(url) {
    let response
    try {
	response = await axios.get(url, {
            timeout: AXIOS_TIMEOUT
        })
    } catch(error) {
	return `Couldn't get ${url}: ${error}`
    }

    // See Raw PDF contents shown as readable contents · Issue #703 ·
    // mozilla/readability
    // https://github.com/mozilla/readability/issues/703
    if (! (response.headers['content-type'] &&
           response.headers['content-type'].match(/html|xml/)
    ))
        return '&lt;Not HTML&gt;'

    html = response.data
    var doc = getJSDOM(html, url)
    let reader = new Readability(doc.window.document);
    let article = reader.parse();
    doc.window.close();

    // Also see Raw PDF contents shown as readable contents · Issue #703 ·
    // mozilla/readability
    // https://github.com/mozilla/readability/issues/703
    if (article == null || (
        ! article.title &&
        ! article.byline &&
        ! article.dir &&
        ! article.excerpt &&
        ! article.siteName
    )) {
        return '&lt;Unparsable&gt;'
    }
    return article.content;
}

async function updateArticleInDB(objectID) {
    let row = await db.asyncGet(
        `SELECT points FROM articles WHERE objectID=?`,
        hit.objectID
    )
    if (! row)
        return false
    if (row.points != hit.points) {
        process.stderr.write(
            `Updating points ${row.points}->${hit.points} for: ${
                getArticleURL(hit)
            }\n`
        );
        db.asyncRun(
            `UPDATE articles
                SET points=?
              WHERE objectID=?`,
            hit.points,
            hit.objectID
        )
    }
    return true
}

function getHNewsURL(hit) {
    return `https://news.ycombinator.com/item?id=${hit.objectID}`
}

function getArticleURL(hit) {
    return hit.url ? hit.url : getHNewsURL(hit)
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

    const title = `${hit.url ? '' : 'HNInternal: '}${hit.title}`

    await db.asyncRun(`
        INSERT INTO articles (
            objectID,
            createTime,
            title,
            points,
            description,
            url
        )
        VALUES(?,?,?,?,?,?)`,
        hit.objectID,
        hit.created_at_i,
        title,
        hit.points,
        description,
        url
    )
}

async function addArticleToFeed(feed, article) {
    const date = new Date(article.createTime * 1000)

    const title = `${article.title} (${article.points} pts)`
    // console.log("   ", date.toISOString())
    feed.addItem({
        title,
        id: article.objectID,
        link: article.url,
        description: article.description,
        date,
    })
}

async function start() {
    initDatabase()

    const response = await axios.get(jsonURL, {
        timeout: AXIOS_TIMEOUT
    });
    for (hit of response.data.hits) {
        // Don't add the same article twice
        if (await updateArticleInDB(hit)) {
            continue;
        }
        await addHitToDB(hit);
    }

    const feed = new Feed({
      title: "HN100 - Readable Contents",
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

    process.stdout.write(feed.rss2())

    deleteOldArtcilesFromDatabase()

    db.close()
}

async function processArgUrls(urls) {
    for (let url of urls) {
        console.log(url)
        console.log(await readability(url))
    }
}

let urls = [ ...process.argv ].slice(2);
if (urls.length > 0) {
    processArgUrls(urls)
} else {
    start()
}
