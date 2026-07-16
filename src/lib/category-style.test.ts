import { describe, expect, it } from "vitest";
import { categoryVisualStyle, resolveCategoryPaletteKey } from "@/lib/category-style";

describe("category visual styles", () => {
  it("uses stored palettes when available", () => {
    expect(resolveCategoryPaletteKey("violet-indigo", "Housing")).toBe("violet-indigo");
    expect(categoryVisualStyle({ name: "Housing", color: "#9B6CFF", paletteKey: "violet-indigo" })).toMatchObject({
      "--category": "#9B6CFF",
      "--category-start": "#b57aff",
      "--category-end": "#7155f5",
    });
  });

  it("infers a useful palette for legacy and slate categories", () => {
    expect(resolveCategoryPaletteKey("slate", "Groceries")).toBe("cyan-teal");
    expect(resolveCategoryPaletteKey(undefined, "Paycheck")).toBe("lime-emerald");
  });
});
