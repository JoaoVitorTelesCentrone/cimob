import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renderiza o texto com as classes do primário e repassa props", () => {
    const html = renderToStaticMarkup(createElement(Button, { type: "submit" }, "Enviar"));
    expect(html).toContain("Enviar");
    expect(html).toContain('type="submit"');
    expect(html).toContain("bg-brand");
  });

  it("deixa a classe do chamador vencer a do variant", () => {
    const html = renderToStaticMarkup(createElement(Button, { className: "h-12" }, "Ok"));
    expect(html).toContain("h-12");
    expect(html).not.toContain("h-10");
  });
});
