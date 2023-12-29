/* Sketch
   This node creates a widget for the connected node with an additional modification element.
 */
import {
	ComboSpec,
	ComfyTracedNode,
	Configuration,
	convertToComfyType,
	convertToConfig,
	isNumberTypeId,
	isTransparentNode,
	isTypeId,
} from "./RK_NodeTracer.js";
import { app } from "/scripts/app.js";
import { forwardOutputValues } from "./utilities.js";

import { LLink, LiteGraph as LiteGraphType } from "/types/litegraph";
import { ComfyConvertedWidget, ComfyNode, ComfyNodeInputSlot } from "typings/comfytypes";
import { RK_ForwardWidget } from "./RK_ForwardWidget.js";
import { RK_ControlWidget } from "./RK_ControlWidget.js";

declare const LiteGraph: typeof LiteGraphType;

export interface RK_PrimitiveNode extends ComfyNode {
	control: RK_ControlWidget;
	configuration: Configuration;
}

export class RK_PrimitiveNode {
	static category: string;

	constructor() {
		this.configuration = null;

		this.control = new RK_ControlWidget(this, {
			get: () => this.widgets[0].value,
			set: (v: any) => {
				this.widgets[0].value = v;
			},
			type: () => this.configuration.type,
			options: () => this.configuration.spec,
		});

		this.addOutput("connect inputs...", "*");
		this.serialize_widgets = true;
		this.isVirtualNode = true;

		this.widgets = [];
		this.setSize(this.computeSize());
	}

	onConnectOutput(
		output_slot: number,
		data_type: string,
		input_info: ComfyNodeInputSlot,
		target_node: ComfyNode,
		target_slot: number
	): boolean {
		return data_type === "*" || this.acceptsType(convertToConfig(input_info.widget)?.type);
	}

	onConnectionsChange(side: number, slot_index: number, connected: boolean, link_info: LLink) {
		try {
			switch (side) {
				case LiteGraph.INPUT: {
					// This node has no inputs
					break;
				}
				case LiteGraph.OUTPUT: {
					console.log("create connection", this, connected, app.graph.getNodeById(link_info.target_id));
					this.onOutputConnectionsChanged(link_info, connected);
					console.log("created connection", this, connected, app.graph.getNodeById(link_info.target_id));
					break;
				}
			}
		} catch (error) {
			console.log("create connection failed", this, error);
			if (connected) {
				switch (side) {
					case LiteGraph.INPUT:
						break;
					case LiteGraph.OUTPUT:
						this.disconnectOutput(slot_index, app.graph.getNodeById(link_info.target_id));
						break;
				}
			}
		}
	}

	onAfterGraphConfigured() {
		this.outputs[0].links.map((link_id: number) => {
			const link_info = this.graph.links[link_id];
			this.onOutputConnectionsChanged(link_info, true);
		});
	}

	private onOutputConnectionsChanged(link_info: LLink, connected: boolean) {
		function tracedFromLink(link_info: LLink): ComfyTracedNode {
			return {
				node: app.graph.getNodeById(link_info.target_id) as ComfyNode,
				config_slot: link_info.target_slot,
			};
		}

		function* followOutputs(node: ComfyNode) {
			try {
				if (isTransparentNode(node))
					for (const link_id of node.outputs[0].links) {
						yield tracedFromLink(app.graph.links[link_id]);
					}
			} catch (error) {}
		}

		this.widgets = [];
		this.graph.setDirtyCanvas(true, false);

		if (connected) {
			const target_node = tracedFromLink(link_info).node;
			const inputs = target_node.inputs || [];
			const widget_name = inputs[link_info.target_slot]?.widget?.name;
			if (widget_name && target_node.widgets) {
				const target_widget = target_node.widgets.find((w) => w.name == widget_name) as ComfyConvertedWidget;
				if (target_widget) {
					var widget_copy = new RK_ForwardWidget(target_widget.name, target_widget.value, (v: string | number) =>
						forwardOutputValues(this, () => v)
					);
					widget_copy = Object.assign(widget_copy, {
						computeSize: target_widget.origComputeSize,
						serializeValue: target_widget.origSerializeValue,
						name: target_widget.name,
						options: target_widget.options,
						type: target_widget.origType,
					});

					const type = widget_copy.type.toUpperCase();
					if (isNumberTypeId(type)) this.configuration = { type: type, spec: widget_copy.options };
					else if (type === "COMBO")
						this.configuration = {
							type: "COMBO",
							spec: { values: widget_copy.options.values, default: target_widget.value },
						};

					this.addCustomWidget(widget_copy);
					this.addCustomWidget(this.control);
					this.addCustomWidget(this.control.widget);

					this.outputs[0].type = widget_copy.type;
					this.outputs[0].name = widget_name;
				}
			}
		} else this.resetToWildcard();

		this.setSize(this.computeSize());
	}

	private acceptsType(data_type: string): boolean {
		try {
			data_type = data_type.toUpperCase();
			if (isTypeId(data_type)) {
				if (this.configuration === null) return true;
				else return this.configuration.type === data_type;
			} else return false;
		} catch (error) {
			return false;
		}
	}

	private updateExternalType() {
		var config = this.configuration;

		this.outputs[0].name = config.type;
		this.outputs[0].type = convertToComfyType(config);

		switch (config.type) {
			case "INT":
			case "FLOAT": {
				// TODO add number widget
				// TODO add value control
			}
			case "COMBO":
				// TODO add combo widget
				// TODO add value control
				break;
		}
	}

	private resetToWildcard() {
		this.outputs[0].name = "connect inputs...";
		this.outputs[0].type = "*";

		this.configuration = null;
	}
}
