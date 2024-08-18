import * as cheerio from "cheerio";
import puppeteerExtra from "puppeteer-extra";
import stealhPlugin from "puppeteer-extra-plugin-stealth";

init();

async function searchGoogleMaps() {
  try {
    const start = Date.now();

    puppeteerExtra.use(stealhPlugin());

    const browser = await puppeteerExtra.launch({
      headless: false,
    });

    const page = await browser.newPage();

    const query = "bakso";

    try {
      await page.goto(
        `https://www.google.com/maps/search/${query.split(" ").join("+")}`
      );
    } catch (error) {
      console.log(`error going to page: ${error}`)
    }

    async function autoScroll(page) {
      await page.evaluate(async () => {
        const wrapper = document.querySelector('div[role="feed"]');

        await new Promise((resolve, reject) => {
          var totalHeight = 0;
          var distance = 1000;
          var scrollDelay  = 3000;

          var timer = setInterval(async () => {
            var scrillHeightBefore = wrapper.scrollHeight;
            wrapper.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrillHeightBefore) {
              totalHeight = 0;
              await new Promise((resolve) => setTimeout(resolve, scrollDelay));

              // calculate scrollHeight after waiting 
              var scrillHeightAfter = wrapper.scrollHeight;
              
              if (scrillHeightAfter > scrillHeightBefore) {
                // More Content loaded, keep scrolling
                return;
              } else {
                clearInterval(timer);
                resolve();
              }
            }
          }, 700)
        });
      });
    }
    
    await autoScroll(page);

    const html = await page.content();
    const pages = await browser.pages();
    await Promise.all(pages.map((page) => page.close()));
    
    await browser.close();
    console.log("browser close");

    // get all a tag parent where a tag href includes /maps/place
    const $ = cheerio.load(html);
    const aTags = $("a");
    const parents = [];
    aTags.each((i, el) => {
      const href = $(el).attr("href");
      if (!href) {
        return;
      } 
      if (href.includes("/maps/place/")) {
        parents.push($(el).parent())
      }
    });

    const bussinesses = [];
    let index = 0;
    parents.forEach((parent) => {
      const url = parent.find("a").attr("href");
      // get a tag where data-value="Website"
      const website = parent.find('a[data-value="Website"]').attr("href") || parent.find('a[data-value="Situs Web"]').attr("href");
      // find a div that includes the class fontHeadlineSmall 
      const storeName = parent.find("div.fontHeadlineSmall").text();
      // find span that includes class fontByMedium
      const ratingText = parent.find("span.fontBodyMedium > span").attr("aria-label");

      // get the first div that includes the class fontBodyMedium
      const bodyDiv = parent.find("div.fontBodyMedium").first();
      const children = bodyDiv.children();
      const lastChild = children.last();
      const firstOfLast = lastChild.children().first();
      const lastOfLast = lastChild.children().last();
      index = index + 1;

      const phoneNumber1 = lastOfLast?.text()?.split(".")?.[1]?.trim().replace("00 · ", "") == '00' ? null : lastOfLast?.text()?.split(".")?.[1]?.trim().replace("00 · ", "")
      const phoneNumber2 = lastOfLast?.text()?.split(".")?.[0].split('·')[1]?.trim() == "00" ? null : lastOfLast?.text()?.split(".")?.[0].split('·')[1]?.trim()


      bussinesses.push({
        index,
        storeName,
        placeId: `ChI${url?.split("?")?.[0]?.split("ChI")?.[1]}`,
        address: firstOfLast?.text()?.split(".")?.[1]?.trim(),
        category: firstOfLast?.text()?.split(".")?.[0]?.split("·")?.[0]?.trim(),
        phone: phoneNumber1 ?? phoneNumber2,
        googleUrl: url,
        bizWebsite: website,
        ratingText,
        stars: ratingText?.split("bintang")?.[0]?.trim() 
          ? Number(ratingText?.split("bintang")?.[0]?.trim().replace(",", "."))
          : null,
        numberOfReviews: ratingText?.split("bintang")?.[1]?.replace("Ulasan", "")?.trim() 
          ? Number(ratingText?.split("bintang")?.[1]?.replace("Ulasan", "")?.trim())
          : null,
      });
    });
    
    const end = Date.now();
    
    console.log(`time in second ${Math.floor((end - start) / 1000)}`);

    return bussinesses;
  } catch (error) {
    console.log("error at googleMaps", error.message);
    return [];
  }
}

async function init() {
  try {
    const places = await searchGoogleMaps();

    console.log("Ini Places", places);
  } catch (error) {
    console.log("Error in init:", error.message);
  }
}