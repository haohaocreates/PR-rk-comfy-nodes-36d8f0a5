import { IVisited, Configuration, NumberSpec, ComboSpec, NumberTypeIds } from "../RK_NodeTracer.js";
import { RK_ConfigConstrainer } from "../RK_ConfigConstrainer.js";

describe("Test RK_ConfigConstrainer", () => {
	const configurations: Configuration[] = [
		{ type: "INT", spec: { min: 1, max: 10, default: 5, step: 1 } },
		{ type: "FLOAT", spec: { min: 2.0, max: 12.0, default: 5.0, step: 0.1 } },
		{ type: "COMBO", spec: { default: "first", values: ["first", "second", "third"] } },
	];

	function makeVisited(c: Configuration): IVisited {
		return {
			getConfiguration() {
				return c;
			},
		};
	}

	it("can be constructed with empty array", () => {
		const constrainer = new RK_ConfigConstrainer([]);
	});

	it("has no configuration when constructed with empty", () => {
		const constrainer = new RK_ConfigConstrainer([]);

		expect(constrainer.getConfiguration()).toBeNull();
	});

	it("does not copy configuration with singe visited", () => {
		for (const configuration of configurations) {
			const visited: IVisited = {
				getConfiguration() {
					return configuration;
				},
			};

			const constrainer = new RK_ConfigConstrainer([visited]);

			expect(constrainer.getConfiguration()).toBe(configuration);
		}
	});

	it("copies configuration of same specs", () => {
		for (const configuration of configurations) {
			const constrainer = new RK_ConfigConstrainer([makeVisited(configuration), makeVisited(configuration)]);

			const expectation = expect(constrainer.getConfiguration()).withContext(`type ${configuration.type}`);
			expectation.not.toBe(configuration);
			expectation.toEqual(configuration);
		}
	});

	it("picks default from first spec", () => {
		for (const configuration of configurations) {
			const other_default: Configuration = {
				...configuration,
				spec: { ...configuration.spec, default: null },
			} as Configuration;

			const constrainer = new RK_ConfigConstrainer([makeVisited(configuration), makeVisited(other_default)]);

			const constrained = constrainer.getConfiguration();
			expect(constrained.spec.default).withContext(`type ${configuration.type}`).toEqual(configuration.spec.default);
		}
	});

	it("throws when constructed with different types", () => {
		expect(() => new RK_ConfigConstrainer(configurations.map((c) => makeVisited(c)))).toThrow();
	});

	it("copies to common interval for number configurations", () => {
		for (const configuration of configurations.filter((c) => c.type === "INT" || c.type === "FLOAT")) {
			const spec = configuration.spec as NumberSpec;
			const smaller: Configuration = {
				type: configuration.type as NumberTypeIds,
				spec: { min: spec.min + 1, max: spec.max - 1, default: spec.default, step: spec.step },
			};

			const constrainer = new RK_ConfigConstrainer([makeVisited(configuration), makeVisited(smaller)]);

			const expectation = expect(constrainer.getConfiguration()).withContext(`type ${configuration.type}`);
			expectation.not.toBe(configuration);
			expectation.not.toBe(smaller);
			expectation.toEqual(smaller);
		}
	});

	it("adjusts default when outside common number range", () => {
		for (const configuration of configurations.filter((c) => c.type === "INT" || c.type === "FLOAT")) {
			const spec = configuration.spec as NumberSpec;
			const disjoint_default: Configuration = {
				type: configuration.type as NumberTypeIds,
				spec: { min: spec.default + 1, max: spec.max, default: spec.default + 1, step: spec.step },
			};

			const constrainer = new RK_ConfigConstrainer([makeVisited(configuration), makeVisited(disjoint_default)]);

			const expectation = expect(constrainer.getConfiguration().spec.default).withContext(`type ${configuration.type}`);
			expectation.toBeGreaterThanOrEqual(spec.min);
			expectation.toBeLessThanOrEqual(spec.max);
		}
	});

	it("has no configuration for disjoint number ranges", () => {
		for (const configuration of configurations.filter((c) => c.type === "INT" || c.type === "FLOAT")) {
			const spec = configuration.spec as NumberSpec;
			const disjoint_default: Configuration = {
				type: configuration.type as NumberTypeIds,
				spec: { min: spec.max + 1, max: spec.max + 2, default: spec.max, step: spec.step },
			};

			const constrainer = new RK_ConfigConstrainer([makeVisited(configuration), makeVisited(disjoint_default)]);

			const constrained = constrainer.getConfiguration();
			expect(constrained).withContext(`type ${configuration.type}`).toBeNull();
		}
	});

	it("copies to common set for combo types", () => {
		function generatePermutations<T>(arr: T[]): T[][] {
			const result: T[][] = [];

			function permute(arr: T[], start: number): void {
				if (start === arr.length) {
					result.push([...arr]);
					return;
				}

				for (let i = start; i < arr.length; i++) {
					[arr[start], arr[i]] = [arr[i], arr[start]];
					permute(arr, start + 1);
					[arr[start], arr[i]] = [arr[i], arr[start]]; // Restore the array to its original state
				}
			}

			permute(arr, 0);
			return result;
		}

		for (const configuration of configurations.filter((c) => c.type === "COMBO")) {
			var spec = { ...(configuration.spec as ComboSpec) };
			for (const order of generatePermutations(Array.from(spec.values))) {
				var overlapped: Configuration = {
					type: "COMBO",
					spec: { default: order[1], values: order.filter((v, i) => i != 0) },
				};

				const constrainer = new RK_ConfigConstrainer([makeVisited(configuration), makeVisited(overlapped)]);

				const config = constrainer.getConfiguration();
				expect(config.type).toEqual("COMBO");
				expect(overlapped.spec.values.includes(config.spec.default as string))
					.withContext(`${order}`)
					.toBeTruthy();
				expect(new Set((config.spec as ComboSpec).values))
					.withContext(`${order}`)
					.toEqual(new Set(overlapped.spec.values));
			}
		}
	});
});
