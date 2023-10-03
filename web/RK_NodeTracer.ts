export type NumberSpec = {
	min: number;
	max: number;
	step: number;
	default: number;
};

export type ComboSpec = { default: string; values: string[] };
export type NumberTypeIds = "INT" | "FLOAT";
export type TypeIds = NumberTypeIds | "COMBO";
export type Configuration =
	| {
			type: NumberTypeIds;
			spec: NumberSpec;
	  }
	| { type: "COMBO"; spec: ComboSpec };

export function isNumberTypeId(value: string): value is NumberTypeIds {
	return value === "INT" || value === "FLOAT";
}

export function isTypeId(value: string): value is TypeIds {
	return value === "INT" || value === "FLOAT" || value === "COMBO";
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
