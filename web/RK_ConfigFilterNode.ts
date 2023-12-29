/* Sketch
  The nodes will behave like a Reroute node, except that you and the system apply a filter
  on the configuration, so that you can link nodes of the same type but with different
  configurations.
  
  E.g., 
  - get the common set of values in COMBO boxes
  - get the common input range of INT widgets
  - on top, apply a further reduction of the configuration

  The nodes are -- like Reroute a node -- invisible when forwarding values in the graph
  because they have no influence on values. The generating node on our input ensures that
  values live within the limits of the configuration we handed out.
*/

import { RK_ComboFilter } from "./RK_ComboFilter.js";
import { RK_ConfigFilter } from "./RK_ConfigFilter.js";
import {
	ComboSpec,
	Configuration,
	ITransparent,
	NumberSpec,
	RK_NodeTracer,
	isNumberTypeId,
	isTypeId,
	convertToConfig,
	ComfyTracedNode,
	convertToTransparent,
	isTransparentNode,
	convertToComfyType
} from "./RK_NodeTracer.js";
import { app } from "/scripts/app.js";
import { forwardOutputValues } from "./utilities.js";

import { INodeOutputSlot, IWidget, LLink, LiteGraph as LiteGraphType } from "/types/litegraph";
import { ComfyNode, ComfyNodeInputSlot, ComfyWidget } from "typings/comfytypes";

declare const LiteGraph: typeof LiteGraphType;

export interface RK_ConfigFilterNode extends ComfyNode {}

/**
 * @brief: this class glues the anonymous ComfyUI world to my TypeScripted extension.
 */
export class RK_ConfigFilterNode {
	static category: string;

	configuration: { input: Configuration; output: Configuration };
	controls: { min: IWidget<number, any>; max: IWidget<number, any>; filter: IWidget<string, any> };

	constructor() {
		this.configuration = { input: null, output: null };
		this.addInput("*", "*");
		this.addOutput("connect inputs...", "*");

		this.controls = {
			min: this.addWidget<IWidget<number, any>>("number", "Min", null, () => this.minLimitChanged()),
			max: this.addWidget<IWidget<number, any>>("number", "Max", null, () => this.maxLimitChanged()),
			filter: this.addWidget<IWidget<string, any>>("text", "Filter", null, () => this.comboFilterChanged()),
		};
		this.widgets = [];
		this.setSize(this.computeSize());

		this.serialize_widgets = true;
		this.isVirtualNode = true;
	}

