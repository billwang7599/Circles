import { defineConfig } from "eslint/config";
import expo from "eslint-config-expo/flat.js";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["app/dist/", "app/.expo/"] },
  tseslint.configs.recommended,
  {
    files: ["app/**"],
    extends: [expo],
    settings: { react: { version: "19" } },
  },
  { files: ["api/**"], rules: { "no-console": "error" } },
);
