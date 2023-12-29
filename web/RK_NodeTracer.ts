import { ComfyNode, ComfyWidget } from "typings/comfytypes";

export type NumberSpec = {
	min: number;
	max: number;
	step: number;
	default: number;
	precision?: number;
};

export type ComboSpec = { default: string; values: string[] };
export type NumberTypeIds = "INT" | "FLOAT" | "NUMBER";
export type TypeIds = NumberTypeIds | "COMBO";
export type Configuration =
	| {
			type: NumberTypeIds;
			spec: NumberSpec;
	  }
	| { type: "COMBO"; spec: ComboSpec };

export function isNumberTypeId(value: string): value is NumberTypeIds {
	return value === "INT" || value === "FLOAT" || value === "NUMBER";
}

export function isTypeId(value: string): value is TypeIds {
	return value === "INT" || value === "FLOAT" || value === "NUMBER" || value === "COMBO";
}

export interface ITransparent {
	isTransparent(): boolean;
	getConfiguration(): Configuration | null;
	follow(): Generator<ITransparent, void, unknown>;
}

export interface IVisited {
	getConfiguration(): Configuration;
}

export interface INodeTracer {
	all(): Generator<ITransparent, void, unknown>;
	configs(): Generator<IVisited, void, unknown>;
}

export type ComfyTracedNode = { node: ComfyNode; config_slot?: number };
export type ComfyNodeTracer = (node: ComfyNode) => Generator<ComfyTracedNode, void, unknown>;

export class RK_NodeTracer implements INodeTracer {
	start_node: ITransparent;
	constructor(start_node: ITransparent = null) {
		this.start_node = start_node;
	}

	*all(): Generator<ITransparent, void, unknown> {
		yield* this.#follow(this.start_node);
	}

	*configs(): Generator<IVisited, void, unknown> {
		yield* this.#followOpaque(this.start_node);
	}

	*#follow(node: ITransparent): Generator<ITransparent, void, unknown> {
		if (node) {
			yield node;
			for (const child of node.follow()) {
				yield* this.#follow(child);
			}
		}
	}

	*#followOpaque(node: ITransparent): Generator<IVisited, void, unknown> {
		if (node) {
			if (!node.isTransparent()) yield node;
			for (const child of node.follow()) {
				yield* this.#followOpaque(child);
			}
		}
	}
}


export function isTransparentNode(node: ComfyNode): boolean {
	return (node.constructor as any).type === "RK_ConfigFilterNode" || (node.constructor as any).type === "Reroute";
}

export function convertToConfig(widget: ComfyWidget): Configuration {
	const config = widget?.config || [];
	if (config.length) {
		if (config[0] instanceof Array) {
			return { type: "COMBO", spec: { values: config[0], default: config[0][0] } };
		} else {
			const type = config[0].toUpperCase();
			if (isNumberTypeId(type)) return { type: type, spec: config[1] as NumberSpec };
			if (type === "COMBO") return { type: type, spec: { default: "", values: config[1].values } };
		}
	}
	return null;
}

export function convertToTransparent(node: ComfyTracedNode, nextNode: ComfyNodeTracer): ITransparent {
	class Transparent implements ITransparent {
		traced: ComfyTracedNode;
		constructor(traced: ComfyTracedNode) {
			this.traced = traced;
		}

		isTransparent() {
			return isTransparentNode(this.traced.node);
		}

		getConfiguration() {
			if (this.traced.config_slot === undefined) return null;

			try {
				return convertToConfig(this.traced.node.inputs[this.traced.config_slot].widget);
			} catch (error) {
				return null;
			}
		}

		*follow() {
			for (const next of nextNode(this.traced.node)) {
				yield convertToTransparent(next, nextNode);
			}
		}
	}

	return new Transparent(node);
}

export function convertToComfyType(config: Configuration): string {
	switch (config.type) {
		case "INT":
		case "FLOAT":
		case "NUMBER":
			return "NUMBER"; // This feels really broken.

		case "COMBO":
			return config.spec.values.join(",");
	}
}
