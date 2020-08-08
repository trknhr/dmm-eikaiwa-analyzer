const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");
const puppeteer = require("puppeteer");
const d3 = require("d3");
const dom = new JSDOM(
    `<html>
        <head>
        <style>
        .body {
        height: 97%;
        }

        svg {
        height: 1800;
        width: 97%;
        }
    </style>
    </head>

<body><svg id="cal-heatmap"></svg>
</body>
</html>`,
    { resources: "usable", runScripts: "dangerously" }
);
global.document = dom.window.document;

function draw(sample) {
    const svg = d3.select("#cal-heatmap");
    const dateValues = sample.map((dv) => ({
        date: d3.timeDay(new Date(dv.date)),
        value: Number(dv.lessonCount),
    }));

    const dateMap = {};
    for (const d of dateValues) {
        dateMap[d.date] = d;
    }
    const dates = dateValues.map((c) => c.date);
    const maxDate = d3.max(dates);
    const minDate = d3.min(dates);
    const dateArray = d3.timeDay.range(minDate, maxDate).map((a) => {
        if (dateMap[a] != null) {
            return dateMap[a];
        }

        return {
            date: a,
            value: 0,
        };
    });

    const years = d3
        .nest()
        .key((d) => d.date.getUTCFullYear())
        .entries(dateArray)
        .reverse();

    const cellSize = 10;
    const cellMargin = 3;
    const yearHeight = cellSize * 7 + cellMargin * 7;
    const cellRound = 2;
    const topMargin = 15;
    const yearMargin = 12;
    const fontSize = 10;
    const fontColor = "#767676";

    const group = svg.append("g");

    const year = group
        .selectAll("g")
        .data(years)
        .join("g")
        .attr(
            "transform",
            (d, i) =>
                `translate(50, ${(yearHeight + yearMargin) * i + topMargin})`
        );

    // year label
    year.append("text")
        .attr("x", -5)
        .attr("y", -30)
        .attr("text-anchor", "end")
        .attr("font-size", 16)
        .attr("font-weight", 550)
        .attr("transform", "rotate(270)")
        .attr("fill", fontColor)
        .text((d) => d.key);

    const formatDay = (d) =>
        ["", "Mon", "", "Wed", "", "Fri", ""][(d.getUTCDay() + 1) % 7];
    const countDay = (d) => (d.getUTCDay() + 1) % 7;
    const timeWeek = d3.utcSaturday;

    const colorFn = d3
        .scaleLinear()
        .domain([1, 5])
        .range(["#9be9a8", "#40c463", "#30a14e", "#216e39"]);

    // day label
    year.append("g")
        .attr("text-anchor", "end")
        .selectAll("text")
        .data(d3.range(7).map((i) => new Date(1995, 0, i)))
        .join("text")
        .attr("x", -5)
        .attr("y", (d) => countDay(d) * (cellSize + cellMargin))
        .attr("dy", 11)
        .attr("font-size", fontSize)
        .attr("fill", fontColor)
        .text(formatDay);

    // month label
    year.append("g")
        .attr("text-anchor", "start")
        .selectAll("text")
        .data(d3.timeMonths(new Date(1995, 0), new Date(1995, 12)))
        .join("text")
        .attr("x", (d) => {
            return (
                timeWeek.count(d3.utcYear(d), d3.utcMonth(d)) *
                (cellSize + cellMargin)
            );
        })
        .attr("y", -5)
        .attr("font-size", fontSize)
        .attr("fill", fontColor)
        .text((d) =>
            d3.utcMonth(d).toLocaleString("default", { month: "short" })
        );

    // cell drawing
    year.append("g")
        .selectAll("rect")
        .data((d) => d.values)
        .join("rect")
        .attr("width", cellSize)
        .attr("height", cellSize)
        .attr(
            "x",
            (d) =>
                timeWeek.count(d3.utcYear(d.date), d.date) *
                (cellSize + cellMargin)
        )
        .attr("y", (d) => countDay(d.date) * (cellSize + cellMargin))
        .attr("fill", (d) => {
            if (d.value == 0) {
                return "#ebedf0";
            }
            return colorFn(d.value);
        })
        .attr("rx", cellRound)
        .attr("ry", cellRound)
        .append("data")
        .text((d) => `${d.date}: ${d.value}`);
}

async function main() {
    const rawdata = fs.readFileSync("mylessonHist.json");

    const data = JSON.parse(rawdata);

    const sample = [
        ...data.map((a) => {
            return [
                ...[...new Set(a.lessons.map((b) => b.date))].map((b) => {
                    return {
                        date: b,
                        lessonCount: a.lessons.filter((c) => c.date === b)
                            .length,
                    };
                }),
            ];
        }),
    ].flat();

    draw(sample);

    const window = dom.window;
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(window.document.documentElement.outerHTML);
    await page.screenshot({ path: "dmm-eikaiwa-analytics.png" });
    console.log("Finish!!");
    browser.close();
}

main();
