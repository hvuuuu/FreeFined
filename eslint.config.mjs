import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    ignores: ["public/models/*.onnx"],
  },
  {
    files: ["app/page.tsx", "components/theme-toggle.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
