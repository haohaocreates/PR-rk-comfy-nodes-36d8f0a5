import { Configuration, ITransparent, IVisited, RK_NodeTracer } from "../RK_NodeTracer.js";

describe("test RK_NodeTracer", () => {
	it("is empty without iterated nodes", () => {
		const tracer = new RK_NodeTracer();
		expect(tracer.all()).toBeTruthy();
		expect(tracer.configs()).toBeTruthy();
		expect(Array.from(tracer.all()).length).toEqual(0);
		expect(Array.from(tracer.configs()).length).toEqual(0);
	});

	const config: Configuration = { type: "INT", spec: { default: 1, min: 0, max: 2, step: 1 } };

	it("yields opaque node for all", () => {
		const start_node: ITransparent = {
			isTransparent() {
				return false;
			},
			getConfiguration(): Configuration {
				return config;
			},
			*follow() {},
		};

		const tracer = new RK_NodeTracer(start_node);

		const all = Array.from(tracer.all());
		const opaque = Array.from(tracer.configs());

		expect(all.length).toEqual(1);
		expect(all[0]).toBe(start_node);
		expect(opaque.length).toEqual(1);
		expect(opaque[0]).toBe(start_node);
	});

	it("all collects all followed nodes", () => {
		const count: number = 6 + Math.trunc(Math.random() * 4);
		const start_node = {
			depth: count,
			isTransparent() {
				return (this.depth % 2) != 0;
			},
			getConfiguration(): Configuration {
				throw new Error("The tracer shall never call this!");
			},
			*follow() {
				while (this.depth-- > 1) yield this;
			},
		} as ITransparent;

		const tracer = new RK_NodeTracer(start_node);

		const all = Array.from(tracer.all());

		expect(all.length).toEqual(count);
	});

	it("configs collects opaque nodes", () => {
		const count: number = 6 + Math.trunc(Math.random() * 4);
		const start_node = {
			depth: count,
			isTransparent() {
				return (this.depth % 2) != 0;
			},
			getConfiguration(): Configuration {
				throw new Error("The tracer shall never call this!");
			},
			*follow() {
				while (this.depth-- > 1) yield this;
			},
		} as ITransparent;

		const tracer = new RK_NodeTracer(start_node);

		const opaque = Array.from(tracer.configs());

		expect(opaque.length).toEqual(Math.trunc(count / 2));
	});
});
