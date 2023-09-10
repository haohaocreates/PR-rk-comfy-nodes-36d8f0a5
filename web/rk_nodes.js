import { app } from "../../scripts/app.js";
import { applyInputWidgetConversionMenu } from "../core/utilities.js"

import { RK_AspectRatio } from "./rk_aspect_ratio.js";

const RK_NodesExtension = {
  // Unique name for the extension
  name: "RK_Nodes.Extension",
  async init(app) {
  },
  
  async setup(app) {
  },

  async addCustomNodeDefs(defs, app) {
  },

  async getCustomWidgets(app) {
  },

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
  },

  async registerCustomNodes(app) {
    console.log("[logging]", "register custom nodes");

    LiteGraph.registerNodeType(
      "RK_AspectRatio",
      Object.assign(RK_AspectRatio, {
        title_mode: LiteGraph.NORMAL_TITLE,
        title: "Aspect Ratio",
        collapsable: true,
      })
    );
    RK_AspectRatio.category = "RK_Nodes/image";
    applyInputWidgetConversionMenu(RK_AspectRatio, {}, app);
  },

  loadedGraphNode(node, app) {
  },

  nodeCreated(node, app) {
  },
};

app.registerExtension(RK_NodesExtension);