	onConnectInput(
		input_slot: number,
		data_type: string,
		output_info: INodeOutputSlot,
		source_node: ComfyNode,
		source_slot: number
	): boolean {
		return data_type === "*" || this.acceptsType(data_type);
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
					const start_node = this.onInputConnectionsChanged(link_info);
					break;
				}
				case LiteGraph.OUTPUT: {
					this.onOutputConnectionsChanged(link_info, connected);
					break;
				}
			}
		} catch (error) {
			if (connected) {
				switch (side) {
					case LiteGraph.INPUT:
						this.disconnectInput(slot_index);
						break;
					case LiteGraph.OUTPUT:
						this.disconnectOutput(slot_index, app.graph.getNodeById(link_info.target_id));
						break;
				}
			}
		}
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

		const start_node = convertToTransparent(connected ? tracedFromLink(link_info) : { node: this }, followOutputs);
		const updated = Object.assign(
			new RK_ConfigFilter(),
			connected && this.configuration.output ? { configuration: this.configuration.output } : {}
		);

		updated.triggerUpdate(new RK_NodeTracer(start_node));
		this.configuration.output = updated.getConfiguration();

		this.widgets = [];
		this.graph.setDirtyCanvas(true, false);

		if (this.configuration.output) {
			this.updateExternalType();
		} else {
			this.resetToWildcard();
		}

		this.setSize(this.computeSize());
		this.updateLinkedInputs();
	}

	private updateExternalType() {
		var config = this.configuration.output;

		this.outputs[0].name = config.type;
		this.outputs[0].type = convertToComfyType(config);

		switch (config.type) {
			case "INT":
			case "FLOAT": {
				function clamp(control: IWidget<number, NumberSpec>, default_value: number) {
					control.value = Math.max(Math.min(control.value || default_value, control.options.max), control.options.min);
				}

				const precision = config.type === "INT" ? 0 : 1;
				const step = config.spec.step * 10;
				this.controls.min.options = { ...config.spec, step: step, precision: precision };
				clamp(this.controls.min, config.spec.min);

				this.controls.max.options = { ...config.spec, step: step, precision: precision };
				clamp(this.controls.max, config.spec.max);

				this.addCustomWidget(this.controls.min);
				this.addCustomWidget(this.controls.max);
				this.configuration.input = { type: config.type, spec: { ...config.spec } };

				this.adjustNumberInputConfiguration();
				break;
			}
			case "COMBO":
				if (this.controls.filter.value == undefined) this.controls.filter.value = ".*";

				this.addCustomWidget(this.controls.filter);
				this.configuration.input = { type: config.type, spec: { ...config.spec } };

				this.adjustComboInputConfiguration();
				break;
		}

		this.applyInputConfiguration();
	}

	private applyInputConfiguration() {
		const config = this.configuration.input;
		this.inputs[0].name = config.type;
		this.inputs[0].type = convertToComfyType(config);
		this.inputs[0].widget = { name: config.type, config: convertToComfyWidgetSpec(config) };

		this.addForwardingWidget(config);
	}

	/** Add a widget for the "Primitive" node where it can set it's value when it get's applied to the graph. For the "Primitive"
	 *  node, we look like an end-point for values, but we want to inform our connected outputs about values.
	 *
	 * @param config the configuration to use for the custom widget.
	 */
	private addForwardingWidget(config: Configuration) {
		class ForwardWidget implements IWidget {
			name: string;
			_value: any;
			_node: RK_ConfigFilterNode;

			constructor(name: string, value: any, node: RK_ConfigFilterNode) {
				this.name = name;
				this._value = value;
				this._node = node;
			}

			set value(value: any) {
				this._value = value;
				forwardOutputValues(this._node, (output: INodeOutputSlot, index: number) => this._value);
			}
			get value() {
				return this._value;
			}
			computeSize(width?: number): [number, number] {
				return [0, -4];
			}
		}

		const self = this;

		var widget = this.widgets.find((w) => (w as ForwardWidget)._node === this) as ForwardWidget;
		if (!widget) widget = this.addCustomWidget(new ForwardWidget(config.type, config.spec.default, this));
		else {
			widget.name = config.type;
			widget._value = config.spec.default;
		}
	}

	private resetToWildcard() {
		this.outputs[0].name = "connect inputs...";
		this.outputs[0].type = "*";

		this.inputs[0].name = "*";
		this.inputs[0].type = "*";
		this.inputs[0].widget = null;

		this.configuration = { input: null, output: null };
		this.controls.filter.value = null;
	}

	private updateLinkedInputs() {
		if (this.inputs[0].link) {
			const link_info = app.graph.links[this.inputs[0].link] as LLink;
			const origin = app.graph.getNodeById(link_info.origin_id) as ComfyNode;

			if (
				origin.onConnectOutput &&
				!origin.onConnectOutput(link_info.origin_slot, this.inputs[0].type, this.inputs[0], this, 0)
			) {
				this.disconnectInput(0);
				origin.connect(link_info.origin_slot, this, 0);
			}
		}
	}

	private onInputConnectionsChanged(link_info: LLink) {
		return convertToTransparent(app.graph.getNodeById(link_info.origin_id), function* (node: ComfyNode) {
			try {
				if (isTransparentNode(node))
					yield {
						node: app.graph.getNodeById(app.graph.links[node.inputs[0].link]) as ComfyNode,
					};
			} catch (error) {}
		});
	}

	private acceptsType(data_type: string): boolean {
		try {
			data_type = data_type.toUpperCase();
			if (isTypeId(data_type)) {
				if (this.configuration.output === null) return true;
				else return this.configuration.output.type === data_type;
			} else return false;
		} catch (error) {
			return false;
		}
	}

	private maxLimitChanged(): void {
		const min = this.controls.min.value;
		var max = this.controls.max.value;
		const options = this.controls.max.options;

		if (max !== null && min !== null && max < min)
			max = min + (options.step / 10.0) * Math.pow(10.0, -(options.precision || 0));
		this.controls.max.value = max;

		this.adjustNumberInputConfiguration();
		this.applyInputConfiguration();
		this.updateLinkedInputs();
	}

	private minLimitChanged(): void {
		var min = this.controls.min.value;
		const max = this.controls.max.value;
		const options = this.controls.min.options;

		if (min !== null && max !== null && min > max)
			min = max - (options.step / 10.0) * Math.pow(10.0, -(options.precision || 0));
		this.controls.min.value = min;

		this.adjustNumberInputConfiguration();
		this.applyInputConfiguration();
		this.updateLinkedInputs();
	}

	private comboFilterChanged(): void {
		try {
			this.adjustComboInputConfiguration();
			this.applyInputConfiguration();
			this.updateLinkedInputs();
		} catch (error) {
			// pretty rough...
			this.controls.filter.value = ".*";
		}
	}

	private adjustNumberInputConfiguration() {
		var spec = this.configuration.input.spec as NumberSpec;
		spec.min = this.controls.min.value;
		spec.max = this.controls.max.value;
		spec.default = Math.min(Math.max(spec.default, spec.min), spec.max);
	}

	private adjustComboInputConfiguration() {
		const filter = new RK_ComboFilter((this.configuration.output.spec as ComboSpec).values);

		filter.updateFilter(this.controls.filter.value);
		var spec = this.configuration.input.spec as ComboSpec;
		spec.values = filter.getValues();
		if (spec.values.length) {
			if (!spec.values.includes(spec.default)) spec.default = spec.values[0];
		} else spec.values = [spec.default];
	}
}

function convertToComfyWidgetSpec(config: Configuration) {
	switch (config.type) {
		case "INT":
		case "FLOAT":
			return [config.type as string, config.spec];

		case "COMBO":
			return [config.spec.values];
	}
}
