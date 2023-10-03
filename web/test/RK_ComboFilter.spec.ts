import { RK_ComboFilter } from "../RK_ComboFilter.js";

describe("Test RK_ComboFilter", () => {
	it("WorksWithEmptyContent", () => {
		const filter = new RK_ComboFilter([]);

		expect(filter.getValues()).toHaveSize(0);
		expect(() => filter.updateFilter("")).not.toThrow();
		expect(filter.getValues()).toHaveSize(0);
		expect(() => filter.updateFilter("\\xl")).not.toThrow();
		expect(filter.getValues()).toHaveSize(0);
	});

	it("ThrowsOnInvalidFilter", () => {
		const filter = new RK_ComboFilter([]);
		expect(() => filter.updateFilter("not an re [}")).toThrow();
	});

	it("ConstructionAcceptsAnArrayOfString", () => {
		const content = ["1", `foo`, Number(1).toString()];
		const filter = new RK_ComboFilter(content);

		expect(filter.getValues()).toEqual(content);
	});

	it("FiltersContentByRe", () => {
		const content = ["first", "value_with_sub", "last"];
		const filter = new RK_ComboFilter(content);

		filter.updateFilter(".*sub.*");
		expect(filter.getValues()).toEqual(["value_with_sub"]);

		filter.updateFilter(".*st.*");
		expect(filter.getValues()).toEqual(["first", "last"]);
	});
});
