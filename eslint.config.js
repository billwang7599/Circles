import { defineConfig } from "eslint/config";
import expo from "eslint-config-expo/flat.js";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["mobile/dist/", "mobile/.expo/", "web/dist/"] },
  tseslint.configs.recommended,
  {
    files: ["mobile/**"],
    extends: [expo],
    settings: { react: { version: "19" } },
  },
  { files: ["api/**"], rules: { "no-console": "error" } },
);
