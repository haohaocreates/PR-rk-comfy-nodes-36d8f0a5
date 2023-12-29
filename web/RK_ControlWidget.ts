import { ComfyNode } from "typings/comfytypes";
import { IWidget, Vector2 } from "/types/litegraph";
import { ComboSpec, NumberSpec } from "./RK_NodeTracer";

import { ComfyWidgets } from "/scripts/widgets.js";
import { app } from "/scripts/app.js";

export type IAccess<T = string | number> = {
	type(): string;
	get(): T;
	set(v: T): void;
	options(): NumberSpec | ComboSpec;
};

export interface RK_ControlWidget<T = string | number> extends IWidget<T, any> {
	afterQueued(): void;
}

export class RK_ControlWidget<T = string | number> implements RK_ControlWidget<T> {
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

	computeSize(width: number): Vector2 {
		return [0, -4];
	}
}
