import { Configuration, INodeTracer, ITransparent } from "web/RK_NodeTracer.js";
import { RK_ConfigFilter } from "../RK_ConfigFilter.js";

describe("Test RK_ConfigFilter", () => {
	it("starts with a null config", () => {
		const filter = new RK_ConfigFilter();

		expect(filter.getConfiguration()).toBeNull();
	});

	it("has null config when triggered without opaque nodes", () => {
		const node_tracer: INodeTracer = { *all() {}, *configs() {} };

		const filter = new RK_ConfigFilter();
		filter.triggerUpdate(node_tracer);

		expect(filter.getConfiguration()).toBeNull();
	});

	const configs: Configuration[] = [
		{ type: "INT", spec: { min: 10, default: 5, max: 20, step: 1 } },
		{ type: "FLOAT", spec: { min: 1.5, default: 2.5, max: 3.5, step: 0.1 } },
		{ type: "COMBO", spec: { default: "first", values: ["first", "second", "third"] } },
	];

	it("pick config from singular opaque node", () => {
		for (const config of configs) {
			const node_tracer: INodeTracer = {
				*all() {
					yield {
						isTransparent() {
							return false;
						},
						getConfiguration() {
							return config;
						},
						*follow() {},
					};
				},
				*configs() {
					yield* this.all();
				},
			};

			const filter = new RK_ConfigFilter();
			filter.triggerUpdate(node_tracer);

			expect(filter.getConfiguration()).withContext(`${config.type}`).toEqual(config);
		}
	});

	it("throws with different config types", () => {
		const combine = function* () {
			const pair = function* (first: Configuration) {
				for (const config of configs) {
					if (config.type != first.type) {
						yield [first, config];
					}
				}
			};

			for (const config of configs) yield* pair(config);
		};

		const filter = new RK_ConfigFilter();

		for (const pair of combine()) {
			const node_tracer = {
				nodes: pair.map<ITransparent>((c) => ({
					isTransparent() {
						return false;
					},
					getConfiguration() {
						return c;
					},
					*follow() {},
				})),

				*all() {
					yield* this.nodes.values();
				},
				*configs() {
					yield* this.all();
				},
			} as INodeTracer;

            const context = `${pair[0].type} and ${pair[1].type}`;

            expect(() => filter.triggerUpdate(node_tracer)).withContext(context).toThrow();
            expect(filter.getConfiguration()).toBeNull();
		}
	});
});
