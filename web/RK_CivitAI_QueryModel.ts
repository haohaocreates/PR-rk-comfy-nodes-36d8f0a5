/* Sketch: take a model name as input, compute it's sha256 checksum -- we might need to do that in a python module -- and then query CivitAI's model information. */

import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

import { ComfyWidgets } from "/scripts/widgets.js";

import { ComfyConvertedWidget, ComfyNode, ComfyWidget } from "typings/comfytypes";
import {
	INodeInputSlot,
	INodeOutputSlot,
	IWidget,
	LGraphNode,
	LLink,
	LiteGraph as LiteGraphType,
	widgetTypes,
} from "/types/litegraph";
import { forwardOutputValues } from "./utilities.js";
import { ComboSpec, NumberSpec, isNumberTypeId } from "./RK_NodeTracer.js";

declare const LiteGraph: typeof LiteGraphType;

type IAccess<T = string | number> = { type(): string; get(): T; set(v: T): void; options(): NumberSpec | ComboSpec };

interface RK_ControlWidget<T = string | number> extends IWidget<T, any> {
	afterQueue(): void;
}

class RK_ControlWidget<T = string | number> implements RK_ControlWidget<T> {
	widget: IWidget<string, any>;
	access: IAccess;

	constructor(parent: ComfyNode, access: IAccess) {
		this.widget = ComfyWidgets.COMBO(
			parent,
			"control",
			[["constant", "random", "increment", "decrement"], { default: "random" }],
			app
		).widget;

		this.access = access;
	}

	afterQueued(): void {
		function evaluate(current: number, spec: NumberSpec, control: string): number {
			const range = (spec.max - spec.min + 1) / spec.step;
			var next = current;

			switch (control) {
				case "constant":
					break;
				case "random":
					next = spec.min + Math.floor(Math.random() * range) * spec.step;
					break;
				case "increment":
					next = current + spec.step;
					if (next > spec.max) next = spec.min;
					break;
				case "decrement":
					next = current - spec.step;
					if (next < spec.min) next = spec.max;
					break;
			}
			return next;
		}
		const control = this.widget.value;
		const options = this.access.options();
		if ("min" in options) {
			this.access.set(evaluate(this.access.get() as number, options, control));
		} else if ("values" in options) {
			const values = options.values;
			const current_index = values.indexOf(this.access.get() as string);
			const index_count = values.length - 1;
			const index = evaluate(
				current_index,
				{ min: 0, max: index_count, default: current_index, step: 1, precision: 0 },
				control
			);
			this.access.set(values[index]);
		}
	}
}
export interface RK_QueryCivitAI_ModelInfo extends ComfyNode {
	info: IWidget<string, any>;
	controls: { control: RK_ControlWidget<string> };
}

type CivitAI_Hashes = {
	AutoV1: string;
	AutoV2: string;
	AutoV3: string;
	BLAKE3: string;
	CRC32: string;
	SHA256: string;
};

type CivitAI_FileMetaData = {
	fp: "fp16" | "fp32" | undefined;
	size: "full" | "pruned" | undefined;
	format: "SafeTensor" | "PickleTensor" | "Other" | undefined;
};

type CivitAI_File = {
	downloadUrl: URL;
	hashes: CivitAI_Hashes;
	id: number;
	metadata: CivitAI_FileMetaData;
	name: string;
	pickleScanMessage: string;
	pickleScanResult: string;
	primary: boolean;
	scannedAt: string;
	sizeKB: number;
	type: "Checkpoint" | "TextualInversion" | "Hypernetwork" | "AestheticGradient" | "LORA" | "Controlnet" | "Poses";
	virusScanMessage: string;
	virusScanResult: string;
};

type CivitAI_Model = {
	name: string;
	nsfw: boolean;
	poi: boolean;
	type: "Checkpoint" | "TextualInversion" | "Hypernetwork" | "AestheticGradient" | "LORA" | "Controlnet" | "Poses";
};

type CivitAI_ModelInfo = {
	baseModel: string;
	baseModelType: any;
	createdAt: string;
	description: HTMLElement;
	downloadUrl: URL;
	earlyAccessTimeFrame: number;
	files: CivitAI_File[];
	id: number;
	images: any[];
	model: CivitAI_Model;
	modelId: number;
	name: string;
	publishedAt: string;
	stats: { downloadCount: number; ratingCount: number; rating: number };
	trainedWords: string[];
	trainingDetails: string | undefined;
	trainingStatus: string | undefined;
	updatedAt: string;
};

export class RK_QueryCivitAI_ModelInfo {
	static category: string;

