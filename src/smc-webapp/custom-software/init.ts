// Manage DB <-> UI integration of available *custom* compute images
// TODO: also get rid of hardcoded legacy software images

const { redux, Store, Actions, Table } = require("../app-framework");
import { Map as iMap } from "immutable";
import { CUSTOM_IMG_PREFIX } from "./util";
import { join as path_join } from "path";
const { capitalize } = require("smc-util/misc");

export const NAME = "compute_images";

// this must match db-schema.compute_images → field type → allowed values
// legacy image names are "default", "exp", or a timestamp-string
// custom iamges are "custom/<image-id>/<tag, usually latest>"
// the "custom/" string is supposed to be CUSTOM_IMG_PREFIX!
export type ComputeImageTypes = "legacy" | "custom";

// this must be compatible with db-schema.compute_images → field keys
export type ComputeImageKeys =
  | "id"
  | "src"
  | "type"
  | "display"
  | "url"
  | "desc"
  | "path"
  | "search_str"
  | "display_tag"
  | "disabled";

export type ComputeImage = iMap<ComputeImageKeys, string>;
export type ComputeImages = iMap<string, ComputeImage>;

interface ComputeImagesState {
  images?: ComputeImages;
}

// derive the actual compute image name (which will be set in the DB) from the selected ID.
export function custom_image_name(id: string): string {
  let tag: string;
  if (id.indexOf(":") >= 0) {
    [id, tag] = id.split(":");
  } else {
    tag = "latest";
  }
  return path_join(CUSTOM_IMG_PREFIX, id, tag);
}

class ComputeImagesStore extends Store<ComputeImagesState> {}

class ComputeImagesActions<ComputeImagesState> extends Actions<
  ComputeImagesState
> {}

export function id2name(id: string): string {
  return id
    .split("-")
    .map(capitalize)
    .join(" ");
}

function fallback(
  img: ComputeImage,
  key: ComputeImageKeys,
  replace: (img: ComputeImage) => string | undefined
): string {
  const ret = img.get(key);
  if (ret == null || ret.length == 0) {
    return replace(img) || "";
  }
  return ret;
}

function display_fallback(img: ComputeImage, id: string) {
  return fallback(img, "display", _ => id2name(id));
}

function desc_fallback(img: ComputeImage) {
  return fallback(img, "desc", _ => "*No description available.*");
}

/* if there is no URL set, derive it from the git source URL
 * this supports github, gitlab and bitbucket. https URLs look like this:
 * https://github.com/sagemathinc/cocalc.git
 * https://gitlab.com/orgname/projectname.git
 * https://username@bitbucket.org/orgname/projectname.git
 */
function url_fallback(img: ComputeImage) {
  const cloudgit = ["github.com", "gitlab.com", "bitbucket.org"];
  const derive_url = (img: ComputeImage) => {
    const src = img.get("src", undefined);
    if (src == null || src.length == 0) return;
    if (!src.startsWith("http")) return;
    for (const srv of cloudgit) {
      if (src.indexOf(srv) < 0) continue;
      if (src.endsWith(".git")) {
        return src.slice(0, -".git".length);
      } else {
        return src;
      }
    }
  };
  return fallback(img, "url", derive_url);
}

class ComputeImagesTable extends Table {
  constructor(NAME, redux) {
    super(NAME, redux);
    this._change = this._change.bind(this);
  }

  query() {
    return NAME;
  }

  options(): any[] {
    return [];
  }

  prepare(data: ComputeImages): ComputeImages {
    // console.log("ComputeImagesTable data:", data);
    // deriving disp, desc, etc. must be robust against null and empty strings
    return (
      data
        // filter disabled ones. we still want to have the data available, though.
        .filter(img => !img.get("disabled", false))
        .map((img, id) => {
          const display = display_fallback(img, id);
          const desc = desc_fallback(img);
          const url = url_fallback(img);
          const search_str = `${id} ${display} ${desc} ${url}`
            .split(" ")
            .filter(x => x.length > 0)
            .join(" ")
            .toLowerCase();
          // derive the displayed tag, docker-like
          const tag = id.indexOf(":") >= 0 ? "" : ":latest";
          const disp_tag = `${id}${tag}`;

          return img.withMutations(img =>
            img
              .set("display", display)
              .set("desc", desc)
              .set("search_str", search_str)
              .set("url", url)
              .set("display_tag", disp_tag)
          );
        })
    );
  }

  _change(table, _keys): void {
    const store: ComputeImagesStore | undefined = this.redux.getStore(NAME);
    if (store == null) throw Error("store must be defined");
    const actions = this.redux.getActions(NAME);
    if (actions == null) throw Error("actions must be defined");
    const data = table.get();
    actions.setState({ images: this.prepare(data) });
  }
}

redux.createStore(NAME, ComputeImagesStore, {});
redux.createActions(NAME, ComputeImagesActions);
redux.createTable(NAME, ComputeImagesTable);
