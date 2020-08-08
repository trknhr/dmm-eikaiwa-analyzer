const fs = require("fs");
const UserAgent = require('user-agents');
const {addExtra} = require('puppeteer-extra')
 
const puppeteer = addExtra(require('puppeteer'))

const StealthPlugin = require('puppeteer-extra-plugin-stealth')
// To avoid recaptha
puppeteer.use(StealthPlugin())


const dataFile = "mylessonHist.json";
async function main() {
    let data = null;
    if (fs.existsSync(dataFile)) {
        const rawData = fs.readFileSync(dataFile);
        data = JSON.parse(rawData);
    }

    const latestMonth = data ? data[data.length - 1].month : null;

    console.log("Start:");
    const browser = await puppeteer.launch({
        headless: true,
        slowMo: 10,
        defaultViewport: null,
    });
    let [result, error] = await getUserData(browser, latestMonth);

    if (error != null) {
        console.log(error.message);
        await browser.close();
        return;
    }

    if(latestMonth) {
        data[data.length - 1] = result
        result = data
    }
    let json = JSON.stringify(result);
    fs.writeFile(dataFile, json, (err) => {
        if (err) {
            console.log(`An error happens during saving data::${err}`);
        }
    });

    await browser.close();
}

async function getUserData(browser, latestMonth) {
    const page = await browser.newPage();

    const userAgent = new UserAgent();

    await page.setUserAgent(userAgent.toString())

    const loginURL = "https://accounts.dmm.com/service/login/password";
    await page.goto(loginURL, { waitUntil: "domcontentloaded", timeout: 0 });

    console.log("Start login");
    // If you have a session already, it redirects to top dmm page even though its status is 200...
    if (page.url() === loginURL) {
        try {
            await page.type("#login_id", process.env.DMM_USER);
            await page.type("#password", process.env.DMM_PASSWORD);

            await page.waitFor(3000);
            await page.click("input[type=submit]");
        } catch (e) {
            return [
                null,
                {
                    message:
                        "Login failure. Please confirm DMM_USER/DMM_PASSWORD again.",
                },
            ];
        }

        await page.waitForNavigation({ waitUntil: "networkidle2" });

        if (page.url() === loginURL) {
            return [
                null,
                {
                    message:
                        "Login failure. DMM_USER or DMM_PASSWORD is incorrect.",
                },
            ];
        }

        console.log("Login success!!");
    }
    console.log("End login");

    await page.goto("https://eikaiwa.dmm.com/lesson/", {
        waitUntil: "domcontentloaded",
    });

    async function getAllMonth(latestM) {
        return await page.evaluate((latestM) => {
            const allMonthsDom = document.querySelector(
                "select[name=history_date]"
            ).options;
            const allMonths = [];
            for (const m of allMonthsDom) {
                if (
                    latestM == null ||
                    parseInt(m.value) >= parseInt(latestM)
                ) {
                    allMonths.push(m.value);
                }
            }
            return allMonths;
        }, latestM);
    }

    async function getAllPageId() {
        return await page.evaluate(() => {
            const pageListDom = document
                .querySelector("#lessonHistory")
                .lastElementChild.querySelectorAll("li");
            const pageList = [];
            for (const p of pageListDom) {
                if (!isNaN(parseInt(p.innerText))) {
                    pageList.push(p.innerText);
                }
            }
            return pageList;
        });
    }

    const result = [];
    try {
        const allMonths = await getAllMonth(latestMonth);

        for (const m of allMonths) {
            // wait 1000
            await page.waitFor(1000);
            // All lessons of the month
            const monthlyResult = { month: m, lessons: [] };
            await page.goto(
                `https://eikaiwa.dmm.com/lesson/index/${1}/?hd=${m}/`,
                { waitUntil: "domcontentloaded" }
            );
            const pageList = await getAllPageId();
            console.log(`Start to get ${m}`);
            for (const pageId of pageList) {
                await page.goto(
                    `https://eikaiwa.dmm.com/lesson/index/${pageId}/?hd=${m}/`,
                    { waitUntil: "domcontentloaded" }
                );

                const lessons = await page.evaluate(() => {
                    function isCanceledLessen(lessenNode) {
                        return lessenNode.querySelector(".mg-t12") != null;
                    }

                    const res = [];
                    const nodes = document.querySelectorAll("div#contents");
                    nodes.forEach((n) => {
                        if (isCanceledLessen(n)) {
                            console.log("cancelled", n);
                            return;
                        }
                        let date = n
                            .querySelector("#time")
                            .innerText.split("\n")[0];
                        date = date
                            .split("（")[0]
                            .replace("年", "-")
                            .replace("月", "-")
                            .replace("日", "");
                        const country = n.querySelector("#country").innerText;
                        const name = n
                            .querySelector("#name")
                            .querySelector("#en").innerText;
                        res.push({
                            date,
                            teacher: {
                                country,
                                name,
                            },
                        });
                    });

                    return res;
                });

                monthlyResult.lessons.push(...lessons);
            }

            console.log(`End to get ${m}`);
            result.push(monthlyResult);
        }
    } catch (e) {
        return [
            null,
            {
                message: `An error happen during correcting your historical data: ${e}`,
            },
        ];
    }

    return [result, null];
}

main();
