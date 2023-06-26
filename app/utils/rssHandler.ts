import FeedSub from "feedsub";
import bsky from "./bskyHandler";
import db from "./dbHandler";
let reader: any = null;
let lastDate: string = "";

interface Config {
  string: string;
  publishEmbed?: boolean;
}

let config: Config = {
  string: "",
  publishEmbed: false,
};

interface Item {
  title: string;
  link: {
    href: string;
  };
  published?: string;
  pubdate?: string;
  description: string;
}

interface ParseResult {
  text: string;
  embed?: Embed;
}

interface Embed {
  uri: string;
  title: string;
  description?: string;
}

async function start() {
  reader.read();

  reader.on("item", async (item: Item) => {
    let useDate = item.pubdate ? item.pubdate : item.published;
    if (!useDate)
      return console.log("No date provided by RSS reader for post.");

    if (new Date(useDate) <= new Date(lastDate)) return;

    console.log(
      `[${new Date().toUTCString()}] - [bsky.rss] Posting new item (${
        item.title
      })`
    );

    // @ts-ignore
    db.writeDate(new Date(useDate));
    let parsed = parseString(config.string, item);
    await bsky.post({
      content: parsed.text,
      embed: config.publishEmbed ? parsed.embed : undefined,
    });
  });
}

async function init({
  fetch_interval,
  fetch_url,
}: {
  fetch_interval: number;
  fetch_url: URL;
}) {
  config = await db.initConfig();
  if (!config.string) throw new Error("No string provided.");

  reader = new FeedSub(String(fetch_url), {
    interval: fetch_interval,
    emitOnStart: true,
    lastDate: (await db.readLast()) ? await db.readLast() : null,
  });

  lastDate = await db.readLast();
  return reader;
}

async function launch() {
  reader.start();
  return reader;
}

export default {
  start,
  init,
  launch,
};

function parseString(string: string, item: Item) {
  let result: ParseResult = {
    text: "",
    embed: {
      title: "",
      uri: "",
    },
  };

  let parsedString = string;
  if (string.includes("$title") || config.publishEmbed) {
    if (!item.title) throw new Error("No title provided from RSS reader.");
    parsedString = parsedString.replace("$title", item.title);
    if (config.publishEmbed && result.embed) {
      result.embed.title = item.title;
    }
  }

  if (string.includes("$link") || config.publishEmbed) {
    if (!item.link) throw new Error("No link provided from RSS reader.");
    /*if (!config.stringFields.link) throw new Error("No link field provided.");

    if (config.stringFields.link.includes(".")) {
      parsedString = parsedString.replace(
        "$link",
        // @ts-ignore
        joinDotField(config.stringFields.link, item)
      );

      if (config.publishEmbed && result.embed) {
        // @ts-ignore
        result.embed.uri = joinDotField(config.stringFields.link, item);
      }
    } else {
      parsedString = parsedString.replace(
        "$link",
        // @ts-ignore
        item[config.stringFields.link]
      );

      if (config.publishEmbed && result.embed) {
        // @ts-ignore
        result.embed.uri = item[config.stringFields.link];
      }
    }*/
    if (typeof item.link === "object") {
      parsedString = parsedString.replace("$link", item.link.href);

      if (config.publishEmbed && result.embed) {
        result.embed.uri = item.link.href;
      }
    } else {
      parsedString = parsedString.replace("$link", item.link);

      if (config.publishEmbed && result.embed) {
        result.embed.uri = item.link;
      }
    }
  }

  if (
    string.includes("$description") ||
    config.publishEmbed ||
    item.description
  ) {
    if (string.includes("$description")) {
      parsedString = parsedString.replace("$description", item.description);
    }

    if (config.publishEmbed && result.embed) {
      result.embed.description = item.description;
    }
  }

  result.text = parsedString;
  return result;
}

/* function joinDotField(field: string, item: Item) {
  let joinedField = item;
  let fields = field.split(".");
  for (let i = 0; i < fields.length; i++) {
    // @ts-ignore
    joinedField = joinedField[fields[i]];
  }
  return joinedField;
} */