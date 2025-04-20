import { EditorView, basicSetup } from "https://esm.sh/@codemirror/basic-setup";
import { javascript } from "https://esm.sh/@codemirror/lang-javascript";
import { lineNumbers } from "https://esm.sh/@codemirror/gutter";

window.addEventListener("DOMContentLoaded", () => {
  new EditorView({
    doc: "Hello World!",
    extensions: [
      basicSetup,
      javascript(),
      lineNumbers()
    ],
    parent: document.getElementById("editor")
  });
});
