
export class RK_ComboFilter {
	#properties: { filter_expression: RegExp; original: string[]; filtered: string[]; };

	constructor(content: string[]) {
		this.#properties = {
			filter_expression: /.*/,
			original: content,
			filtered: content,
		};
	}

	updateFilter(value: string) {
		this.#properties.filter_expression = RegExp(value);
		this.#properties.filtered = this.#properties.original.filter((value) => this.#properties.filter_expression.test(value)
		);
	}

	getValues() {
		return this.#properties.filtered;
	}
}
