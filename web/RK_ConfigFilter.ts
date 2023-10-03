import { RK_ConfigConstrainer } from "./RK_ConfigConstrainer.js";
import { Configuration, INodeTracer } from "./RK_NodeTracer.js";

export class RK_ConfigFilter {
	configuration: Configuration = null;

	getConfiguration(): Configuration {
		return this.configuration;
	}

	triggerUpdate(node_tracer: INodeTracer) {
        const constrainer = new RK_ConfigConstrainer(Array.from(node_tracer.configs()));
        this.configuration = constrainer.getConfiguration();
	}
}
