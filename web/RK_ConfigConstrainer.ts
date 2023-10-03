import { IVisited, Configuration, NumberSpec, ComboSpec, TypeIds } from "./RK_NodeTracer.js";

/**
 * @brief Compute a configuration that satisfies constraits of a visited configurations.
 */
export class RK_ConfigConstrainer {
	#combined: Configuration = null;

	constructor(visited_outputs: IVisited[]) {
		switch (visited_outputs.length) {
			case 0:
				break;

			case 1:
				this.#combined = visited_outputs[0].getConfiguration();
				break;

			default:
				const type = this.#copyConfiguration(visited_outputs[0].getConfiguration());
				this.#assertSameTypes(type, visited_outputs);
				switch (type) {
					case "FLOAT":
					case "INT":
						this.#constrainNumbers(visited_outputs);
						break;

					case "COMBO":
						this.#constrainCombos(visited_outputs);
						break;

					default:
						break;
				}
				break;
		}
	}

	getConfiguration(): Configuration {
		return this.#combined;
	}

	#copyConfiguration(original: Configuration) {
		switch (original.type) {
			case "INT":
			case "FLOAT":
				this.#combined = { type: original.type, spec: { ...original.spec } };
				break;
			case "COMBO":
				this.#combined = { type: original.type, spec: { ...original.spec } };
				break;
		}
		return original.type;
	}

	#constrainNumbers(visited_outputs: IVisited[]) {
		var spec = this.#combined.spec as NumberSpec;
		for (var i = 1; i < visited_outputs.length; ++i) {
			const other = visited_outputs[i].getConfiguration().spec as NumberSpec;
			spec.min = Math.max(spec.min, other.min);
			spec.max = Math.min(spec.max, other.max);
			spec.default = Math.max(Math.min(spec.default, spec.max), spec.min);
		}
		if (spec.min > spec.max) this.#combined = null;
	}

	#constrainCombos(visited_outputs: IVisited[]) {
		var spec = this.#combined.spec as ComboSpec;
		var current = new Set<string>(spec.values);
		for (var i = 1; current.size > 0 && i < visited_outputs.length; ++i) {
			const other = (visited_outputs[i].getConfiguration().spec as ComboSpec).values;
			var common = new Set<string>();
			for (const value of other) {
				if (current.has(value)) common.add(value);
			}
			current = common;
		}
		if (current.size == 0) {
			this.#combined = null;
		} else {
			const values = Array.from(current);
			this.#combined.spec = {default: current.has(spec.default) ? spec.default : values[0], values: values};
		}
	}

	#assertSameTypes(type: TypeIds, visited_outputs: IVisited[]) {
		if (!visited_outputs.reduce((same, v) => same && v.getConfiguration().type === type, true)) {
			throw new Error(
				`Cannot constrain configs of different types. Expected '${type}', but got '${visited_outputs.map(
					(c) => c.getConfiguration().type
				)}'`
			);
		}
	}
}