	static IS_PROXY = Symbol();

	widget_copy: any;
	get_config_symbol: Symbol = null;
	get_config: Function = null;

	constructor() {
		this.info = ComfyWidgets.STRING(this, "", ["", { default: "", multiline: true }], app).widget;
		this.widget_copy = null;
		this.controls = {
			control: new RK_ControlWidget(this, {
				type: () => "COMBO",
				get: () => this.widget_copy.value as string,
				set: (v: string): void => {
					this.widget_copy.value = v;
				},
				options: () => {
					return { values: this.get_config()[0] as string[], default: "" };
				},
			}),
		};

		this.addOutput("connect model", "*");
		this.serialize_widgets = true;
		this.isVirtualNode = true;
	}

	onConnectOutput(
		output_slot: number,
		data_type: string,
		input_info: INodeInputSlot,
		target_node: ComfyNode,
		target_slot: number
	) {
		if (data_type === "COMBO") {
			return true;
		} else return false;
	}

	onAfterGraphConfigured() {
		if (this.get_config_symbol || !this.isOutputConnected(0)) return;

		const link_info = this.graph.links[this.outputs[0].links[0]];
		const target_node = this.graph.getNodeById(link_info.target_id) as ComfyNode;
		const target_widget = target_node.inputs[link_info.target_slot].widget;
		this.addForwardWidgetForTarget(target_widget, target_node);
	}

	onConnectionsChange(side: number, slot_index: number, connected: boolean, link_info: LLink) {
		try {
			switch (side) {
				case LiteGraph.OUTPUT: {
					if (connected) {
						if (!this.get_config) {
							const target_node = this.graph.getNodeById(link_info.target_id) as ComfyNode;
							const target_widget = target_node.inputs[link_info.target_slot].widget;
							this.addForwardWidgetForTarget(target_widget, target_node);
						}
					} else {
					}
					break;
				}
				case LiteGraph.INPUT: {
					// This node has no inputs
					break;
				}
			}
		} catch (error) {
			console.log("create connection failed", this, error);
			if (connected) {
				switch (side) {
					case LiteGraph.OUTPUT:
						this.disconnectOutput(slot_index, this.graph.getNodeById(link_info.target_id));
						break;
					case LiteGraph.INPUT:
						break;
				}
			}
		}
	}

	private addForwardWidgetForTarget(target_widget: ComfyWidget, target_node: ComfyNode) {
		const get_config_symbol = Object.getOwnPropertySymbols(target_widget).find((s) => typeof s === "symbol");
		if (get_config_symbol) {
			this.get_config_symbol = get_config_symbol;
			this.get_config = target_widget[get_config_symbol];

			const widget_name = target_widget.name;
			if (widget_name && target_node.widgets) {
				const target_widget = target_node.widgets.find((w) => w.name == widget_name) as ComfyConvertedWidget;
				if (target_widget) {
					class ForwardWidget implements IWidget {
						name: string;
						type: widgetTypes;
						options?: any;
						_value: any;
						_action: (v: any) => void;

						constructor(name: string, value: any, action: (v: any) => void) {
							this.name = name;
							this._value = value;
							this._action = action;
						}

						set value(value: any) {
							this._value = value;
							this._action(this._value);
						}

						get value(): any {
							return this._value;
						}
					}
					var widget_copy = new ForwardWidget(widget_name, target_widget.value, (v: any) => {
						forwardOutputValues(this, () => v);
						this.queryModelInfo(v);
					});

					widget_copy = Object.assign(widget_copy, {
						computeSize: target_widget.origComputeSize,
						serializeValue: target_widget.origSerializeValue,
						name: target_widget.name,
						options: target_widget.options,
						type: target_widget.origType,
					});

					if (widget_copy.type === "combo") widget_copy.options.values = () => this.get_config?.()?.[0];

					this.addCustomWidget(widget_copy);
					this.addCustomWidget(this.controls.control);

					this.widget_copy = widget_copy;
					this.outputs[0].type = widget_copy.type;
					this.outputs[0].name = widget_name;
				}
			}
		} else {
			console.log("nothing to configure, yet...", this);
		}
	}

	private async queryModelInfo(name: string) {
		const response = await api.fetchApi("/RK_Nodes/get_model_info", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name: name }),
		});

		if (response.ok) {
			const info = (await response.json()) as CivitAI_ModelInfo;
			this.info.value = `${info.model.name} (${info.id})\nbase: ${info.baseModel}\ntrigger: ${info.trainedWords.join(
				", "
			)}`;
		} else {
			this.info.value = await response.text();
		}
	}
}
