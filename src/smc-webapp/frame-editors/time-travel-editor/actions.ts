/*
TimeTravel Frame Editor Actions
*/
import { debounce } from "lodash";
import { List } from "immutable";
import { callback2, once } from "smc-util/async-utils";
import { filename_extension } from "smc-util/misc2";
import { SyncDoc } from "smc-util/sync/editor/generic/sync-doc";
const { webapp_client } = require("../../webapp_client");
import { Actions, CodeEditorState } from "../code-editor/actions";
import { FrameTree } from "../frame-tree/types";

const EXTENSION = ".time-travel";

interface TimeTravelState extends CodeEditorState {
  versions: List<Date>;
}

export class TimeTravelActions extends Actions<TimeTravelState> {
  protected doctype: string = "none"; // actual document is managed elsewhere
  private docpath: string;
  private docext: string;
  private syncdoc?: SyncDoc;

  public _init2(): void {
    this.docpath = this.path.slice(0, this.path.length - EXTENSION.length);
    this.docext = filename_extension(this.docpath);
    this.setState({ versions: List([]) });
    this.init_syncdoc();
  }

  public _raw_default_frame_tree(): FrameTree {
    return { type: "time_travel" };
  }

  private async init_syncdoc(): Promise<void> {
    const persistent = this.docext == "ipynb" || this.docext == "sagews"; // ugly for now (?)
    this.syncdoc = await callback2(webapp_client.open_existing_sync_document, {
      project_id: this.project_id,
      path: this.docpath,
      persistent
    });
    if (this.syncdoc == null) return;
    this.syncdoc.on("change", debounce(this.syncdoc_changed.bind(this), 1000));
    await once(this.syncdoc, "ready");
  }

  private syncdoc_changed(): void {
    if (this.syncdoc == null) return;
    const versions = List<Date>(this.syncdoc.versions());
    this.ensure_versions_are_stable(versions);
    this.setState({ versions });
  }

  // For each store version in a frame node, check to see
  // if the Date changes from the current versions to the new
  // ones and if so, fix it. We do this because if you're looking
  // at time t at position p, and somebody inserts a new version
  // before position p ... then suddenly position p is no longer
  // time t, which would be confusing.
  private ensure_versions_are_stable(new_versions): void {
    // TODO
    new_versions = new_versions;
  }

  // Get the given version of the document.
  public get_doc(version: Date): any {
    if (this.syncdoc == null) return;
    return this.syncdoc.version(version);
  }

  set_version(id: string, version: number): void {
    if (this._get_frame_node(id) == null) {
      throw Error(`no frame with id ${id}`);
    }
    if (typeof version != "number") { // be extra careful
      throw Error("version must be a number");
    }
    const versions = this.store.get("versions");
    if (versions == null || versions.size == 0) return;
    if (version == -1 || version >= versions.size) {
      version = versions.size - 1;
    } else if (version < 0) {
      version = 0;
    }
    this.set_frame_tree({ id, version });
  }

  step(id: string, delta: number): void {
    const node = this._get_frame_node(id);
    if (node == null) {
      throw Error(`no frame with id ${id}`);
    }
    const versions = this.store.get("versions");
    if (versions == null || versions.size == 0) return;
    let version = node.get("version");
    if (version == null) {
      // no current version, so just init it.
      this.set_version(id, -1);
      return;
    }
    version = (version + delta) % versions.size;
    if (version < 0) {
      version += versions.size;
    }
    this.set_version(id, version);
  }
}
