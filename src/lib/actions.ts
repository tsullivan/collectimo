import * as NodeID3 from "node-id3";
import * as ffmpeg from "ffmpeg";
import { resolve as resolvePath } from "path";
import { constants as constantsFs, copyFile as copyFileNode, mkdir } from "fs";
import { ObservableInput } from "rxjs";
import { LogObj, Tagimo } from "../types";
import { logJson } from "../logjson";

const ALLOWED_TAGS = [
  "artist",
  "album",
  "trackNumber",
  "genre",
  "title",
  "year"
];

type ReadTagsCallbackFn = (LogObj) => void;
interface Video {
  fnExtractSoundToMP3: (
    destinationFileName: string,
    callback: (err: object, newFile: string) => void
  ) => void;
}

const { COPYFILE_EXCL } = constantsFs;

export const convertEncoding = (baseIn: string) => (
  file: string
): ObservableInput<string> =>
  new Promise((resolve, reject) => {
    const inFile = resolvePath(__dirname, "..", "..", baseIn, file);
    console.log(inFile);

    let process: Promise<Video>;
    try {
      process = new ffmpeg(inFile);
    } catch (err) {
      throw new Error(`ffmpeg error! ${JSON.stringify(err)}`);
    }
    process
      .then(video => {
        const destFile = file.replace(/m4a/, "mp3");
        video.fnExtractSoundToMP3(
          resolvePath(baseIn, destFile),
          (err, newFile) => {
            if (err) {
              return reject(err);
            }
            resolve(newFile);
          }
        );
      })
      .catch(err => {
        return reject(err);
      });
  });

export const readTags = (baseIn: string) => (
  file: string
): ObservableInput<LogObj> =>
  new Promise((resolve, reject): void => {
    NodeID3.read(
      resolvePath(baseIn, file),
      (err: Error, tags: Tagimo | false) => {
        if (err) {
          return reject(err);
        }

        let okTags: Tagimo = {};
        if (typeof tags === "object") {
          okTags = Object.keys(tags).reduce((acc, cur) => {
            if (ALLOWED_TAGS.includes(cur)) {
              return {
                ...acc,
                [cur]: tags[cur].slice(0, 99)
              };
            }
            return acc;
          }, {});
        }

        let newTags;
        let title;
        const fileParts = file.split("/");
        title = fileParts.pop();
        if (okTags.trackNumber != null) {
          title = okTags.trackNumber + " " + title;
        }
        const album = fileParts.pop();
        const artist = fileParts.pop();
        if (typeof okTags === "object") {
          newTags = { artist, album, title, ...okTags, raw: {} };
        } else {
          newTags = { artist, album, title };
        }

        resolve({ file, tags: newTags });
      }
    );
  });

const logCp = (file: string, dest: string, destFile: string): void => {
  console.log(`mkdir -p "${dest}"; cp -n "${file}" "${destFile}"`);
};
export const copyFile = (baseIn: string, baseOut: string) => (
  val: LogObj
): ObservableInput<LogObj> =>
  new Promise((resolve, reject): void => {
    const { file, tags } = val;
    const { genre: gen, artist: art, album: alb } = tags;

    // PROBLEM: this still can cause 200+ files or subdirectories in a directory
    let baseNewParts: string[] = [];
    if (gen && art && alb) {
      const genre = `Genres/${gen}`;
      baseNewParts = [genre, art, alb];
    } else if (art && alb) {
      const artist = `Artists/${art}`;
      baseNewParts = [artist, alb];
    } else if (alb) {
      const album = `Albums/${alb}`;
      baseNewParts = [album];
    } else {
      baseNewParts = ["Unknown"];
    }

    const fileParts = file.split("/");
    const baseFileName = fileParts[fileParts.length - 1];

    const src = resolvePath(baseIn, file);
    const dest = resolvePath(baseOut, ...baseNewParts);
    const destFile = resolvePath(dest, baseFileName);
    logCp(src, dest, destFile);

    /// MAKE DIRECTORY
    mkdir(dest, { recursive: true }, mkdirErr => {
      if (mkdirErr) {
        return reject(mkdirErr);
      }

      /// COPY FILE
      copyFileNode(src, destFile, COPYFILE_EXCL, (err: Error) => {
        if (err) {
          //reject(err);
        }
        resolve({ file: destFile, tags });
      });
    });
  });

export const removeTags = (basePath: string) => (
  val: LogObj
): ObservableInput<LogObj> =>
  new Promise((resolve, reject): void => {
    const { file } = val;
    /// REMOVE EXISTING TAGS
    NodeID3.removeTags(resolvePath(basePath, file), (err: Error) => {
      if (err) {
        return reject(err);
      }
      resolve(val);
    });
  });

export const updateTags = (basePath: string) => (
  val: LogObj
): ObservableInput<LogObj> =>
  new Promise((resolve, reject): void => {
    const { file, tags } = val;

    /// UPDATE TAGS
    NodeID3.update(tags, resolvePath(basePath, file), (err: Error) => {
      if (err) {
        return reject(err);
      }
      resolve({ file, tags });
    });
  });

export const logVal = (message: string): ((LogObj) => LogObj) => ({
  file,
  tags
}: LogObj): LogObj => {
  logJson([message, { file, tags }]);
  return { file, tags };
};

export const logStr = (message: string): ((string) => string) => (
  strVal: string
): string => {
  logJson([message, strVal]);
  return message;
};
