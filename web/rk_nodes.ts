import { app } from "/scripts/app.js";
import { applyInputWidgetConversionMenu } from "./utilities.js";

import { RK_AspectRatio } from "./rk_aspect_ratio.js";
import { CivitAIMetaChecker } from "./rk_civitai_meta_checker.js";

import type { LiteGraph as LiteGraphType } from "g:/github/ComfyUI/web/types/litegraph.js";
import { ComfyExtension } from "g:/github/ComfyUI/web/types/comfy.js";
import { ComfyNode } from "typings/comfytypes.js";
import { RK_ConfigFilterNode } from "./RK_ConfigFilterNode.js";

declare const LiteGraph: typeof LiteGraphType;

const RK_NodesExtension: ComfyExtension = {
	// Unique name for the extension
	name: "RK_Nodes.Extension",
	async init(app) {},

	async setup(app) {},

	async addCustomNodeDefs(defs, app) {},

	async getCustomWidgets(app) {
		return undefined;
	},

	async beforeRegisterNodeDef(nodeType, nodeData, app) {},

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

		applyInputWidgetConversionMenu(RK_AspectRatio, {}, app);
		RK_AspectRatio.category = "RK_Nodes/image"

		LiteGraph.registerNodeType(
			"RK_ConfigFilterNode",
			Object.assign(RK_ConfigFilterNode, {
				title_mode: LiteGraph.NORMAL_TITLE,
				title: "Filter Configuration",
				collapsable: true,
			})
		);

		RK_ConfigFilterNode.category = "RK_Nodes/utils";
	},

	loadedGraphNode(node, app) {},

	nodeCreated(node, app) {
		const comfy_node = node as ComfyNode;
		if (comfy_node.comfyClass.startsWith("RK_")) {
			switch (comfy_node.comfyClass) {
				case "RK_CivitAIMetaChecker":
					node = Object.assign(node, CivitAIMetaChecker, { app: app });
					break;

				default:
					break;
			}
		}
	},
};

app.registerExtension(RK_NodesExtension);
