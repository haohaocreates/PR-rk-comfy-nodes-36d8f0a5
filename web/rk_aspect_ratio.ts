import { app } from "/scripts/app.js";
import { ComfyWidgets } from "/scripts/widgets.js";
import { forwardOutputValues } from "/extensions/core/utilities.js";

import { IWidget, INodeOutputSlot } from "/types/litegraph";
import { ComfyNode } from "typings/comfytypes";

export interface RK_AspectRatioParameters {
	longest_side: IWidget;
	ratio: IWidget;
	swap: IWidget;
	info: IWidget;
	dimensions: number[];
}

export interface RK_AspectRatio extends ComfyNode {
	parameters: RK_AspectRatioParameters;
}

export class RK_AspectRatio {
	static category: string = "RK_Nodes/image";
	constructor() {
		this.parameters = {
			longest_side: ComfyWidgets.INT(
				this,
				"longest_side",
				["INT", { default: 1024, min: 128, max: 4096, step: 16 }],
				app
			).widget,
			ratio: ComfyWidgets.COMBO(
				this,
				"ratio",
				[["1:1", "1:2", "3:4", "2:5", "3:5", "4:5", "9:16"], { default: "3:5" }],
				app
			).widget,
			swap: ComfyWidgets.COMBO(this, "swap", [["min:max", "max:min"], { default: "min:max" }], app).widget,
			info: ComfyWidgets.STRING(this, "", ["", { default: "", multiline: true }], app).widget,
			dimensions: [1024, 1024],
		};

		this.addOutput("width", "INT");
		this.addOutput("height", "INT");

		this.#setCallback(this.parameters.longest_side);
		this.#setCallback(this.parameters.ratio);
		this.#setCallback(this.parameters.swap);

		this.serialize_widgets = true;
		this.isVirtualNode = true;

		this.#computeOutputs();
	}

	onConfigure(into) {
		this.#computeOutputs();
	}

	applyToGraph() {
		this.#computeOutputs();
		forwardOutputValues(this, (output: INodeOutputSlot, index: number) => this.parameters.dimensions[index]);
	}

	#computeOutputs(): void {
		var longest_side = Number(this.parameters.longest_side.value);
		const ratio: number[] = this.parameters.ratio.value.split(":").map((t: any) => Number(t));
		let other_side = Math.trunc((longest_side * ratio[0]) / ratio[1]);
		other_side = other_side + (other_side % 2);

		if (this.parameters.swap.value == "max:min") {
			const v = longest_side;
			longest_side = other_side;
			other_side = v;
		}

		this.parameters.dimensions = [other_side, longest_side];
		this.parameters.info.value = `${other_side} x ${longest_side}`;
	}

	#setCallback(widget: IWidget): void {
		const widget_callback = widget.callback;
		const self = this;
		widget.callback = function () {
			const result = widget_callback ? widget_callback.apply(this, arguments) : undefined;
			self.applyToGraph();
			return result;
		};
	}
}
