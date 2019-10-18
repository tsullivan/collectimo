import * as Rx from "rxjs";
import { promisify } from "util";
import { readFile } from "fs";
import { argv } from "yargs";
import { take, map, tap, mergeMap } from "rxjs/operators";
import {
  convertEncoding as convertEncodingAction,
  readTags as readTagsAction,
  copyFile as copyFileAction,
  removeTags as removeTagsAction,
  updateTags as updateTagsAction,
  logStr,
  logVal
} from "./lib/actions";

const readFileAsync = promisify(readFile);
const { in: fileIn, baseIn, baseOut } = argv as { [arg: string]: string };

if (!fileIn) {
  throw new Error("need a --in arg");
} else if (!baseIn) {
  throw new Error("need a --baseIn arg");
} else if (!baseOut) {
  throw new Error("need a --baseOut arg");
}

// add everything to collectimo
readFileAsync(fileIn, { encoding: "utf8" })
  .then((fileSrc: string) => {
    const files: string[] = fileSrc.split("\n");

    // start a ticker to trigger every 200ms
    const copier$ = Rx.interval(200).pipe(
      take(files.length - 1),
      map((i: number) => files[i]),
      tap(logStr("file name")),
      mergeMap(convertEncodingAction(baseIn)),
      mergeMap(readTagsAction(baseIn)),
      tap(logVal("tags read")),
      mergeMap(copyFileAction(baseIn, baseOut)),
      tap(logVal("file copied")),
      mergeMap(removeTagsAction(baseOut)),
      tap(logVal("tags removed")),
      mergeMap(updateTagsAction(baseOut))
    );

    copier$.subscribe();
  })
  .catch(err => {
    console.error("ERROR:", err);
    throw err;
  });
